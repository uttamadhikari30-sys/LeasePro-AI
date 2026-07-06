from decimal import Decimal


def qualifies_short_term(
    lease_term_months: int,
    has_purchase_option: bool,
    threshold_months: int = 12,
) -> bool:
    """Ind AS 116.5 / IFRS 16.5-6: a lease with a term of 12 months or less at
    the commencement date, and containing no purchase option, may be exempted
    (expensed straight-line, no ROU asset / liability recognized)."""
    return lease_term_months <= threshold_months and not has_purchase_option


def qualifies_low_value(
    underlying_asset_value: Decimal,
    threshold: Decimal = Decimal("500000"),
) -> bool:
    """IFRS 16.B3-B8 low-value asset exemption (assessed on an absolute basis,
    e.g. USD 5,000 when new; `threshold` should be set per the org's policy /
    functional currency). Not available under Ind AS 116, which has no
    low-value exemption -- callers should gate this on reporting_standard."""
    return underlying_asset_value <= threshold


def straight_line_expense_schedule(
    total_payments: Decimal,
    num_periods: int,
) -> Decimal:
    """Short-term / low-value leases are expensed straight-line over the
    lease term rather than capitalized; returns the flat per-period expense."""
    if num_periods <= 0:
        raise ValueError("num_periods must be positive")
    return (total_payments / num_periods).quantize(Decimal("0.01"))
