"""Deterministic reminder service.

External messaging providers (SMS / WhatsApp / email) are mocked, but the
reminder *records*, scheduling logic, dispatch simulation and cancellation are
real and persisted. Reminders support English and Hindi.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from ..models import (
    REMINDER_CANCELLED,
    REMINDER_SCHEDULED,
    REMINDER_SENT,
    Instalment,
    Reminder,
    Student,
)
from .ledger import instalment_state

# Days relative to the due date for each reminder kind.
OFFSETS = {
    "before_due": -3,
    "on_due": 0,
    "after_due": 3,
}

DEFAULT_CHANNEL = "whatsapp"


def _fmt_amount(amount: float) -> str:
    return f"₹{amount:,.0f}"


def build_message(kind: str, student_name: str, amount: float, due: date, language: str) -> str:
    amt = _fmt_amount(amount)
    d = due.strftime("%d %b %Y")
    templates = {
        "en": {
            "before_due": f"Hi, a fee instalment of {amt} for {student_name} is due on {d}. "
                          f"Please pay on time to avoid late charges. — FeeFlow",
            "on_due": f"Reminder: {amt} for {student_name} is due today ({d}). "
                      f"Tap your payment link to pay now. — FeeFlow",
            "after_due": f"Overdue notice: {amt} for {student_name} was due on {d}. "
                         f"Please clear the dues to continue classes. — FeeFlow",
        },
        "hi": {
            "before_due": f"नमस्ते, {student_name} की {amt} की फीस किस्त {d} को देय है। "
                          f"कृपया समय पर भुगतान करें। — FeeFlow",
            "on_due": f"अनुस्मारक: {student_name} की {amt} फीस आज ({d}) देय है। "
                      f"अभी भुगतान करने के लिए अपना लिंक खोलें। — FeeFlow",
            "after_due": f"बकाया सूचना: {student_name} की {amt} फीस {d} को देय थी। "
                         f"कृपया बकाया राशि शीघ्र चुकाएँ। — FeeFlow",
        },
    }
    return templates.get(language, templates["en"])[kind]


def generate_for_instalment(
    db: Session,
    instalment: Instalment,
    language: str = "en",
    channel: str = DEFAULT_CHANNEL,
) -> list[Reminder]:
    """Create any missing scheduled reminders for an unpaid instalment.

    Idempotent: will not duplicate reminders of the same (instalment, kind).
    Skips instalments that are already fully paid.
    """
    created: list[Reminder] = []
    state = instalment_state(instalment)
    if state["balance"] <= 0:
        return created

    student = instalment.fee_plan.student
    existing_kinds = {r.kind for r in instalment.reminders if r.status != REMINDER_CANCELLED}

    for kind, offset in OFFSETS.items():
        if kind in existing_kinds:
            continue
        scheduled_for = instalment.due_date + timedelta(days=offset)
        reminder = Reminder(
            student_id=student.id,
            instalment_id=instalment.id,
            kind=kind,
            channel=channel,
            language=language,
            scheduled_for=scheduled_for,
            status=REMINDER_SCHEDULED,
            message=build_message(kind, student.name, state["balance"], instalment.due_date, language),
        )
        db.add(reminder)
        created.append(reminder)
    db.commit()
    return created


def generate_for_student(db: Session, student: Student, language: str = "en") -> int:
    count = 0
    for inst in student.fee_plan.instalments:
        count += len(generate_for_instalment(db, inst, language=language))
    return count


def dispatch_due(db: Session, as_of: date | None = None) -> int:
    """Simulate the scheduler: 'send' every scheduled reminder whose date has
    arrived. Mocks the external provider but persists the state transition.
    Cancelled reminders are never sent.
    """
    as_of = as_of or date.today()
    due = (
        db.query(Reminder)
        .filter(Reminder.status == REMINDER_SCHEDULED, Reminder.scheduled_for <= as_of)
        .all()
    )
    for reminder in due:
        reminder.status = REMINDER_SENT
        reminder.sent_at = datetime.now(timezone.utc)
        db.add(reminder)
    db.commit()
    return len(due)


def cancel_for_instalment(db: Session, instalment: Instalment, reason: str) -> int:
    cancelled = 0
    for reminder in instalment.reminders:
        if reminder.status == REMINDER_SCHEDULED:
            reminder.status = REMINDER_CANCELLED
            reminder.cancelled_at = datetime.now(timezone.utc)
            reminder.cancel_reason = reason
            db.add(reminder)
            cancelled += 1
    db.commit()
    return cancelled
