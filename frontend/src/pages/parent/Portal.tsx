import { useState } from "react";
import { CalendarClock, CheckCircle2, CreditCard, Sparkles } from "lucide-react";
import { Card, QueryState, Button, Badge } from "../../components/ui";
import {
  InstalmentList,
  PaymentHistory,
  AttendanceCard,
  ScoresCard,
  ReminderMiniList,
} from "../../components/ledger-sections";
import { PaymentDialog } from "../../components/PaymentDialog";
import { SampleDataBanner } from "../../components/Notices";
import { useParentPortal } from "../../lib/queries";
import { inr, formatDate } from "../../lib/format";
import { errorMessage } from "../../lib/api";
import type { InstalmentState, StudentDetail } from "../../lib/types";

export default function Portal() {
  const q = useParentPortal();
  return (
    <div>
      <QueryState
        isLoading={q.isLoading}
        isError={q.isError}
        error={errorMessage(q.error)}
        data={q.data}
        onRetry={() => q.refetch()}
        loadingLabel="Loading your portal…"
      >
        {(d) => <PortalBody d={d} refetch={() => q.refetch()} />}
      </QueryState>
    </div>
  );
}

function PortalBody({ d, refetch }: { d: StudentDetail; refetch: () => void }) {
  const { student, ledger } = d;
  const [payFor, setPayFor] = useState<InstalmentState | null>(null);

  // Next instalment with a balance — the primary call to action.
  const nextDue = ledger.instalments.find((i) => i.balance > 0);
  const settled = ledger.outstanding <= 0;

  // Collect reminders across instalments for a flat history.
  const reminders = ledger.instalments.flatMap((i) => i.reminders ?? []);

  return (
    <div className="space-y-5">
      <SampleDataBanner />

      {/* HERO — 5-second summary */}
      <Card className="overflow-hidden">
        <div className="ff-hero px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-navy-300">
                {student.name}
              </p>
              <p className="text-xs text-navy-400">
                {student.program} · {student.batch}
              </p>
            </div>
            <Badge tone="slate">{student.student_code}</Badge>
          </div>

          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-widest text-navy-300">
              Total outstanding
            </p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight">{inr(ledger.outstanding)}</p>
            {settled ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> All fees cleared. Thank you!
              </p>
            ) : (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-navy-200">
                <CalendarClock className="h-4 w-4" />
                Next due {formatDate(ledger.next_due_date)}
                {ledger.max_days_overdue > 0 && (
                  <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-xs font-semibold text-white">
                    {ledger.max_days_overdue}d overdue
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {!settled && nextDue && (
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-navy-800">{nextDue.label}</p>
              <p className="text-xs text-navy-400">
                {inr(nextDue.balance)} due · {formatDate(nextDue.due_date)}
              </p>
            </div>
            <Button
              className="w-full sm:w-auto"
              icon={<CreditCard className="h-4 w-4" />}
              onClick={() => setPayFor(nextDue)}
            >
              Pay {inr(nextDue.balance)} now
            </Button>
          </div>
        )}
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Net fees" value={inr(ledger.net_payable)} />
        <MiniStat label="Paid" value={inr(ledger.total_paid)} tone="green" />
        <MiniStat label="Outstanding" value={inr(ledger.outstanding)} tone="indigo" />
      </div>

      <InstalmentList
        instalments={ledger.instalments}
        studentName={student.name}
        canPay
        onPaid={refetch}
      />

      <PaymentHistory payments={d.payments} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <AttendanceCard attendance={d.attendance} />
        <ScoresCard scores={d.test_scores} />
      </div>

      <ReminderMiniList reminders={reminders} />

      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-navy-300">
        <Sparkles className="h-3.5 w-3.5" /> Payments are simulated for this demo. Receipts are
        generated instantly after confirmation.
      </p>

      {payFor && (
        <PaymentDialog
          open={!!payFor}
          onClose={() => setPayFor(null)}
          instalment={{ id: payFor.id, label: payFor.label, balance: payFor.balance }}
          studentName={student.name}
          onPaid={refetch}
        />
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "navy",
}: {
  label: string;
  value: string;
  tone?: "navy" | "green" | "indigo";
}) {
  const color = { navy: "text-navy-900", green: "text-emerald-600", indigo: "text-accent-600" }[tone];
  return (
    <Card className="p-3.5 text-center">
      <p className="ff-label mb-0.5">{label}</p>
      <p className={`text-base font-extrabold ${color}`}>{value}</p>
    </Card>
  );
}
