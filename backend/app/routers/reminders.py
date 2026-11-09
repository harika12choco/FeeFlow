"""Reminder management (accounts executive)."""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_accounts
from ..models import (
    REMINDER_CANCELLED,
    REMINDER_SCHEDULED,
    Reminder,
    Student,
    User,
)
from ..schemas import ReminderDispatchRequest, ReminderGenerateRequest
from ..serializers import reminder_out
from ..services import reminders as reminder_service

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("")
def list_reminders(
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
    student_id: int | None = Query(None),
    status: str | None = Query(None),
    kind: str | None = Query(None),
) -> list[dict]:
    q = db.query(Reminder)
    if student_id:
        q = q.filter(Reminder.student_id == student_id)
    if status:
        q = q.filter(Reminder.status == status)
    if kind:
        q = q.filter(Reminder.kind == kind)
    reminders = q.order_by(Reminder.scheduled_for.desc(), Reminder.id.desc()).all()
    return [reminder_out(r) for r in reminders]


@router.post("/generate")
def generate(
    payload: ReminderGenerateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
) -> dict:
    if payload.student_id:
        student = db.get(Student, payload.student_id)
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        created = reminder_service.generate_for_student(db, student, payload.language)
    else:
        created = 0
        for student in db.query(Student).all():
            created += reminder_service.generate_for_student(db, student, payload.language)
    return {"created": created, "message": f"{created} reminder(s) scheduled."}


@router.post("/dispatch")
def dispatch(
    payload: ReminderDispatchRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
) -> dict:
    as_of = date.fromisoformat(payload.as_of) if payload.as_of else date.today()
    sent = reminder_service.dispatch_due(db, as_of)
    return {"sent": sent, "message": f"{sent} due reminder(s) dispatched (mock provider)."}


@router.post("/{reminder_id}/cancel")
def cancel(
    reminder_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
) -> dict:
    reminder = db.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    if reminder.status != REMINDER_SCHEDULED:
        raise HTTPException(status_code=400, detail="Only scheduled reminders can be cancelled")
    reminder.status = REMINDER_CANCELLED
    reminder.cancelled_at = datetime.now(timezone.utc)
    reminder.cancel_reason = "Cancelled manually by accounts staff"
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return {"reminder": reminder_out(reminder), "message": "Reminder cancelled."}
