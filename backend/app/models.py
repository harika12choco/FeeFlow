"""SQLAlchemy ORM models for FeeFlow.

Money is stored as Float for simplicity; all financial math is done with
explicit rounding in the service layer so results are deterministic.
"""
from __future__ import annotations

from datetime import datetime, date

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ---- Roles & status constants -------------------------------------------------

ROLE_ACCOUNTS = "accounts"
ROLE_PARENT = "parent"

PAYMENT_PENDING = "pending"
PAYMENT_CONFIRMED = "confirmed"
PAYMENT_FAILED = "failed"

REMINDER_SCHEDULED = "scheduled"
REMINDER_SENT = "sent"
REMINDER_CANCELLED = "cancelled"

REFUND_REQUESTED = "requested"
REFUND_APPROVED = "approved"
REFUND_REJECTED = "rejected"
REFUND_PROCESSED = "processed"

FLAG_OPEN = "open"
FLAG_FALSE_POSITIVE = "false_positive"
FLAG_RESOLVED = "resolved"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    students: Mapped[list["Student"]] = relationship(back_populates="parent")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    program: Mapped[str] = mapped_column(String(64))          # JEE 2027 / NEET 2027
    batch: Mapped[str] = mapped_column(String(64))            # Morning / Evening
    centre: Mapped[str] = mapped_column(String(64))           # Centre name
    parent_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    enrolled_on: Mapped[date] = mapped_column(Date)
    course_start: Mapped[date] = mapped_column(Date)
    course_end: Mapped[date] = mapped_column(Date)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    parent: Mapped[User | None] = relationship(back_populates="students")
    fee_plan: Mapped["FeePlan"] = relationship(
        back_populates="student", uselist=False, cascade="all, delete-orphan"
    )
    attendance: Mapped[list["Attendance"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
    test_scores: Mapped[list["TestScore"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
    risk_flags: Mapped[list["RiskFlag"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )


class FeePlan(Base):
    __tablename__ = "fee_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), unique=True)
    name: Mapped[str] = mapped_column(String(128))
    gross_amount: Mapped[float] = mapped_column(Float)   # before discounts
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    student: Mapped[Student] = relationship(back_populates="fee_plan")
    discounts: Mapped[list["Discount"]] = relationship(
        back_populates="fee_plan", cascade="all, delete-orphan"
    )
    instalments: Mapped[list["Instalment"]] = relationship(
        back_populates="fee_plan",
        cascade="all, delete-orphan",
        order_by="Instalment.seq",
    )


class Discount(Base):
    __tablename__ = "discounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    fee_plan_id: Mapped[int] = mapped_column(ForeignKey("fee_plans.id"))
    label: Mapped[str] = mapped_column(String(128))
    amount: Mapped[float] = mapped_column(Float)   # absolute rupee amount

    fee_plan: Mapped[FeePlan] = relationship(back_populates="discounts")


class Instalment(Base):
    __tablename__ = "instalments"

    id: Mapped[int] = mapped_column(primary_key=True)
    fee_plan_id: Mapped[int] = mapped_column(ForeignKey("fee_plans.id"))
    seq: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(128))
    amount: Mapped[float] = mapped_column(Float)
    due_date: Mapped[date] = mapped_column(Date)

    fee_plan: Mapped[FeePlan] = relationship(back_populates="instalments")
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="instalment", cascade="all, delete-orphan"
    )
    reminders: Mapped[list["Reminder"]] = relationship(
        back_populates="instalment", cascade="all, delete-orphan"
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    instalment_id: Mapped[int] = mapped_column(ForeignKey("instalments.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(16), default=PAYMENT_PENDING, index=True)
    method: Mapped[str] = mapped_column(String(32), default="simulated")
    # Idempotency key supplied by the client to prevent duplicate processing.
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    receipt_no: Mapped[str | None] = mapped_column(String(32), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime)

    instalment: Mapped[Instalment] = relationship(back_populates="payments")


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    instalment_id: Mapped[int] = mapped_column(ForeignKey("instalments.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16))        # before_due / on_due / after_due
    channel: Mapped[str] = mapped_column(String(16))     # sms / email / whatsapp (mocked)
    language: Mapped[str] = mapped_column(String(4))     # en / hi
    scheduled_for: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default=REMINDER_SCHEDULED, index=True)
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    cancel_reason: Mapped[str | None] = mapped_column(String(255))

    instalment: Mapped[Instalment] = relationship(back_populates="reminders")


class Refund(Base):
    __tablename__ = "refunds"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    policy_key: Mapped[str] = mapped_column(String(64))
    reason: Mapped[str] = mapped_column(Text)
    paid_amount: Mapped[float] = mapped_column(Float)
    computed_refund: Mapped[float] = mapped_column(Float)
    breakdown: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default=REFUND_REQUESTED, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)

    student: Mapped[Student] = relationship()


class RiskFlag(Base):
    __tablename__ = "risk_flags"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    risk_level: Mapped[str] = mapped_column(String(16), index=True)   # low / medium / high
    score: Mapped[float] = mapped_column(Float)
    reasons: Mapped[list] = mapped_column(JSON)
    recommended_action: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(16))      # ai / rule_based
    model: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default=FLAG_OPEN, index=True)
    counsellor_task: Mapped[str] = mapped_column(Text)   # the review task that was created
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)

    student: Mapped[Student] = relationship(back_populates="risk_flags")


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    period: Mapped[str] = mapped_column(String(32))   # e.g. "2026-09"
    present: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)

    student: Mapped[Student] = relationship(back_populates="attendance")

    @property
    def percentage(self) -> float:
        return round(100.0 * self.present / self.total, 1) if self.total else 0.0


class TestScore(Base):
    __tablename__ = "test_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    test_name: Mapped[str] = mapped_column(String(128))
    taken_on: Mapped[date] = mapped_column(Date)
    score: Mapped[float] = mapped_column(Float)
    max_score: Mapped[float] = mapped_column(Float)

    student: Mapped[Student] = relationship(back_populates="test_scores")

    @property
    def percentage(self) -> float:
        return round(100.0 * self.score / self.max_score, 1) if self.max_score else 0.0
