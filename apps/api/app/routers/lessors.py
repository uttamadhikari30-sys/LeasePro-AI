from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from ..auth import CurrentUser, get_current_user
from ..deps import get_user_scoped_db
from ..schemas import LessorCreate, LessorOut
from ..services import audit_service

router = APIRouter(prefix="/lessors", tags=["lessors"])


@router.get("", response_model=list[LessorOut])
def list_lessors(db: Client = Depends(get_user_scoped_db)):
    return db.table("lessors").select("*").order("name").execute().data


@router.post("", response_model=LessorOut, status_code=201)
def create_lessor(
    payload: LessorCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    result = db.table("lessors").insert(payload.model_dump(exclude_unset=True)).execute()
    lessor = result.data[0]
    audit_service.log_action(db, user.user_id, "CREATE", "lessor", lessor["id"], after=lessor)
    return lessor


@router.get("/{lessor_id}", response_model=LessorOut)
def get_lessor(lessor_id: UUID, db: Client = Depends(get_user_scoped_db)):
    result = db.table("lessors").select("*").eq("id", str(lessor_id)).single().execute()
    if not result.data:
        raise HTTPException(404, "Lessor not found")
    return result.data


@router.patch("/{lessor_id}", response_model=LessorOut)
def update_lessor(
    lessor_id: UUID,
    payload: LessorCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    before = db.table("lessors").select("*").eq("id", str(lessor_id)).single().execute().data
    if not before:
        raise HTTPException(404, "Lessor not found")
    result = (
        db.table("lessors")
        .update(payload.model_dump(exclude_unset=True))
        .eq("id", str(lessor_id))
        .execute()
    )
    after = result.data[0]
    audit_service.log_action(db, user.user_id, "UPDATE", "lessor", lessor_id, before=before, after=after)
    return after


@router.delete("/{lessor_id}", status_code=204)
def delete_lessor(
    lessor_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    before = db.table("lessors").select("*").eq("id", str(lessor_id)).single().execute().data
    if not before:
        raise HTTPException(404, "Lessor not found")
    db.table("lessors").delete().eq("id", str(lessor_id)).execute()
    audit_service.log_action(db, user.user_id, "DELETE", "lessor", lessor_id, before=before)
