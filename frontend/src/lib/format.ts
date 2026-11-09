// Formatting helpers for currency, dates and labels.

export function inr(amount: number | null | undefined, opts?: { decimals?: boolean }): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts?.decimals ? 2 : 0,
    minimumFractionDigits: opts?.decimals ? 2 : 0,
  }).format(amount);
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d.endsWith("Z") || d.includes("+") ? d : d + "Z");
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  overdue: "Overdue",
  part_paid: "Part paid",
  partial: "Part paid",
  upcoming: "Upcoming",
  pending: "Pending",
  scheduled: "Scheduled",
  sent: "Sent",
  cancelled: "Cancelled",
  confirmed: "Confirmed",
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  processed: "Processed",
  open: "Open",
  false_positive: "False positive",
  resolved: "Resolved",
};

export function titleCase(s: string): string {
  return STATUS_LABELS[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const REMINDER_KIND_LABELS: Record<string, string> = {
  before_due: "Before due",
  on_due: "On due date",
  after_due: "After due",
};
