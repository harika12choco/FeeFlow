"""AI dropout-risk review (accounts executive).

A risk assessment ONLY ever creates a counsellor review task (a RiskFlag row).
It never changes fees, triggers penalties, messages parents, or makes any
automatic financial decision.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_accounts
from ..models import (
    FLAG_FALSE_POSITIVE,
    FLAG_OPEN,
    FLAG_RESOLVED,
    RiskFlag,
    Student,
    User,
)
from ..schemas import RiskAssessRequest, RiskStatusRequest
from ..serializers import risk_flag_out
from ..services import risk as risk_service

router = APIRouter(prefix="/risk", tags=["risk"])

_STATUSES = {FLAG_OPEN, FLAG_FALSE_POSITIVE, FLAG_RESOLVED}


def _create_flag(db: Session, student: Student, use_ai: bool) -> RiskFlag:
    features = risk_service.compute_features(student)
    assessment = risk_service.assess(features, use_ai=use_ai)
    task = risk_service.build_counsellor_task(features, assessment)
    flag = RiskFlag(
        student_id=student.id,
        risk_level=assessment["risk_level"],
        score=assessment["score"],
        reasons=assessment["reasons"],
        recommended_action=assessment["recommended_action"],
        confidence=assessment["confidence"],
        source=assessment["source"],
        model=assessment.get("model"),
        status=FLAG_OPEN,
        counsellor_task=task,
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)
    return flag


@router.post("/assess")
def assess_one(
    payload: RiskAssessRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
) -> dict:
    student = db.get(Student, payload.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    flag = _create_flag(db, student, payload.use_ai)
    return {
        "flag": risk_flag_out(flag),
        "note": "A counsellor review task was created. No fees, penalties or "
                "messages were changed by this assessment.",
    }


@router.post("/assess-all")
def assess_all(
    db: Session = Depends(get_db),
    use_ai: bool = Query(True),
    _: User = Depends(require_accounts),
) -> dict:
    created = 0
    for student in db.query(Student).all():
        has_open = any(f.status == FLAG_OPEN for f in student.risk_flags)
        if has_open:
            continue
        features = risk_service.compute_features(student)
        assessment = risk_service.assess(features, use_ai=use_ai)
        # Only medium/high assessments become counsellor tasks in bulk runs.
        if assessment["risk_level"] in {"medium", "high"}:
            task = risk_service.build_counsellor_task(features, assessment)
            db.add(RiskFlag(
                student_id=student.id,
                risk_level=assessment["risk_level"],
                score=assessment["score"],
                reasons=assessment["reasons"],
                recommended_action=assessment["recommended_action"],
                confidence=assessment["confidence"],
                source=assessment["source"],
                model=assessment.get("model"),
                status=FLAG_OPEN,
                counsellor_task=task,
            ))
            created += 1
    db.commit()
    return {"created": created, "message": f"{created} counsellor review task(s) created."}


@router.get("/flags")
def list_flags(
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
    status: str | None = Query(None),
    risk_level: str | None = Query(None),
) -> list[dict]:
    q = db.query(RiskFlag)
    if status:
        q = q.filter(RiskFlag.status == status)
    if risk_level:
        q = q.filter(RiskFlag.risk_level == risk_level)
    flags = q.order_by(RiskFlag.created_at.desc()).all()
    return [risk_flag_out(f) for f in flags]


@router.post("/flags/{flag_id}/status")
def set_status(
    flag_id: int,
    payload: RiskStatusRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
) -> dict:
    flag = db.get(RiskFlag, flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Risk flag not found")
    if payload.status not in _STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    flag.status = payload.status
    flag.resolved_at = (
        datetime.now(timezone.utc) if payload.status != FLAG_OPEN else None
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)
    label = "false positive" if payload.status == FLAG_FALSE_POSITIVE else payload.status
    return {"flag": risk_flag_out(flag), "message": f"Flag marked as {label}."}
