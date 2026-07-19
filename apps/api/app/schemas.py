from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from .engine.models import EscalationType, PaymentFrequency, PaymentTiming


# ---------------------------------------------------------------------------
# Auth / organizations
# ---------------------------------------------------------------------------
class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str
    organization_name: str
    reporting_standard: str = "IND_AS_116"


class OrganizationOut(BaseModel):
    id: UUID
    name: str
    cin: Optional[str] = None
    gstin: Optional[str] = None
    functional_currency: str
    reporting_standard: str
    fiscal_year_start_month: int
    low_value_asset_threshold: Decimal
    short_term_threshold_months: int


class ProfileOut(BaseModel):
    id: UUID
    org_id: UUID
    full_name: Optional[str] = None
    role: str
    created_at: datetime


class UserCreate(BaseModel):
    email: str
    full_name: str
    role: str = "VIEWER"


class UserCreateResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    temporary_password: str


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    cin: Optional[str] = None
    gstin: Optional[str] = None
    functional_currency: Optional[str] = None
    fiscal_year_start_month: Optional[int] = None
    low_value_asset_threshold: Optional[Decimal] = None
    short_term_threshold_months: Optional[int] = None


# ---------------------------------------------------------------------------
# Lessors
# ---------------------------------------------------------------------------
class LessorCreate(BaseModel):
    name: str
    gstin: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    bank_details: Optional[dict] = None


class LessorOut(LessorCreate):
    id: UUID
    org_id: UUID
    created_at: datetime


# ---------------------------------------------------------------------------
# Leases
# ---------------------------------------------------------------------------
class LeaseCreate(BaseModel):
    lessor_id: UUID
    lease_code: str
    asset_name: str
    asset_category: str = "Other"
    location: Optional[str] = None

    commencement_date: date
    lease_term_months: int = Field(gt=0)
    non_cancellable_period_months: int
    renewal_option_months: int = 0
    reasonably_certain_to_renew: bool = False
    termination_option_months: int = 0
    reasonably_certain_to_terminate_early: bool = False

    payment_frequency: PaymentFrequency = PaymentFrequency.MONTHLY
    payment_timing: PaymentTiming = PaymentTiming.ARREARS
    base_payment_amount: Decimal
    escalation_type: EscalationType = EscalationType.NONE
    escalation_percent: Decimal = Decimal("0")
    escalation_frequency_months: int = 12

    discount_rate_annual: Decimal
    currency: str = "INR"

    initial_direct_costs: Decimal = Decimal("0")
    lease_incentives: Decimal = Decimal("0")
    restoration_cost_estimate: Decimal = Decimal("0")
    prepaid_rent: Decimal = Decimal("0")

    is_short_term: bool = False
    is_low_value: bool = False
    useful_life_months: Optional[int] = None

    gst_applicable: bool = False
    gst_rate: Decimal = Decimal("0")
    tds_applicable: bool = False
    tds_rate: Decimal = Decimal("0")

    notes: Optional[str] = None


class LeaseOut(LeaseCreate):
    id: UUID
    org_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime


class LeaseUpdate(BaseModel):
    """Partial update -- same fields as create, all optional. Changing
    commencement/term/rate/payments after ACTIVE should go through the
    /modify (remeasurement) endpoint, not a plain PATCH."""
    lease_code: Optional[str] = None
    asset_name: Optional[str] = None
    asset_category: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class PaymentOverride(BaseModel):
    period_number: int
    amount: Decimal


class CalculateLeaseRequest(BaseModel):
    payment_overrides: list[PaymentOverride] = Field(default_factory=list)


class LiabilityScheduleRowOut(BaseModel):
    period_number: int
    period_start: date
    period_end: date
    opening_liability: Decimal
    interest_expense: Decimal
    payment: Decimal
    closing_liability: Decimal


class RouScheduleRowOut(BaseModel):
    period_number: int
    period_start: date
    period_end: date
    opening_nbv: Decimal
    depreciation: Decimal
    impairment: Decimal
    closing_nbv: Decimal


class CalculateLeaseResponse(BaseModel):
    lease_liability: Decimal
    rou_asset: Decimal
    liability_schedule: list[LiabilityScheduleRowOut]
    rou_schedule: list[RouScheduleRowOut]


# ---------------------------------------------------------------------------
# Modifications / remeasurement
# ---------------------------------------------------------------------------
class ModificationRequest(BaseModel):
    modification_date: date
    modification_type: str
    description: Optional[str] = None
    revised_discount_rate: Optional[Decimal] = None
    revised_term_months: Optional[int] = None
    revised_payment_amount: Optional[Decimal] = None
    reduction_ratio: Optional[Decimal] = None  # for SCOPE_DECREASE / PARTIAL_TERMINATION


class ModificationOut(BaseModel):
    id: UUID
    lease_id: UUID
    modification_date: date
    modification_type: str
    liability_before: Optional[Decimal] = None
    liability_after: Optional[Decimal] = None
    rou_adjustment: Optional[Decimal] = None
    gain_loss_on_termination: Optional[Decimal] = None


# ---------------------------------------------------------------------------
# Security deposits
# ---------------------------------------------------------------------------
class SecurityDepositCreate(BaseModel):
    deposit_amount: Decimal
    paid_date: date
    refundable: bool = True
    expected_refund_date: date
    discount_rate_annual: Decimal


class SecurityDepositOut(SecurityDepositCreate):
    id: UUID
    lease_id: UUID
    present_value: Decimal
    prepaid_rent_component: Decimal


# ---------------------------------------------------------------------------
# Journals
# ---------------------------------------------------------------------------
class JournalLineOut(BaseModel):
    account_code: str
    account_name: str
    debit: Decimal
    credit: Decimal
    description: Optional[str] = None


class JournalEntryOut(BaseModel):
    id: UUID
    lease_id: Optional[UUID]
    entry_date: date
    entry_type: str
    narration: Optional[str]
    status: str
    lines: list[JournalLineOut] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Reports / disclosures
# ---------------------------------------------------------------------------
class MaturityBucketOut(BaseModel):
    label: str
    undiscounted_amount: Decimal


class DisclosureSummary(BaseModel):
    total_rou_asset_nbv: Decimal
    total_lease_liability: Decimal
    weighted_average_discount_rate: Decimal
    maturity_analysis: list[MaturityBucketOut]
    total_cash_outflow_ytd: Decimal
