// Shared API types (mirror the backend serializers).

export type Role = "accounts" | "parent";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: Role;
  full_name: string;
}

export type InstalmentStatus = "paid" | "partial" | "pending" | "overdue";
export type LedgerStatus = "paid" | "overdue" | "part_paid" | "upcoming";

export interface PaymentOut {
  id: number;
  amount: number;
  status: "pending" | "confirmed" | "failed";
  method: string;
  receipt_no: string | null;
  idempotency_key: string;
  created_at: string;
  confirmed_at: string | null;
  instalment_id: number;
}

export interface ReminderOut {
  id: number;
  student_id: number;
  instalment_id: number;
  kind: "before_due" | "on_due" | "after_due";
  channel: string;
  language: "en" | "hi";
  scheduled_for: string;
  status: "scheduled" | "sent" | "cancelled";
  message: string;
  sent_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface InstalmentState {
  id: number;
  seq: number;
  label: string;
  amount: number;
  paid: number;
  balance: number;
  due_date: string;
  status: InstalmentStatus;
  days_overdue: number;
  payments?: PaymentOut[];
  reminders?: ReminderOut[];
}

export interface Ledger {
  gross_amount: number;
  discount_total: number;
  net_payable: number;
  total_paid: number;
  outstanding: number;
  overdue_amount: number;
  max_days_overdue: number;
  next_due_date: string | null;
  status: LedgerStatus;
  instalments: InstalmentState[];
  missed_instalments: number;
}

export interface StudentSummary {
  id: number;
  student_code: string;
  name: string;
  program: string;
  batch: string;
  centre: string;
  is_sample: boolean;
  parent: { id: number; full_name: string; email: string } | null;
  net_payable: number;
  total_paid: number;
  outstanding: number;
  overdue_amount: number;
  days_overdue: number;
  next_due_date: string | null;
  status: LedgerStatus;
  risk_level: "low" | "medium" | "high" | null;
}

export interface StudentDetail {
  student: {
    id: number;
    student_code: string;
    name: string;
    program: string;
    batch: string;
    centre: string;
    is_sample: boolean;
    enrolled_on: string;
    course_start: string;
    course_end: string;
    parent: { id: number; full_name: string; email: string } | null;
  };
  fee_plan: {
    name: string;
    gross_amount: number;
    discounts: { label: string; amount: number }[];
  };
  ledger: Ledger;
  payments: PaymentOut[];
  receipts: PaymentOut[];
  attendance: { period: string; present: number; total: number; percentage: number }[];
  test_scores: {
    test_name: string;
    taken_on: string;
    score: number;
    max_score: number;
    percentage: number;
  }[];
  risk_flags: RiskFlag[];
}

export interface RiskFlag {
  id: number;
  student_id: number;
  student_name: string | null;
  student_code: string | null;
  risk_level: "low" | "medium" | "high";
  score: number;
  reasons: string[];
  recommended_action: string;
  confidence: number;
  source: "ai" | "rule_based";
  model: string | null;
  status: "open" | "false_positive" | "resolved";
  counsellor_task: string;
  created_at: string;
  resolved_at: string | null;
}

export interface DashboardStats {
  totals: {
    total_billed: number;
    total_collected: number;
    outstanding: number;
    overdue: number;
    collection_rate: number;
    student_count: number;
  };
  dues_by_centre: { centre: string; outstanding: number }[];
  dues_by_batch: { batch: string; outstanding: number }[];
  ageing: { bucket: string; amount: number }[];
  high_risk_students: {
    student_id: number;
    student_code: string;
    name: string;
    centre: string;
    batch: string;
    risk_level: "low" | "medium" | "high";
    score: number;
    source: "ai" | "rule_based";
    outstanding: number;
  }[];
}

export interface RefundPolicy {
  key: string;
  name: string;
  type: "linear" | "slab";
  description: string;
  assumptions: string[];
}

export interface RefundStep {
  label: string;
  value: number;
  note?: string;
  total?: boolean;
}

export interface RefundResult {
  policy_key: string;
  policy_name: string;
  assumptions: string[];
  inputs: {
    paid_amount: number;
    course_start: string;
    course_end: string;
    as_of: string;
    total_days: number;
    elapsed_days: number;
    remaining_days: number;
    elapsed_percent: number;
    remaining_percent: number;
  };
  steps: RefundStep[];
  net_refund: number;
  student?: { id: number; name: string; student_code: string };
}

export interface RefundRecord {
  id: number;
  student_id: number;
  student_name: string | null;
  policy_key: string;
  reason: string;
  paid_amount: number;
  computed_refund: number;
  breakdown: RefundResult;
  status: "requested" | "approved" | "rejected" | "processed";
  created_at: string;
  decided_at: string | null;
}

export interface FilterOptions {
  centres: string[];
  batches: string[];
  programs: string[];
}
