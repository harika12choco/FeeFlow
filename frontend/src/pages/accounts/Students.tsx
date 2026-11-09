import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, ChevronRight } from "lucide-react";
import { PageHeader } from "../../components/AccountsLayout";
import { Card, QueryState, Select, Input, EmptyState } from "../../components/ui";
import { StatusBadge, RiskBadge } from "../../components/badges";
import { SampleDataBanner } from "../../components/Notices";
import { useFilterOptions, useStudents } from "../../lib/queries";
import { inr, formatDate } from "../../lib/format";
import { errorMessage } from "../../lib/api";
import type { StudentSummary } from "../../lib/types";

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "overdue", label: "Overdue" },
  { value: "part_paid", label: "Part paid" },
  { value: "upcoming", label: "Upcoming" },
  { value: "paid", label: "Paid" },
];

export default function Students() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ centre: "", batch: "", program: "", status: "", search: "" });
  const { data: opts } = useFilterOptions();
  const q = useStudents(filters);

  return (
    <div>
      <PageHeader
        title="Student fee ledger"
        subtitle="Every student's fee plan, payments and outstanding balance."
      />
      <SampleDataBanner />

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="relative md:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
            <Input
              className="pl-9"
              placeholder="Search name / ID"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <Select value={filters.centre} onChange={(e) => setFilters((f) => ({ ...f, centre: e.target.value }))}>
            <option value="">All centres</option>
            {opts?.centres.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={filters.batch} onChange={(e) => setFilters((f) => ({ ...f, batch: e.target.value }))}>
            <option value="">All batches</option>
            {opts?.batches.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
          <Select value={filters.program} onChange={(e) => setFilters((f) => ({ ...f, program: e.target.value }))}>
            <option value="">All programs</option>
            {opts?.programs.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
      </Card>

      <Card>
        <QueryState
          isLoading={q.isLoading}
          isError={q.isError}
          error={errorMessage(q.error)}
          data={q.data}
          onRetry={() => q.refetch()}
          loadingLabel="Loading students…"
          isEmpty={(d) => d.length === 0}
          empty={
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No students match"
              message="Try clearing the filters or search term."
            />
          }
        >
          {(students) => (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-navy-100">
                      <th className="ff-th">Student</th>
                      <th className="ff-th">Program / batch</th>
                      <th className="ff-th text-right">Outstanding</th>
                      <th className="ff-th">Next due</th>
                      <th className="ff-th">Status</th>
                      <th className="ff-th">Risk</th>
                      <th className="ff-th" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {students.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="cursor-pointer transition hover:bg-navy-50/60"
                      >
                        <td className="ff-td">
                          <div className="font-semibold text-navy-900">{s.name}</div>
                          <div className="text-xs text-navy-400">{s.student_code}</div>
                        </td>
                        <td className="ff-td">
                          <div>{s.program}</div>
                          <div className="text-xs text-navy-400">{s.batch} · {s.centre.split(" - ")[0]}</div>
                        </td>
                        <td className="ff-td text-right font-semibold text-navy-900">
                          {inr(s.outstanding)}
                          {s.days_overdue > 0 && (
                            <div className="text-xs font-medium text-rose-500">
                              {s.days_overdue}d overdue
                            </div>
                          )}
                        </td>
                        <td className="ff-td">{formatDate(s.next_due_date)}</td>
                        <td className="ff-td"><StatusBadge status={s.status} /></td>
                        <td className="ff-td"><RiskBadge level={s.risk_level} /></td>
                        <td className="ff-td text-right">
                          <ChevronRight className="inline h-4 w-4 text-navy-300" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-navy-100 md:hidden">
                {students.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => navigate(`/students/${s.id}`)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-navy-900">{s.name}</p>
                        <p className="truncate text-xs text-navy-400">
                          {s.student_code} · {s.program}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <StatusBadge status={s.status} />
                          <RiskBadge level={s.risk_level} />
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="font-bold text-navy-900">{inr(s.outstanding)}</p>
                        {s.days_overdue > 0 && (
                          <p className="text-xs text-rose-500">{s.days_overdue}d overdue</p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <SummaryFooter students={students} />
            </>
          )}
        </QueryState>
      </Card>
    </div>
  );
}

function SummaryFooter({ students }: { students: StudentSummary[] }) {
  const outstanding = students.reduce((a, s) => a + s.outstanding, 0);
  return (
    <div className="flex items-center justify-between border-t border-navy-100 px-4 py-3 text-sm">
      <span className="text-navy-400">{students.length} student(s)</span>
      <span className="font-semibold text-navy-800">Total outstanding: {inr(outstanding)}</span>
    </div>
  );
}
