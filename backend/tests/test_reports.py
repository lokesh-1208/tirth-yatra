"""Unit tests for pilgrim reports and the curators' review queue."""
import pytest

from app.config import get_settings
from conftest import login

S = get_settings()


@pytest.fixture()
def pilgrim(client):
    return login(client, "yatri.reports@qa.tirthyatra.app")


def _live_place_id(client):
    return client.get("/places").json()[0]["id"]


def _correction(client, headers, place_id, topic="timings", message="Aarti is at 7 pm, not 6 pm"):
    return client.post("/reports", json={"kind": "correction", "place_id": place_id, "topic": topic, "message": message}, headers=headers)


def _missing(client, headers, name="Village Jain Mandir", area="Harda"):
    return client.post(
        "/reports",
        json={"kind": "new_place", "place_name": name, "area": area, "message": "Old mandir 3 km off the highway"},
        headers=headers,
    )


# --- sending -----------------------------------------------------------------------------------


def test_reporting_needs_login(client):
    assert _correction(client, {}, _live_place_id(client)).status_code == 401


def test_correction_is_saved_and_listed_as_mine(client, pilgrim):
    pid = _live_place_id(client)
    r = _correction(client, pilgrim, pid)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "open" and body["kind"] == "correction" and body["topic"] == "timings"
    assert body["place_title"] == client.get(f"/places/{pid}").json()["name"]

    mine = client.get("/reports/mine", headers=pilgrim).json()
    assert [m["id"] for m in mine] == [body["id"]]
    other = login(client, "someone.else@qa.tirthyatra.app")
    assert client.get("/reports/mine", headers=other).json() == []


def test_missing_place_report(client, pilgrim):
    r = _missing(client, pilgrim)
    assert r.status_code == 201
    assert r.json()["place_title"] == "Village Jain Mandir" and r.json()["area"] == "Harda"


@pytest.mark.parametrize(
    "body",
    [
        {"kind": "correction", "topic": "timings", "message": "Wrong timings here"},  # no place
        {"kind": "new_place", "message": "There is a mandir here"},  # no name
        {"kind": "correction", "place_id": 1, "topic": "price", "message": "Wrong timings here"},  # unknown topic
        {"kind": "correction", "place_id": 1, "topic": "other", "message": "bad"},  # too short
        {"kind": "complaint", "message": "Something long enough"},
    ],
)
def test_report_validation(client, pilgrim, body):
    assert client.post("/reports", json=body, headers=pilgrim).status_code == 422


def test_cannot_report_a_place_pilgrims_cannot_see(client, pilgrim, curator_headers):
    draft = client.post(
        "/admin/places", json={"name": "Hidden Draft", "latitude": 22.5, "longitude": 77.0}, headers=curator_headers
    ).json()
    assert _correction(client, pilgrim, draft["id"]).status_code == 404
    assert _correction(client, pilgrim, 99999).status_code == 404


def test_same_open_report_twice_is_refused(client, pilgrim):
    pid = _live_place_id(client)
    assert _correction(client, pilgrim, pid).status_code == 201
    assert _correction(client, pilgrim, pid).status_code == 409
    assert _correction(client, pilgrim, pid, topic="contact", message="Phone number does not work").status_code == 201


def test_daily_limit(client, pilgrim, monkeypatch):
    monkeypatch.setattr(S, "max_reports_per_day", 2)
    assert _missing(client, pilgrim, name="A place").status_code == 201
    assert _missing(client, pilgrim, name="B place").status_code == 201
    r = _missing(client, pilgrim, name="C place")
    assert r.status_code == 429 and "2 reports a day" in r.json()["detail"]


# --- review queue ------------------------------------------------------------------------------


def test_review_queue_is_curator_only(client, pilgrim, curator_headers):
    assert client.get("/admin/reports", headers=pilgrim).status_code == 403
    assert client.get("/admin/reports", headers=curator_headers).status_code == 200


def test_queue_shows_open_reports_oldest_first_with_reporter(client, pilgrim, curator_headers):
    client.patch("/auth/me", json={"name": "Asha"}, headers=pilgrim)
    pid = _live_place_id(client)
    first = _correction(client, pilgrim, pid).json()
    second = _missing(client, pilgrim).json()

    queue = client.get("/admin/reports", headers=curator_headers).json()
    assert [q["id"] for q in queue] == [first["id"], second["id"]]
    assert queue[0]["reporter_name"] == "Asha"
    assert queue[0]["reporter_contact"] == "yatri.reports@qa.tirthyatra.app"
    assert queue[0]["place_status"] == "live"
    assert client.get("/admin/summary", headers=curator_headers).json()["open_reports"] == 2

    only_place = client.get("/admin/reports", params={"place_id": pid}, headers=curator_headers).json()
    assert [q["id"] for q in only_place] == [first["id"]]


def test_resolve_with_note_is_shown_to_the_pilgrim_and_can_be_reopened(client, pilgrim, curator_headers):
    report = _correction(client, pilgrim, _live_place_id(client)).json()
    r = client.patch(
        f"/admin/reports/{report['id']}",
        json={"status": "resolved", "curator_note": "Fixed, thank you!"},
        headers=curator_headers,
    )
    assert r.status_code == 200 and r.json()["resolved_at"] is not None

    mine = client.get("/reports/mine", headers=pilgrim).json()[0]
    assert mine["status"] == "resolved" and mine["curator_note"] == "Fixed, thank you!"
    assert client.get("/admin/reports", headers=curator_headers).json() == []  # no longer open
    assert len(client.get("/admin/reports", params={"status": "resolved"}, headers=curator_headers).json()) == 1
    assert len(client.get("/admin/reports", params={"status": "all"}, headers=curator_headers).json()) == 1

    reopened = client.patch(f"/admin/reports/{report['id']}", json={"status": "open"}, headers=curator_headers).json()
    assert reopened["status"] == "open" and reopened["resolved_at"] is None
    assert reopened["curator_note"] == "Fixed, thank you!"  # note kept unless replaced


def test_dismiss_and_bad_status(client, pilgrim, curator_headers):
    report = _missing(client, pilgrim).json()
    assert client.patch(f"/admin/reports/{report['id']}", json={"status": "dismissed"}, headers=curator_headers).json()["status"] == "dismissed"
    assert client.patch(f"/admin/reports/{report['id']}", json={"status": "done"}, headers=curator_headers).status_code == 422
    assert client.patch("/admin/reports/999", json={"status": "dismissed"}, headers=curator_headers).status_code == 404


def test_missing_place_becomes_a_lead(client, pilgrim, curator_headers):
    report = _missing(client, pilgrim).json()
    r = client.post(f"/admin/reports/{report['id']}/to-lead", headers=curator_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "resolved" and body["lead_id"]
    assert "verify" in body["curator_note"]

    lead = next(l for l in client.get("/admin/leads", headers=curator_headers).json() if l["id"] == body["lead_id"])
    assert lead["name"] == "Village Jain Mandir" and lead["area"] == "Harda"
    assert lead["source"] == f"Pilgrim report #{report['id']}"

    assert client.post(f"/admin/reports/{report['id']}/to-lead", headers=curator_headers).status_code == 409


def test_correction_cannot_become_a_lead(client, pilgrim, curator_headers):
    report = _correction(client, pilgrim, _live_place_id(client)).json()
    assert client.post(f"/admin/reports/{report['id']}/to-lead", headers=curator_headers).status_code == 409
