from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from ..auth import CurrentUser, get_current_user
from ..deps import get_user_scoped_db
from ..engine.security_deposit import compute_security_deposit
from ..schemas import SecurityDepositCreate, SecurityDepositOut
from ..services import audit_service

router = APIRouter(prefix="/leases/{lease_id}/security-deposits", tags=["security-deposits"])


@router.get("", response_model=list[SecurityDepositOut])
def list_security_deposits(lease_id: UUID, db: Client = Depends(get_user_scoped_db)):
    return db.table("security_deposits").select("*").eq("lease_id", str(lease_id)).execute().data


@router.post("", response_model=SecurityDepositOut, status_code=201)
def create_security_deposit(
    lease_id: UUID,
    payload: SecurityDepositCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    lease = db.table("leases").select("id").eq("id", str(lease_id)).single().execute().data
    if not lease:
        raise HTTPException(404, "Lease not found")

    result = compute_security_deposit(
        payload.deposit_amount, payload.paid_date, payload.expected_refund_date, payload.discount_rate_annual
    )

    row = (
        db.table("security_deposits")
        .insert(
            {
                "lease_id": str(lease_id),
                "deposit_amount": str(payload.deposit_amount),
                "paid_date": payload.paid_date.isoformat(),
                "refundable": payload.refundable,
                "expected_refund_date": payload.expected_refund_date.isoformat(),
                "discount_rate_annual": str(payload.discount_rate_annual),
                "present_value": str(result.present_value),
                "prepaid_rent_component": str(result.prepaid_rent_component),
            }
        )
        .execute()
        .data[0]
    )

    db.table("security_deposit_schedule").insert(
        [
            {
                "security_deposit_id": row["id"],
                "period_number": r.period_number,
                "period_date": r.period_date.isoformat(),
                "opening_balance": str(r.opening_balance),
                "interest_income": str(r.interest_income),
                "closing_balance": str(r.closing_balance),
            }
            for r in result.schedule
        ]
    ).execute()

    audit_service.log_action(db, user.user_id, "CREATE", "security_deposit", row["id"], after=row)
    return row


@router.get("/{deposit_id}/schedule")
def get_security_deposit_schedule(lease_id: UUID, deposit_id: UUID, db: Client = Depends(get_user_scoped_db)):
    return (
        db.table("security_deposit_schedule")
        .select("*")
        .eq("security_deposit_id", str(deposit_id))
        .order("period_number")
        .execute()
        .data
    )
