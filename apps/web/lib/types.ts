export type PaymentFrequency = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUALLY";
export type PaymentTiming = "ADVANCE" | "ARREARS";
export type EscalationType = "NONE" | "FIXED_PERCENT" | "CUSTOM";
export type LeaseStatus = "DRAFT" | "ACTIVE" | "MODIFIED" | "TERMINATED" | "EXPIRED";
export type ModificationType =
  | "TERM_EXTENSION"
  | "TERM_REDUCTION"
  | "SCOPE_INCREASE"
  | "SCOPE_DECREASE"
  | "RATE_CHANGE"
  | "PRICE_CHANGE"
  | "FULL_TERMINATION"
  | "PARTIAL_TERMINATION";

export type UserRole = "ADMIN" | "ACCOUNTANT" | "APPROVER" | "VIEWER";

export interface Profile {
  id: string;
  org_id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface UserCreateResponse {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  temporary_password: string;
}

export interface Organization {
  id: string;
  name: string;
  cin: string | null;
  gstin: string | null;
  functional_currency: string;
  reporting_standard: "IND_AS_116" | "IFRS_16";
  fiscal_year_start_month: number;
  low_value_asset_threshold: string;
  short_term_threshold_months: number;
}

export interface Lessor {
  id: string;
  org_id: string;
  name: string;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

export interface Lease {
  id: string;
  org_id: string;
  lessor_id: string;
  lease_code: string;
  asset_name: string;
  asset_category: string;
  location: string | null;
  commencement_date: string;
  lease_term_months: number;
  non_cancellable_period_months: number;
  renewal_option_months: number;
  reasonably_certain_to_renew: boolean;
  termination_option_months: number;
  reasonably_certain_to_terminate_early: boolean;
  payment_frequency: PaymentFrequency;
  payment_timing: PaymentTiming;
  base_payment_amount: string;
  escalation_type: EscalationType;
  escalation_percent: string;
  escalation_frequency_months: number;
  discount_rate_annual: string;
  currency: string;
  initial_direct_costs: string;
  lease_incentives: string;
  restoration_cost_estimate: string;
  prepaid_rent: string;
  is_short_term: boolean;
  is_low_value: boolean;
  useful_life_months: number | null;
  gst_applicable: boolean;
  gst_rate: string;
  tds_applicable: boolean;
  tds_rate: string;
  status: LeaseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaseRegisterRow extends Lease {
  lessors: { name: string } | null;
  current_lease_liability: string | null;
  current_rou_nbv: string | null;
}

export interface LiabilityScheduleRow {
  period_number: number;
  period_start: string;
  period_end: string;
  opening_liability: string;
  interest_expense: string;
  payment: string;
  closing_liability: string;
}

export interface RouScheduleRow {
  period_number: number;
  period_start: string;
  period_end: string;
  opening_nbv: string;
  depreciation: string;
  impairment: string;
  closing_nbv: string;
}

export interface CalculateLeaseResponse {
  lease_liability: string;
  rou_asset: string;
  liability_schedule: LiabilityScheduleRow[];
  rou_schedule: RouScheduleRow[];
}

export interface JournalLine {
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
  description: string | null;
}

export interface JournalEntry {
  id: string;
  lease_id: string | null;
  entry_date: string;
  entry_type: string;
  narration: string | null;
  status: string;
  lines: JournalLine[];
}

export interface MaturityBucket {
  label: string;
  undiscounted_amount: string;
}

export interface DisclosureSummary {
  total_rou_asset_nbv: string;
  total_lease_liability: string;
  weighted_average_discount_rate: string;
  maturity_analysis: MaturityBucket[];
  total_cash_outflow_ytd: string;
}
