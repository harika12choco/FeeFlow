"""Deterministic refund calculator tests."""
from __future__ import annotations

from datetime import date

from app.services.refunds import calculate_refund, list_policies


def test_linear_prorata_halfway():
    # 200-day course, exactly halfway, paid 20000, flat admin fee 2500.
    start = date(2026, 1, 1)
    end = date(2026, 7, 20)  # 200 days
    as_of = date(2026, 4, 11)  # 100 days elapsed
    r = calculate_refund("pro_rata_linear", 20000, start, end, as_of)
    assert r["inputs"]["total_days"] == 200
    assert r["inputs"]["elapsed_days"] == 100
    # unused half of 20000 = 10000, minus 2500 admin = 7500
    assert r["net_refund"] == 7500


def test_linear_is_deterministic():
    start, end, as_of = date(2026, 1, 1), date(2026, 7, 20), date(2026, 4, 11)
    a = calculate_refund("pro_rata_linear", 20000, start, end, as_of)
    b = calculate_refund("pro_rata_linear", 20000, start, end, as_of)
    assert a["net_refund"] == b["net_refund"]


def test_registration_policy_nonrefundable():
    start = date(2026, 1, 1)
    end = date(2026, 1, 11)  # 10 days
    as_of = date(2026, 1, 1)  # 0 elapsed -> fully unused
    r = calculate_refund("pro_rata_with_registration", 10000, start, end, as_of)
    # 10% non-refundable = 1000; refundable base 9000; unused 100% = 9000; admin 1000 => 8000
    assert r["net_refund"] == 8000


def test_slab_based_boundaries():
    start = date(2026, 1, 1)
    end = date(2026, 4, 11)  # ~100 day course
    # ~5% elapsed -> 90% refund slab
    r = calculate_refund("slab_based", 10000, start, end, date(2026, 1, 6))
    assert r["inputs"]["elapsed_percent"] <= 10
    assert r["net_refund"] == 9000


def test_refund_floored_at_zero():
    start = date(2026, 1, 1)
    end = date(2026, 1, 11)
    as_of = date(2026, 1, 11)  # fully elapsed -> 0 refundable, admin fee applies
    r = calculate_refund("pro_rata_linear", 5000, start, end, as_of)
    assert r["net_refund"] == 0


def test_policies_expose_assumptions():
    for policy in list_policies():
        assert policy["assumptions"], "every policy must label its assumptions"
