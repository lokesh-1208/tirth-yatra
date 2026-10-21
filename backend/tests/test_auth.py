from app.config import get_settings

S = get_settings()


def _otp_login(client, identifier, otp=None):
    assert client.post("/auth/otp/request", json={"identifier": identifier}).status_code == 200
    return client.post("/auth/otp/verify", json={"identifier": identifier, "otp": otp or S.test_user_otp})


def test_test_user_logs_in_with_fixed_otp_by_email_and_phone(client):
    for ident in (S.test_user_email, "9999999999", S.test_user_phone):
        r = _otp_login(client, ident)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["email"] == S.test_user_email
        assert body["is_new_user"] is False
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
        assert me.json()["name"] == "Test Yatri"


def test_qa_domain_emails_use_fixed_otp_and_are_created(client):
    r = _otp_login(client, "Fresh+1@qa.tirthyatra.app")
    assert r.status_code == 200
    assert r.json()["is_new_user"] is True
    assert r.json()["user"]["name"] is None


def test_wrong_otp_rejected(client):
    r = _otp_login(client, S.test_user_email, otp="123456")
    assert r.status_code == 401


def test_verify_without_request_rejected(client):
    r = client.post("/auth/otp/verify", json={"identifier": "nobody@example.com", "otp": "999999"})
    assert r.status_code == 401


def test_new_user_created_on_first_otp(client, monkeypatch):
    sent = {}
    monkeypatch.setattr("app.otp.send_otp", lambda ident, code: sent.update(code=code))
    r = _otp_login(client, "New@Example.com", otp="000000")  # wrong on purpose
    assert r.status_code == 401
    # request again is throttled, so re-issue after clearing throttle
    from app.database import SessionLocal
    from app.models import OtpCode

    with SessionLocal() as db:
        db.query(OtpCode).delete()
        db.commit()
    assert client.post("/auth/otp/request", json={"identifier": "New@Example.com"}).status_code == 200
    r = client.post("/auth/otp/verify", json={"identifier": "new@example.com", "otp": sent["code"]})
    assert r.status_code == 200
    assert r.json()["is_new_user"] is True
    assert r.json()["user"]["email"] == "new@example.com"
    # profile onboarding
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = client.patch("/auth/me", json={"name": "Asha", "faith": "jain", "sect": "shvetambar"}, headers=h)
    assert r.json()["name"] == "Asha"


def test_otp_is_single_use(client, monkeypatch):
    sent = {}
    monkeypatch.setattr("app.otp.send_otp", lambda ident, code: sent.update(code=code))
    client.post("/auth/otp/request", json={"identifier": "once@example.com"})
    body = {"identifier": "once@example.com", "otp": sent["code"]}
    assert client.post("/auth/otp/verify", json=body).status_code == 200
    assert client.post("/auth/otp/verify", json=body).status_code == 401


def test_resend_throttled_for_real_users(client):
    assert client.post("/auth/otp/request", json={"identifier": "a@example.com"}).status_code == 200
    assert client.post("/auth/otp/request", json={"identifier": "a@example.com"}).status_code == 429


def test_attempt_limit(client, monkeypatch):
    monkeypatch.setattr("app.otp.send_otp", lambda *a: None)
    client.post("/auth/otp/request", json={"identifier": "b@example.com"})
    for _ in range(S.otp_max_attempts):
        client.post("/auth/otp/verify", json={"identifier": "b@example.com", "otp": "000000"})
    assert client.post("/auth/otp/verify", json={"identifier": "b@example.com", "otp": "000000"}).status_code == 401


def test_invalid_identifier(client):
    assert client.post("/auth/otp/request", json={"identifier": "not-an-id"}).status_code == 422
    assert client.post("/auth/otp/request", json={"identifier": "a@b"}).status_code == 422


def test_me_requires_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_update_profile(client, auth_headers):
    r = client.patch("/auth/me", json={"faith": "jain", "sect": "digambar"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["sect"] == "digambar"


def test_test_user_otp_is_stateless_and_reusable(client):
    for _ in range(3):  # no request needed, never consumed
        r = client.post("/auth/otp/verify", json={"identifier": S.test_user_email, "otp": S.test_user_otp})
        assert r.status_code == 200
