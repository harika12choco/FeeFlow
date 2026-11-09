"""Instalment calculation and ledger aggregation tests."""
from __future__ import annotations

from app.services.ledger import instalment_state, student_ledger
from tests.conftest import make_student


def test_instalment_amounts_and_due(db):
    student = make_student(db, instalments=[(10000, -30), (10000, 30)])
    inst = student.fee_plan.instalments[0]
    state = instalment_state(inst)
    assert state["amount"] == 10000
    assert state["balance"] == 10000
    assert state["status"] == "overdue"  # due 30 days ago, unpaid
    assert state["days_overdue"] == 30


def test_fully_paid_instalment_not_overdue(db):
    student = make_student(db, instalments=[(10000, -30)], payments=[(0, 10000)])
    state = instalment_state(student.fee_plan.instalments[0])
    assert state["status"] == "paid"
    assert state["balance"] == 0
    assert state["days_overdue"] == 0


def test_ledger_totals_with_discount(db):
    # gross 32000, discount 2000 => net 30000; pay 15000.
    student = make_student(
        db, gross=32000, discounts=[("Sibling", 2000)],
        instalments=[(10000, -70), (10000, -35), (10000, -5)],
        payments=[(0, 10000), (1, 5000)],
    )
    ledger = student_ledger(student)
    assert ledger["net_payable"] == 30000
    assert ledger["total_paid"] == 15000
    assert ledger["outstanding"] == 15000
    assert ledger["overdue_amount"] == 15000  # inst1 balance 5000 + inst2 10000
    assert ledger["status"] == "overdue"
    assert ledger["missed_instalments"] == 2


def test_upcoming_not_overdue(db):
    student = make_student(db, gross=40000, instalments=[(20000, 20), (20000, 80)], payments=[])
    ledger = student_ledger(student)
    assert ledger["outstanding"] == 40000
    assert ledger["overdue_amount"] == 0
    assert ledger["status"] == "upcoming"
    assert ledger["next_due_date"] is not None
