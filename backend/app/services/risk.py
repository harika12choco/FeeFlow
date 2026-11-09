"""AI-assisted dropout-risk assessment.

Signals used: missed instalments, days overdue, attendance %, test-score trend.

Behaviour:
* If an LLM provider is configured and reachable, it is used and the result is
  labelled source="ai" with the model name.
* Otherwise a transparent, deterministic rule-based engine runs and the result
  is labelled source="rule_based". We NEVER claim a rule-based result came from AI.

Hard guardrails (enforced by the caller / router): a risk assessment may only
create a counsellor review task. It must never change fees, trigger penalties,
send messages to parents, or make any automatic financial decision.
"""
from __future__ import annotations

import json
from datetime import date

from sqlalchemy.orm import Session

from ..models import Student
from .ledger import student_ledger


# --- Feature extraction -------------------------------------------------------

def compute_features(student: Student, today: date | None = None) -> dict:
    today = today or date.today()
    ledger = student_ledger(student, today)

    att = sorted(student.attendance, key=lambda a: a.period)
    attendance_percent = att[-1].percentage if att else None

    scores = sorted(student.test_scores, key=lambda s: s.taken_on)
    score_percents = [s.percentage for s in scores]
    if len(score_percents) >= 2:
        score_trend = round(score_percents[-1] - score_percents[0], 1)
        latest_score = score_percents[-1]
    elif score_percents:
        score_trend = 0.0
        latest_score = score_percents[0]
    else:
        score_trend = None
        latest_score = None

    return {
        "student_code": student.student_code,
        "student_name": student.name,
        "missed_instalments": ledger["missed_instalments"],
        "days_overdue": ledger["max_days_overdue"],
        "outstanding": ledger["outstanding"],
        "attendance_percent": attendance_percent,
        "latest_score_percent": latest_score,
        "score_trend": score_trend,  # positive = improving, negative = declining
    }


# --- Deterministic rule-based engine -----------------------------------------

def _rule_based(features: dict) -> dict:
    score = 0.0
    reasons: list[str] = []
    missing_signals = 0

    missed = features.get("missed_instalments") or 0
    if missed >= 2:
        score += 30
        reasons.append(f"{missed} overdue instalments indicate sustained payment difficulty.")
    elif missed == 1:
        score += 15
        reasons.append("1 overdue instalment.")

    overdue = features.get("days_overdue") or 0
    if overdue >= 45:
        score += 30
        reasons.append(f"Payment is {overdue} days overdue (severe).")
    elif overdue >= 21:
        score += 20
        reasons.append(f"Payment is {overdue} days overdue.")
    elif overdue >= 1:
        score += 10
        reasons.append(f"Payment is {overdue} days overdue (mild).")

    att = features.get("attendance_percent")
    if att is None:
        missing_signals += 1
    elif att < 60:
        score += 25
        reasons.append(f"Attendance is low at {att}%.")
    elif att < 75:
        score += 12
        reasons.append(f"Attendance is below target at {att}%.")

    trend = features.get("score_trend")
    latest = features.get("latest_score_percent")
    if trend is None:
        missing_signals += 1
    else:
        if trend <= -10:
            score += 15
            reasons.append(f"Test scores declined by {abs(trend)} points.")
        elif trend < 0:
            score += 7
            reasons.append(f"Test scores slightly declining ({trend}).")
        if latest is not None and latest < 35:
            score += 8
            reasons.append(f"Latest test score is weak at {latest}%.")

    score = min(score, 100.0)
    if score >= 60:
        level = "high"
    elif score >= 30:
        level = "medium"
    else:
        level = "low"

    if not reasons:
        reasons.append("No significant risk signals detected.")

    actions = {
        "high": "Schedule a counsellor call with the family within 48 hours; discuss a "
                "fee-instalment plan and academic support. Do NOT alter fees automatically.",
        "medium": "Counsellor to check in within the week regarding dues and attendance.",
        "low": "No action needed; continue routine monitoring.",
    }

    # Confidence falls when input signals are missing.
    confidence = round(max(0.4, 1.0 - 0.2 * missing_signals), 2)
    uncertainty = (
        f"{missing_signals} of 2 behavioural signals were missing; treat with caution."
        if missing_signals
        else "All key signals were available."
    )

    return {
        "risk_level": level,
        "score": round(score, 1),
        "reasons": reasons,
        "recommended_action": actions[level],
        "confidence": confidence,
        "uncertainty": uncertainty,
        "source": "rule_based",
        "model": None,
    }


# --- Optional LLM path --------------------------------------------------------

def _ai_based(features: dict) -> dict | None:
    """Try an LLM assessment. Returns None on any failure so the caller can fall back."""
    from ..config import settings

    if not settings.openai_api_key:
        return None
    try:
        import httpx

        system = (
            "You are a student-retention risk analyst for a coaching institute. "
            "Assess dropout risk ONLY from the provided signals. You may not change "
            "fees, apply penalties, or message anyone. Respond with strict JSON: "
            '{"risk_level":"low|medium|high","score":0-100,"reasons":["..."],'
            '"recommended_action":"...","confidence":0-1,"uncertainty":"..."}'
        )
        user = json.dumps(features)
        resp = httpx.post(
            f"{settings.openai_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={
                "model": settings.openai_model,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
            timeout=20.0,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
        # Minimal validation of the model output.
        if data.get("risk_level") not in {"low", "medium", "high"}:
            return None
        data["source"] = "ai"
        data["model"] = settings.openai_model
        data.setdefault("score", 0)
        data.setdefault("reasons", [])
        data.setdefault("confidence", 0.5)
        data.setdefault("uncertainty", "")
        return data
    except Exception:
        # Any provider/parsing error -> deterministic fallback.
        return None


def assess(features: dict, use_ai: bool = True) -> dict:
    """Primary entry point. Attempts AI (if enabled) then falls back transparently."""
    if use_ai:
        ai = _ai_based(features)
        if ai is not None:
            return ai
    return _rule_based(features)


def build_counsellor_task(features: dict, assessment: dict) -> str:
    return (
        f"Counsellor review for {features['student_name']} ({features['student_code']}): "
        f"risk={assessment['risk_level']} (score {assessment['score']}). "
        f"Action: {assessment['recommended_action']}"
    )
