def test_register_login_me(client):
    r = client.post("/auth/register", json={"name": "Lokesh", "email": "L@Example.com", "password": "secret123"})
    assert r.status_code == 201
    assert r.json()["user"]["email"] == "l@example.com"

    r = client.post("/auth/login", json={"email": "l@example.com", "password": "secret123"})
    assert r.status_code == 200
    token = r.json()["access_token"]

    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["name"] == "Lokesh"


def test_duplicate_email_rejected(client):
    body = {"name": "A", "email": "a@example.com", "password": "secret123"}
    assert client.post("/auth/register", json=body).status_code == 201
    assert client.post("/auth/register", json=body).status_code == 409


def test_wrong_password(client):
    client.post("/auth/register", json={"name": "A", "email": "a@example.com", "password": "secret123"})
    r = client.post("/auth/login", json={"email": "a@example.com", "password": "wrong-pass"})
    assert r.status_code == 401


def test_short_password_rejected(client):
    r = client.post("/auth/register", json={"name": "A", "email": "a@example.com", "password": "123"})
    assert r.status_code == 422


def test_me_requires_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_update_profile(client, auth_headers):
    r = client.patch("/auth/me", json={"faith": "jain", "sect": "digambar"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["sect"] == "digambar"
