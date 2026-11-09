import { useState } from "react";
import { BellRing, Send, Plus, XCircle, Languages } from "lucide-react";
import { PageHeader } from "../../components/AccountsLayout";
import { Card, CardHeader, QueryState, Select, Button, Badge, EmptyState } from "../../components/ui";
import { StatusBadge } from "../../components/badges";
import { InfoNote } from "../../components/Notices";
import { useReminders, useReminderActions, useStudents } from "../../lib/queries";
import { errorMessage } from "../../lib/api";
import { formatDate, REMINDER_KIND_LABELS, titleCase } from "../../lib/format";
import type { ReminderOut } from "../../lib/types";

export default function Reminders() {
  const [filters, setFilters] = useState({ student_id: "", status: "", kind: "" });
  const [genStudent, setGenStudent] = useState("");
  const [genLang, setGenLang] = useState("en");
  const [flash, setFlash] = useState<string | null>(null);

  const { data: students } = useStudents({});
  const q = useReminders(filters);
  const { generate, dispatch, cancel } = useReminderActions();

  function note(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3500);
  }

  return (
    <div>
      <PageHeader
        title="Reminder management"
        subtitle="Schedule, dispatch and cancel fee reminders in English & Hindi."
        action={
          <Button
            variant="secondary"
            icon={<Send className="h-4 w-4" />}
            loading={dispatch.isPending}
            onClick={() =>
              dispatch.mutate({}, { onSuccess: (r) => note(r.message), onError: (e) => note(errorMessage(e)) })
            }
          >
            Dispatch due now
          </Button>
        }
      />

      <div className="mb-5">
        <InfoNote>
          External SMS/WhatsApp providers are <strong>mocked</strong>, but reminder records,
          scheduling, dispatch and cancellation are real. Reminders are auto-cancelled when an
          instalment is fully paid. Schedule: 3 days before, on the due date, and 3 days after.
        </InfoNote>
      </div>

      {flash && (
        <div className="mb-5 rounded-xl border border-accent-200 bg-accent-50 px-4 py-2.5 text-sm font-medium text-accent-800">
          {flash}
        </div>
      )}

      {/* Generate */}
      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <span className="ff-label">Generate reminders for</span>
            <Select value={genStudent} onChange={(e) => setGenStudent(e.target.value)}>
              <option value="">All students</option>
              {students?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.student_code}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-40">
            <span className="ff-label">Language</span>
            <Select value={genLang} onChange={(e) => setGenLang(e.target.value)}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </Select>
          </div>
          <Button
            icon={<Plus className="h-4 w-4" />}
            loading={generate.isPending}
            onClick={() =>
              generate.mutate(
                {
                  student_id: genStudent ? Number(genStudent) : undefined,
                  language: genLang,
                },
                { onSuccess: (r) => note(r.message), onError: (e) => note(errorMessage(e)) },
              )
            }
          >
            Generate
          </Button>
        </div>
      </Card>

      {/* Filters + history */}
      <Card>
        <CardHeader
          title="Reminder history"
          subtitle="Every scheduled, sent and cancelled reminder"
          action={
            <div className="flex gap-2">
              <Select
                className="py-1.5 text-xs"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">All statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="sent">Sent</option>
                <option value="cancelled">Cancelled</option>
              </Select>
              <Select
                className="py-1.5 text-xs"
                value={filters.kind}
                onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))}
              >
                <option value="">All types</option>
                <option value="before_due">Before due</option>
                <option value="on_due">On due date</option>
                <option value="after_due">After due</option>
              </Select>
            </div>
          }
        />
        <QueryState
          isLoading={q.isLoading}
          isError={q.isError}
          error={errorMessage(q.error)}
          data={q.data}
          onRetry={() => q.refetch()}
          loadingLabel="Loading reminders…"
          isEmpty={(d) => d.length === 0}
          empty={
            <EmptyState
              icon={<BellRing className="h-6 w-6" />}
              title="No reminders yet"
              message="Generate reminders for unpaid instalments to get started."
            />
          }
        >
          {(reminders) => (
            <ul className="divide-y divide-navy-100">
              {reminders.map((r) => (
                <ReminderRow
                  key={r.id}
                  r={r}
                  studentName={students?.find((s) => s.id === r.student_id)?.name}
                  onCancel={() =>
                    cancel.mutate(r.id, {
                      onSuccess: () => note("Reminder cancelled."),
                      onError: (e) => note(errorMessage(e)),
                    })
                  }
                  cancelling={cancel.isPending}
                />
              ))}
            </ul>
          )}
        </QueryState>
      </Card>
    </div>
  );
}

function ReminderRow({
  r,
  studentName,
  onCancel,
  cancelling,
}: {
  r: ReminderOut;
  studentName?: string;
  onCancel: () => void;
  cancelling: boolean;
}) {
  return (
    <li className="flex flex-wrap items-start gap-3 px-5 py-4">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-400">
        <BellRing className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-navy-800">{studentName ?? `Student #${r.student_id}`}</span>
          <StatusBadge status={r.status} />
          <Badge tone="indigo">{REMINDER_KIND_LABELS[r.kind]}</Badge>
          <Badge tone="slate">
            <Languages className="h-3 w-3" />
            {r.language.toUpperCase()}
          </Badge>
        </div>
        <p className="mt-1.5 text-sm text-navy-600">{r.message}</p>
        <p className="mt-1 text-xs text-navy-400">
          Scheduled {formatDate(r.scheduled_for)} · via {r.channel}
          {r.status === "cancelled" && r.cancel_reason ? ` · ${r.cancel_reason}` : ""}
        </p>
      </div>
      {r.status === "scheduled" && (
        <Button
          size="sm"
          variant="ghost"
          icon={<XCircle className="h-3.5 w-3.5" />}
          onClick={onCancel}
          loading={cancelling}
        >
          Cancel
        </Button>
      )}
      {r.status !== "scheduled" && (
        <span className="text-xs text-navy-300">{titleCase(r.status)}</span>
      )}
    </li>
  );
}
