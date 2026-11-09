import { useState } from "react";
import { Calculator, FileCheck2, TriangleAlert, Scale } from "lucide-react";
import { PageHeader } from "../../components/AccountsLayout";
import { Card, CardHeader, QueryState, Select, Input, Button, Badge, EmptyState, Field } from "../../components/ui";
import { StatusBadge } from "../../components/badges";
import {
  useRefundActions,
  useRefundList,
  useRefundPolicies,
  useStudents,
} from "../../lib/queries";
import { errorMessage } from "../../lib/api";
import { inr, formatDateTime } from "../../lib/format";
import type { RefundPolicy, RefundResult } from "../../lib/types";

export default function Refunds() {
  const { data: students } = useStudents({});
  const { data: policies } = useRefundPolicies();
  const refunds = useRefundList();
  const { calculate, create, decide } = useRefundActions();

  const [studentId, setStudentId] = useState("");
  const [policyKey, setPolicyKey] = useState("");
  const [asOf, setAsOf] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<RefundResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPolicy = policies?.find((p) => p.key === policyKey);
  const canCalc = studentId && policyKey;

  function runCalc() {
    setError(null);
    setResult(null);
    calculate.mutate(
      { student_id: Number(studentId), policy_key: policyKey, as_of: asOf || undefined },
      { onSuccess: (r) => setResult(r), onError: (e) => setError(errorMessage(e)) },
    );
  }

  function record() {
    create.mutate(
      {
        student_id: Number(studentId),
        policy_key: policyKey,
        reason: reason || "Refund requested via calculator",
        as_of: asOf || undefined,
      },
      {
        onSuccess: () => {
          setReason("");
          setResult(null);
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  return (
    <div>
      <PageHeader
        title="Refund calculator"
        subtitle="Deterministic pro-rata refunds with transparent, configurable policies."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Calculator */}
        <Card>
          <CardHeader title="Calculate a refund" subtitle="Never uses AI — fully rule-based math" />
          <div className="space-y-4 px-5 py-5">
            <Field label="Student">
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">Select a student…</option>
                {students?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.student_code} · paid {inr(s.total_paid)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Refund policy">
              <Select value={policyKey} onChange={(e) => setPolicyKey(e.target.value)}>
                <option value="">Select a policy…</option>
                {policies?.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>

            {selectedPolicy && <PolicyNote policy={selectedPolicy} />}

            <Field label="Refund as-of date (optional)">
              <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </Field>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            )}

            <Button
              className="w-full"
              icon={<Calculator className="h-4 w-4" />}
              disabled={!canCalc}
              loading={calculate.isPending}
              onClick={runCalc}
            >
              Calculate refund
            </Button>
          </div>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader title="Calculation breakdown" subtitle="Itemised, auditable steps" />
          <div className="px-5 py-5">
            {!result ? (
              <EmptyState
                icon={<Scale className="h-6 w-6" />}
                title="No calculation yet"
                message="Pick a student and policy, then calculate to see the breakdown."
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-navy-50 px-4 py-3 text-xs text-navy-500">
                  <div className="flex justify-between">
                    <span>Course elapsed</span>
                    <span className="font-semibold text-navy-800">
                      {result.inputs.elapsed_days}/{result.inputs.total_days} days (
                      {result.inputs.elapsed_percent}%)
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span>Policy</span>
                    <span className="font-semibold text-navy-800">{result.policy_name}</span>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {result.steps.map((s, i) => (
                    <li
                      key={i}
                      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                        s.total ? "bg-accent-50 font-bold text-accent-800" : "text-navy-700"
                      }`}
                    >
                      <span>
                        {s.label}
                        {s.note && <span className="block text-xs font-normal text-navy-400">{s.note}</span>}
                      </span>
                      <span className={s.value < 0 ? "text-rose-600" : ""}>
                        {s.value < 0 ? "−" : ""}
                        {inr(Math.abs(s.value), { decimals: true })}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between rounded-xl border border-accent-200 bg-accent-50 px-4 py-3">
                  <span className="text-sm font-semibold text-accent-800">Net refund</span>
                  <span className="text-2xl font-extrabold text-accent-700">
                    {inr(result.net_refund, { decimals: true })}
                  </span>
                </div>

                <AssumptionsList assumptions={result.assumptions} />

                <div className="border-t border-navy-100 pt-4">
                  <Field label="Reason for refund">
                    <Input
                      placeholder="e.g. Relocation to another city"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                  <Button
                    className="mt-3 w-full"
                    variant="secondary"
                    icon={<FileCheck2 className="h-4 w-4" />}
                    loading={create.isPending}
                    onClick={record}
                  >
                    Record refund request
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Requests */}
      <Card className="mt-6">
        <CardHeader title="Refund requests" subtitle="Recorded requests and their status" />
        <QueryState
          isLoading={refunds.isLoading}
          isError={refunds.isError}
          error={errorMessage(refunds.error)}
          data={refunds.data}
          onRetry={() => refunds.refetch()}
          loadingLabel="Loading refund requests…"
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={<Scale className="h-6 w-6" />} title="No refund requests yet" />}
        >
          {(list) => (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-navy-100">
                    <th className="ff-th">Student</th>
                    <th className="ff-th">Policy</th>
                    <th className="ff-th">Reason</th>
                    <th className="ff-th text-right">Refund</th>
                    <th className="ff-th">Status</th>
                    <th className="ff-th">Requested</th>
                    <th className="ff-th text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td className="ff-td font-medium text-navy-800">{r.student_name}</td>
                      <td className="ff-td">{r.breakdown.policy_name}</td>
                      <td className="ff-td max-w-[14rem] truncate text-navy-500">{r.reason}</td>
                      <td className="ff-td text-right font-semibold">{inr(r.computed_refund, { decimals: true })}</td>
                      <td className="ff-td"><StatusBadge status={r.status} /></td>
                      <td className="ff-td text-xs text-navy-400">{formatDateTime(r.created_at)}</td>
                      <td className="ff-td text-right">
                        {r.status === "requested" ? (
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => decide.mutate({ id: r.id, status: "approved" })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: r.id, status: "rejected" })}>
                              Reject
                            </Button>
                          </div>
                        ) : r.status === "approved" ? (
                          <Button size="sm" variant="subtle" onClick={() => decide.mutate({ id: r.id, status: "processed" })}>
                            Mark processed
                          </Button>
                        ) : (
                          <span className="text-xs text-navy-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </Card>
    </div>
  );
}

function PolicyNote({ policy }: { policy: RefundPolicy }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-navy-50/60 px-4 py-3">
      <p className="text-xs text-navy-600">{policy.description}</p>
      <Badge tone="slate" className="mt-2">
        {policy.type === "linear" ? "Linear pro-rata" : "Slab-based"}
      </Badge>
    </div>
  );
}

function AssumptionsList({ assumptions }: { assumptions: string[] }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
        <TriangleAlert className="h-3.5 w-3.5" /> Policy assumptions
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-800">
        {assumptions.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  );
}
