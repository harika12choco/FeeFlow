import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ShieldCheck, Lock, ReceiptText } from "lucide-react";
import { Modal } from "./Modal";
import { Button, Field, Input } from "./ui";
import { api, errorMessage } from "../lib/api";
import { inr } from "../lib/format";
import type { PaymentOut } from "../lib/types";

type Step = "amount" | "confirm" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  instalment: { id: number; label: string; balance: number };
  studentName: string;
  onPaid?: () => void;
}

export function PaymentDialog({ open, onClose, instalment, studentName, onPaid }: Props) {
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState<string>(String(instalment.balance));
  const [idemKey] = useState(() => cryptoKey());
  const [payment, setPayment] = useState<PaymentOut | null>(null);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = useMemo(() => Number(amount), [amount]);
  const invalid = !Number.isFinite(amountNum) || amountNum <= 0 || amountNum > instalment.balance;

  function reset() {
    setStep("amount");
    setPayment(null);
    setReceiptNo(null);
    setError(null);
    setAmount(String(instalment.balance));
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function initiate() {
    setError(null);
    setLoading(true);
    try {
      const r = await api.post("/payments/initiate", {
        instalment_id: instalment.id,
        amount: amountNum,
        idempotency_key: idemKey,
      });
      setPayment(r.data.payment);
      setStep("confirm");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!payment) return;
    setError(null);
    setLoading(true);
    try {
      const r = await api.post("/payments/confirm", {
        payment_id: payment.id,
        idempotency_key: idemKey,
      });
      setReceiptNo(r.data.receipt_no);
      setStep("done");
      onPaid?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === "done" ? "Payment successful" : `Pay ${instalment.label}`}
      subtitle={step === "done" ? undefined : `For ${studentName}`}
      footer={
        step === "amount" ? (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button onClick={initiate} loading={loading} disabled={invalid}>
              Continue
            </Button>
          </>
        ) : step === "confirm" ? (
          <>
            <Button variant="secondary" onClick={() => setStep("amount")} disabled={loading}>
              Back
            </Button>
            <Button onClick={confirm} loading={loading} icon={<Lock className="h-4 w-4" />}>
              Confirm payment
            </Button>
          </>
        ) : (
          <Button onClick={handleClose}>Done</Button>
        )
      }
    >
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}

      {step === "amount" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-navy-50 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-navy-500">Outstanding on this instalment</span>
              <span className="font-bold text-navy-900">{inr(instalment.balance)}</span>
            </div>
          </div>
          <Field label="Amount to pay (₹)">
            <Input
              type="number"
              min={1}
              max={instalment.balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          {invalid && amount !== "" && (
            <p className="text-xs text-rose-500">
              Enter an amount between ₹1 and {inr(instalment.balance)}.
            </p>
          )}
          <p className="text-xs text-navy-400">
            Partial payments are allowed. You can pay the rest later.
          </p>
        </div>
      )}

      {step === "confirm" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-navy-100 p-4">
            <p className="ff-label">You are about to pay</p>
            <p className="text-3xl font-extrabold text-navy-900">{inr(amountNum)}</p>
            <p className="mt-1 text-sm text-navy-400">
              {instalment.label} · {studentName}
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl bg-accent-50 px-4 py-3 text-xs text-accent-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              This is a <span className="font-semibold">simulated</span> payment. Nothing is charged
              until the backend confirms the transaction below.
            </p>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="rounded-full bg-emerald-50 p-3 text-emerald-500">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <p className="text-lg font-bold text-navy-900">{inr(amountNum)} received</p>
            <p className="text-sm text-navy-400">Receipt {receiptNo} has been generated.</p>
          </div>
          {payment && (
            <Link
              to={`/receipt/${payment.id}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-600 hover:underline"
            >
              <ReceiptText className="h-4 w-4" /> View receipt
            </Link>
          )}
        </div>
      )}
    </Modal>
  );
}

function cryptoKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `key-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
