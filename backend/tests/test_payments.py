"""Payment flow: partial payments, backend confirmation, duplicate prevention."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.models import PAYMENT_CONFIRMED, PAYMENT_PENDING
from app.services.ledger import instalment_state, student_ledger
from app.services.payments import confirm_payment, initiate_payment
from tests.conftest import make_student


def test_partial_payment_updates_balance(db):
    student = make_student(db, instalments=[(10000, -10)], payments=[])
    inst = student.fee_plan.instalments[0]

    payment = initiate_payment(db, inst, 4000)
    assert payment.status == PAYMENT_PENDING
    # Not confirmed yet -> balance unchanged.
    assert instalment_state(inst)["balance"] == 10000

    confirm_payment(db, payment)
    db.refresh(inst)
    state = instalment_state(inst)
    assert state["paid"] == 4000
    assert state["balance"] == 6000
    assert state["status"] == "overdue"  # still owes, due in the past


def test_payment_not_successful_before_confirmation(db):
    student = make_student(db, instalments=[(10000, -10)])
    inst = student.fee_plan.instalments[0]
    payment = initiate_payment(db, inst, 10000)
    assert payment.status == PAYMENT_PENDING
    assert payment.receipt_no is None


def test_duplicate_initiate_same_key_returns_same_payment(db):
    student = make_student(db, instalments=[(10000, -10)])
    inst = student.fee_plan.instalments[0]
    p1 = initiate_payment(db, inst, 10000, idempotency_key="abc123")
    p2 = initiate_payment(db, inst, 10000, idempotency_key="abc123")
    assert p1.id == p2.id  # no duplicate created


def test_confirm_twice_does_not_double_count(db):
    student = make_student(db, instalments=[(10000, -10)])
    inst = student.fee_plan.instalments[0]
    payment = initiate_payment(db, inst, 10000, idempotency_key="k1")
    confirm_payment(db, payment)
    first_receipt = payment.receipt_no
    # Confirm again -> idempotent no-op.
    confirm_payment(db, payment)
    db.refresh(inst)
    assert instalment_state(inst)["paid"] == 10000
    assert payment.receipt_no == first_receipt
    assert payment.status == PAYMENT_CONFIRMED


def test_overpayment_rejected(db):
    student = make_student(db, instalments=[(10000, -10)])
    inst = student.fee_plan.instalments[0]
    with pytest.raises(HTTPException) as exc:
        initiate_payment(db, inst, 15000)
    assert exc.value.status_code == 400


def test_second_payment_cannot_exceed_remaining(db):
    student = make_student(db, instalments=[(10000, -10)])
    inst = student.fee_plan.instalments[0]
    confirm_payment(db, initiate_payment(db, inst, 7000, idempotency_key="a"))
    db.refresh(inst)
    # Remaining is 3000; attempting 5000 must fail.
    with pytest.raises(HTTPException):
        initiate_payment(db, inst, 5000, idempotency_key="b")
    # Exactly remaining is fine.
    confirm_payment(db, initiate_payment(db, inst, 3000, idempotency_key="c"))
    db.refresh(inst)
    assert instalment_state(inst)["balance"] == 0
