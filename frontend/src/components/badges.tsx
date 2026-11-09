import { Badge } from "./ui";
import { titleCase } from "../lib/format";
import { ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles, Scale } from "lucide-react";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "indigo" | "neutral" | "slate"> = {
  paid: "green",
  confirmed: "green",
  sent: "green",
  approved: "green",
  processed: "green",
  resolved: "green",
  overdue: "red",
  rejected: "red",
  part_paid: "amber",
  partial: "amber",
  pending: "amber",
  requested: "amber",
  scheduled: "indigo",
  upcoming: "indigo",
  open: "amber",
  cancelled: "slate",
  false_positive: "slate",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{titleCase(status)}</Badge>;
}

export function RiskBadge({
  level,
  source,
}: {
  level: "low" | "medium" | "high" | null;
  source?: "ai" | "rule_based";
}) {
  if (!level) return <span className="text-xs text-navy-300">—</span>;
  const tone = level === "high" ? "red" : level === "medium" ? "amber" : "green";
  const Icon = level === "high" ? ShieldAlert : level === "medium" ? ShieldQuestion : ShieldCheck;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={tone}>
        <Icon className="h-3.5 w-3.5" />
        {level[0].toUpperCase() + level.slice(1)} risk
      </Badge>
      {source && (
        <Badge tone="slate" className="font-medium">
          {source === "ai" ? <Sparkles className="h-3 w-3" /> : <Scale className="h-3 w-3" />}
          {source === "ai" ? "AI" : "Rule-based"}
        </Badge>
      )}
    </span>
  );
}
