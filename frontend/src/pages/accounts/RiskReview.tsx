import { useState } from "react";
import { Link } from "react-router-dom";
import { Brain, Sparkles, Scale, CheckCircle2, ThumbsDown, RotateCcw, ClipboardList } from "lucide-react";
import { PageHeader } from "../../components/AccountsLayout";
import { Card, QueryState, Select, Button, Badge, EmptyState } from "../../components/ui";
import { RiskBadge } from "../../components/badges";
import { InfoNote } from "../../components/Notices";
import { useRiskActions, useRiskFlags } from "../../lib/queries";
import { errorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import type { RiskFlag } from "../../lib/types";

export default function RiskReview() {
  const [filters, setFilters] = useState({ status: "open", risk_level: "" });
  const [flash, setFlash] = useState<string | null>(null);
  const q = useRiskFlags(filters);
  const { assessAll, setStatus } = useRiskActions();

  function note(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3500);
  }

  return (
    <div>
      <PageHeader
        title="AI dropout-risk review"
        subtitle="Risk flags create counsellor review tasks — nothing financial changes automatically."
        action={
          <Button
            icon={<Sparkles className="h-4 w-4" />}
            loading={assessAll.isPending}
            onClick={() =>
              assessAll.mutate(undefined, {
                onSuccess: (r) => note(r.message),
                onError: (e) => note(errorMessage(e)),
              })
            }
          >
            Assess all students
          </Button>
        }
      />

      <div className="mb-5">
        <InfoNote>
          Signals used: missed instalments, days overdue, attendance % and test-score trend. If the
          AI provider is unavailable, FeeFlow falls back to a transparent{" "}
          <strong>rule-based</strong> engine (labelled accordingly) — it never pretends a result
          came from AI. A flag can only open a counsellor task; it never changes fees, adds
          penalties, or messages parents.
        </InfoNote>
      </div>

      {flash && (
        <div className="mb-5 rounded-xl border border-accent-200 bg-accent-50 px-4 py-2.5 text-sm font-medium text-accent-800">
          {flash}
        </div>
      )}

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="text-sm font-semibold text-navy-500">Filter</span>
          <Select
            className="sm:w-48"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="false_positive">False positive</option>
            <option value="resolved">Resolved</option>
          </Select>
          <Select
            className="sm:w-48"
            value={filters.risk_level}
            onChange={(e) => setFilters((f) => ({ ...f, risk_level: e.target.value }))}
          >
            <option value="">All risk levels</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </div>
      </Card>

      <QueryState
        isLoading={q.isLoading}
        isError={q.isError}
        error={errorMessage(q.error)}
        data={q.data}
        onRetry={() => q.refetch()}
        loadingLabel="Loading risk flags…"
        isEmpty={(d) => d.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={<Brain className="h-6 w-6" />}
              title="No flags for this filter"
              message="Run “Assess all students” to generate counsellor review tasks."
            />
          </Card>
        }
      >
        {(flags) => (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {flags.map((f) => (
              <FlagCard
                key={f.id}
                f={f}
                onStatus={(status) =>
                  setStatus.mutate(
                    { id: f.id, status },
                    { onSuccess: (r) => note(r.message), onError: (e) => note(errorMessage(e)) },
                  )
                }
                pending={setStatus.isPending}
              />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

function FlagCard({
  f,
  onStatus,
  pending,
}: {
  f: RiskFlag;
  onStatus: (status: string) => void;
  pending: boolean;
}) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            to={`/students/${f.student_id}`}
            className="text-base font-bold text-navy-900 hover:text-accent-600"
          >
            {f.student_name}
          </Link>
          <p className="text-xs text-navy-400">{f.student_code}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <RiskBadge level={f.risk_level} source={f.source} />
          {f.status !== "open" && (
            <Badge tone={f.status === "false_positive" ? "slate" : "green"}>
              {f.status === "false_positive" ? "False positive" : "Resolved"}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-navy-500">
        <span className="inline-flex items-center gap-1">
          <span className="font-semibold text-navy-800">Score</span> {f.score}/100
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-semibold text-navy-800">Confidence</span>{" "}
          {Math.round(f.confidence * 100)}%
        </span>
        <span className="inline-flex items-center gap-1">
          {f.source === "ai" ? <Sparkles className="h-3 w-3" /> : <Scale className="h-3 w-3" />}
          {f.source === "ai" ? `AI (${f.model})` : "Rule-based"}
        </span>
      </div>

      <div className="mt-4">
        <p className="ff-label">Reasons</p>
        <ul className="list-disc space-y-1 pl-4 text-sm text-navy-600">
          {f.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-xl bg-navy-50 px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy-500">
          <ClipboardList className="h-3.5 w-3.5" /> Counsellor task
        </p>
        <p className="mt-1 text-sm text-navy-700">{f.recommended_action}</p>
      </div>

      <p className="mt-3 text-xs text-navy-300">Flagged {formatDateTime(f.created_at)}</p>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-navy-100 pt-4">
        {f.status === "open" ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              onClick={() => onStatus("resolved")}
              loading={pending}
            >
              Mark resolved
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<ThumbsDown className="h-3.5 w-3.5" />}
              onClick={() => onStatus("false_positive")}
              loading={pending}
            >
              False positive
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={() => onStatus("open")}
            loading={pending}
          >
            Reopen
          </Button>
        )}
      </div>
    </Card>
  );
}
