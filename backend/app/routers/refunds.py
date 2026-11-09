"""Refund calculator and refund-request management (accounts executive)."""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_accounts
from ..models import (
    REFUND_APPROVED,
    REFUND_PROCESSED,
    REFUND_REJECTED,
    REFUND_REQUESTED,
    Refund,
    Student,
    User,
)
from ..schemas import RefundCalcRequest, RefundCreateRequest, RefundDecisionRequest
from ..serializers import refund_out
from ..services import refunds as refund_service
from ..services.ledger import student_ledger

router = APIRouter(prefix="/refunds", tags=["refunds"])

_DECISIONS = {REFUND_APPROVED, REFUND_REJECTED, REFUND_PROCESSED}


@router.get("/policies")
def policies(_: User = Depends(require_accounts)) -> list[dict]:
    return refund_service.list_policies()


def _calc_for_student(db: Session, student_id: int, policy_key: str, as_of: str | None) -> dict:
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    try:
        when = date.fromisoformat(as_of) if as_of else date.today()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid as_of date")
    ledger = student_ledger(student, when)
    try:
        result = refund_service.calculate_refund(
            policy_key=policy_key,
            paid_amount=ledger["total_paid"],
            course_start=student.course_start,
            course_end=student.course_end,
            as_of=when,
        )
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    result["student"] = {
        "id": student.id,
        "name": student.name,
        "student_code": student.student_code,
    }
    return result


@router.post("/calculate")
def calculate(
    payload: RefundCalcRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
) -> dict:
    return _calc_for_student(db, payload.student_id, payload.policy_key, payload.as_of)


@router.post("")
def create_refund(
    payload: RefundCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
) -> dict:
    result = _calc_for_student(db, payload.student_id, payload.policy_key, payload.as_of)
    refund = Refund(
        student_id=payload.student_id,
        policy_key=payload.policy_key,
        reason=payload.reason,
        paid_amount=result["inputs"]["paid_amount"],
        computed_refund=result["net_refund"],
        breakdown=result,
        status=REFUND_REQUESTED,
    )
    db.add(refund)
    db.commit()
    db.refresh(refund)
    return refund_out(refund)


@router.get("")
def list_refunds(
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
) -> list[dict]:
    refunds = db.query(Refund).order_by(Refund.created_at.desc()).all()
    return [refund_out(r) for r in refunds]


@router.post("/{refund_id}/decision")
def decide(
    refund_id: int,
    payload: RefundDecisionRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
) -> dict:
    refund = db.get(Refund, refund_id)
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    if payload.status not in _DECISIONS:
        raise HTTPException(status_code=400, detail="Invalid refund decision")
    refund.status = payload.status
    refund.decided_at = datetime.now(timezone.utc)
    db.add(refund)
    db.commit()
    db.refresh(refund)
    return refund_out(refund)
