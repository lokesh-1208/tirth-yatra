"""Unit tests for the admin section (Phase 1): roles, places, checks, publishing, languages,
contacts, photos and leads."""
from datetime import date, timedelta

import pytest

from app.config import get_settings
from app.routers.admin import add_months
from conftest import login

S = get_settings()
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64  # enough of a PNG header for the type check

NEW_PLACE = {
    "name": "Test Kshetra",
    "sect": "digambar",
    "kind": "atishay_kshetra",
    "city": "Nemawar",
    "district": "Dewas",
    "state": "Madhya Pradesh",
    "latitude": 22.44,
    "longitude": 76.87,
    "landmarks": "Gate faces the ghat",
}


@pytest.fixture()
def pilgrim_headers(client):
    return login(client, S.test_user_email)


def _create(client, headers, **overrides):
    r = client.post("/admin/places", json={**NEW_PLACE, **overrides}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _check(client, headers, pid, **body):
    r = client.post(f"/admin/places/{pid}/checks", json={"method": "call", **body}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


# --- roles -------------------------------------------------------------------------------------


def test_admin_needs_login_and_curator_role(client, pilgrim_headers, curator_headers):
    assert client.get("/admin/summary").status_code == 401
    r = client.get("/admin/summary", headers=pilgrim_headers)
    assert r.status_code == 403
    assert client.get("/admin/summary", headers=curator_headers).status_code == 200


def test_roles_shown_on_me(client, pilgrim_headers, curator_headers):
    assert client.get("/auth/me", headers=pilgrim_headers).json()["role"] == "pilgrim"
    assert client.get("/auth/me", headers=curator_headers).json()["role"] == "curator"


def test_qa_curator_emails_become_curators(client):
    h = login(client, "curator.one@qa.tirthyatra.app")
    assert client.get("/auth/me", headers=h).json()["role"] == "curator"
    h2 = login(client, "yatri.one@qa.tirthyatra.app")
    assert client.get("/auth/me", headers=h2).json()["role"] == "pilgrim"


def test_curator_identifiers_setting_upgrades_on_login(client, monkeypatch):
    monkeypatch.setattr(S, "curator_identifiers", "someone@qa.tirthyatra.app, 98765 43210")
    h = login(client, "someone@qa.tirthyatra.app")
    assert client.get("/auth/me", headers=h).json()["role"] == "curator"


def test_role_cannot_be_changed_through_profile_update(client, pilgrim_headers):
    client.patch("/auth/me", json={"role": "curator", "name": "Yatri"}, headers=pilgrim_headers)
    assert client.get("/auth/me", headers=pilgrim_headers).json()["role"] == "pilgrim"


# --- places, drafts and publishing -------------------------------------------------------------


def test_new_place_is_a_draft_hidden_from_pilgrims(client, curator_headers):
    place = _create(client, curator_headers)
    assert place["status"] == "draft" and place["verified"] is False
    assert place["landmarks"] == "Gate faces the ghat"
    assert all(p["id"] != place["id"] for p in client.get("/places").json())
    assert client.get(f"/places/{place['id']}").status_code == 404
    route = client.get("/route", params={"start": "Jabalpur", "end": "Nemawar", "max_detour_km": 50}).json()
    assert all(p["id"] != place["id"] for p in route["places"])


def test_create_validates_fields(client, curator_headers):
    bad = [
        {"name": "X"},
        {"latitude": 95},
        {"sect": "other"},
        {"kind": "museum"},
        {"pincode": "45"},
    ]
    for override in bad:
        r = client.post("/admin/places", json={**NEW_PLACE, **override}, headers=curator_headers)
        assert r.status_code == 422, override


def test_update_changes_only_sent_fields(client, curator_headers):
    pid = _create(client, curator_headers)["id"]
    r = client.patch(f"/admin/places/{pid}", json={"darshan_timings": "6 am to 8 pm", "pincode": "455339"}, headers=curator_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["darshan_timings"] == "6 am to 8 pm" and body["pincode"] == "455339"
    assert body["name"] == NEW_PLACE["name"]
    assert client.patch(f"/admin/places/{pid}", json={"name": None}, headers=curator_headers).status_code == 422
    assert client.patch("/admin/places/99999", json={"city": "X"}, headers=curator_headers).status_code == 404


def test_cannot_go_live_without_a_check(client, curator_headers):
    pid = _create(client, curator_headers)["id"]
    r = client.post(f"/admin/places/{pid}/status", json={"status": "live"}, headers=curator_headers)
    assert r.status_code == 409
    assert client.post(f"/admin/places/{pid}/status", json={"status": "in_review"}, headers=curator_headers).status_code == 200


def test_check_then_publish_then_hide(client, curator_headers):
    pid = _create(client, curator_headers)["id"]
    checked = _check(client, curator_headers, pid, checked_with="Office, trust", confirmed="timings", checked_on="2026-01-31", recheck_after_months=1)
    assert checked["verified"] is True
    assert checked["verified_on"] == "2026-01-31"
    assert checked["recheck_due"] == "2026-02-28"  # month-end clamp
    assert checked["verified_by"] == "Test Curator"
    assert checked["checks"][0]["method"] == "call"

    live = client.post(f"/admin/places/{pid}/status", json={"status": "live"}, headers=curator_headers).json()
    assert live["status"] == "live"
    pilgrim_view = client.get(f"/places/{pid}").json()
    assert pilgrim_view["verified"] is True and pilgrim_view["verified_method"] == "call"

    client.post(f"/admin/places/{pid}/status", json={"status": "hidden"}, headers=curator_headers)
    assert client.get(f"/places/{pid}").status_code == 404


def test_older_check_does_not_replace_the_newer_badge(client, curator_headers):
    pid = _create(client, curator_headers)["id"]
    _check(client, curator_headers, pid, method="visit", checked_on="2026-05-01")
    body = _check(client, curator_headers, pid, method="call", checked_on="2026-03-01")
    assert body["verified_on"] == "2026-05-01" and body["verified_method"] == "visit"
    assert len(body["checks"]) == 2


def test_check_cannot_be_in_the_future(client, curator_headers):
    pid = _create(client, curator_headers)["id"]
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    r = client.post(f"/admin/places/{pid}/checks", json={"method": "call", "checked_on": tomorrow}, headers=curator_headers)
    assert r.status_code == 422
    r = client.post(f"/admin/places/{pid}/checks", json={"method": "email"}, headers=curator_headers)
    assert r.status_code == 422


@pytest.mark.parametrize(
    "start, months, expected",
    [
        (date(2026, 1, 31), 1, date(2026, 2, 28)),
        (date(2028, 1, 31), 1, date(2028, 2, 29)),
        (date(2026, 10, 23), 6, date(2027, 4, 23)),
        (date(2026, 12, 15), 12, date(2027, 12, 15)),
    ],
)
def test_add_months(start, months, expected):
    assert add_months(start, months) == expected


# --- summary and lists -------------------------------------------------------------------------


def test_summary_counts_and_recheck_list(client, curator_headers):
    pid = _create(client, curator_headers)["id"]
    _check(client, curator_headers, pid)  # re-check due in the future
    client.post(f"/admin/places/{pid}/status", json={"status": "live"}, headers=curator_headers)
    client.post("/admin/leads", json={"name": "Lead A"}, headers=curator_headers)

    s = client.get("/admin/summary", headers=curator_headers).json()
    assert s["counts"]["live"] == 7  # 6 samples + the new one
    assert s["recheck_due"] == 6  # samples were never checked; the new one is not due yet
    assert all(p["id"] != pid for p in s["due_places"])
    assert s["open_leads"] == 1
    assert s["recent_checks"][0]["place_id"] == pid


def test_places_list_filters(client, curator_headers):
    pid = _create(client, curator_headers, name="Filter Me Mandir", city="Sagar")["id"]
    ids = lambda **params: [p["id"] for p in client.get("/admin/places", params=params, headers=curator_headers).json()]  # noqa: E731
    assert pid in ids(status="draft")
    assert pid not in ids(status="live")
    assert ids(q="sagar") == [pid]
    assert pid not in ids(recheck_due=True)  # drafts are not on the re-check list


# --- languages ---------------------------------------------------------------------------------


def _live_place(client, headers, **overrides):
    pid = _create(client, headers, **overrides)["id"]
    _check(client, headers, pid)
    client.post(f"/admin/places/{pid}/status", json={"status": "live"}, headers=headers)
    return pid


def test_translation_with_fallback(client, curator_headers, pilgrim_headers):
    pid = _live_place(client, curator_headers, description="English text")
    r = client.put(f"/admin/places/{pid}/translations/hi", json={"name": "परीक्षा क्षेत्र", "landmarks": "घाट के सामने"}, headers=curator_headers)
    assert r.status_code == 200
    assert r.json()["translations"][0]["language"] == "hi"

    hi = client.get(f"/places/{pid}", params={"lang": "hi"}).json()
    assert hi["name"] == "परीक्षा क्षेत्र" and hi["landmarks"] == "घाट के सामने"
    assert hi["description"] == "English text"  # not translated yet: falls back
    assert hi["language"] == "hi"

    mr = client.get(f"/places/{pid}", params={"lang": "mr"}).json()
    assert mr["name"] == NEW_PLACE["name"] and mr["language"] == "en"

    # No lang parameter: the logged-in user's language is used.
    client.patch("/auth/me", json={"language": "hi"}, headers=pilgrim_headers)
    assert client.get(f"/places/{pid}", headers=pilgrim_headers).json()["name"] == "परीक्षा क्षेत्र"


def test_translation_rules(client, curator_headers):
    pid = _create(client, curator_headers)["id"]
    assert client.put(f"/admin/places/{pid}/translations/en", json={"name": "x"}, headers=curator_headers).status_code == 422
    assert client.put(f"/admin/places/{pid}/translations/HINDI", json={"name": "x"}, headers=curator_headers).status_code == 422
    client.put(f"/admin/places/{pid}/translations/gu", json={"name": "ગુ"}, headers=curator_headers)
    r = client.delete(f"/admin/places/{pid}/translations/gu", headers=curator_headers)
    assert r.status_code == 200 and r.json()["translations"] == []
    assert client.delete(f"/admin/places/{pid}/translations/gu", headers=curator_headers).status_code == 404


# --- contacts ----------------------------------------------------------------------------------


def test_contacts_need_consent_to_be_public(client, curator_headers):
    pid = _live_place(client, curator_headers)
    base = f"/admin/places/{pid}/contacts"
    r = client.post(base, json={"name": "Manager Ji", "phone": "98765 43210", "show_publicly": True}, headers=curator_headers)
    assert r.status_code == 422

    private = client.post(base, json={"name": "Pujari Ji", "role": "pujari", "phone": "9876500000"}, headers=curator_headers).json()
    public = client.post(
        base,
        json={"name": "Manager Ji", "phone": "98765 43210", "consent_on": "2026-10-01", "show_publicly": True},
        headers=curator_headers,
    ).json()
    assert public["phone"] == "+919876543210"  # normalized

    seen = client.get(f"/places/{pid}").json()
    assert [c["name"] for c in seen["contacts"]] == ["Manager Ji"]
    assert seen["contact_phone"] == "+919876543210"

    r = client.patch(f"{base}/{private['id']}", json={"show_publicly": True}, headers=curator_headers)
    assert r.status_code == 422  # still no consent recorded

    assert client.delete(f"{base}/{public['id']}", headers=curator_headers).status_code == 204
    assert client.get(f"/places/{pid}").json()["contacts"] == []


def test_contact_phone_must_be_a_phone(client, curator_headers):
    pid = _create(client, curator_headers)["id"]
    r = client.post(f"/admin/places/{pid}/contacts", json={"name": "Someone", "phone": "not-a-phone"}, headers=curator_headers)
    assert r.status_code == 422


# --- photos ------------------------------------------------------------------------------------


def _upload(client, headers, pid, content=PNG, mime="image/png", **form):
    data = {"no_deity_confirmed": "true", **form}
    return client.post(f"/admin/places/{pid}/photos", files={"file": ("x.png", content, mime)}, data=data, headers=headers)


def test_photo_upload_rules(client, curator_headers, monkeypatch):
    pid = _create(client, curator_headers)["id"]
    r = client.post(f"/admin/places/{pid}/photos", files={"file": ("x.png", PNG, "image/png")}, headers=curator_headers)
    assert r.status_code == 422  # deity confirmation missing
    assert _upload(client, curator_headers, pid, mime="application/pdf").status_code == 415
    assert _upload(client, curator_headers, pid, content=b"not really a png").status_code == 415
    monkeypatch.setattr(S, "max_upload_mb", 0.00001)
    assert _upload(client, curator_headers, pid).status_code == 413


def test_first_photo_becomes_cover_and_is_served(client, curator_headers):
    pid = _live_place(client, curator_headers)
    first = _upload(client, curator_headers, pid, photographer="Lokesh", permission_note="Taken by us").json()
    assert first["is_cover"] is True and first["url"].startswith("/uploads/place-")
    assert client.get(first["url"]).content == PNG
    assert client.get(f"/places/{pid}").json()["photo_url"] == first["url"]

    second = _upload(client, curator_headers, pid, make_cover="true").json()
    full = client.get(f"/admin/places/{pid}", headers=curator_headers).json()
    assert [p["is_cover"] for p in full["photos"]] == [False, True]
    assert full["cover_url"] == second["url"]

    assert client.delete(f"/admin/places/{pid}/photos/{second['id']}", headers=curator_headers).status_code == 204
    assert client.get(f"/places/{pid}").json()["photo_url"] is None  # no cover: app shows the auto cover
    assert client.get(second["url"]).status_code == 404  # file removed


def test_unset_cover(client, curator_headers):
    pid = _create(client, curator_headers)["id"]
    photo = _upload(client, curator_headers, pid).json()
    r = client.patch(f"/admin/places/{pid}/photos/{photo['id']}", json={"is_cover": False, "caption": "Gate"}, headers=curator_headers)
    assert r.json()["is_cover"] is False and r.json()["caption"] == "Gate"
    assert client.get(f"/admin/places/{pid}", headers=curator_headers).json()["cover_url"] is None


# --- leads -------------------------------------------------------------------------------------


def test_lead_flow_to_draft(client, curator_headers):
    lead = client.post("/admin/leads", json={"name": "Village Mandir", "area": "Harda", "source": "Instagram follower"}, headers=curator_headers).json()
    assert lead["status"] == "to_call"

    r = client.patch(f"/admin/leads/{lead['id']}", json={"status": "drafted"}, headers=curator_headers)
    assert r.status_code == 409  # no draft place yet
    client.patch(f"/admin/leads/{lead['id']}", json={"status": "called", "notes": "Trustee confirmed"}, headers=curator_headers)

    place = _create(client, curator_headers, name="Village Mandir", lead_id=lead["id"])
    leads = client.get("/admin/leads", headers=curator_headers).json()
    assert leads[0]["status"] == "drafted" and leads[0]["place_id"] == place["id"]
    assert client.post("/admin/places", json={**NEW_PLACE, "lead_id": lead["id"]}, headers=curator_headers).status_code == 409
    assert client.post("/admin/places", json={**NEW_PLACE, "lead_id": 999}, headers=curator_headers).status_code == 404


def test_lead_list_filter_and_validation(client, curator_headers):
    client.post("/admin/leads", json={"name": "One"}, headers=curator_headers)
    two = client.post("/admin/leads", json={"name": "Two"}, headers=curator_headers).json()
    client.patch(f"/admin/leads/{two['id']}", json={"status": "rejected"}, headers=curator_headers)
    assert [l["name"] for l in client.get("/admin/leads", params={"status": "rejected"}, headers=curator_headers).json()] == ["Two"]
    assert client.post("/admin/leads", json={"name": "X"}, headers=curator_headers).status_code == 422
    assert client.patch("/admin/leads/999", json={"notes": "x"}, headers=curator_headers).status_code == 404
