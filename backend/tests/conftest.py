"""Pytest fixtures: isolated SQLite test DB, TestClient and data builders."""
from __future__ import annotations

import os
import tempfile
from datetime import date, datetime, timedelta, timezone

# Point the app at a throwaway database BEFORE importing any app module.
_TMP = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"
os.environ["JWT_SECRET"] = "test-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    PAYMENT_CONFIRMED,
    Attendance,
    Discount,
    FeePlan,
    Instalment,
    Payment,
    Student,
    TestScore,
    User,
)
from app.security import hash_password  # noqa: E402

TODAY = date.today()


def d(offset: int) -> date:
    return TODAY + timedelta(days=offset)


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    return TestClient(app)


# --- builders ----------------------------------------------------------------

def make_user(db, email, role, name="User", password="Passw0rd!") -> User:
    user = User(email=email.lower(), hashed_password=hash_password(password),
                full_name=name, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_student(
    db,
    code="STU-TEST",
    parent=None,
    gross=30000,
    discounts=None,
    instalments=None,
    payments=None,
    attendance=None,
    scores=None,
    course_offsets=(-100, 300),
) -> Student:
    """instalments: list[(amount, due_offset)]; payments: list[(idx, amount)]."""
    instalments = instalments or [(10000, -30), (10000, 0), (10000, 30)]
    payments = payments or []
    student = Student(
        student_code=code, name=f"Student {code}", program="JEE 2027",
        batch="Morning", centre="Kota - Rajeev Gandhi Nagar",
        parent_user_id=parent.id if parent else None,
        enrolled_on=d(course_offsets[0]), course_start=d(course_offsets[0]),
        course_end=d(course_offsets[1]), is_sample=True,
    )
    db.add(student)
    db.flush()
    plan = FeePlan(student_id=student.id, name="Test Plan", gross_amount=float(gross))
    db.add(plan)
    db.flush()
    for label, amount in (discounts or []):
        db.add(Discount(fee_plan_id=plan.id, label=label, amount=float(amount)))
    inst_objs = []
    for seq, (amount, off) in enumerate(instalments, start=1):
        inst = Instalment(fee_plan_id=plan.id, seq=seq, label=f"Instalment {seq}",
                          amount=float(amount), due_date=d(off))
        db.add(inst)
        db.flush()
        inst_objs.append(inst)
    for idx, amount in payments:
        inst = inst_objs[idx]
        db.add(Payment(instalment_id=inst.id, student_id=student.id, amount=float(amount),
                       status=PAYMENT_CONFIRMED, method="simulated",
                       idempotency_key=f"seed-{code}-{idx}",
                       receipt_no=f"RCP-{code}-{idx}",
                       confirmed_at=datetime.now(timezone.utc)))
    for period, present, total in (attendance or []):
        db.add(Attendance(student_id=student.id, period=period, present=present, total=total))
    for name, off, score, mx in (scores or []):
        db.add(TestScore(student_id=student.id, test_name=name, taken_on=d(off),
                         score=float(score), max_score=float(mx)))
    db.commit()
    db.refresh(student)
    return student


def login(client, email, password="Passw0rd!") -> str:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
