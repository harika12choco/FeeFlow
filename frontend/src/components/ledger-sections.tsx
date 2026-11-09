import { useState } from "react";
import {
  CalendarClock,
  CreditCard,
  GraduationCap,
  CalendarCheck2,
  BellRing,
} from "lucide-react";
import { Card, CardHeader, Button, EmptyState, Badge } from "./ui";
import { StatusBadge } from "./badges";
import { PaymentDialog } from "./PaymentDialog";
import { inr, formatDate, formatDateTime, REMINDER_KIND_LABELS, titleCase } from "../lib/format";
import type { InstalmentState, PaymentOut, ReminderOut, StudentDetail } from "../lib/types";

/** Instalment schedule with optional Pay action per row. */
export function InstalmentList({
  instalments,
  studentName,
  canPay,
  onPaid,
}: {
  instalments: InstalmentState[];
  studentName: string;
  canPay?: boolean;
  onPaid?: () => void;
}) {
  const [payFor, setPayFor] = useState<InstalmentState | null>(null);

  return (
    <Card>
      <CardHeader title="Instalments" subtitle="Schedule, balances and due dates" />
      <ul className="divide-y divide-navy-100">
        {instalments.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="flex-1 basis-48">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-navy-900">{i.label}</span>
                <StatusBadge status={i.status} />
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-navy-400">
                <CalendarClock className="h-3.5 w-3.5" />
                Due {formatDate(i.due_date)}
                {i.days_overdue > 0 && (
                  <span className="font-semibold text-rose-500">· {i.days_overdue}d overdue</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-navy-400">
                Paid {inr(i.paid)} of {inr(i.amount)}
              </p>
              <p className="font-bold text-navy-900">
                {i.balance > 0 ? `${inr(i.balance)} due` : "Cleared"}
              </p>
            </div>
            {canPay && i.balance > 0 && (
              <Button
                size="sm"
                variant="subtle"
                icon={<CreditCard className="h-3.5 w-3.5" />}
                onClick={() => setPayFor(i)}
              >
                Pay now
              </Button>
            )}
          </li>
        ))}
      </ul>

      {payFor && (
        <PaymentDialog
          open={!!payFor}
          onClose={() => setPayFor(null)}
          instalment={{ id: payFor.id, label: payFor.label, balance: payFor.balance }}
          studentName={studentName}
          onPaid={() => {
            onPaid?.();
          }}
        />
      )}
    </Card>
  );
}

export function PaymentHistory({ payments }: { payments: PaymentOut[] }) {
  const confirmed = payments.filter((p) => p.status === "confirmed");
  return (
    <Card>
      <CardHeader title="Payment history & receipts" subtitle={`${confirmed.length} confirmed payment(s)`} />
      {payments.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-6 w-6" />} title="No payments yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-100">
                <th className="ff-th">Receipt</th>
                <th className="ff-th text-right">Amount</th>
                <th className="ff-th">Status</th>
                <th className="ff-th">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="ff-td font-medium text-navy-800">{p.receipt_no ?? "—"}</td>
                  <td className="ff-td text-right font-semibold">{inr(p.amount)}</td>
                  <td className="ff-td"><StatusBadge status={p.status} /></td>
                  <td className="ff-td">{formatDateTime(p.confirmed_at ?? p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function AttendanceCard({ attendance }: { attendance: StudentDetail["attendance"] }) {
  const latest = attendance.at(-1);
  return (
    <Card>
      <CardHeader title="Attendance" subtitle="Monthly class attendance" />
      <div className="px-5 py-4">
        {attendance.length === 0 ? (
          <EmptyState icon={<CalendarCheck2 className="h-6 w-6" />} title="No attendance records" />
        ) : (
          <>
            {latest && (
              <div className="mb-4 flex items-end gap-2">
                <span className="text-3xl font-extrabold text-navy-900">{latest.percentage}%</span>
                <span className="mb-1 text-xs text-navy-400">latest ({latest.period})</span>
              </div>
            )}
            <div className="space-y-2.5">
              {attendance.map((a) => (
                <div key={a.period}>
                  <div className="mb-1 flex justify-between text-xs text-navy-500">
                    <span>{a.period}</span>
                    <span>
                      {a.present}/{a.total} · {a.percentage}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-navy-100">
                    <div
                      className={`h-full rounded-full ${
                        a.percentage < 60 ? "bg-rose-400" : a.percentage < 75 ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                      style={{ width: `${a.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

export function ScoresCard({ scores }: { scores: StudentDetail["test_scores"] }) {
  return (
    <Card>
      <CardHeader title="Test scores" subtitle="Recent assessments" />
      <div className="px-5 py-4">
        {scores.length === 0 ? (
          <EmptyState icon={<GraduationCap className="h-6 w-6" />} title="No test scores" />
        ) : (
          <ul className="space-y-3">
            {scores.map((s, idx) => (
              <li key={idx} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy-800">{s.test_name}</p>
                  <p className="text-xs text-navy-400">{formatDate(s.taken_on)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-navy-900">
                    {s.score}
                    <span className="text-sm font-normal text-navy-400">/{s.max_score}</span>
                  </p>
                  <Badge tone={s.percentage < 35 ? "red" : s.percentage < 50 ? "amber" : "green"}>
                    {s.percentage}%
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function ReminderMiniList({ reminders }: { reminders: ReminderOut[] }) {
  if (reminders.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Reminders" subtitle="Scheduled & sent notifications" />
      <ul className="divide-y divide-navy-100">
        {reminders.map((r) => (
          <li key={r.id} className="flex items-start gap-3 px-5 py-3">
            <span className="mt-0.5 text-navy-300">
              <BellRing className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-navy-700">
                  {REMINDER_KIND_LABELS[r.kind]}
                </span>
                <StatusBadge status={r.status} />
                <Badge tone="slate">{r.language.toUpperCase()}</Badge>
              </div>
              <p className="mt-1 text-xs text-navy-500">{r.message}</p>
              <p className="mt-1 text-[11px] text-navy-400">
                {titleCase(r.status)} · {formatDate(r.scheduled_for)}
                {r.channel ? ` · ${r.channel}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
