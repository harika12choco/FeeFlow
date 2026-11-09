import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Card, QueryState, Button } from "../../components/ui";
import { StatusBadge } from "../../components/badges";
import { PaymentDialog } from "../../components/PaymentDialog";
import { api, errorMessage } from "../../lib/api";
import { inr, formatDate } from "../../lib/format";
import { useState } from "react";
import type { InstalmentState } from "../../lib/types";

interface PaymentLink {
  instalment: InstalmentState;
  student: { id: number; name: string; student_code: string; program: string };
  fee_plan: string;
  payable_now: number;
}

export default function Payment() {
  const { instalmentId } = useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["payment-link", instalmentId],
    queryFn: async () => (await api.get<PaymentLink>(`/payments/link/${instalmentId}`)).data,
  });

  return (
    <div>
      <button
        onClick={() => navigate("/portal")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-500 hover:text-navy-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to portal
      </button>

      <QueryState
        isLoading={q.isLoading}
        isError={q.isError}
        error={errorMessage(q.error)}
        data={q.data}
        onRetry={() => q.refetch()}
        loadingLabel="Loading payment link…"
      >
        {(link) => (
          <Card className="mx-auto max-w-md overflow-hidden">
            <div className="ff-hero px-6 py-6">
              <p className="text-xs uppercase tracking-widest text-navy-300">Secure payment link</p>
              <p className="mt-1 text-lg font-bold">{link.student.name}</p>
              <p className="text-xs text-navy-400">
                {link.student.student_code} · {link.fee_plan}
              </p>
            </div>
            <div className="space-y-4 px-6 py-6">
              <Row label="Instalment" value={link.instalment.label} />
              <Row label="Due date" value={formatDate(link.instalment.due_date)} />
              <Row label="Status" value={<StatusBadge status={link.instalment.status} />} />
              <div className="flex items-center justify-between border-t border-navy-100 pt-4">
                <span className="ff-label mb-0">Payable now</span>
                <span className="text-2xl font-extrabold text-navy-900">
                  {inr(link.payable_now)}
                </span>
              </div>

              {link.payable_now > 0 ? (
                <Button
                  className="w-full"
                  icon={<CreditCard className="h-4 w-4" />}
                  onClick={() => setOpen(true)}
                >
                  Pay now
                </Button>
              ) : (
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">
                  This instalment is fully paid.{" "}
                  <Link to="/portal" className="underline">
                    Back to portal
                  </Link>
                </div>
              )}
            </div>

            {open && (
              <PaymentDialog
                open={open}
                onClose={() => setOpen(false)}
                instalment={{
                  id: link.instalment.id,
                  label: link.instalment.label,
                  balance: link.payable_now,
                }}
                studentName={link.student.name}
                onPaid={() => q.refetch()}
              />
            )}
          </Card>
        )}
      </QueryState>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-navy-400">{label}</span>
      <span className="text-sm font-semibold text-navy-800">{value}</span>
    </div>
  );
}
