from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from .dates import add_months
from .models import (
    EscalationType,
    MONTHS_PER_PERIOD,
    PaymentFrequency,
    PaymentLine,
    PaymentTiming,
)

CENT = Decimal("0.01")


def _round(amount: Decimal) -> Decimal:
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def generate_payment_schedule(
    commencement_date: date,
    lease_term_months: int,
    frequency: PaymentFrequency,
    timing: PaymentTiming,
    base_payment_amount: Decimal,
    escalation_type: EscalationType = EscalationType.NONE,
    escalation_percent: Decimal = Decimal("0"),
    escalation_frequency_months: int = 12,
) -> list[PaymentLine]:
    """Build the contractual (undiscounted) cash flow schedule for a lease.

    Period `i` (1-indexed) covers the interval starting at
    `commencement + (i-1)*period_months`. For ARREARS, payment is due at the
    end of that interval; for ADVANCE, at its start (so payment 1 is due on
    the commencement date itself).
    """
    period_months = MONTHS_PER_PERIOD[frequency]
    if lease_term_months % period_months != 0:
        raise ValueError(
            f"lease_term_months ({lease_term_months}) is not a whole number of "
            f"{frequency.value} periods"
        )
    num_periods = lease_term_months // period_months

    lines: list[PaymentLine] = []
    for i in range(1, num_periods + 1):
        if timing == PaymentTiming.ARREARS:
            due_date = add_months(commencement_date, i * period_months)
        else:
            due_date = add_months(commencement_date, (i - 1) * period_months)

        amount = base_payment_amount
        if escalation_type == EscalationType.FIXED_PERCENT and escalation_percent:
            escalation_steps = ((i - 1) * period_months) // escalation_frequency_months
            factor = (Decimal("1") + escalation_percent / Decimal("100")) ** escalation_steps
            amount = base_payment_amount * factor
        elif escalation_type == EscalationType.CUSTOM:
            # Custom schedules are supplied externally (per-period overrides);
            # this generator only produces the flat/escalating baseline.
            pass

        lines.append(PaymentLine(period_number=i, due_date=due_date, amount=_round(amount)))

    return lines


def apply_overrides(
    lines: list[PaymentLine], overrides: dict[int, Decimal]
) -> list[PaymentLine]:
    """Replace amounts for specific period numbers (1-indexed) with override values."""
    result = []
    for line in lines:
        if line.period_number in overrides:
            result.append(
                PaymentLine(
                    period_number=line.period_number,
                    due_date=line.due_date,
                    amount=_round(overrides[line.period_number]),
                )
            )
        else:
            result.append(line)
    return result
