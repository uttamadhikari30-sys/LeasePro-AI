from datetime import date
from decimal import Decimal

import pytest

from app.engine.amortization import build_liability_schedule
from app.engine.depreciation import build_rou_schedule
from app.engine.disclosures import maturity_analysis, weighted_average_discount_rate
from app.engine.exemptions import qualifies_low_value, qualifies_short_term
from app.engine.initial_recognition import compute_initial_recognition
from app.engine.models import EscalationType, PaymentFrequency, PaymentTiming
from app.engine.present_value import present_value
from app.engine.remeasurement import partial_termination, remeasure_for_modification
from app.engine.schedule import generate_payment_schedule
from app.engine.security_deposit import compute_security_deposit


def test_classic_annual_arrears_pv_textbook_example():
    # Textbook example: 3 annual payments of 100,000 in arrears at 10% -> 248,685.20
    payments = generate_payment_schedule(
        commencement_date=date(2026, 4, 1),
        lease_term_months=36,
        frequency=PaymentFrequency.ANNUALLY,
        timing=PaymentTiming.ARREARS,
        base_payment_amount=Decimal("100000"),
    )
    assert len(payments) == 3
    pv = present_value(payments, Decimal("0.10"), 1, PaymentTiming.ARREARS)
    assert pv.quantize(Decimal("0.01")) == Decimal("248685.20")


def test_liability_schedule_self_balances_to_zero_arrears():
    payments = generate_payment_schedule(
        commencement_date=date(2026, 4, 1),
        lease_term_months=36,
        frequency=PaymentFrequency.ANNUALLY,
        timing=PaymentTiming.ARREARS,
        base_payment_amount=Decimal("100000"),
    )
    schedule = build_liability_schedule(
        payments, date(2026, 4, 1), PaymentFrequency.ANNUALLY, Decimal("0.10"), PaymentTiming.ARREARS
    )
    assert len(schedule) == 3
    assert schedule[-1].closing_liability == Decimal("0.00")
    # Opening of period 1 equals the initial liability.
    assert schedule[0].opening_liability == Decimal("248685.20")


def test_liability_schedule_self_balances_to_zero_advance_monthly():
    payments = generate_payment_schedule(
        commencement_date=date(2026, 1, 1),
        lease_term_months=12,
        frequency=PaymentFrequency.MONTHLY,
        timing=PaymentTiming.ADVANCE,
        base_payment_amount=Decimal("50000"),
    )
    schedule = build_liability_schedule(
        payments, date(2026, 1, 1), PaymentFrequency.MONTHLY, Decimal("0.12"), PaymentTiming.ADVANCE
    )
    assert len(schedule) == 12
    assert schedule[-1].closing_liability == Decimal("0.00")
    # First payment is due day 1 (advance): no interest accrues before it, so
    # opening liability for period 1 equals opening balance and the payment
    # is deducted before interest starts accruing on the remainder.
    assert schedule[0].payment == Decimal("50000.00")
    assert schedule[0].closing_liability == schedule[0].opening_liability - schedule[0].payment + schedule[0].interest_expense


def test_escalation_fixed_percent_annual_step():
    payments = generate_payment_schedule(
        commencement_date=date(2026, 1, 1),
        lease_term_months=24,
        frequency=PaymentFrequency.MONTHLY,
        timing=PaymentTiming.ARREARS,
        base_payment_amount=Decimal("10000"),
        escalation_type=EscalationType.FIXED_PERCENT,
        escalation_percent=Decimal("5"),
        escalation_frequency_months=12,
    )
    assert payments[0].amount == Decimal("10000.00")
    assert payments[11].amount == Decimal("10000.00")
    assert payments[12].amount == Decimal("10500.00")
    assert payments[23].amount == Decimal("10500.00")


def test_initial_recognition_includes_direct_costs_and_incentives():
    payments = generate_payment_schedule(
        commencement_date=date(2026, 4, 1),
        lease_term_months=36,
        frequency=PaymentFrequency.ANNUALLY,
        timing=PaymentTiming.ARREARS,
        base_payment_amount=Decimal("100000"),
    )
    result = compute_initial_recognition(
        payments,
        annual_discount_rate=Decimal("0.10"),
        frequency=PaymentFrequency.ANNUALLY,
        timing=PaymentTiming.ARREARS,
        initial_direct_costs=Decimal("5000"),
        lease_incentives=Decimal("2000"),
        restoration_cost_estimate=Decimal("3000"),
    )
    assert result.lease_liability == Decimal("248685.20")
    assert result.rou_asset == Decimal("248685.20") + Decimal("5000") - Decimal("2000") + Decimal("3000")


def test_rou_depreciation_fully_depreciates_to_zero():
    schedule = build_rou_schedule(
        rou_asset_initial=Decimal("254685.20"),
        commencement_date=date(2026, 4, 1),
        depreciation_end_date=date(2029, 4, 1),
        period_months=1,
    )
    assert len(schedule) == 36
    assert schedule[-1].closing_nbv == Decimal("0.00")
    total_depreciation = sum((row.depreciation for row in schedule), Decimal("0"))
    assert total_depreciation == Decimal("254685.20")


def test_partial_termination_gain_or_loss():
    result = partial_termination(
        liability_before=Decimal("200000.00"),
        rou_before=Decimal("180000.00"),
        reduction_ratio=Decimal("0.30"),
    )
    assert result.liability_after == Decimal("140000.00")
    # liability decrease 60000, rou decrease 54000 -> gain of 6000
    assert result.gain_loss_on_termination == Decimal("6000.00")
    assert result.rou_adjustment == Decimal("-54000.00")


def test_remeasurement_for_term_extension_increases_liability_and_rou():
    original_payments = generate_payment_schedule(
        commencement_date=date(2026, 4, 1),
        lease_term_months=36,
        frequency=PaymentFrequency.ANNUALLY,
        timing=PaymentTiming.ARREARS,
        base_payment_amount=Decimal("100000"),
    )
    liability_before = present_value(
        original_payments, Decimal("0.10"), 1, PaymentTiming.ARREARS
    ).quantize(Decimal("0.01"))

    # Extend by 2 more years at a revised rate.
    revised_payments = generate_payment_schedule(
        commencement_date=date(2026, 4, 1),
        lease_term_months=60,
        frequency=PaymentFrequency.ANNUALLY,
        timing=PaymentTiming.ARREARS,
        base_payment_amount=Decimal("100000"),
    )
    result = remeasure_for_modification(
        liability_before=liability_before,
        revised_payments=revised_payments,
        revised_annual_rate=Decimal("0.11"),
        frequency=PaymentFrequency.ANNUALLY,
        timing=PaymentTiming.ARREARS,
        rou_carrying_amount=Decimal("248685.20"),
    )
    assert result.liability_after > liability_before
    assert result.rou_adjustment > 0
    assert result.gain_loss_on_termination == Decimal("0.00")


def test_security_deposit_present_value_and_unwinding_to_face_value():
    result = compute_security_deposit(
        deposit_amount=Decimal("120000"),
        paid_date=date(2026, 4, 1),
        expected_refund_date=date(2029, 4, 1),
        annual_discount_rate=Decimal("0.10"),
    )
    assert result.present_value < Decimal("120000")
    assert result.prepaid_rent_component == Decimal("120000.00") - result.present_value
    assert result.schedule[-1].closing_balance == Decimal("120000.00")


def test_short_term_exemption():
    assert qualifies_short_term(12, has_purchase_option=False) is True
    assert qualifies_short_term(13, has_purchase_option=False) is False
    assert qualifies_short_term(12, has_purchase_option=True) is False


def test_low_value_exemption():
    assert qualifies_low_value(Decimal("400000"), threshold=Decimal("500000")) is True
    assert qualifies_low_value(Decimal("600000"), threshold=Decimal("500000")) is False


def test_maturity_analysis_buckets():
    payments = generate_payment_schedule(
        commencement_date=date(2026, 1, 1),
        lease_term_months=84,
        frequency=PaymentFrequency.ANNUALLY,
        timing=PaymentTiming.ARREARS,
        base_payment_amount=Decimal("100000"),
    )
    buckets = maturity_analysis(payments, as_of_date=date(2026, 1, 1))
    total = sum((b.undiscounted_amount for b in buckets), Decimal("0"))
    assert total == Decimal("700000.00")
    assert buckets[-1].label == "Later than 5 years"
    assert buckets[-1].undiscounted_amount == Decimal("200000.00")


def test_weighted_average_discount_rate():
    rate = weighted_average_discount_rate(
        [(Decimal("100000"), Decimal("0.10")), (Decimal("300000"), Decimal("0.12"))]
    )
    # (100000*0.10 + 300000*0.12) / 400000 = 0.115
    assert rate == Decimal("0.11500")


def test_invalid_term_not_whole_number_of_periods_raises():
    with pytest.raises(ValueError):
        generate_payment_schedule(
            commencement_date=date(2026, 1, 1),
            lease_term_months=10,
            frequency=PaymentFrequency.QUARTERLY,
            timing=PaymentTiming.ARREARS,
            base_payment_amount=Decimal("1000"),
        )
