from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from supabase import Client

from ..deps import get_user_scoped_db
from ..engine.disclosures import maturity_analysis, total_cash_outflow, weighted_average_discount_rate
from ..engine.models import PaymentLine
from ..schemas import DisclosureSummary, MaturityBucketOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/lease-register")
def lease_register(db: Client = Depends(get_user_scoped_db)):
    """One row per lease with its lessor and current ROU/liability balances."""
    leases = db.table("leases").select("*, lessors(name)").order("lease_code").execute().data
    register = []
    for lease in leases:
        latest_liability = (
            db.table("lease_liability_schedule")
            .select("closing_liability")
            .eq("lease_id", lease["id"])
            .order("period_number", desc=True)
            .limit(1)
            .execute()
            .data
        )
        latest_rou = (
            db.table("rou_asset_schedule")
            .select("closing_nbv")
            .eq("lease_id", lease["id"])
            .order("period_number", desc=True)
            .limit(1)
            .execute()
            .data
        )
        register.append(
            {
                **lease,
                "current_lease_liability": latest_liability[0]["closing_liability"] if latest_liability else None,
                "current_rou_nbv": latest_rou[0]["closing_nbv"] if latest_rou else None,
            }
        )
    return register


@router.get("/rou-register")
def rou_register(db: Client = Depends(get_user_scoped_db)):
    leases = db.table("leases").select("id, lease_code, asset_name, asset_category").execute().data
    result = []
    for lease in leases:
        schedule = (
            db.table("rou_asset_schedule")
            .select("*")
            .eq("lease_id", lease["id"])
            .order("period_number")
            .execute()
            .data
        )
        result.append({**lease, "schedule": schedule})
    return result


@router.get("/liability-rollforward")
def liability_rollforward(db: Client = Depends(get_user_scoped_db)):
    leases = db.table("leases").select("id, lease_code, asset_name").execute().data
    result = []
    for lease in leases:
        schedule = (
            db.table("lease_liability_schedule")
            .select("*")
            .eq("lease_id", lease["id"])
            .order("period_number")
            .execute()
            .data
        )
        result.append({**lease, "schedule": schedule})
    return result


@router.get("/security-deposit-register")
def security_deposit_register(db: Client = Depends(get_user_scoped_db)):
    leases = db.table("leases").select("id, lease_code, asset_name").execute().data
    result = []
    for lease in leases:
        deposits = db.table("security_deposits").select("*").eq("lease_id", lease["id"]).execute().data
        if deposits:
            result.append({**lease, "deposits": deposits})
    return result


@router.get("/disclosures", response_model=DisclosureSummary)
def disclosures(
    as_of_date: date = Query(default_factory=date.today),
    db: Client = Depends(get_user_scoped_db),
):
    leases = db.table("leases").select("id, discount_rate_annual").eq("status", "ACTIVE").execute().data

    all_payments: list[PaymentLine] = []
    wadr_inputs: list[tuple[Decimal, Decimal]] = []
    total_liability = Decimal("0")
    total_rou = Decimal("0")
    period_cash_outflows: list[Decimal] = []

    for lease in leases:
        payments = db.table("lease_payment_schedule").select("*").eq("lease_id", lease["id"]).execute().data
        for p in payments:
            all_payments.append(
                PaymentLine(
                    period_number=p["period_number"],
                    due_date=date.fromisoformat(p["due_date"]),
                    amount=Decimal(str(p["payment_amount"])),
                )
            )

        latest_liability = (
            db.table("lease_liability_schedule")
            .select("closing_liability, payment, period_end")
            .eq("lease_id", lease["id"])
            .order("period_number", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if latest_liability:
            balance = Decimal(str(latest_liability[0]["closing_liability"]))
            total_liability += balance
            wadr_inputs.append((balance, Decimal(str(lease["discount_rate_annual"]))))

        latest_rou = (
            db.table("rou_asset_schedule")
            .select("closing_nbv")
            .eq("lease_id", lease["id"])
            .order("period_number", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if latest_rou:
            total_rou += Decimal(str(latest_rou[0]["closing_nbv"]))

        ytd_rows = (
            db.table("lease_liability_schedule")
            .select("payment, period_end")
            .eq("lease_id", lease["id"])
            .lte("period_end", as_of_date.isoformat())
            .gte("period_end", date(as_of_date.year, 1, 1).isoformat())
            .execute()
            .data
        )
        period_cash_outflows.extend(Decimal(str(r["payment"])) for r in ytd_rows)

    return DisclosureSummary(
        total_rou_asset_nbv=total_rou,
        total_lease_liability=total_liability,
        weighted_average_discount_rate=weighted_average_discount_rate(wadr_inputs),
        maturity_analysis=[
            MaturityBucketOut(**bucket.__dict__) for bucket in maturity_analysis(all_payments, as_of_date)
        ],
        total_cash_outflow_ytd=total_cash_outflow(period_cash_outflows),
    )


@router.get("/audit-trail")
def audit_trail(
    entity_type: str | None = None,
    limit: int = 100,
    db: Client = Depends(get_user_scoped_db),
):
    query = db.table("audit_log").select("*").order("created_at", desc=True).limit(limit)
    if entity_type:
        query = query.eq("entity_type", entity_type)
    return query.execute().data
