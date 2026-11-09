"""Seed the database with demo users and clearly-labelled sample data.

Run as a script to reset and reseed:  python -m app.seed
All student records are flagged is_sample=True and surfaced as "Sample data"
in the UI. Required assessment records (STU-0412 / STU-0587 / STU-0219) are
included verbatim, plus additional realistic records to populate the dashboard.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .models import (
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
from .security import hash_password
from .services import reminders as reminder_service
from .services import risk as risk_service
from .models import FLAG_OPEN, RiskFlag

DEMO_PASSWORD = "Passw0rd!"
TODAY = date.today()


def d(offset_days: int) -> date:
    return TODAY + timedelta(days=offset_days)


# Declarative student specs. Amounts in INR. due_off = days relative to today.
STUDENTS: list[dict] = [
    {
        "code": "STU-0412", "name": "Aarav Meena", "program": "JEE 2027",
        "batch": "Morning", "centre": "Kota - Rajeev Gandhi Nagar",
        "parent_name": "Suresh Meena", "parent_email": "suresh.meena@example.com",
        "gross": 30000, "discounts": [], "lang": "en",
        "instalments": [("Instalment 1", 10000, -120), ("Instalment 2", 10000, -60),
                        ("Instalment 3", 10000, -5)],
        "payments": [(0, 10000), (1, 10000), (2, 10000)],
        "attendance": [("2026-08", 24, 26), ("2026-09", 25, 27), ("2026-10", 23, 25)],
        "scores": [("Unit Test 1", -80, 62, 100), ("Unit Test 2", -40, 71, 100),
                   ("Mock Test 1", -10, 78, 100)],
    },
    {
        "code": "STU-0587", "name": "Ishita Sharma", "program": "JEE 2027",
        "batch": "Evening", "centre": "Kota - Rajeev Gandhi Nagar",
        "parent_name": "Demo Parent (Ishita)", "parent_email": "parent@feeflow.app",
        "gross": 32000, "discounts": [("Sibling discount", 2000)], "lang": "hi",
        "instalments": [("Instalment 1", 10000, -70), ("Instalment 2", 10000, -35),
                        ("Instalment 3", 10000, -5)],
        "payments": [(0, 10000), (1, 5000)],
        "attendance": [("2026-08", 20, 26), ("2026-09", 17, 27), ("2026-10", 16, 25)],
        "scores": [("Unit Test 1", -80, 58, 100), ("Unit Test 2", -40, 49, 100),
                   ("Mock Test 1", -10, 41, 100)],
    },
    {
        "code": "STU-0219", "name": "Mohit Gurjar", "program": "NEET 2027",
        "batch": "Morning", "centre": "Jaipur - Vaishali Nagar",
        "parent_name": "Ramesh Gurjar", "parent_email": "ramesh.gurjar@example.com",
        "gross": 40000, "discounts": [], "lang": "en",
        "instalments": [("Instalment 1", 20000, 20), ("Instalment 2", 20000, 80)],
        "payments": [],
        "attendance": [("2026-09", 25, 26), ("2026-10", 24, 25)],
        "scores": [("Unit Test 1", -30, 66, 100), ("Mock Test 1", -5, 69, 100)],
    },
    {
        "code": "STU-0731", "name": "Sneha Verma", "program": "NEET 2027",
        "batch": "Evening", "centre": "Jaipur - Vaishali Nagar",
        "parent_name": "Alok Verma", "parent_email": "alok.verma@example.com",
        "gross": 45000, "discounts": [("Early bird", 5000)], "lang": "en",
        "instalments": [("Instalment 1", 10000, -90), ("Instalment 2", 10000, -50),
                        ("Instalment 3", 10000, -10), ("Instalment 4", 10000, 30)],
        "payments": [(0, 10000)],
        "attendance": [("2026-08", 15, 26), ("2026-09", 13, 27), ("2026-10", 12, 25)],
        "scores": [("Unit Test 1", -70, 55, 100), ("Unit Test 2", -35, 42, 100),
                   ("Mock Test 1", -8, 31, 100)],
    },
    {
        "code": "STU-0666", "name": "Rohan Singh", "program": "JEE 2027",
        "batch": "Morning", "centre": "Delhi - Mukherjee Nagar",
        "parent_name": "Harpreet Singh", "parent_email": "harpreet.singh@example.com",
        "gross": 36000, "discounts": [], "lang": "en",
        "instalments": [("Instalment 1", 12000, -40), ("Instalment 2", 12000, -10),
                        ("Instalment 3", 12000, 50)],
        "payments": [(0, 12000), (1, 12000)],
        "attendance": [("2026-09", 22, 26), ("2026-10", 21, 25)],
        "scores": [("Unit Test 1", -40, 70, 100), ("Mock Test 1", -8, 72, 100)],
    },
    {
        "code": "STU-0588", "name": "Priya Nair", "program": "NEET 2027",
        "batch": "Morning", "centre": "Kota - Rajeev Gandhi Nagar",
        "parent_name": "Lakshmi Nair", "parent_email": "lakshmi.nair@example.com",
        "gross": 40000, "discounts": [], "lang": "hi",
        "instalments": [("Instalment 1", 20000, -25), ("Instalment 2", 20000, 40)],
        "payments": [(0, 8000)],
        "attendance": [("2026-09", 19, 26), ("2026-10", 18, 25)],
        "scores": [("Unit Test 1", -30, 60, 100), ("Mock Test 1", -5, 53, 100)],
    },
    {
        "code": "STU-0903", "name": "Karan Malhotra", "program": "Foundation 2028",
        "batch": "Evening", "centre": "Delhi - Mukherjee Nagar",
        "parent_name": "Deepak Malhotra", "parent_email": "deepak.malhotra@example.com",
        "gross": 24000, "discounts": [("Scholarship", 4000)], "lang": "en",
        "instalments": [("Instalment 1", 10000, 15), ("Instalment 2", 10000, 75)],
        "payments": [],
        "attendance": [("2026-09", 25, 26), ("2026-10", 24, 25)],
        "scores": [("Unit Test 1", -20, 80, 100)],
    },
    {
        "code": "STU-0450", "name": "Ananya Gupta", "program": "JEE 2027",
        "batch": "Evening", "centre": "Jaipur - Vaishali Nagar",
        "parent_name": "Vivek Gupta", "parent_email": "vivek.gupta@example.com",
        "gross": 30000, "discounts": [], "lang": "en",
        "instalments": [("Instalment 1", 10000, -100), ("Instalment 2", 10000, -60),
                        ("Instalment 3", 10000, -20)],
        "payments": [],
        "attendance": [("2026-08", 12, 26), ("2026-09", 10, 27), ("2026-10", 9, 25)],
        "scores": [("Unit Test 1", -80, 40, 100), ("Unit Test 2", -40, 33, 100),
                   ("Mock Test 1", -12, 24, 100)],
    },
    {
        "code": "STU-0812", "name": "Vikram Reddy", "program": "NEET 2027",
        "batch": "Morning", "centre": "Delhi - Mukherjee Nagar",
        "parent_name": "Anil Reddy", "parent_email": "anil.reddy@example.com",
        "gross": 50000, "discounts": [("Merit scholarship", 10000)], "lang": "en",
        "instalments": [("Instalment 1", 10000, -80), ("Instalment 2", 10000, -40),
                        ("Instalment 3", 10000, 0), ("Instalment 4", 10000, 40)],
        "payments": [(0, 10000), (1, 10000)],
        "attendance": [("2026-09", 21, 26), ("2026-10", 20, 25)],
        "scores": [("Unit Test 1", -40, 68, 100), ("Mock Test 1", -6, 66, 100)],
    },
]


def _receipt_counter():
    n = {"i": 0}

    def nxt() -> str:
        n["i"] += 1
        return f"RCP-{n['i']:06d}"

    return nxt


def seed(db: Session, force: bool = False) -> None:
    if db.query(User).first() and not force:
        print("Database already seeded; skipping. Use force to reseed.")
        return

    accounts = User(
        email="accounts@feeflow.app",
        hashed_password=hash_password(DEMO_PASSWORD),
        full_name="Anita Desai (Accounts)",
        role="accounts",
    )
    db.add(accounts)
    db.flush()

    next_receipt = _receipt_counter()

    for spec in STUDENTS:
        parent = User(
            email=spec["parent_email"].lower(),
            hashed_password=hash_password(DEMO_PASSWORD),
            full_name=spec["parent_name"],
            role="parent",
        )
        db.add(parent)
        db.flush()

        student = Student(
            student_code=spec["code"],
            name=spec["name"],
            program=spec["program"],
            batch=spec["batch"],
            centre=spec["centre"],
            parent_user_id=parent.id,
            enrolled_on=d(-150),
            course_start=d(-150),
            course_end=d(400),
            is_sample=True,
        )
        db.add(student)
        db.flush()

        plan = FeePlan(student_id=student.id, name=f"{spec['program']} Full Course",
                       gross_amount=float(spec["gross"]))
        db.add(plan)
        db.flush()
        for label, amount in spec["discounts"]:
            db.add(Discount(fee_plan_id=plan.id, label=label, amount=float(amount)))

        instalments: list[Instalment] = []
        for seq, (label, amount, off) in enumerate(spec["instalments"], start=1):
            inst = Instalment(fee_plan_id=plan.id, seq=seq, label=label,
                              amount=float(amount), due_date=d(off))
            db.add(inst)
            db.flush()
            instalments.append(inst)

        for idx, amount in spec["payments"]:
            inst = instalments[idx]
            db.add(Payment(
                instalment_id=inst.id,
                student_id=student.id,
                amount=float(amount),
                status=PAYMENT_CONFIRMED,
                method="simulated",
                idempotency_key=uuid.uuid4().hex,
                receipt_no=next_receipt(),
                confirmed_at=datetime.now(timezone.utc),
            ))

        for period, present, total in spec["attendance"]:
            db.add(Attendance(student_id=student.id, period=period,
                              present=present, total=total))
        for name, off, score, mx in spec["scores"]:
            db.add(TestScore(student_id=student.id, test_name=name, taken_on=d(off),
                             score=float(score), max_score=float(mx)))

    db.commit()

    # Generate + dispatch reminders for unpaid instalments.
    for student in db.query(Student).all():
        spec_lang = next((s["lang"] for s in STUDENTS if s["code"] == student.student_code), "en")
        reminder_service.generate_for_student(db, student, language=spec_lang)
    reminder_service.dispatch_due(db)

    # Create counsellor review tasks (risk flags) for medium/high risk students.
    for student in db.query(Student).all():
        features = risk_service.compute_features(student)
        assessment = risk_service.assess(features, use_ai=False)  # rule-based for deterministic seed
        if assessment["risk_level"] in {"medium", "high"}:
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
                counsellor_task=risk_service.build_counsellor_task(features, assessment),
            ))
    db.commit()
    print("Seed complete.")
    print(f"  Accounts login : accounts@feeflow.app / {DEMO_PASSWORD}")
    print(f"  Parent login   : parent@feeflow.app / {DEMO_PASSWORD}  (linked to STU-0587)")


def reset_and_seed() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db, force=True)
    finally:
        db.close()


if __name__ == "__main__":
    reset_and_seed()
