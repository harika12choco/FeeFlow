import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer, CheckCircle2 } from "lucide-react";
import { Card, QueryState, Button } from "../components/ui";
import { Logo } from "../components/Logo";
import { api, errorMessage } from "../lib/api";
import { inr, formatDateTime, formatDate } from "../lib/format";
import { useAuth } from "../context/AuthContext";

interface ReceiptData {
  receipt_no: string;
  issued_at: string | null;
  amount: number;
  method: string;
  student: {
    name: string;
    student_code: string;
    program: string;
    batch: string;
    centre: string;
  };
  instalment: { label: string; due_date: string };
  fee_plan: string;
  note: string;
}

export default function Receipt() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["receipt", paymentId],
    queryFn: async () => (await api.get<ReceiptData>(`/payments/${paymentId}/receipt`)).data,
  });

  return (
    <div className="min-h-screen bg-navy-50/40 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <button
            onClick={() => (user?.role === "accounts" ? navigate(-1) : navigate("/portal"))}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-500 hover:text-navy-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <Button variant="secondary" size="sm" icon={<Printer className="h-3.5 w-3.5" />} onClick={() => window.print()}>
            Print
          </Button>
        </div>

        <QueryState
          isLoading={q.isLoading}
          isError={q.isError}
          error={errorMessage(q.error)}
          data={q.data}
          onRetry={() => q.refetch()}
          loadingLabel="Loading receipt…"
        >
          {(r) => (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-navy-100 px-6 py-5">
                <Logo />
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest text-navy-400">Receipt</p>
                  <p className="font-bold text-navy-900">{r.receipt_no}</p>
                </div>
              </div>

              <div className="px-6 py-5">
                <div className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" /> Payment confirmed
                </div>

                <dl className="space-y-3 text-sm">
                  <Line label="Student" value={`${r.student.name} (${r.student.student_code})`} />
                  <Line label="Program" value={`${r.student.program} · ${r.student.batch}`} />
                  <Line label="Centre" value={r.student.centre} />
                  <Line label="Fee plan" value={r.fee_plan} />
                  <Line label="Instalment" value={r.instalment.label} />
                  <Line label="Due date" value={formatDate(r.instalment.due_date)} />
                  <Line label="Method" value={r.method} />
                  <Line label="Issued" value={formatDateTime(r.issued_at)} />
                </dl>

                <div className="mt-5 flex items-center justify-between border-t border-navy-100 pt-5">
                  <span className="text-sm font-semibold text-navy-500">Amount paid</span>
                  <span className="text-2xl font-extrabold text-navy-900">{inr(r.amount, { decimals: true })}</span>
                </div>
              </div>

              <div className="border-t border-navy-100 bg-navy-50/50 px-6 py-3 text-center text-[11px] text-navy-400">
                {r.note}
              </div>
            </Card>
          )}
        </QueryState>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-navy-400">{label}</dt>
      <dd className="text-right font-medium text-navy-800">{value}</dd>
    </div>
  );
}
