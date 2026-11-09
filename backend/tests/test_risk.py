"""AI dropout-risk: rule-based fallback behaviour and guardrails."""
from __future__ import annotations

from app.config import settings
from app.services import risk as risk_service
from app.services.ledger import student_ledger
from tests.conftest import auth, login, make_student, make_user


def test_fallback_is_rule_based_without_api_key(db):
    # No API key configured in tests -> deterministic rule-based result.
    assert settings.openai_api_key is None
    student = make_student(
        db,
        instalments=[(10000, -100), (10000, -60), (10000, -20)],
        payments=[],
        attendance=[("2026-10", 9, 25)],  # 36%
        scores=[("T1", -80, 40, 100), ("T2", -10, 24, 100)],
    )
    features = risk_service.compute_features(student)
    result = risk_service.assess(features, use_ai=True)
    assert result["source"] == "rule_based"
    assert result["model"] is None
    assert result["risk_level"] == "high"
    # Required output fields present.
    for key in ("risk_level", "reasons", "recommended_action", "confidence", "uncertainty"):
        assert key in result
    assert result["reasons"]


def test_low_risk_for_healthy_student(db):
    student = make_student(
        db,
        instalments=[(10000, 30), (10000, 90)],  # upcoming, nothing overdue
        payments=[],
        attendance=[("2026-10", 24, 25)],  # 96%
        scores=[("T1", -40, 70, 100), ("T2", -5, 78, 100)],
    )
    features = risk_service.compute_features(student)
    result = risk_service.assess(features, use_ai=True)
    assert result["risk_level"] == "low"


def test_confidence_drops_with_missing_signals(db):
    student = make_student(db, instalments=[(10000, -20)], payments=[],
                           attendance=[], scores=[])
    features = risk_service.compute_features(student)
    result = risk_service.assess(features, use_ai=True)
    # Two missing signals -> confidence <= 0.6
    assert result["confidence"] <= 0.6
    assert "missing" in result["uncertainty"].lower()


def test_assessment_only_creates_review_task_no_side_effects(db, client):
    make_user(db, "acc@test.com", "accounts")
    student = make_student(
        db,
        instalments=[(10000, -60), (10000, -20)],
        payments=[],
        attendance=[("2026-10", 12, 25)],
        scores=[("T1", -40, 40, 100), ("T2", -5, 30, 100)],
    )
    before = student_ledger(student)
    token = login(client, "acc@test.com")
    resp = client.post("/risk/assess", headers=auth(token),
                       json={"student_id": student.id, "use_ai": True})
    assert resp.status_code == 200
    body = resp.json()
    # A counsellor task was created...
    assert body["flag"]["counsellor_task"]
    assert body["flag"]["status"] == "open"
    # ...and nothing financial changed.
    db.refresh(student)
    after = student_ledger(student)
    assert after["outstanding"] == before["outstanding"]
    assert after["total_paid"] == before["total_paid"]


def test_mark_false_positive(db, client):
    make_user(db, "acc@test.com", "accounts")
    student = make_student(db, instalments=[(10000, -60), (10000, -30)], payments=[],
                           attendance=[("2026-10", 10, 25)],
                           scores=[("T1", -40, 35, 100), ("T2", -5, 25, 100)])
    token = login(client, "acc@test.com")
    flag_id = client.post("/risk/assess", headers=auth(token),
                          json={"student_id": student.id}).json()["flag"]["id"]
    resp = client.post(f"/risk/flags/{flag_id}/status", headers=auth(token),
                       json={"status": "false_positive"})
    assert resp.status_code == 200
    assert resp.json()["flag"]["status"] == "false_positive"
