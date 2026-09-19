import re
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from supabase import Client

from ..auth import CurrentUser, get_current_user
from ..deps import get_service_db, get_user_scoped_db
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

_DOC_BUCKET = "lease-documents"
_ALLOWED_DOC_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_MAX_DOC_BYTES = 25 * 1024 * 1024


def _safe_filename(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", name or "agreement")[:120]


@router.post("/{lease_id}/document")
async def upload_lease_document(
    lease_id: UUID,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
    admin_db: Client = Depends(get_service_db),
):
    """Attach the master lease agreement to a lease. Ownership is enforced via
    the user-scoped client; the file is stored in a private bucket by the
    service role."""
    lease = db.table("leases").select("id, org_id").eq("id", str(lease_id)).single().execute().data
    if not lease:
        raise HTTPException(404, "Lease not found")
    if file.content_type not in _ALLOWED_DOC_TYPES:
        raise HTTPException(400, "Upload a PDF, Word document, or image of the lease agreement.")

    contents = await file.read()
    if len(contents) > _MAX_DOC_BYTES:
        raise HTTPException(413, "File too large (max 25 MB).")

    filename = _safe_filename(file.filename or "agreement")
    path = f"{lease['org_id']}/{lease_id}/{filename}"
    admin_db.storage.from_(_DOC_BUCKET).upload(
        path, contents, {"content-type": file.content_type or "application/octet-stream", "upsert": "true"}
    )
    db.table("leases").update({"agreement_path": path, "agreement_filename": filename}).eq("id", str(lease_id)).execute()
    audit_service.log_action(db, user.user_id, "UPLOAD_DOCUMENT", "lease", lease_id, after={"filename": filename})
    return {"filename": filename}


@router.get("/{lease_id}/document")
def get_lease_document_url(
    lease_id: UUID,
    db: Client = Depends(get_user_scoped_db),
    admin_db: Client = Depends(get_service_db),
):
    """Return a short-lived signed URL for the lease's agreement, or 404."""
    lease = db.table("leases").select("agreement_path, agreement_filename").eq("id", str(lease_id)).single().execute().data
    if not lease or not lease.get("agreement_path"):
        raise HTTPException(404, "No agreement uploaded for this lease")
    signed = admin_db.storage.from_(_DOC_BUCKET).create_signed_url(lease["agreement_path"], 3600)
    url = signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")
    return {"url": url, "filename": lease["agreement_filename"]}


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


@router.post("/{lease_id}/journals/generate-all")
def generate_all_journals(
    lease_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_user_scoped_db),
):
    """Regenerate the full set of derived monthly journals for a lease from its
    computed schedules: initial recognition, then every period's interest +
    payment and ROU depreciation, plus each security deposit's recognition and
    monthly unwinding. Idempotent -- clears prior derived entries first."""
    lease = db.table("leases").select("*").eq("id", str(lease_id)).single().execute().data
    if not lease:
        raise HTTPException(404, "Lease not found")

    liability_rows = (
        db.table("lease_liability_schedule").select("*").eq("lease_id", str(lease_id)).order("period_number").execute().data
    )
    rou_rows = (
        db.table("rou_asset_schedule").select("*").eq("lease_id", str(lease_id)).order("period_number").execute().data
    )
    if not liability_rows or not rou_rows:
        raise HTTPException(400, "Lease has not been calculated yet; run /calculate first")

    from datetime import date as _date

    journal_service.delete_derived_journals(db, lease_id)
    org_id = lease["org_id"]

    counts = {"initial_recognition": 0, "period_entries": 0, "deposit_entries": 0}

    journal_service.create_initial_recognition_journal(
        db, lease_id, _date.fromisoformat(lease["commencement_date"]),
        Decimal(str(rou_rows[0]["opening_nbv"])),
        Decimal(str(liability_rows[0]["opening_liability"])),
        Decimal(str(lease["initial_direct_costs"])),
        Decimal(str(lease["prepaid_rent"])),
        Decimal(str(lease["lease_incentives"])),
        Decimal(str(lease["restoration_cost_estimate"])),
        user.user_id,
    )
    counts["initial_recognition"] = 1

    rou_by_period = {r["period_number"]: r for r in rou_rows}
    for liab in liability_rows:
        rou = rou_by_period.get(liab["period_number"])
        if rou:
            journal_service.create_period_journals(db, lease_id, liab, rou, user.user_id)
            counts["period_entries"] += 2

    deposits = db.table("security_deposits").select("*").eq("lease_id", str(lease_id)).execute().data
    for dep in deposits:
        journal_service.create_security_deposit_initial_journal(
            db, lease_id, _date.fromisoformat(dep["paid_date"]),
            Decimal(str(dep["deposit_amount"])), Decimal(str(dep["present_value"])),
            Decimal(str(dep["prepaid_rent_component"])), user.user_id, org_id=org_id,
        )
        counts["deposit_entries"] += 1
        sched = (
            db.table("security_deposit_schedule").select("*").eq("security_deposit_id", dep["id"]).order("period_number").execute().data
        )
        entries = journal_service.create_security_deposit_period_journals(
            db, lease_id, sched, Decimal(str(dep["prepaid_rent_component"])), user.user_id, org_id=org_id,
        )
        counts["deposit_entries"] += len(entries)

    audit_service.log_action(db, user.user_id, "GENERATE_JOURNALS", "lease", lease_id, after=counts)
    total = counts["initial_recognition"] + counts["period_entries"] + counts["deposit_entries"]
    return {"total_entries": total, **counts}


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
