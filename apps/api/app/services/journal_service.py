from datetime import date
from decimal import Decimal
from uuid import UUID

from supabase import Client


def _lease_org_id(db: Client, lease_id: UUID) -> str:
    """journal_entries.org_id is NOT NULL and RLS-checked, so every entry must
    carry the owning organization. Derive it from the lease."""
    row = db.table("leases").select("org_id").eq("id", str(lease_id)).single().execute().data
    return row["org_id"]


def _insert_entry(
    db: Client,
    lease_id: UUID,
    entry_date: date,
    entry_type: str,
    narration: str,
    user_id: str,
    lines: list[dict],
    org_id: str | None = None,
) -> dict:
    entry = (
        db.table("journal_entries")
        .insert(
            {
                "org_id": org_id or _lease_org_id(db, lease_id),
                "lease_id": str(lease_id),
                "entry_date": entry_date.isoformat(),
                "entry_type": entry_type,
                "narration": narration,
                "status": "POSTED",
                "created_by": user_id,
            }
        )
        .execute()
    )
    entry_id = entry.data[0]["id"]
    for line in lines:
        line["journal_entry_id"] = entry_id
    db.table("journal_lines").insert(lines).execute()
    return entry.data[0]


def create_initial_recognition_journal(
    db: Client,
    lease_id: UUID,
    entry_date: date,
    rou_asset: Decimal,
    lease_liability: Decimal,
    initial_direct_costs: Decimal,
    prepaid_rent: Decimal,
    lease_incentives: Decimal,
    restoration_cost_estimate: Decimal,
    user_id: str,
) -> dict:
    """Dr ROU Asset / Cr Lease Liability + net cash + ARO provision.
    Balances by construction: ROU = liability + net_cash + restoration."""
    lines = [
        {
            "account_code": "ROU-ASSET",
            "account_name": "Right-of-Use Asset",
            "debit": str(rou_asset),
            "credit": "0",
        },
        {
            "account_code": "LEASE-LIAB",
            "account_name": "Lease Liability",
            "debit": "0",
            "credit": str(lease_liability),
        },
    ]
    net_cash = initial_direct_costs + prepaid_rent - lease_incentives
    if net_cash != 0:
        lines.append(
            {
                "account_code": "CASH-BANK",
                "account_name": "Cash / Bank",
                "debit": str(max(-net_cash, Decimal("0"))),
                "credit": str(max(net_cash, Decimal("0"))),
            }
        )
    if restoration_cost_estimate != 0:
        lines.append(
            {
                "account_code": "ARO-PROVISION",
                "account_name": "Asset Retirement Obligation Provision",
                "debit": "0",
                "credit": str(restoration_cost_estimate),
            }
        )
    return _insert_entry(
        db, lease_id, entry_date, "INITIAL_RECOGNITION", "Initial recognition of ROU asset and lease liability", user_id, lines
    )


def create_period_journals(
    db: Client,
    lease_id: UUID,
    liability_row: dict,
    rou_row: dict,
    user_id: str,
) -> list[dict]:
    """Books the interest-accrual-and-payment entry and the depreciation
    entry for a single period, from persisted liability/ROU schedule rows."""
    period_end = date.fromisoformat(liability_row["period_end"])
    interest = Decimal(str(liability_row["interest_expense"]))
    payment = Decimal(str(liability_row["payment"]))
    liability_movement = interest - payment  # negative = net reduction in liability

    interest_lines = [
        {
            "account_code": "INTEREST-EXP",
            "account_name": "Interest Expense on Lease Liability",
            "debit": str(interest),
            "credit": "0",
        },
        {
            "account_code": "CASH-BANK",
            "account_name": "Cash / Bank",
            "debit": "0",
            "credit": str(payment),
        },
    ]
    if liability_movement < 0:
        interest_lines.append(
            {
                "account_code": "LEASE-LIAB",
                "account_name": "Lease Liability",
                "debit": str(-liability_movement),
                "credit": "0",
            }
        )
    elif liability_movement > 0:
        interest_lines.append(
            {
                "account_code": "LEASE-LIAB",
                "account_name": "Lease Liability",
                "debit": "0",
                "credit": str(liability_movement),
            }
        )

    interest_entry = _insert_entry(
        db, lease_id, period_end, "INTEREST_EXPENSE",
        f"Interest accrual & payment for period {liability_row['period_number']}", user_id, interest_lines,
    )

    depreciation = Decimal(str(rou_row["depreciation"]))
    depreciation_entry = _insert_entry(
        db, lease_id, period_end, "DEPRECIATION",
        f"Depreciation of ROU asset for period {rou_row['period_number']}", user_id,
        [
            {
                "account_code": "DEPRECIATION-EXP",
                "account_name": "Depreciation Expense - ROU Asset",
                "debit": str(depreciation),
                "credit": "0",
            },
            {
                "account_code": "ACC-DEPRECIATION-ROU",
                "account_name": "Accumulated Depreciation - ROU Asset",
                "debit": "0",
                "credit": str(depreciation),
            },
        ],
    )

    return [interest_entry, depreciation_entry]


def create_remeasurement_journal(
    db: Client,
    lease_id: UUID,
    modification_date: date,
    rou_adjustment: Decimal,
    liability_after: Decimal,
    liability_before: Decimal,
    gain_loss_on_termination: Decimal,
    user_id: str,
) -> dict:
    liability_movement = liability_after - liability_before
    lines = []
    if rou_adjustment >= 0:
        lines.append({"account_code": "ROU-ASSET", "account_name": "Right-of-Use Asset", "debit": str(rou_adjustment), "credit": "0"})
    else:
        lines.append({"account_code": "ROU-ASSET", "account_name": "Right-of-Use Asset", "debit": "0", "credit": str(-rou_adjustment)})

    if liability_movement >= 0:
        lines.append({"account_code": "LEASE-LIAB", "account_name": "Lease Liability", "debit": "0", "credit": str(liability_movement)})
    else:
        lines.append({"account_code": "LEASE-LIAB", "account_name": "Lease Liability", "debit": str(-liability_movement), "credit": "0"})

    if gain_loss_on_termination != 0:
        if gain_loss_on_termination > 0:
            lines.append({"account_code": "GAIN-TERMINATION", "account_name": "Gain on Lease Modification/Termination", "debit": "0", "credit": str(gain_loss_on_termination)})
        else:
            lines.append({"account_code": "LOSS-TERMINATION", "account_name": "Loss on Lease Modification/Termination", "debit": str(-gain_loss_on_termination), "credit": "0"})

    return _insert_entry(
        db, lease_id, modification_date, "REMEASUREMENT", "Lease remeasurement / modification", user_id, lines
    )


# ---------------------------------------------------------------------------
# Security deposit journals (Ind AS 109 / IFRS 9 recognition of a refundable
# interest-free deposit at present value, day-1 discount as prepaid rent).
# ---------------------------------------------------------------------------
def create_security_deposit_initial_journal(
    db: Client,
    lease_id: UUID,
    paid_date: date,
    deposit_amount: Decimal,
    present_value: Decimal,
    prepaid_rent_component: Decimal,
    user_id: str,
    org_id: str | None = None,
) -> dict:
    """Dr Security Deposit (financial asset @ PV) + Dr Prepaid Rent (day-1
    discount) / Cr Cash (full refundable amount paid)."""
    lines = [
        {"account_code": "SEC-DEPOSIT", "account_name": "Security Deposit (Financial Asset)",
         "debit": str(present_value), "credit": "0"},
    ]
    if prepaid_rent_component != 0:
        lines.append({"account_code": "PREPAID-RENT", "account_name": "Prepaid Rent",
                      "debit": str(prepaid_rent_component), "credit": "0"})
    lines.append({"account_code": "CASH-BANK", "account_name": "Cash / Bank",
                  "debit": "0", "credit": str(deposit_amount)})
    return _insert_entry(
        db, lease_id, paid_date, "SECURITY_DEPOSIT",
        "Security deposit paid - recognised at present value", user_id, lines, org_id=org_id,
    )


def create_security_deposit_period_journals(
    db: Client,
    lease_id: UUID,
    schedule_rows: list[dict],
    prepaid_rent_component: Decimal,
    user_id: str,
    org_id: str | None = None,
) -> list[dict]:
    """For each period of the deposit's life: unwind the discount as interest
    income (Dr Security Deposit / Cr Interest Income) and amortise the day-1
    prepaid-rent component straight-line (Dr Rent Expense / Cr Prepaid Rent)."""
    org_id = org_id or _lease_org_id(db, lease_id)
    n = len(schedule_rows)
    entries: list[dict] = []
    prepaid_per_period = (prepaid_rent_component / n).quantize(Decimal("0.01")) if n else Decimal("0")
    amortised = Decimal("0")

    for i, r in enumerate(schedule_rows, start=1):
        period_date = date.fromisoformat(r["period_date"])
        interest = Decimal(str(r["interest_income"]))
        lines = [
            {"account_code": "SEC-DEPOSIT", "account_name": "Security Deposit (Financial Asset)",
             "debit": str(interest), "credit": "0"},
            {"account_code": "INTEREST-INCOME", "account_name": "Interest Income on Security Deposit",
             "debit": "0", "credit": str(interest)},
        ]
        # Straight-line prepaid rent amortisation; true up the final period.
        this_prepaid = prepaid_rent_component - amortised if i == n else prepaid_per_period
        amortised += this_prepaid
        if this_prepaid != 0:
            lines.append({"account_code": "RENT-EXP", "account_name": "Rent Expense (deposit discount)",
                          "debit": str(this_prepaid), "credit": "0"})
            lines.append({"account_code": "PREPAID-RENT", "account_name": "Prepaid Rent",
                          "debit": "0", "credit": str(this_prepaid)})
        entries.append(_insert_entry(
            db, lease_id, period_date, "SECURITY_DEPOSIT",
            f"Security deposit unwinding & prepaid rent amortisation - period {i}", user_id, lines, org_id=org_id,
        ))
    return entries


# ---------------------------------------------------------------------------
# Bulk regeneration of all system-derived journals for a lease.
# ---------------------------------------------------------------------------
_DERIVED_ENTRY_TYPES = ("INITIAL_RECOGNITION", "INTEREST_EXPENSE", "DEPRECIATION", "SECURITY_DEPOSIT")


def delete_derived_journals(db: Client, lease_id: UUID) -> None:
    """Remove previously auto-generated (derived) journals for a lease so the
    full set can be regenerated idempotently. Manual entries and remeasurement
    entries are left untouched."""
    existing = (
        db.table("journal_entries")
        .select("id, entry_type")
        .eq("lease_id", str(lease_id))
        .in_("entry_type", list(_DERIVED_ENTRY_TYPES))
        .execute()
        .data
    )
    ids = [e["id"] for e in existing]
    if ids:
        db.table("journal_lines").delete().in_("journal_entry_id", ids).execute()
        db.table("journal_entries").delete().in_("id", ids).execute()
