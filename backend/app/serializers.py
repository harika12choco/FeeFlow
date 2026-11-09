"""Functions that shape ORM objects into JSON-friendly dicts for the API."""
from __future__ import annotations

from datetime import date

from .models import FLAG_OPEN, PAYMENT_CONFIRMED, Student
from .services.ledger import student_ledger


def latest_open_risk(student: Student):
    open_flags = [f for f in student.risk_flags if f.status == FLAG_OPEN]
    if not open_flags:
        return None
    return max(open_flags, key=lambda f: f.created_at or date.min)


def student_summary(student: Student, today: date | None = None) -> dict:
    ledger = student_ledger(student, today)
    risk = latest_open_risk(student)
    return {
        "id": student.id,
        "student_code": student.student_code,
        "name": student.name,
        "program": student.program,
        "batch": student.batch,
        "centre": student.centre,
        "is_sample": student.is_sample,
        "parent": {
            "id": student.parent.id,
            "full_name": student.parent.full_name,
            "email": student.parent.email,
        } if student.parent else None,
        "net_payable": ledger["net_payable"],
        "total_paid": ledger["total_paid"],
        "outstanding": ledger["outstanding"],
        "overdue_amount": ledger["overdue_amount"],
        "days_overdue": ledger["max_days_overdue"],
        "next_due_date": ledger["next_due_date"],
        "status": ledger["status"],
        "risk_level": risk.risk_level if risk else None,
    }


def payment_out(payment) -> dict:
    return {
        "id": payment.id,
        "amount": payment.amount,
        "status": payment.status,
        "method": payment.method,
        "receipt_no": payment.receipt_no,
        "idempotency_key": payment.idempotency_key,
        "created_at": payment.created_at,
        "confirmed_at": payment.confirmed_at,
        "instalment_id": payment.instalment_id,
    }


def reminder_out(reminder) -> dict:
    return {
        "id": reminder.id,
        "student_id": reminder.student_id,
        "instalment_id": reminder.instalment_id,
        "kind": reminder.kind,
        "channel": reminder.channel,
        "language": reminder.language,
        "scheduled_for": reminder.scheduled_for,
        "status": reminder.status,
        "message": reminder.message,
        "sent_at": reminder.sent_at,
        "cancelled_at": reminder.cancelled_at,
        "cancel_reason": reminder.cancel_reason,
    }


def risk_flag_out(flag) -> dict:
    return {
        "id": flag.id,
        "student_id": flag.student_id,
        "student_name": flag.student.name if flag.student else None,
        "student_code": flag.student.student_code if flag.student else None,
        "risk_level": flag.risk_level,
        "score": flag.score,
        "reasons": flag.reasons,
        "recommended_action": flag.recommended_action,
        "confidence": flag.confidence,
        "source": flag.source,
        "model": flag.model,
        "status": flag.status,
        "counsellor_task": flag.counsellor_task,
        "created_at": flag.created_at,
        "resolved_at": flag.resolved_at,
    }


def refund_out(refund) -> dict:
    return {
        "id": refund.id,
        "student_id": refund.student_id,
        "student_name": refund.student.name if refund.student else None,
        "policy_key": refund.policy_key,
        "reason": refund.reason,
        "paid_amount": refund.paid_amount,
        "computed_refund": refund.computed_refund,
        "breakdown": refund.breakdown,
        "status": refund.status,
        "created_at": refund.created_at,
        "decided_at": refund.decided_at,
    }


def student_detail(student: Student, today: date | None = None) -> dict:
    """Full ledger view used by the student-detail and parent-portal screens."""
    ledger = student_ledger(student, today)

    # Attach payments + reminders to each instalment state.
    inst_by_id = {i.id: i for i in student.fee_plan.instalments}
    for state in ledger["instalments"]:
        inst = inst_by_id[state["id"]]
        state["payments"] = [payment_out(p) for p in inst.payments]
        state["reminders"] = [reminder_out(r) for r in inst.reminders]

    all_payments = [
        payment_out(p)
        for inst in student.fee_plan.instalments
        for p in inst.payments
    ]
    all_payments.sort(key=lambda p: p["created_at"] or 0, reverse=True)

    return {
        "student": {
            "id": student.id,
            "student_code": student.student_code,
            "name": student.name,
            "program": student.program,
            "batch": student.batch,
            "centre": student.centre,
            "is_sample": student.is_sample,
            "enrolled_on": student.enrolled_on,
            "course_start": student.course_start,
            "course_end": student.course_end,
            "parent": {
                "id": student.parent.id,
                "full_name": student.parent.full_name,
                "email": student.parent.email,
            } if student.parent else None,
        },
        "fee_plan": {
            "name": student.fee_plan.name,
            "gross_amount": ledger["gross_amount"],
            "discounts": [
                {"label": d.label, "amount": d.amount} for d in student.fee_plan.discounts
            ],
        },
        "ledger": ledger,
        "payments": all_payments,
        "receipts": [p for p in all_payments if p["status"] == PAYMENT_CONFIRMED],
        "attendance": [
            {"period": a.period, "present": a.present, "total": a.total,
             "percentage": a.percentage}
            for a in sorted(student.attendance, key=lambda a: a.period)
        ],
        "test_scores": [
            {"test_name": t.test_name, "taken_on": t.taken_on, "score": t.score,
             "max_score": t.max_score, "percentage": t.percentage}
            for t in sorted(student.test_scores, key=lambda t: t.taken_on)
        ],
        "risk_flags": [risk_flag_out(f) for f in
                       sorted(student.risk_flags, key=lambda f: f.created_at or date.min,
                              reverse=True)],
    }
