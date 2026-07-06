from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from ..auth import CurrentUser, get_current_user
from ..deps import get_user_scoped_db
from ..schemas import (
    CalculateLeaseRequest,
    CalculateLeaseResponse,
    JournalEntryOut,
    LeaseCreate,
    LeaseOut,
    LeaseUpdate,
    LiabilityScheduleRowOut,
    ModificationOut,
    ModificationRequest,
    RouScheduleRowOut,
)
from ..services import audit_service, journal_service, lease_service

router = APIRouter(prefix="/leases", tags=["leases"])


@router.get("", response_model=list[LeaseOut])
def list_leases(db: Client = Depends(get_user_scoped_db)):
    return db.table("leases").select("*").order("created_at", desc=True).execute().data


@router.post("", response_model=LeaseOut, status_code=201)
def create_lease(
    payload: LeaseCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    # mode="json" gives Supabase-safe primitives: UUID/date -> str, Decimal -> str.
    body = payload.model_dump(mode="json")
    body["created_by"] = user.user_id
    result = db.table("leases").insert(body).execute()
    lease = result.data[0]
    audit_service.log_action(db, user.user_id, "CREATE", "lease", lease["id"], after=lease)
    return lease


@router.get("/{lease_id}", response_model=LeaseOut)
def get_lease(lease_id: UUID, db: Client = Depends(get_user_scoped_db)):
    result = db.table("leases").select("*").eq("id", str(lease_id)).single().execute()
    if not result.data:
        raise HTTPException(404, "Lease not found")
    return result.data


@router.patch("/{lease_id}", response_model=LeaseOut)
def update_lease(
    lease_id: UUID,
    payload: LeaseUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    before = db.table("leases").select("*").eq("id", str(lease_id)).single().execute().data
    if not before:
        raise HTTPException(404, "Lease not found")
    updates = payload.model_dump(exclude_unset=True)
    result = db.table("leases").update(updates).eq("id", str(lease_id)).execute()
    after = result.data[0]
    audit_service.log_action(db, user.user_id, "UPDATE", "lease", lease_id, before=before, after=after)
    return after


@router.post("/{lease_id}/calculate", response_model=CalculateLeaseResponse)
def calculate_lease(
    lease_id: UUID,
    payload: CalculateLeaseRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    lease = db.table("leases").select("*").eq("id", str(lease_id)).single().execute().data
    if not lease:
        raise HTTPException(404, "Lease not found")

    from datetime import date as _date
    lease["commencement_date"] = _date.fromisoformat(lease["commencement_date"])

    overrides = {o.period_number: o.amount for o in payload.payment_overrides}
    result = lease_service.calculate_lease(db, lease, overrides, user.user_id)
    audit_service.log_action(db, user.user_id, "CALCULATE", "lease", lease_id)
    return CalculateLeaseResponse(
        lease_liability=result["lease_liability"],
        rou_asset=result["rou_asset"],
        liability_schedule=[LiabilityScheduleRowOut(**row.__dict__) for row in result["liability_schedule"]],
        rou_schedule=[RouScheduleRowOut(**row.__dict__) for row in result["rou_schedule"]],
    )


@router.get("/{lease_id}/liability-schedule", response_model=list[LiabilityScheduleRowOut])
def get_liability_schedule(lease_id: UUID, db: Client = Depends(get_user_scoped_db)):
    return (
        db.table("lease_liability_schedule")
        .select("*")
        .eq("lease_id", str(lease_id))
        .order("period_number")
        .execute()
        .data
    )


@router.get("/{lease_id}/rou-schedule", response_model=list[RouScheduleRowOut])
def get_rou_schedule(lease_id: UUID, db: Client = Depends(get_user_scoped_db)):
    return (
        db.table("rou_asset_schedule")
        .select("*")
        .eq("lease_id", str(lease_id))
        .order("period_number")
        .execute()
        .data
    )


@router.post("/{lease_id}/journals/period/{period_number}", response_model=list[JournalEntryOut])
def generate_period_journals(
    lease_id: UUID,
    period_number: int,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    liability_row = (
        db.table("lease_liability_schedule")
        .select("*")
        .eq("lease_id", str(lease_id))
        .eq("period_number", period_number)
        .single()
        .execute()
        .data
    )
    rou_row = (
        db.table("rou_asset_schedule")
        .select("*")
        .eq("lease_id", str(lease_id))
        .eq("period_number", period_number)
        .single()
        .execute()
        .data
    )
    if not liability_row or not rou_row:
        raise HTTPException(404, "Schedule rows not found for this period; run /calculate first")

    entries = journal_service.create_period_journals(db, lease_id, liability_row, rou_row, user.user_id)
    entry_ids = [e["id"] for e in entries]
    lines_by_entry: dict[str, list] = {eid: [] for eid in entry_ids}
    lines = db.table("journal_lines").select("*").in_("journal_entry_id", entry_ids).execute().data
    for line in lines:
        lines_by_entry[line["journal_entry_id"]].append(line)
    return [JournalEntryOut(**e, lines=lines_by_entry[e["id"]]) for e in entries]


@router.get("/{lease_id}/journals", response_model=list[JournalEntryOut])
def list_journals(lease_id: UUID, db: Client = Depends(get_user_scoped_db)):
    entries = (
        db.table("journal_entries")
        .select("*")
        .eq("lease_id", str(lease_id))
        .order("entry_date")
        .execute()
        .data
    )
    if not entries:
        return []
    entry_ids = [e["id"] for e in entries]
    lines = db.table("journal_lines").select("*").in_("journal_entry_id", entry_ids).execute().data
    lines_by_entry: dict[str, list] = {eid: [] for eid in entry_ids}
    for line in lines:
        lines_by_entry[line["journal_entry_id"]].append(line)
    return [JournalEntryOut(**e, lines=lines_by_entry[e["id"]]) for e in entries]


@router.post("/{lease_id}/modify", response_model=ModificationOut)
def modify_lease(
    lease_id: UUID,
    payload: ModificationRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    from datetime import date as _date

    from ..engine.models import PaymentFrequency, PaymentTiming
    from ..engine.remeasurement import full_termination, partial_termination, remeasure_for_modification
    from ..services.lease_service import _build_payments

    lease = db.table("leases").select("*").eq("id", str(lease_id)).single().execute().data
    if not lease:
        raise HTTPException(404, "Lease not found")
    lease["commencement_date"] = _date.fromisoformat(lease["commencement_date"])

    latest_liability = (
        db.table("lease_liability_schedule")
        .select("*")
        .eq("lease_id", str(lease_id))
        .order("period_number", desc=True)
        .limit(1)
        .execute()
        .data
    )
    latest_rou = (
        db.table("rou_asset_schedule")
        .select("*")
        .eq("lease_id", str(lease_id))
        .order("period_number", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if not latest_liability or not latest_rou:
        raise HTTPException(400, "Lease has not been calculated yet; run /calculate first")

    liability_before = Decimal(str(latest_liability[0]["closing_liability"]))
    rou_before = Decimal(str(latest_rou[0]["closing_nbv"]))

    if payload.modification_type == "FULL_TERMINATION":
        result = full_termination(liability_before, rou_before)
    elif payload.modification_type in ("SCOPE_DECREASE", "PARTIAL_TERMINATION"):
        if payload.reduction_ratio is None:
            raise HTTPException(400, "reduction_ratio is required for a scope decrease / partial termination")
        result = partial_termination(liability_before, rou_before, payload.reduction_ratio)
    else:
        revised_lease = dict(lease)
        if payload.revised_term_months:
            revised_lease["lease_term_months"] = payload.revised_term_months
        if payload.revised_payment_amount:
            revised_lease["base_payment_amount"] = payload.revised_payment_amount
        revised_payments = _build_payments(revised_lease, {})
        revised_rate = payload.revised_discount_rate or Decimal(str(lease["discount_rate_annual"]))
        result = remeasure_for_modification(
            liability_before,
            revised_payments,
            revised_rate,
            PaymentFrequency(lease["payment_frequency"]),
            PaymentTiming(lease["payment_timing"]),
            rou_before,
        )

    modification = (
        db.table("lease_modifications")
        .insert(
            {
                "lease_id": str(lease_id),
                "modification_date": payload.modification_date.isoformat(),
                "modification_type": payload.modification_type,
                "description": payload.description,
                "revised_discount_rate": str(payload.revised_discount_rate) if payload.revised_discount_rate else None,
                "revised_term_months": payload.revised_term_months,
                "revised_payment_amount": str(payload.revised_payment_amount) if payload.revised_payment_amount else None,
                "liability_before": str(result.liability_before),
                "liability_after": str(result.liability_after),
                "rou_adjustment": str(result.rou_adjustment),
                "gain_loss_on_termination": str(result.gain_loss_on_termination),
                "created_by": user.user_id,
            }
        )
        .execute()
        .data[0]
    )

    journal_service.create_remeasurement_journal(
        db,
        lease_id,
        payload.modification_date,
        result.rou_adjustment,
        result.liability_after,
        result.liability_before,
        result.gain_loss_on_termination,
        user.user_id,
    )

    if payload.modification_type == "FULL_TERMINATION":
        db.table("leases").update({"status": "TERMINATED"}).eq("id", str(lease_id)).execute()
    else:
        db.table("leases").update({"status": "MODIFIED"}).eq("id", str(lease_id)).execute()

    audit_service.log_action(db, user.user_id, "MODIFY", "lease", lease_id, after=modification)
    return modification
