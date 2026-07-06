from decimal import Decimal, ROUND_HALF_UP

from .models import PaymentFrequency, PaymentLine, PaymentTiming, RemeasurementResult
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


def remeasure_for_modification(
    liability_before: Decimal,
    revised_payments: list[PaymentLine],
    revised_annual_rate: Decimal,
    frequency: PaymentFrequency,
    timing: PaymentTiming,
    rou_carrying_amount: Decimal,
) -> RemeasurementResult:
    """Ind AS 116.45(b) / IFRS 16.45(b) — modification not accounted for as a
    separate lease, and not a decrease in scope: remeasure the liability as
    the PV of revised payments at the (possibly revised) discount rate, as of
    the effective date, and adjust the ROU asset by the same amount. If the
    adjustment would take the ROU asset below zero, the excess is recognized
    as a gain in P&L.
    """
    liability_after = _round(
        present_value(
            revised_payments, revised_annual_rate, PERIODS_PER_YEAR[frequency], timing
        )
    )
    rou_adjustment = liability_after - liability_before

    gain_loss = Decimal("0")
    new_rou = rou_carrying_amount + rou_adjustment
    if new_rou < 0:
        gain_loss = -new_rou  # recognized as a gain in P&L
        new_rou = Decimal("0")
        rou_adjustment = new_rou - rou_carrying_amount

    return RemeasurementResult(
        liability_before=liability_before,
        liability_after=liability_after,
        rou_adjustment=_round(rou_adjustment),
        gain_loss_on_termination=_round(gain_loss),
    )


def partial_termination(
    liability_before: Decimal,
    rou_before: Decimal,
    reduction_ratio: Decimal,
) -> RemeasurementResult:
    """Ind AS 116.46(a) / IFRS 16.46(a) — decrease in scope (partial
    termination): reduce the liability and ROU asset proportionately to the
    decrease in scope, and recognize any difference as a gain or loss in P&L.

    `reduction_ratio` is the proportionate decrease (0 < ratio <= 1), e.g. a
    reduction of 30% of leased floor area -> Decimal("0.30").
    """
    if not (Decimal("0") < reduction_ratio <= Decimal("1")):
        raise ValueError("reduction_ratio must be between 0 (exclusive) and 1 (inclusive)")

    liability_decrease = _round(liability_before * reduction_ratio)
    rou_decrease = _round(rou_before * reduction_ratio)
    gain_loss = liability_decrease - rou_decrease  # positive = gain, negative = loss

    liability_after = liability_before - liability_decrease

    return RemeasurementResult(
        liability_before=liability_before,
        liability_after=_round(liability_after),
        rou_adjustment=_round(-rou_decrease),
        gain_loss_on_termination=_round(gain_loss),
    )


def full_termination(liability_before: Decimal, rou_before: Decimal) -> RemeasurementResult:
    """Full termination: derecognize the entire liability and ROU asset;
    the difference is a gain or loss in P&L."""
    gain_loss = liability_before - rou_before
    return RemeasurementResult(
        liability_before=liability_before,
        liability_after=Decimal("0"),
        rou_adjustment=_round(-rou_before),
        gain_loss_on_termination=_round(gain_loss),
    )
