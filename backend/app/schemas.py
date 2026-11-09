"""Pydantic request/response schemas."""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


# --- Auth ---------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str


# --- Payments -----------------------------------------------------------------

class PaymentInitiateRequest(BaseModel):
    instalment_id: int
    amount: float = Field(gt=0)
    idempotency_key: str | None = None


class PaymentConfirmRequest(BaseModel):
    payment_id: int
    idempotency_key: str | None = None


# --- Reminders ----------------------------------------------------------------

class ReminderGenerateRequest(BaseModel):
    student_id: int | None = None  # None = all students
    language: str = "en"


class ReminderDispatchRequest(BaseModel):
    as_of: str | None = None  # ISO date; defaults to today


# --- Refunds ------------------------------------------------------------------

class RefundCalcRequest(BaseModel):
    student_id: int
    policy_key: str
    as_of: str | None = None


class RefundCreateRequest(BaseModel):
    student_id: int
    policy_key: str
    reason: str
    as_of: str | None = None


class RefundDecisionRequest(BaseModel):
    status: str  # approved / rejected / processed


# --- Risk ---------------------------------------------------------------------

class RiskAssessRequest(BaseModel):
    student_id: int
    use_ai: bool = True


class RiskStatusRequest(BaseModel):
    status: str  # false_positive / resolved / open
