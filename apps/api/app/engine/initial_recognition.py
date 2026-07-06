from decimal import Decimal, ROUND_HALF_UP

from .models import (
    InitialRecognitionResult,
    PaymentFrequency,
    PaymentLine,
    PaymentTiming,
)
from .present_value import present_value

CENT = Decimal("0.01")
PERIODS_PER_YEAR = {
    PaymentFrequency.MONTHLY: 12,
    PaymentFrequency.QUARTERLY: 4,
    PaymentFrequency.HALF_YEARLY: 2,
    PaymentFrequency.ANNUALLY: 1,
}


def _round(amount: Decimal) -> Decimal:
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def compute_initial_recognition(
    payments: list[PaymentLine],
    annual_discount_rate: Decimal,
    frequency: PaymentFrequency,
    timing: PaymentTiming,
    initial_direct_costs: Decimal = Decimal("0"),
    lease_incentives: Decimal = Decimal("0"),
    restoration_cost_estimate: Decimal = Decimal("0"),
    prepaid_rent: Decimal = Decimal("0"),
) -> InitialRecognitionResult:
    """Ind AS 116.26 / IFRS 16.26 initial measurement.

    Lease liability = PV of unpaid lease payments at commencement.
    ROU asset = lease liability + initial direct costs + prepayments made at
    or before commencement (outside the schedule) - lease incentives received
    + estimated restoration/dismantling costs.
    """
    lease_liability = _round(
        present_value(payments, annual_discount_rate, PERIODS_PER_YEAR[frequency], timing)
    )
    rou_asset = _round(
        lease_liability
        + initial_direct_costs
        + prepaid_rent
        - lease_incentives
        + restoration_cost_estimate
    )
    return InitialRecognitionResult(
        lease_liability=lease_liability,
        rou_asset=rou_asset,
        initial_direct_costs=initial_direct_costs,
        lease_incentives=lease_incentives,
        restoration_cost_estimate=restoration_cost_estimate,
        prepaid_rent=prepaid_rent,
    )
