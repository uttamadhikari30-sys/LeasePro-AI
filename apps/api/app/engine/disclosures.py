import math
from datetime import date
from decimal import Decimal

from .models import MaturityBucket, PaymentLine


def maturity_analysis(payments: list[PaymentLine], as_of_date: date) -> list[MaturityBucket]:
    """Undiscounted lease payment maturity analysis (Ind AS 116.58 / IFRS
    16.58 read with Appendix B / IFRS 16.94): buckets of not later than 1
    year, 1-2, 2-3, 3-4, 4-5, and later than 5 years, based on payments still
    due after `as_of_date`. A payment due exactly N years out falls in the
    bucket ending at year N (e.g. exactly 1 year out -> "not later than 1
    year"), matching how lease disclosure schedules are conventionally cut."""
    buckets = {
        "Not later than 1 year": Decimal("0"),
        "Later than 1 year and not later than 2 years": Decimal("0"),
        "Later than 2 years and not later than 3 years": Decimal("0"),
        "Later than 3 years and not later than 4 years": Decimal("0"),
        "Later than 4 years and not later than 5 years": Decimal("0"),
        "Later than 5 years": Decimal("0"),
    }
    labels = list(buckets.keys())

    for line in payments:
        if line.due_date <= as_of_date:
            continue
        years_out = (line.due_date.year - as_of_date.year) + (
            (line.due_date.month - as_of_date.month) / 12
        )
        bucket_index = min(math.ceil(years_out) - 1, len(labels) - 1)
        label = labels[bucket_index]
        buckets[label] += line.amount

    return [MaturityBucket(label=label, undiscounted_amount=amount) for label, amount in buckets.items()]


def weighted_average_discount_rate(leases: list[tuple[Decimal, Decimal]]) -> Decimal:
    """Weighted-average incremental borrowing rate disclosure.

    `leases` is a list of (lease_liability_balance, annual_discount_rate)
    tuples. Weighted by outstanding liability balance.
    """
    total_liability = sum((liability for liability, _ in leases), Decimal("0"))
    if total_liability == 0:
        return Decimal("0")
    weighted_sum = sum((liability * rate for liability, rate in leases), Decimal("0"))
    return (weighted_sum / total_liability).quantize(Decimal("0.00001"))


def total_cash_outflow(liability_schedule_payments: list[Decimal]) -> Decimal:
    """IFRS 16.53(g) / Ind AS 116.53(g) — total cash outflow for leases in the
    period; pass the `payment` column of the liability schedule rows falling
    within the reporting period."""
    return sum(liability_schedule_payments, Decimal("0"))


def build_disclosure_note(
    *,
    standard: str,
    entity_name: str,
    as_of_date: date,
    currency: str,
    total_rou_nbv: Decimal,
    rou_by_category: dict[str, Decimal],
    total_liability: Decimal,
    current_liability: Decimal,
    non_current_liability: Decimal,
    depreciation_ytd: Decimal,
    interest_ytd: Decimal,
    short_term_expense_ytd: Decimal,
    low_value_expense_ytd: Decimal,
    total_cash_outflow_ytd: Decimal,
    additions_ytd: Decimal,
    wadr: Decimal,
    maturity: list["MaturityBucket"],
) -> str:
    """Produce a ready-to-paste financial-statement disclosure note text for
    Ind AS 116 / IFRS 16, populated with the entity's figures. Wording follows
    the disclosure requirements of Ind AS 116.51-60 / IFRS 16.51-60 and ICAI's
    Educational Material on Ind AS 116."""
    std_label = "IFRS 16, Leases" if standard == "IFRS_16" else "Ind AS 116, Leases"
    ref = "IFRS 16" if standard == "IFRS_16" else "Ind AS 116"

    def m(x: Decimal) -> str:
        return f"{currency} {Decimal(x).quantize(Decimal('1')):,}"

    def pct(x: Decimal) -> str:
        return f"{(Decimal(x) * 100).quantize(Decimal('0.01'))}%"

    rou_lines = "\n".join(f"| {cat} | {m(val)} |" for cat, val in rou_by_category.items()) or "| — | 0 |"
    maturity_lines = "\n".join(f"| {b.label} | {m(b.undiscounted_amount)} |" for b in maturity)
    total_undiscounted = sum((b.undiscounted_amount for b in maturity), Decimal("0"))

    return f"""# Note — Leases ({ref})

*{entity_name} — for the period ended {as_of_date.strftime('%d %B %Y')} (all amounts in {currency})*

## 1. Accounting policy
The Company assesses at contract inception whether a contract is, or contains, a
lease. The Company recognises a right-of-use (ROU) asset and a corresponding
lease liability for all lease arrangements in which it is a lessee, except for
short-term leases (term of 12 months or less) and leases of low-value assets,
for which lease payments are recognised as an expense on a straight-line basis
over the lease term. This policy is applied in accordance with {std_label}.

The lease liability is initially measured at the present value of the lease
payments that are not paid at the commencement date, discounted using the
interest rate implicit in the lease, or where that rate cannot be readily
determined, the Company's incremental borrowing rate. The ROU asset is initially
measured at cost, comprising the initial lease liability, initial direct costs,
prepaid lease payments and estimated restoration costs, less lease incentives
received. The ROU asset is subsequently depreciated on a straight-line basis and
the lease liability is measured at amortised cost using the effective interest
method.

## 2. Amounts recognised in the balance sheet
### Right-of-use assets (net carrying amount by class)
| Class of underlying asset | Carrying amount |
|---|---|
{rou_lines}
| **Total ROU assets** | **{m(total_rou_nbv)}** |

### Lease liabilities
| | Amount |
|---|---|
| Current | {m(current_liability)} |
| Non-current | {m(non_current_liability)} |
| **Total lease liabilities** | **{m(total_liability)}** |

Additions to ROU assets during the period: {m(additions_ytd)}.

## 3. Amounts recognised in the statement of profit and loss
| | Amount |
|---|---|
| Depreciation charge on right-of-use assets | {m(depreciation_ytd)} |
| Interest expense on lease liabilities | {m(interest_ytd)} |
| Expense relating to short-term leases | {m(short_term_expense_ytd)} |
| Expense relating to leases of low-value assets | {m(low_value_expense_ytd)} |

## 4. Amounts recognised in the statement of cash flows
Total cash outflow for leases during the period: {m(total_cash_outflow_ytd)}.

## 5. Maturity analysis of lease liabilities (undiscounted)
Contractual undiscounted lease payments (as required by {ref}.58 and the
liquidity-risk disclosures of Ind AS 107 / IFRS 7):

| Maturity | Undiscounted lease payments |
|---|---|
{maturity_lines}
| **Total undiscounted lease payments** | **{m(total_undiscounted)}** |

## 6. Other information
The weighted-average incremental borrowing rate applied to lease liabilities is
**{pct(wadr)}**. The Company's leasing activities and the extension/termination
options are described in the significant-judgements note. There were no material
sale-and-leaseback transactions during the period.

*This note is auto-generated by LeasePro AI from the underlying lease
computations and is intended as a drafting aid; it should be reviewed by the
preparer before inclusion in the financial statements.*
"""
