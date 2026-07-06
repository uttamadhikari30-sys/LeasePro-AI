from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from .dates import add_months
from .models import SecurityDepositResult, SecurityDepositScheduleRow

CENT = Decimal("0.01")


def _round(amount: Decimal) -> Decimal:
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def compute_security_deposit(
    deposit_amount: Decimal,
    paid_date: date,
    expected_refund_date: date,
    annual_discount_rate: Decimal,
) -> SecurityDepositResult:
    """Refundable interest-free security deposits are financial instruments:
    recognize at PV on day 1 (Ind AS 109 / IFRS 9), with the day-1 discount
    treated as prepaid rent (amortized over the lease term), and unwind the
    discount as interest income over the deposit's life back up to the full
    refundable face value.
    """
    months = (
        (expected_refund_date.year - paid_date.year) * 12
        + (expected_refund_date.month - paid_date.month)
    )
    months = max(months, 1)

    monthly_rate = (Decimal("1") + annual_discount_rate) ** (Decimal("1") / Decimal("12")) - 1
    present_value = _round(deposit_amount / ((Decimal("1") + monthly_rate) ** months))
    prepaid_rent_component = _round(deposit_amount - present_value)

    schedule: list[SecurityDepositScheduleRow] = []
    opening = present_value
    for i in range(1, months + 1):
        period_date = add_months(paid_date, i)
        interest = _round(opening * monthly_rate)
        closing = opening + interest
        if i == months:
            closing = deposit_amount  # plug final period to face value exactly
            interest = closing - opening

        schedule.append(
            SecurityDepositScheduleRow(
                period_number=i,
                period_date=period_date,
                opening_balance=_round(opening),
                interest_income=_round(interest),
                closing_balance=_round(closing),
            )
        )
        opening = closing

    return SecurityDepositResult(
        present_value=present_value,
        prepaid_rent_component=prepaid_rent_component,
        schedule=schedule,
    )
