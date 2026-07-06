from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from .dates import add_months
from .models import RouScheduleRow

CENT = Decimal("0.01")


def _round(amount: Decimal) -> Decimal:
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def build_rou_schedule(
    rou_asset_initial: Decimal,
    commencement_date: date,
    depreciation_end_date: date,
    period_months: int = 1,
) -> list[RouScheduleRow]:
    """Straight-line ROU depreciation from commencement to the earlier of the
    lease term end and the asset's useful life end (caller resolves which
    date that is and passes it as `depreciation_end_date`).

    The final period absorbs any rounding remainder so the asset fully
    depreciates to zero (net of impairment, which is applied separately).
    """
    total_months = (
        (depreciation_end_date.year - commencement_date.year) * 12
        + (depreciation_end_date.month - commencement_date.month)
    )
    if depreciation_end_date.day < commencement_date.day:
        total_months -= 1
    num_periods = max(total_months // period_months, 1)

    per_period = _round(rou_asset_initial / num_periods)

    rows: list[RouScheduleRow] = []
    opening = rou_asset_initial
    for i in range(1, num_periods + 1):
        period_start = add_months(commencement_date, (i - 1) * period_months)
        period_end = add_months(commencement_date, i * period_months)

        depreciation = per_period
        if i == num_periods:
            depreciation = opening  # plug final period so closing NBV = 0 exactly

        closing = opening - depreciation
        rows.append(
            RouScheduleRow(
                period_number=i,
                period_start=period_start,
                period_end=period_end,
                opening_nbv=_round(opening),
                depreciation=_round(depreciation),
                impairment=Decimal("0"),
                closing_nbv=_round(closing),
            )
        )
        opening = closing

    return rows
