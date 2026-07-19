import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from ..auth import CurrentUser, get_current_user
from ..deps import get_service_db, get_user_scoped_db
from ..schemas import OrganizationOut, OrganizationUpdate, ProfileOut, UserCreate, UserCreateResponse
from ..services import audit_service

router = APIRouter(prefix="/organizations", tags=["organizations"])


def _require_admin(db: Client, user_id: str) -> dict:
    """Loads the caller's profile and raises 403 unless they're an org ADMIN."""
    profile = db.table("profiles").select("*").eq("id", user_id).single().execute().data
    if not profile:
        raise HTTPException(404, "No profile found for current user")
    if profile["role"] != "ADMIN":
        raise HTTPException(403, "Only organization admins can manage users")
    return profile


class BootstrapRequest(BaseModel):
    organization_name: str
    full_name: str
    reporting_standard: str = "IND_AS_116"


@router.post("/bootstrap")
def bootstrap_organization(
    payload: BootstrapRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    """Called once right after a new Supabase auth signup, using that user's
    own access token, to create their organization + ADMIN profile."""
    result = db.rpc(
        "create_organization_with_admin",
        {
            "p_org_name": payload.organization_name,
            "p_user_id": user.user_id,
            "p_full_name": payload.full_name,
            "p_reporting_standard": payload.reporting_standard,
        },
    ).execute()
    return {"organization_id": result.data}


@router.get("/me", response_model=OrganizationOut)
def get_my_organization(db: Client = Depends(get_user_scoped_db)):
    result = db.table("organizations").select("*").single().execute()
    if not result.data:
        raise HTTPException(404, "No organization found for current user")
    return result.data


@router.patch("/me", response_model=OrganizationOut)
def update_my_organization(payload: OrganizationUpdate, db: Client = Depends(get_user_scoped_db)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not updates:
        return get_my_organization(db)
    org = db.table("organizations").select("id").single().execute().data
    result = db.table("organizations").update(updates).eq("id", org["id"]).execute()
    return result.data[0]


@router.get("/me/profile", response_model=ProfileOut)
def get_my_profile(
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    result = db.table("profiles").select("*").eq("id", user.user_id).single().execute()
    if not result.data:
        raise HTTPException(404, "No profile found for current user")
    return result.data


@router.get("/users", response_model=list[ProfileOut])
def list_org_users(db: Client = Depends(get_user_scoped_db)):
    # RLS (profiles_same_org) already scopes this to the caller's org.
    return db.table("profiles").select("*").order("created_at").execute().data


@router.post("/users", response_model=UserCreateResponse, status_code=201)
def create_org_user(
    payload: UserCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
    admin_db: Client = Depends(get_service_db),
):
    """Admin-only: provisions a new user for the caller's organization.
    LeasePro AI has no public signup -- this is the only way a new user
    account gets created after the org's first admin is bootstrapped."""
    caller_profile = _require_admin(db, user.user_id)

    temp_password = secrets.token_urlsafe(12)
    created = admin_db.auth.admin.create_user(
        {
            "email": payload.email,
            "password": temp_password,
            "email_confirm": True,
        }
    )
    new_user_id = created.user.id

    admin_db.table("profiles").insert(
        {
            "id": new_user_id,
            "org_id": caller_profile["org_id"],
            "full_name": payload.full_name,
            "role": payload.role,
        }
    ).execute()

    audit_service.log_action(
        db, user.user_id, "CREATE", "user", new_user_id, after={"email": payload.email, "role": payload.role}
    )

    return UserCreateResponse(
        id=new_user_id,
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        temporary_password=temp_password,
    )
