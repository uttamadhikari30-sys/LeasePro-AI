from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from .dates import add_months
from .models import (
    LiabilityScheduleRow,
    MONTHS_PER_PERIOD,
    PaymentFrequency,
    PaymentLine,
    PaymentTiming,
)
from .present_value import periodic_rate, present_value

CENT = Decimal("0.01")


def _round(amount: Decimal) -> Decimal:
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def build_liability_schedule(
    payments: list[PaymentLine],
    commencement_date: date,
    frequency: PaymentFrequency,
    annual_rate: Decimal,
    timing: PaymentTiming,
    opening_liability: Decimal | None = None,
) -> list[LiabilityScheduleRow]:
    """Effective-interest amortization of the lease liability.

    - ARREARS (ordinary annuity): interest accrues on the opening balance for
      the full period, then the payment is deducted at period end.
    - ADVANCE (annuity-due): the payment is deducted first (paid at period
      start), then interest accrues on the remaining balance for the period.

    The schedule is self-balancing: the closing balance of the final period
    is ~0 (subject to rounding), which is the key correctness check.
    """
    period_months = MONTHS_PER_PERIOD[frequency]
    r = periodic_rate(annual_rate, {
        PaymentFrequency.MONTHLY: 12,
        PaymentFrequency.QUARTERLY: 4,
        PaymentFrequency.HALF_YEARLY: 2,
        PaymentFrequency.ANNUALLY: 1,
    }[frequency])

    if opening_liability is None:
        opening_liability = present_value(
            payments,
            annual_rate,
            {
                PaymentFrequency.MONTHLY: 12,
                PaymentFrequency.QUARTERLY: 4,
                PaymentFrequency.HALF_YEARLY: 2,
                PaymentFrequency.ANNUALLY: 1,
            }[frequency],
            timing,
        )

    rows: list[LiabilityScheduleRow] = []
    opening = opening_liability
    for line in sorted(payments, key=lambda p: p.period_number):
        period_start = add_months(commencement_date, (line.period_number - 1) * period_months)
        period_end = add_months(commencement_date, line.period_number * period_months)

        if timing == PaymentTiming.ARREARS:
            interest = _round(opening * r)
            closing = opening + interest - line.amount
        else:
            reduced = opening - line.amount
            interest = _round(reduced * r)
            closing = reduced + interest

        rows.append(
            LiabilityScheduleRow(
                period_number=line.period_number,
                period_start=period_start,
                period_end=period_end,
                opening_liability=_round(opening),
                interest_expense=interest,
                payment=line.amount,
                closing_liability=_round(closing),
            )
        )
        opening = closing

    # True up the final period for cent-level rounding drift accumulated over
    # the schedule, so the closing balance lands on exactly zero.
    if rows:
        residual = rows[-1].closing_liability
        if residual != 0:
            rows[-1].interest_expense = _round(rows[-1].interest_expense - residual)
            rows[-1].closing_liability = _round(rows[-1].closing_liability - residual)

    return rows
