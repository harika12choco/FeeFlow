"""Accounts dashboard aggregates with working filters."""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_accounts
from ..models import FLAG_OPEN, Student, User
from ..services.ledger import money, student_ledger

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

AGEING_BUCKETS = ["current", "1-15", "16-30", "31-60", "60+"]


def _bucket(days: int) -> str:
    if days <= 0:
        return "current"
    if days <= 15:
        return "1-15"
    if days <= 30:
        return "16-30"
    if days <= 60:
        return "31-60"
    return "60+"


@router.get("/stats")
def stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_accounts),
    centre: str | None = Query(None),
    batch: str | None = Query(None),
    program: str | None = Query(None),
) -> dict:
    students = db.query(Student).all()
    if centre:
        students = [s for s in students if s.centre == centre]
    if batch:
        students = [s for s in students if s.batch == batch]
    if program:
        students = [s for s in students if s.program == program]

    total_billed = total_collected = outstanding = overdue = 0.0
    dues_by_centre: dict[str, float] = defaultdict(float)
    dues_by_batch: dict[str, float] = defaultdict(float)
    ageing: dict[str, float] = {b: 0.0 for b in AGEING_BUCKETS}
    high_risk: list[dict] = []

    for s in students:
        ledger = student_ledger(s)
        total_billed += ledger["net_payable"]
        total_collected += ledger["total_paid"]
        outstanding += ledger["outstanding"]
        overdue += ledger["overdue_amount"]
        dues_by_centre[s.centre] += ledger["outstanding"]
        dues_by_batch[s.batch] += ledger["outstanding"]

        for inst in ledger["instalments"]:
            if inst["balance"] > 0:
                ageing[_bucket(inst["days_overdue"])] += inst["balance"]

        open_flags = [f for f in s.risk_flags if f.status == FLAG_OPEN]
        if open_flags:
            flag = max(open_flags, key=lambda f: f.score)
            if flag.risk_level in {"high", "medium"}:
                high_risk.append({
                    "student_id": s.id,
                    "student_code": s.student_code,
                    "name": s.name,
                    "centre": s.centre,
                    "batch": s.batch,
                    "risk_level": flag.risk_level,
                    "score": flag.score,
                    "source": flag.source,
                    "outstanding": ledger["outstanding"],
                })

    collection_rate = round(100.0 * total_collected / total_billed, 1) if total_billed else 0.0
    high_risk.sort(key=lambda r: r["score"], reverse=True)

    return {
        "totals": {
            "total_billed": money(total_billed),
            "total_collected": money(total_collected),
            "outstanding": money(outstanding),
            "overdue": money(overdue),
            "collection_rate": collection_rate,
            "student_count": len(students),
        },
        "dues_by_centre": [
            {"centre": k, "outstanding": money(v)} for k, v in sorted(dues_by_centre.items())
        ],
        "dues_by_batch": [
            {"batch": k, "outstanding": money(v)} for k, v in sorted(dues_by_batch.items())
        ],
        "ageing": [{"bucket": b, "amount": money(ageing[b])} for b in AGEING_BUCKETS],
        "high_risk_students": high_risk,
    }
