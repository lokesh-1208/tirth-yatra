import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.seed import seed_places


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_places(db)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth_headers(client):
    from app.config import get_settings

    s = get_settings()
    ident = s.test_user_email
    assert client.post("/auth/otp/request", json={"identifier": ident}).status_code == 200
    r = client.post("/auth/otp/verify", json={"identifier": ident, "otp": s.test_user_otp})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
