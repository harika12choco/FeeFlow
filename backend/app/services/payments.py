"""Simulated payment processing.

Design rules enforced here:
* A payment is NEVER 'confirmed' until the backend confirm step runs.
* Duplicate processing is prevented via a unique idempotency key and by
  short-circuiting already-confirmed payments.
* Over-payment beyond the instalment balance is rejected.
* When an instalment becomes fully paid, its scheduled reminders are cancelled.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import (
    PAYMENT_CONFIRMED,
    PAYMENT_PENDING,
    REMINDER_CANCELLED,
    REMINDER_SCHEDULED,
    Instalment,
    Payment,
)
from .ledger import instalment_state, money


def _next_receipt_no(db: Session) -> str:
    count = db.query(Payment).filter(Payment.receipt_no.isnot(None)).count()
    return f"RCP-{count + 1:06d}"


def initiate_payment(
    db: Session,
    instalment: Instalment,
    amount: float,
    idempotency_key: str | None = None,
) -> Payment:
    """Create (or return the existing) pending payment intent.

    Returns an existing payment for the same idempotency key so retries from
    the client never create duplicates.
    """
    amount = money(amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")

    state = instalment_state(instalment)
    if amount > state["balance"] + 1e-6:
        raise HTTPException(
            status_code=400,
            detail=f"Amount exceeds outstanding balance of {state['balance']}",
        )

    if idempotency_key:
        existing = (
            db.query(Payment)
            .filter(Payment.idempotency_key == idempotency_key)
            .first()
        )
        if existing:
            return existing
    else:
        idempotency_key = uuid.uuid4().hex

    payment = Payment(
        instalment_id=instalment.id,
        student_id=instalment.fee_plan.student_id,
        amount=amount,
        status=PAYMENT_PENDING,
        method="simulated",
        idempotency_key=idempotency_key,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def confirm_payment(db: Session, payment: Payment) -> Payment:
    """Confirm a pending payment. Idempotent: confirming twice is a no-op."""
    if payment.status == PAYMENT_CONFIRMED:
        return payment  # already processed, do not double-count

    if payment.status != PAYMENT_PENDING:
        raise HTTPException(status_code=400, detail="Payment is not in a confirmable state")

    instalment = payment.instalment
    # Re-validate against current balance (excluding this pending payment).
    state = instalment_state(instalment)
    if payment.amount > state["balance"] + 1e-6:
        raise HTTPException(
            status_code=400,
            detail="Balance changed; this payment would over-pay the instalment",
        )

    payment.status = PAYMENT_CONFIRMED
    payment.confirmed_at = datetime.now(timezone.utc)
    payment.receipt_no = _next_receipt_no(db)
    db.add(payment)
    db.flush()

    cancelled = _cancel_reminders_if_paid(db, instalment)

    db.commit()
    db.refresh(payment)
    return payment


def _cancel_reminders_if_paid(db: Session, instalment: Instalment) -> int:
    """Cancel scheduled reminders for an instalment once it is fully paid."""
    state = instalment_state(instalment)
    if state["balance"] > 0:
        return 0
    cancelled = 0
    for reminder in instalment.reminders:
        if reminder.status == REMINDER_SCHEDULED:
            reminder.status = REMINDER_CANCELLED
            reminder.cancelled_at = datetime.now(timezone.utc)
            reminder.cancel_reason = "Instalment fully paid"
            db.add(reminder)
            cancelled += 1
    return cancelled
