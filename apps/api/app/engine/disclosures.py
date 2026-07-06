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
