"""Deterministic fee-ledger computations.

All money math lives here and in the refund service so the rest of the app
never re-derives balances inconsistently. Amounts are rounded to 2 decimals.
"""
from __future__ import annotations

from datetime import date

from ..models import (
    PAYMENT_CONFIRMED,
    Discount,
    FeePlan,
    Instalment,
    Student,
)


def money(x: float) -> float:
    return round(float(x), 2)


def instalment_paid(instalment: Instalment) -> float:
    """Sum of CONFIRMED payments allocated to an instalment."""
    return money(
        sum(p.amount for p in instalment.payments if p.status == PAYMENT_CONFIRMED)
    )


def instalment_state(instalment: Instalment, today: date | None = None) -> dict:
    today = today or date.today()
    paid = instalment_paid(instalment)
    balance = money(instalment.amount - paid)
    if balance <= 0:
        status = "paid"
    elif paid > 0:
        status = "partial"
    else:
        status = "pending"

    overdue = balance > 0 and instalment.due_date < today
    if overdue:
        status = "overdue"
    days_overdue = (today - instalment.due_date).days if overdue else 0

    return {
        "id": instalment.id,
        "seq": instalment.seq,
        "label": instalment.label,
        "amount": money(instalment.amount),
        "paid": paid,
        "balance": balance,
        "due_date": instalment.due_date,
        "status": status,
        "days_overdue": days_overdue,
    }


def discount_total(fee_plan: FeePlan) -> float:
    return money(sum(d.amount for d in fee_plan.discounts))


def student_ledger(student: Student, today: date | None = None) -> dict:
    """Build the full ledger summary for one student."""
    today = today or date.today()
    plan = student.fee_plan
    inst_states = [instalment_state(i, today) for i in plan.instalments]

    gross = money(plan.gross_amount)
    disc = discount_total(plan)
    net_payable = money(gross - disc)
    total_paid = money(sum(s["paid"] for s in inst_states))
    outstanding = money(net_payable - total_paid)
    overdue_amount = money(
        sum(s["balance"] for s in inst_states if s["status"] == "overdue")
    )
    max_days_overdue = max((s["days_overdue"] for s in inst_states), default=0)

    # Next due = earliest instalment that still has a balance.
    with_balance = [s for s in inst_states if s["balance"] > 0]
    with_balance.sort(key=lambda s: s["due_date"])
    next_due = with_balance[0]["due_date"] if with_balance else None

    if outstanding <= 0:
        overall = "paid"
    elif overdue_amount > 0:
        overall = "overdue"
    elif total_paid > 0:
        overall = "part_paid"
    else:
        overall = "upcoming"

    return {
        "gross_amount": gross,
        "discount_total": disc,
        "net_payable": net_payable,
        "total_paid": total_paid,
        "outstanding": outstanding,
        "overdue_amount": overdue_amount,
        "max_days_overdue": max_days_overdue,
        "next_due_date": next_due,
        "status": overall,
        "instalments": inst_states,
        "missed_instalments": sum(1 for s in inst_states if s["status"] == "overdue"),
    }
