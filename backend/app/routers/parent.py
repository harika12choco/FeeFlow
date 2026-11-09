"""Parent portal endpoints. A parent can only ever see their linked student(s)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_parent
from ..models import Student, User
from ..serializers import student_detail, student_summary

router = APIRouter(prefix="/parent", tags=["parent"])


@router.get("/students")
def my_students(
    db: Session = Depends(get_db),
    user: User = Depends(require_parent),
) -> list[dict]:
    students = db.query(Student).filter(Student.parent_user_id == user.id).all()
    return [student_summary(s) for s in students]


@router.get("/portal")
def portal(
    db: Session = Depends(get_db),
    user: User = Depends(require_parent),
) -> dict:
    student = db.query(Student).filter(Student.parent_user_id == user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="No student linked to this account")
    return student_detail(student)
