"""Role-based access control and parent-restriction tests (via the API)."""
from __future__ import annotations

from tests.conftest import auth, login, make_student, make_user


def test_parent_sees_only_own_student(db, client):
    parent_a = make_user(db, "pa@test.com", "parent", "Parent A")
    parent_b = make_user(db, "pb@test.com", "parent", "Parent B")
    student_a = make_student(db, code="STU-A", parent=parent_a)
    student_b = make_student(db, code="STU-B", parent=parent_b)

    token = login(client, "pa@test.com")
    # Own student -> allowed
    ok = client.get(f"/students/{student_a.id}", headers=auth(token))
    assert ok.status_code == 200
    # Other parent's student -> forbidden
    forbidden = client.get(f"/students/{student_b.id}", headers=auth(token))
    assert forbidden.status_code == 403


def test_parent_cannot_list_all_students(db, client):
    parent = make_user(db, "p@test.com", "parent")
    make_student(db, code="STU-A", parent=parent)
    token = login(client, "p@test.com")
    resp = client.get("/students", headers=auth(token))
    assert resp.status_code == 403  # accounts-only endpoint


def test_parent_cannot_access_dashboard(db, client):
    parent = make_user(db, "p@test.com", "parent")
    make_student(db, code="STU-A", parent=parent)
    token = login(client, "p@test.com")
    resp = client.get("/dashboard/stats", headers=auth(token))
    assert resp.status_code == 403


def test_accounts_can_access_everything(db, client):
    accounts = make_user(db, "acc@test.com", "accounts", "Acct")
    parent = make_user(db, "p@test.com", "parent")
    student = make_student(db, code="STU-A", parent=parent)
    token = login(client, "acc@test.com")
    assert client.get("/students", headers=auth(token)).status_code == 200
    assert client.get(f"/students/{student.id}", headers=auth(token)).status_code == 200
    assert client.get("/dashboard/stats", headers=auth(token)).status_code == 200


def test_unauthenticated_rejected(db, client):
    make_student(db, code="STU-A")
    assert client.get("/students").status_code == 401
    assert client.get("/dashboard/stats").status_code == 401


def test_wrong_password_rejected(db, client):
    make_user(db, "acc@test.com", "accounts")
    resp = client.post("/auth/login", json={"email": "acc@test.com", "password": "wrong"})
    assert resp.status_code == 401


def test_parent_payment_restricted_to_own_student(db, client):
    parent_a = make_user(db, "pa@test.com", "parent")
    parent_b = make_user(db, "pb@test.com", "parent")
    make_student(db, code="STU-A", parent=parent_a)
    student_b = make_student(db, code="STU-B", parent=parent_b)
    inst_b = student_b.fee_plan.instalments[0]

    token = login(client, "pa@test.com")
    resp = client.post("/payments/initiate", headers=auth(token),
                       json={"instalment_id": inst_b.id, "amount": 1000})
    assert resp.status_code == 403
