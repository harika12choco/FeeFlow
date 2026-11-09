"""Student fee-ledger endpoints (accounts executive + authorized parent)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import authorize_student_access, get_current_user, require_accounts
from ..models import Student, User
from ..serializers import student_detail, student_summary

router = APIRouter(prefix="/students", tags=["students"])


@router.get("")
def list_students(
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
    centre: str | None = Query(None),
    batch: str | None = Query(None),
    program: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
) -> list[dict]:
    students = db.query(Student).all()
    summaries = [student_summary(s) for s in students]

    if centre:
        summaries = [s for s in summaries if s["centre"] == centre]
    if batch:
        summaries = [s for s in summaries if s["batch"] == batch]
    if program:
        summaries = [s for s in summaries if s["program"] == program]
    if status:
        summaries = [s for s in summaries if s["status"] == status]
    if search:
        q = search.lower()
        summaries = [
            s for s in summaries
            if q in s["name"].lower() or q in s["student_code"].lower()
        ]
    summaries.sort(key=lambda s: s["outstanding"], reverse=True)
    return summaries


@router.get("/filters")
def filter_options(
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
) -> dict:
    students = db.query(Student).all()
    return {
        "centres": sorted({s.centre for s in students}),
        "batches": sorted({s.batch for s in students}),
        "programs": sorted({s.program for s in students}),
    }


@router.get("/{student_id}")
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    authorize_student_access(db, user, student)
    return student_detail(student)
