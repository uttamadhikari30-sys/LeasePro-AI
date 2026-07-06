from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import Enum


class PaymentFrequency(str, Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    HALF_YEARLY = "HALF_YEARLY"
    ANNUALLY = "ANNUALLY"


PERIODS_PER_YEAR = {
    PaymentFrequency.MONTHLY: 12,
    PaymentFrequency.QUARTERLY: 4,
    PaymentFrequency.HALF_YEARLY: 2,
    PaymentFrequency.ANNUALLY: 1,
}

MONTHS_PER_PERIOD = {
    PaymentFrequency.MONTHLY: 1,
    PaymentFrequency.QUARTERLY: 3,
    PaymentFrequency.HALF_YEARLY: 6,
    PaymentFrequency.ANNUALLY: 12,
}


class PaymentTiming(str, Enum):
    ADVANCE = "ADVANCE"   # annuity-due: paid at the start of each period
    ARREARS = "ARREARS"   # ordinary annuity: paid at the end of each period


class EscalationType(str, Enum):
    NONE = "NONE"
    FIXED_PERCENT = "FIXED_PERCENT"
    CUSTOM = "CUSTOM"


@dataclass
class PaymentLine:
    period_number: int          # 1-indexed
    due_date: date
    amount: Decimal


@dataclass
class InitialRecognitionResult:
    lease_liability: Decimal
    rou_asset: Decimal
    initial_direct_costs: Decimal
    lease_incentives: Decimal
    restoration_cost_estimate: Decimal
    prepaid_rent: Decimal


@dataclass
class LiabilityScheduleRow:
    period_number: int
    period_start: date
    period_end: date
    opening_liability: Decimal
    interest_expense: Decimal
    payment: Decimal
    closing_liability: Decimal


@dataclass
class RouScheduleRow:
    period_number: int
    period_start: date
    period_end: date
    opening_nbv: Decimal
    depreciation: Decimal
    impairment: Decimal
    closing_nbv: Decimal


@dataclass
class RemeasurementResult:
    liability_before: Decimal
    liability_after: Decimal
    rou_adjustment: Decimal
    gain_loss_on_termination: Decimal = Decimal("0")


@dataclass
class SecurityDepositScheduleRow:
    period_number: int
    period_date: date
    opening_balance: Decimal
    interest_income: Decimal
    closing_balance: Decimal


@dataclass
class SecurityDepositResult:
    present_value: Decimal
    prepaid_rent_component: Decimal
    schedule: list = field(default_factory=list)


@dataclass
class MaturityBucket:
    label: str
    undiscounted_amount: Decimal
