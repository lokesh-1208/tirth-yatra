"""Unit tests for the admin role, account controls (lock, reset login, delete) and the activity log."""
import pytest

from app.config import get_settings
from conftest import login

S = get_settings()


def _otp(client, ident, otp):
    client.post("/auth/otp/request", json={"identifier": ident})
    return client.post("/auth/otp/verify", json={"identifier": ident, "otp": otp})


def _user_id(client, admin_headers, email):
    users = client.get("/admin/users", params={"q": email}, headers=admin_headers).json()
    assert len(users) == 1, users
    return users[0]["id"]


@pytest.fixture()
def yatri(client):
    """A pilgrim with a token, and their id."""
    headers = login(client, "yatri.users@qa.tirthyatra.app")
    me = client.get("/auth/me", headers=headers).json()
    return headers, me["id"]


# --- roles -------------------------------------------------------------------------------------


def test_admin_has_all_curator_powers_and_user_management(client, admin_headers, curator_headers):
    assert client.get("/auth/me", headers=admin_headers).json()["role"] == "admin"
    assert client.get("/admin/summary", headers=admin_headers).status_code == 200
    assert client.get("/admin/places", headers=admin_headers).status_code == 200
    assert client.get("/admin/users", headers=admin_headers).status_code == 200
    assert client.get("/admin/audit", headers=admin_headers).status_code == 200
    # curators manage places but not users or the log
    assert client.get("/admin/users", headers=curator_headers).status_code == 403
    assert client.get("/admin/audit", headers=curator_headers).status_code == 403


def test_admin_identifiers_and_qa_admin_emails(client, monkeypatch):
    monkeypatch.setattr(S, "admin_identifiers", "boss@qa.tirthyatra.app")
    h = login(client, "boss@qa.tirthyatra.app")
    assert client.get("/auth/me", headers=h).json()["role"] == "admin"
    h2 = login(client, "admin.two@qa.tirthyatra.app")
    assert client.get("/auth/me", headers=h2).json()["role"] == "admin"


def test_login_is_tracked(client, admin_headers, yatri):
    _, uid = yatri
    login(client, "yatri.users@qa.tirthyatra.app")
    u = client.get(f"/admin/users/{uid}", headers=admin_headers).json()
    assert u["login_count"] == 2 and u["last_login_at"] is not None


# --- list and profile --------------------------------------------------------------------------


def test_list_filters(client, admin_headers, curator_headers, yatri):
    roles = lambda **p: {u["role"] for u in client.get("/admin/users", params=p, headers=admin_headers).json()}  # noqa: E731
    assert roles(role="admin") == {"admin"}
    assert roles(role="curator") == {"curator"}
    assert roles(role="pilgrim") == {"pilgrim"}
    found = client.get("/admin/users", params={"q": "yatri.users"}, headers=admin_headers).json()
    assert [u["email"] for u in found] == ["yatri.users@qa.tirthyatra.app"]


def test_create_team_member_before_first_login(client, admin_headers):
    r = client.post("/admin/users", json={"identifier": "New.Curator@QA.tirthyatra.app", "name": "Seema", "role": "curator"}, headers=admin_headers)
    assert r.status_code == 201
    assert r.json()["email"] == "new.curator@qa.tirthyatra.app" and r.json()["role"] == "curator"
    assert client.post("/admin/users", json={"identifier": "new.curator@qa.tirthyatra.app"}, headers=admin_headers).status_code == 409
    assert client.post("/admin/users", json={"identifier": "not valid"}, headers=admin_headers).status_code == 422
    # their first OTP login finds the account (not a new user)
    first = _otp(client, "new.curator@qa.tirthyatra.app", S.test_user_otp).json()
    assert first["is_new_user"] is False and first["user"]["role"] == "curator"


def test_update_profile_and_role(client, admin_headers, yatri):
    _, uid = yatri
    r = client.patch(f"/admin/users/{uid}", json={"name": "Asha Jain", "sect": "shvetambar", "role": "curator"}, headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Asha Jain" and body["role"] == "curator"
    actions = [a["action"] for a in body["activity_on"]]
    assert "user.role" in actions and "user.update" in actions
    assert client.patch(f"/admin/users/{uid}", json={"role": "boss"}, headers=admin_headers).status_code == 422
    assert client.patch(f"/admin/users/{uid}", json={"language": "Hindi"}, headers=admin_headers).status_code == 422


def test_cannot_change_own_role_or_remove_the_last_admin(client, admin_headers):
    me = client.get("/auth/me", headers=admin_headers).json()
    assert client.patch(f"/admin/users/{me['id']}", json={"role": "pilgrim"}, headers=admin_headers).status_code == 409
    assert client.post(f"/admin/users/{me['id']}/lock", json={"reason": "test"}, headers=admin_headers).status_code == 409
    r = client.request("DELETE", f"/admin/users/{me['id']}", json={"confirm": "DELETE"}, headers=admin_headers)
    assert r.status_code == 409

    # a second admin cannot demote the only other admin either while it is the last one standing
    other = login(client, "admin.second@qa.tirthyatra.app")
    second_id = client.get("/auth/me", headers=other).json()["id"]
    assert client.patch(f"/admin/users/{second_id}", json={"role": "curator"}, headers=admin_headers).status_code == 200
    assert client.patch(f"/admin/users/{me['id']}", json={"role": "curator"}, headers=other).status_code == 403  # no longer admin


# --- lock, reset login, wrong-code blocks ------------------------------------------------------


def test_lock_signs_out_and_stops_login_then_unlock(client, admin_headers, yatri):
    headers, uid = yatri
    assert client.get("/auth/me", headers=headers).status_code == 200
    r = client.post(f"/admin/users/{uid}/lock", json={"reason": "Spam reports"}, headers=admin_headers)
    assert r.status_code == 200 and r.json()["is_locked"] is True and r.json()["locked_reason"] == "Spam reports"

    assert client.get("/auth/me", headers=headers).status_code == 401  # old token no longer works
    again = _otp(client, "yatri.users@qa.tirthyatra.app", S.test_user_otp)
    assert again.status_code == 403 and "locked" in again.json()["detail"]
    assert [u["id"] for u in client.get("/admin/users", params={"state": "locked"}, headers=admin_headers).json()] == [uid]

    client.post(f"/admin/users/{uid}/unlock", headers=admin_headers)
    assert _otp(client, "yatri.users@qa.tirthyatra.app", S.test_user_otp).status_code == 200
    assert client.post(f"/admin/users/{uid}/lock", json={"reason": "x"}, headers=admin_headers).status_code == 422  # reason too short


def test_wrong_codes_block_login_and_reset_clears_it(client, admin_headers, yatri, monkeypatch):
    _, uid = yatri
    monkeypatch.setattr(S, "otp_max_failures", 3)
    ident = "yatri.users@qa.tirthyatra.app"
    assert _otp(client, ident, "000000").status_code == 401
    assert _otp(client, ident, "000000").status_code == 401
    third = _otp(client, ident, "000000")
    assert third.status_code == 429 and "Too many wrong codes" in third.json()["detail"]
    assert _otp(client, ident, S.test_user_otp).status_code == 429  # even the right code waits
    assert client.post("/auth/otp/request", json={"identifier": ident}).status_code == 429

    listed = client.get("/admin/users", params={"state": "blocked"}, headers=admin_headers).json()
    assert [u["id"] for u in listed] == [uid] and listed[0]["login_blocked_until"]

    client.post(f"/admin/users/{uid}/reset-login", headers=admin_headers)
    assert _otp(client, ident, S.test_user_otp).status_code == 200


def test_reset_login_signs_out_everywhere(client, admin_headers, yatri):
    headers, uid = yatri
    client.post(f"/admin/users/{uid}/reset-login", headers=admin_headers)
    assert client.get("/auth/me", headers=headers).status_code == 401
    fresh = login(client, "yatri.users@qa.tirthyatra.app")
    assert client.get("/auth/me", headers=fresh).status_code == 200


def test_successful_login_clears_the_wrong_code_count(client, monkeypatch):
    monkeypatch.setattr(S, "otp_max_failures", 2)
    ident = "counting@qa.tirthyatra.app"
    assert _otp(client, ident, "000000").status_code == 401
    assert _otp(client, ident, S.test_user_otp).status_code == 200
    assert _otp(client, ident, "000000").status_code == 401  # count started again, not blocked yet


# --- delete ------------------------------------------------------------------------------------


def test_delete_removes_personal_data_and_keeps_reports_anonymous(client, admin_headers, yatri):
    headers, uid = yatri
    pid = client.get("/places").json()[0]["id"]
    client.post(f"/places/{pid}/save", headers=headers)
    report = client.post(
        "/reports", json={"kind": "correction", "place_id": pid, "topic": "timings", "message": "Timings are wrong"}, headers=headers
    ).json()
    client.patch(f"/admin/users/{uid}", json={"name": "To Be Deleted"}, headers=admin_headers)

    r = client.request("DELETE", f"/admin/users/{uid}", json={"confirm": "yes"}, headers=admin_headers)
    assert r.status_code == 422  # must type DELETE
    r = client.request("DELETE", f"/admin/users/{uid}", json={"confirm": "DELETE"}, headers=admin_headers)
    assert r.status_code == 204

    assert client.get(f"/admin/users/{uid}", headers=admin_headers).status_code == 404
    queue = client.get("/admin/reports", headers=admin_headers).json()
    kept = next(q for q in queue if q["id"] == report["id"])
    assert kept["reporter_name"] is None and kept["reporter_contact"] is None

    log = client.get("/admin/audit", params={"target_type": "user", "target_id": uid}, headers=admin_headers).json()["entries"]
    assert log and all(e["target_label"] == f"User #{uid} (deleted)" for e in log)
    assert all("To Be Deleted" not in str(e) for e in log)
    # logging in again with the same email makes a brand-new account
    again = _otp(client, "yatri.users@qa.tirthyatra.app", S.test_user_otp).json()
    assert again["is_new_user"] is True


# --- activity log ------------------------------------------------------------------------------


def test_place_actions_are_logged_with_who_and_what(client, admin_headers, curator_headers):
    place = client.post("/admin/places", json={"name": "Logged Mandir", "latitude": 22.5, "longitude": 77.1}, headers=curator_headers).json()
    client.patch(f"/admin/places/{place['id']}", json={"landmarks": "Near the tank", "city": "Harda"}, headers=curator_headers)
    client.post(f"/admin/places/{place['id']}/checks", json={"method": "visit"}, headers=curator_headers)
    client.post(f"/admin/places/{place['id']}/status", json={"status": "live"}, headers=curator_headers)

    page = client.get("/admin/audit", params={"target_type": "place", "target_id": place["id"]}, headers=admin_headers).json()
    actions = [e["action"] for e in page["entries"]]
    assert actions == ["place.status", "place.check", "place.update", "place.create"]  # newest first
    status_entry = page["entries"][0]
    assert status_entry["actor_name"] == "Test Curator"
    assert status_entry["details"] == {"old": "draft", "new": "live"}
    assert page["entries"][2]["details"]["fields"] == ["city", "landmarks"]


def test_audit_paging_and_action_prefix(client, admin_headers, curator_headers):
    for i in range(5):
        client.post("/admin/leads", json={"name": f"Lead number {i}"}, headers=curator_headers)
    first = client.get("/admin/audit", params={"limit": 3, "action": "lead."}, headers=admin_headers).json()
    assert len(first["entries"]) == 3 and first["next_before_id"]
    rest = client.get("/admin/audit", params={"limit": 3, "action": "lead.", "before_id": first["next_before_id"]}, headers=admin_headers).json()
    assert len(rest["entries"]) == 2 and rest["next_before_id"] is None
    labels = [e["target_label"] for e in first["entries"] + rest["entries"]]
    assert labels == [f"Lead number {i}" for i in range(4, -1, -1)]


def test_user_detail_shows_what_a_curator_did(client, admin_headers, curator_headers):
    client.post("/admin/leads", json={"name": "Lead by curator"}, headers=curator_headers)
    cid = _user_id(client, admin_headers, S.test_curator_email)
    detail = client.get(f"/admin/users/{cid}", headers=admin_headers).json()
    assert detail["activity_by"][0]["action"] == "lead.create"


def test_user_list_paging_and_hiding_test_accounts(client, admin_headers):
    for i in range(3):
        login(client, f"paging.{i}@qa.tirthyatra.app")
    page1 = client.get("/admin/users", params={"limit": 2}, headers=admin_headers).json()
    page2 = client.get("/admin/users", params={"limit": 2, "offset": 2}, headers=admin_headers).json()
    assert len(page1) == 2 and len(page2) == 2
    assert not {u["id"] for u in page1} & {u["id"] for u in page2}
    real = client.get("/admin/users", params={"hide_test": True}, headers=admin_headers).json()
    assert real and all(not (u["email"] or "").endswith("@qa.tirthyatra.app") for u in real)
