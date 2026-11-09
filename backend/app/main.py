"""FeeFlow API application."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import (
    auth,
    dashboard,
    parent,
    payments,
    refunds,
    reminders,
    risk,
    students,
)

# Create tables on startup (SQLite/Postgres). Safe/idempotent.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FeeFlow API",
    version="1.0.0",
    description="Coaching-institute fee tracking and parent portal.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(students.router)
app.include_router(parent.router)
app.include_router(payments.router)
app.include_router(reminders.router)
app.include_router(refunds.router)
app.include_router(risk.router)
app.include_router(dashboard.router)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok", "service": "feeflow"}
