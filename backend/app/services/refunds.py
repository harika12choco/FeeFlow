"""Deterministic, configurable pro-rata refund calculator.

The assessment brief does NOT define a refund policy, so the policy is made
explicit and configurable. Every policy lists its assumptions, which the UI
surfaces to the user. No AI is involved in any financial calculation.
"""
from __future__ import annotations

from datetime import date

from .ledger import money

# --- Configurable policies ----------------------------------------------------
# Two policy families are supported:
#   * "linear"  -> refund is proportional to the unused fraction of the course.
#   * "slab"    -> refund percentage is chosen from elapsed-time slabs.

POLICIES: dict[str, dict] = {
    "pro_rata_linear": {
        "key": "pro_rata_linear",
        "name": "Standard Pro-Rata (linear)",
        "type": "linear",
        "admin_fee_flat": 2500.0,
        "admin_fee_percent": 0.0,
        "non_refundable_percent": 0.0,
        "description": "Refund is proportional to the unused portion of the course "
                       "duration, minus a flat administrative fee.",
        "assumptions": [
            "ASSUMPTION: Course value is consumed evenly (linearly) across the enrolment period.",
            "ASSUMPTION: A flat administrative fee of ₹2,500 is retained from any refund.",
            "Only confirmed (received) payments are eligible for refund.",
            "Refunds are never negative; the floor is ₹0.",
        ],
    },
    "pro_rata_with_registration": {
        "key": "pro_rata_with_registration",
        "name": "Pro-Rata with Non-Refundable Registration",
        "type": "linear",
        "admin_fee_flat": 1000.0,
        "admin_fee_percent": 0.0,
        "non_refundable_percent": 10.0,
        "description": "10% of paid fees is a non-refundable registration charge; the "
                       "remainder is refunded pro-rata on unused duration, minus a flat fee.",
        "assumptions": [
            "ASSUMPTION: 10% of fees paid is a non-refundable registration/admission charge.",
            "ASSUMPTION: A flat administrative fee of ₹1,000 is retained.",
            "ASSUMPTION: Remaining fees accrue linearly across the enrolment period.",
            "Only confirmed payments are eligible for refund.",
        ],
    },
    "slab_based": {
        "key": "slab_based",
        "name": "Slab-Based (time elapsed)",
        "type": "slab",
        "admin_fee_flat": 0.0,
        "slabs": [
            {"max_elapsed_percent": 10, "refund_percent": 90},
            {"max_elapsed_percent": 25, "refund_percent": 75},
            {"max_elapsed_percent": 50, "refund_percent": 50},
            {"max_elapsed_percent": 75, "refund_percent": 25},
            {"max_elapsed_percent": 100, "refund_percent": 0},
        ],
        "description": "Refund percentage is selected from fixed slabs based on how much "
                       "of the course has elapsed.",
        "assumptions": [
            "ASSUMPTION: Refund slabs are 90/75/50/25/0 percent at 10/25/50/75/100 percent elapsed.",
            "ASSUMPTION: Elapsed time is measured against the enrolment period.",
            "Only confirmed payments are eligible for refund.",
        ],
    },
}


def list_policies() -> list[dict]:
    return list(POLICIES.values())


def get_policy(key: str) -> dict:
    if key not in POLICIES:
        raise KeyError(f"Unknown refund policy '{key}'")
    return POLICIES[key]


def _elapsed(course_start: date, course_end: date, as_of: date) -> tuple[int, int, int]:
    total_days = max((course_end - course_start).days, 1)
    elapsed_days = (as_of - course_start).days
    elapsed_days = max(0, min(elapsed_days, total_days))
    remaining_days = total_days - elapsed_days
    return total_days, elapsed_days, remaining_days


def calculate_refund(
    policy_key: str,
    paid_amount: float,
    course_start: date,
    course_end: date,
    as_of: date | None = None,
) -> dict:
    """Return a fully itemised refund breakdown for the given policy."""
    as_of = as_of or date.today()
    policy = get_policy(policy_key)
    paid_amount = money(paid_amount)

    total_days, elapsed_days, remaining_days = _elapsed(course_start, course_end, as_of)
    elapsed_percent = round(100.0 * elapsed_days / total_days, 2)
    remaining_percent = round(100.0 - elapsed_percent, 2)

    steps: list[dict] = []

    if policy["type"] == "linear":
        non_ref_pct = policy.get("non_refundable_percent", 0.0)
        non_refundable = money(paid_amount * non_ref_pct / 100.0)
        refundable_base = money(paid_amount - non_refundable)
        gross_refund = money(refundable_base * remaining_days / total_days)
        admin_fee = money(
            policy.get("admin_fee_flat", 0.0)
            + refundable_base * policy.get("admin_fee_percent", 0.0) / 100.0
        )
        net_refund = money(max(0.0, gross_refund - admin_fee))

        steps = [
            {"label": "Fees paid (confirmed)", "value": paid_amount},
            {"label": f"Non-refundable registration ({non_ref_pct}%)", "value": -non_refundable},
            {"label": "Refundable base", "value": refundable_base},
            {"label": f"Unused course ({remaining_days}/{total_days} days = {remaining_percent}%)",
             "value": gross_refund, "note": "refundable base × unused fraction"},
            {"label": "Administrative fee", "value": -admin_fee},
            {"label": "Net refund (floored at 0)", "value": net_refund, "total": True},
        ]
    else:  # slab
        refund_percent = 0
        for slab in policy["slabs"]:
            if elapsed_percent <= slab["max_elapsed_percent"]:
                refund_percent = slab["refund_percent"]
                break
        gross_refund = money(paid_amount * refund_percent / 100.0)
        admin_fee = money(policy.get("admin_fee_flat", 0.0))
        net_refund = money(max(0.0, gross_refund - admin_fee))
        steps = [
            {"label": "Fees paid (confirmed)", "value": paid_amount},
            {"label": f"Elapsed {elapsed_percent}% → refund slab {refund_percent}%",
             "value": gross_refund},
            {"label": "Administrative fee", "value": -admin_fee},
            {"label": "Net refund (floored at 0)", "value": net_refund, "total": True},
        ]

    return {
        "policy_key": policy["key"],
        "policy_name": policy["name"],
        "assumptions": policy["assumptions"],
        "inputs": {
            "paid_amount": paid_amount,
            "course_start": course_start.isoformat(),
            "course_end": course_end.isoformat(),
            "as_of": as_of.isoformat(),
            "total_days": total_days,
            "elapsed_days": elapsed_days,
            "remaining_days": remaining_days,
            "elapsed_percent": elapsed_percent,
            "remaining_percent": remaining_percent,
        },
        "steps": steps,
        "net_refund": net_refund,
    }
