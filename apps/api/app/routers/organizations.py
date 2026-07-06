from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from ..auth import CurrentUser, get_current_user
from ..deps import get_user_scoped_db
from ..schemas import OrganizationOut, OrganizationUpdate

router = APIRouter(prefix="/organizations", tags=["organizations"])


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
