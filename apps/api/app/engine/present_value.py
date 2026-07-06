from decimal import Decimal, getcontext

from .models import PaymentLine, PaymentTiming

getcontext().prec = 28


def periodic_rate(annual_rate: Decimal, periods_per_year: int) -> Decimal:
    """Effective periodic discount rate compounding to the given annual rate."""
    one = Decimal("1")
    return (one + annual_rate) ** (Decimal("1") / Decimal(periods_per_year)) - one


def present_value(
    payments: list[PaymentLine],
    annual_rate: Decimal,
    periods_per_year: int,
    timing: PaymentTiming,
) -> Decimal:
    """PV, as of commencement, of a stream of periodic payments.

    Payment `i` (1-indexed) is discounted `t` periods where `t = i` for
    ARREARS (end-of-period) and `t = i - 1` for ADVANCE (start-of-period, so
    the first payment is undiscounted — it is due, and settled, on day one).
    """
    r = periodic_rate(annual_rate, periods_per_year)
    one = Decimal("1")
    total = Decimal("0")
    for line in payments:
        t = line.period_number if timing == PaymentTiming.ARREARS else line.period_number - 1
        total += line.amount / ((one + r) ** t)
    return total
