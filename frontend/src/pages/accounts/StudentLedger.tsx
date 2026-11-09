import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, Mail, MapPin, Tag } from "lucide-react";
import { Card, CardHeader, QueryState, Button, Badge, EmptyState } from "../../components/ui";
import { StatusBadge, RiskBadge } from "../../components/badges";
import {
  InstalmentList,
  PaymentHistory,
  AttendanceCard,
  ScoresCard,
} from "../../components/ledger-sections";
import { useStudent, useRiskActions } from "../../lib/queries";
import { inr, formatDate, formatDateTime } from "../../lib/format";
import { errorMessage } from "../../lib/api";
import type { StudentDetail } from "../../lib/types";

export default function StudentLedger() {
  const { id } = useParams();
  const navigate = useNavigate();
  const q = useStudent(id);

  return (
    <div>
      <button
        onClick={() => navigate("/students")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-500 hover:text-navy-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to ledger
      </button>

      <QueryState
        isLoading={q.isLoading}
        isError={q.isError}
        error={errorMessage(q.error)}
        data={q.data}
        onRetry={() => q.refetch()}
        loadingLabel="Loading student ledger…"
      >
        {(d) => <LedgerBody d={d} refetch={() => q.refetch()} />}
      </QueryState>
    </div>
  );
}

function LedgerBody({ d, refetch }: { d: StudentDetail; refetch: () => void }) {
  const { student, fee_plan, ledger } = d;
  const risk = useRiskActions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-navy-900">{student.name}</h1>
              <Badge tone="slate">{student.student_code}</Badge>
              {student.is_sample && <Badge tone="amber">Sample data</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-400">
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> {student.program} · {student.batch}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {student.centre}
              </span>
              {student.parent && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {student.parent.email}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={ledger.status} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Net payable" value={inr(ledger.net_payable)} />
          <Metric label="Collected" value={inr(ledger.total_paid)} tone="green" />
          <Metric label="Outstanding" value={inr(ledger.outstanding)} tone="indigo" />
          <Metric
            label="Overdue"
            value={inr(ledger.overdue_amount)}
            tone={ledger.overdue_amount > 0 ? "red" : "navy"}
            hint={ledger.max_days_overdue > 0 ? `${ledger.max_days_overdue} days` : undefined}
          />
        </div>

        {fee_plan.discounts.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-navy-100 pt-4 text-xs text-navy-500">
            <span className="font-semibold">Discounts:</span>
            {fee_plan.discounts.map((dc) => (
              <Badge key={dc.label} tone="green">
                {dc.label} −{inr(dc.amount)}
              </Badge>
            ))}
            <span className="text-navy-400">
              (Gross {inr(fee_plan.gross_amount)} → Net {inr(ledger.net_payable)})
            </span>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <InstalmentList
            instalments={ledger.instalments}
            studentName={student.name}
            canPay
            onPaid={refetch}
          />
          <PaymentHistory payments={d.payments} />
        </div>

        <div className="space-y-6">
          {/* Risk */}
          <Card>
            <CardHeader
              title="Dropout risk"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Brain className="h-3.5 w-3.5" />}
                  loading={risk.assess.isPending}
                  onClick={() =>
                    risk.assess.mutate(
                      { student_id: student.id, use_ai: true },
                      { onSuccess: refetch },
                    )
                  }
                >
                  Assess now
                </Button>
              }
            />
            <div className="px-5 py-4">
              {d.risk_flags.length === 0 ? (
                <EmptyState
                  icon={<Brain className="h-6 w-6" />}
                  title="Not assessed yet"
                  message="Run an assessment to create a counsellor review task."
                />
              ) : (
                <RiskFlagSummary flag={d.risk_flags[0]} />
              )}
            </div>
          </Card>

          <AttendanceCard attendance={d.attendance} />
          <ScoresCard scores={d.test_scores} />
        </div>
      </div>

      <p className="text-center text-xs text-navy-300">
        Enrolled {formatDate(student.enrolled_on)} · Course {formatDate(student.course_start)} –{" "}
        {formatDate(student.course_end)}
      </p>
    </div>
  );
}

function RiskFlagSummary({ flag }: { flag: StudentDetail["risk_flags"][number] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <RiskBadge level={flag.risk_level} source={flag.source} />
        <span className="text-xs text-navy-400">
          {Math.round(flag.confidence * 100)}% confidence
        </span>
      </div>
      <div>
        <p className="ff-label">Why</p>
        <ul className="list-disc space-y-1 pl-4 text-sm text-navy-600">
          {flag.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="ff-label">Recommended action</p>
        <p className="text-sm text-navy-600">{flag.recommended_action}</p>
      </div>
      <p className="text-xs text-navy-300">
        <Link to="/risk" className="font-semibold text-accent-600 hover:underline">
          Manage in risk review
        </Link>{" "}
        · {formatDateTime(flag.created_at)}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "navy",
  hint,
}: {
  label: string;
  value: string;
  tone?: "navy" | "green" | "indigo" | "red";
  hint?: string;
}) {
  const color = {
    navy: "text-navy-900",
    green: "text-emerald-600",
    indigo: "text-accent-600",
    red: "text-rose-600",
  }[tone];
  return (
    <div>
      <p className="ff-label mb-0.5">{label}</p>
      <p className={`text-lg font-extrabold ${color}`}>{value}</p>
      {hint && <p className="text-xs text-rose-500">{hint}</p>}
    </div>
  );
}
