"""Reminder generation, dispatch and cancellation after payment."""
from __future__ import annotations

from app.models import REMINDER_CANCELLED, REMINDER_SCHEDULED
from app.services.payments import confirm_payment, initiate_payment
from app.services.reminders import dispatch_due, generate_for_instalment, generate_for_student
from tests.conftest import make_student


def test_three_reminders_generated_per_unpaid_instalment(db):
    student = make_student(db, instalments=[(10000, 10)], payments=[])
    created = generate_for_instalment(db, student.fee_plan.instalments[0])
    kinds = sorted(r.kind for r in created)
    assert kinds == ["after_due", "before_due", "on_due"]


def test_no_reminders_for_paid_instalment(db):
    student = make_student(db, instalments=[(10000, 10)], payments=[(0, 10000)])
    created = generate_for_instalment(db, student.fee_plan.instalments[0])
    assert created == []


def test_generate_is_idempotent(db):
    student = make_student(db, instalments=[(10000, 10)])
    inst = student.fee_plan.instalments[0]
    generate_for_instalment(db, inst)
    db.refresh(inst)
    second = generate_for_instalment(db, inst)
    assert second == []  # no duplicates


def test_reminders_cancelled_after_full_payment(db):
    student = make_student(db, instalments=[(10000, -5)], payments=[])
    inst = student.fee_plan.instalments[0]
    generate_for_instalment(db, inst)
    db.refresh(inst)
    assert all(r.status == REMINDER_SCHEDULED for r in inst.reminders)

    payment = initiate_payment(db, inst, 10000, idempotency_key="pay-full")
    confirm_payment(db, payment)
    db.refresh(inst)

    assert len(inst.reminders) == 3
    assert all(r.status == REMINDER_CANCELLED for r in inst.reminders)
    assert all(r.cancel_reason for r in inst.reminders)


def test_partial_payment_keeps_reminders(db):
    student = make_student(db, instalments=[(10000, -5)])
    inst = student.fee_plan.instalments[0]
    generate_for_instalment(db, inst)
    confirm_payment(db, initiate_payment(db, inst, 4000, idempotency_key="partial"))
    db.refresh(inst)
    # Still owes money -> reminders remain scheduled.
    assert any(r.status == REMINDER_SCHEDULED for r in inst.reminders)


def test_dispatch_sends_only_due_scheduled(db):
    student = make_student(db, instalments=[(10000, -5)])
    generate_for_student(db, student)
    sent = dispatch_due(db)
    # before_due(-8) and on_due(-5) are in the past; after_due(-2) also past -> all 3.
    assert sent == 3
