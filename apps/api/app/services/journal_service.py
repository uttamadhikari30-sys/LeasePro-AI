from datetime import date
from decimal import Decimal
from uuid import UUID

from supabase import Client


def _insert_entry(
    db: Client,
    lease_id: UUID,
    entry_date: date,
    entry_type: str,
    narration: str,
    user_id: str,
    lines: list[dict],
) -> dict:
    entry = (
        db.table("journal_entries")
        .insert(
            {
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
