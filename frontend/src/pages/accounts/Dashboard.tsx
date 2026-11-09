import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  IndianRupee,
  TrendingUp,
  Wallet,
  AlertCircle,
  ArrowUpRight,
  Filter,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "../../components/AccountsLayout";
import { Card, CardHeader, QueryState, Select, Button, EmptyState } from "../../components/ui";
import { RiskBadge } from "../../components/badges";
import { SampleDataBanner } from "../../components/Notices";
import { useDashboard, useFilterOptions } from "../../lib/queries";
import { inr } from "../../lib/format";
import { errorMessage } from "../../lib/api";
import type { DashboardStats } from "../../lib/types";

export default function Dashboard() {
  const [filters, setFilters] = useState({ centre: "", batch: "", program: "" });
  const { data: opts } = useFilterOptions();
  const q = useDashboard({
    centre: filters.centre || undefined,
    batch: filters.batch || undefined,
    program: filters.program || undefined,
  });

  const hasFilters = filters.centre || filters.batch || filters.program;

  return (
    <div>
      <PageHeader
        title="Accounts dashboard"
        subtitle="Collections, dues and dropout risk across all centres."
      />
      <SampleDataBanner />

      {/* Filters */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-navy-500">
            <Filter className="h-4 w-4" /> Filters
          </div>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              value={filters.centre}
              onChange={(e) => setFilters((f) => ({ ...f, centre: e.target.value }))}
            >
              <option value="">All centres</option>
              {opts?.centres.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              value={filters.batch}
              onChange={(e) => setFilters((f) => ({ ...f, batch: e.target.value }))}
            >
              <option value="">All batches</option>
              {opts?.batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
            <Select
              value={filters.program}
              onChange={(e) => setFilters((f) => ({ ...f, program: e.target.value }))}
            >
              <option value="">All programs</option>
              {opts?.programs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => setFilters({ centre: "", batch: "", program: "" })}
            >
              Reset
            </Button>
          )}
        </div>
      </Card>

      <QueryState
        isLoading={q.isLoading}
        isError={q.isError}
        error={errorMessage(q.error)}
        data={q.data}
        onRetry={() => q.refetch()}
        loadingLabel="Crunching the numbers…"
      >
        {(d) => <DashboardBody d={d} />}
      </QueryState>
    </div>
  );
}

function DashboardBody({ d }: { d: DashboardStats }) {
  const t = d.totals;
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total fees billed"
          value={inr(t.total_billed)}
          icon={<IndianRupee className="h-5 w-5" />}
          hint={`${t.student_count} students`}
        />
        <Stat
          label="Total collected"
          value={inr(t.total_collected)}
          icon={<Wallet className="h-5 w-5" />}
          tone="green"
          hint={`${t.collection_rate}% collection rate`}
        />
        <Stat
          label="Outstanding"
          value={inr(t.outstanding)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="indigo"
        />
        <Stat
          label="Overdue"
          value={inr(t.overdue)}
          icon={<AlertCircle className="h-5 w-5" />}
          tone="red"
        />
      </div>

      {/* Collection progress */}
      <Card className="p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="ff-label">Collection rate</p>
            <p className="text-2xl font-extrabold text-navy-900">{t.collection_rate}%</p>
          </div>
          <p className="text-sm text-navy-400">
            {inr(t.total_collected)} of {inr(t.total_billed)}
          </p>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-navy-100">
          <div
            className="h-full rounded-full bg-accent-600 transition-all"
            style={{ width: `${Math.min(t.collection_rate, 100)}%` }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Dues by centre" subtitle="Outstanding amount per centre" />
          <DuesChart
            data={d.dues_by_centre.map((x) => ({ name: shortCentre(x.centre), value: x.outstanding }))}
          />
        </Card>
        <Card>
          <CardHeader title="Dues by batch" subtitle="Outstanding amount per batch" />
          <DuesChart data={d.dues_by_batch.map((x) => ({ name: x.batch, value: x.outstanding }))} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Ageing of dues" subtitle="By days overdue" />
          <AgeingChart data={d.ageing} />
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="High dropout-risk students"
            subtitle="Open counsellor review tasks"
            action={
              <Link to="/risk" className="text-xs font-semibold text-accent-600 hover:underline">
                Review all
              </Link>
            }
          />
          {d.high_risk_students.length === 0 ? (
            <EmptyState title="No open risk flags" message="Nobody is flagged for review right now." />
          ) : (
            <ul className="divide-y divide-navy-100">
              {d.high_risk_students.slice(0, 6).map((s) => (
                <li key={s.student_id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <Link
                    to={`/students/${s.student_id}`}
                    className="group flex min-w-0 items-center gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-800 group-hover:text-accent-600">
                        {s.name}{" "}
                        <span className="font-normal text-navy-400">· {s.student_code}</span>
                      </p>
                      <p className="truncate text-xs text-navy-400">
                        {shortCentre(s.centre)} · {s.batch}
                      </p>
                    </div>
                  </Link>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="hidden text-sm font-semibold text-navy-700 sm:inline">
                      {inr(s.outstanding)}
                    </span>
                    <RiskBadge level={s.risk_level} source={s.source} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  hint,
  tone = "navy",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  tone?: "navy" | "green" | "indigo" | "red";
}) {
  const toneMap = {
    navy: "bg-navy-50 text-navy-600",
    green: "bg-emerald-50 text-emerald-600",
    indigo: "bg-accent-50 text-accent-600",
    red: "bg-rose-50 text-rose-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="ff-label mb-0">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneMap[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-extrabold tracking-tight text-navy-900">{value}</p>
      {hint && (
        <p className="mt-1 flex items-center gap-1 text-xs text-navy-400">
          <ArrowUpRight className="h-3 w-3" /> {hint}
        </p>
      )}
    </Card>
  );
}

const currencyTick = (v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`);

function DuesChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.every((d) => d.value === 0)) {
    return <EmptyState title="No dues" message="Everything is collected for this selection." />;
  }
  return (
    <div className="h-64 w-full px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7187c1" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={currencyTick} tick={{ fontSize: 11, fill: "#7187c1" }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            cursor={{ fill: "rgba(99,102,241,0.06)" }}
            formatter={(v: number) => [inr(v), "Outstanding"]}
            contentStyle={tooltipStyle}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#4f46e5" maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const AGE_COLORS: Record<string, string> = {
  current: "#4f66a9",
  "1-15": "#6366f1",
  "16-30": "#f59e0b",
  "31-60": "#fb7185",
  "60+": "#e11d48",
};

function AgeingChart({ data }: { data: { bucket: string; amount: number }[] }) {
  if (data.every((d) => d.amount === 0)) {
    return <EmptyState title="No outstanding dues" />;
  }
  return (
    <div className="h-64 w-full px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#7187c1" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={currencyTick} tick={{ fontSize: 11, fill: "#7187c1" }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            cursor={{ fill: "rgba(99,102,241,0.06)" }}
            formatter={(v: number) => [inr(v), "Outstanding"]}
            contentStyle={tooltipStyle}
          />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((d) => (
              <Cell key={d.bucket} fill={AGE_COLORS[d.bucket] ?? "#4f46e5"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e4e8f5",
  boxShadow: "0 10px 30px -12px rgba(20,29,56,.18)",
  fontSize: 12,
};

function shortCentre(c: string): string {
  return c.split(" - ")[0];
}
