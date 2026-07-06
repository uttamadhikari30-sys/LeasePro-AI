from decimal import Decimal
from uuid import UUID

from supabase import Client

from ..engine.amortization import build_liability_schedule
from ..engine.dates import add_months
from ..engine.depreciation import build_rou_schedule
from ..engine.initial_recognition import compute_initial_recognition
from ..engine.models import EscalationType, PaymentFrequency, PaymentLine, PaymentTiming
from ..engine.schedule import apply_overrides, generate_payment_schedule
from . import journal_service


def _build_payments(lease: dict, overrides: dict[int, Decimal]) -> list[PaymentLine]:
    payments = generate_payment_schedule(
        commencement_date=lease["commencement_date"],
        lease_term_months=lease["lease_term_months"],
        frequency=PaymentFrequency(lease["payment_frequency"]),
        timing=PaymentTiming(lease["payment_timing"]),
        base_payment_amount=Decimal(str(lease["base_payment_amount"])),
        escalation_type=EscalationType(lease["escalation_type"]),
        escalation_percent=Decimal(str(lease["escalation_percent"])),
        escalation_frequency_months=lease["escalation_frequency_months"],
    )
    if overrides:
        payments = apply_overrides(payments, overrides)
    return payments


def calculate_lease(db: Client, lease: dict, overrides: dict[int, Decimal], user_id: str) -> dict:
    """Runs the Ind AS 116/IFRS 16 engine for a lease and persists the
    resulting payment/liability/ROU schedules, replacing any prior
    calculation. Also books the initial recognition journal entry.
    """
    lease_id = lease["id"]
    frequency = PaymentFrequency(lease["payment_frequency"])
    timing = PaymentTiming(lease["payment_timing"])
    commencement_date = lease["commencement_date"]

    payments = _build_payments(lease, overrides)

    initial = compute_initial_recognition(
        payments,
        annual_discount_rate=Decimal(str(lease["discount_rate_annual"])),
        frequency=frequency,
        timing=timing,
        initial_direct_costs=Decimal(str(lease["initial_direct_costs"])),
        lease_incentives=Decimal(str(lease["lease_incentives"])),
        restoration_cost_estimate=Decimal(str(lease["restoration_cost_estimate"])),
        prepaid_rent=Decimal(str(lease["prepaid_rent"])),
    )

    liability_schedule = build_liability_schedule(
        payments,
        commencement_date,
        frequency,
        Decimal(str(lease["discount_rate_annual"])),
        timing,
        opening_liability=initial.lease_liability,
    )

    lease_term_end = add_months(commencement_date, lease["lease_term_months"])
    if lease.get("useful_life_months"):
        useful_life_end = add_months(commencement_date, lease["useful_life_months"])
        depreciation_end = min(lease_term_end, useful_life_end)
    else:
        depreciation_end = lease_term_end

    rou_schedule = build_rou_schedule(
        rou_asset_initial=initial.rou_asset,
        commencement_date=commencement_date,
        depreciation_end_date=depreciation_end,
        period_months=1,
    )

    # Replace any prior calculation for this lease.
    db.table("lease_payment_schedule").delete().eq("lease_id", lease_id).execute()
    db.table("lease_liability_schedule").delete().eq("lease_id", lease_id).is_("modification_id", "null").execute()
    db.table("rou_asset_schedule").delete().eq("lease_id", lease_id).is_("modification_id", "null").execute()

    db.table("lease_payment_schedule").insert(
        [
            {
                "lease_id": lease_id,
                "period_number": p.period_number,
                "due_date": p.due_date.isoformat(),
                "payment_amount": str(p.amount),
                "is_override": p.period_number in overrides,
            }
            for p in payments
        ]
    ).execute()

    db.table("lease_liability_schedule").insert(
        [
            {
                "lease_id": lease_id,
                "period_number": row.period_number,
                "period_start": row.period_start.isoformat(),
                "period_end": row.period_end.isoformat(),
                "opening_liability": str(row.opening_liability),
                "interest_expense": str(row.interest_expense),
                "payment": str(row.payment),
                "closing_liability": str(row.closing_liability),
            }
            for row in liability_schedule
        ]
    ).execute()

    db.table("rou_asset_schedule").insert(
        [
            {
                "lease_id": lease_id,
                "period_number": row.period_number,
                "period_start": row.period_start.isoformat(),
                "period_end": row.period_end.isoformat(),
                "opening_nbv": str(row.opening_nbv),
                "depreciation": str(row.depreciation),
                "impairment": str(row.impairment),
                "closing_nbv": str(row.closing_nbv),
            }
            for row in rou_schedule
        ]
    ).execute()

    journal_service.create_initial_recognition_journal(
        db,
        lease_id=lease_id,
        entry_date=commencement_date,
        rou_asset=initial.rou_asset,
        lease_liability=initial.lease_liability,
        initial_direct_costs=initial.initial_direct_costs,
        prepaid_rent=initial.prepaid_rent,
        lease_incentives=initial.lease_incentives,
        restoration_cost_estimate=initial.restoration_cost_estimate,
        user_id=user_id,
    )

    db.table("leases").update({"status": "ACTIVE"}).eq("id", lease_id).execute()

    return {
        "lease_liability": initial.lease_liability,
        "rou_asset": initial.rou_asset,
        "liability_schedule": liability_schedule,
        "rou_schedule": rou_schedule,
    }
