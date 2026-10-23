import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["EXTERNAL_GEO_ENABLED"] = "false"  # tests must not hit Nominatim/OSRM
import tempfile  # noqa: E402

os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="tirth-uploads-")  # photos uploaded by tests go to a temp dir
os.environ["CURATOR_IDENTIFIERS"] = ""
os.environ["ADMIN_IDENTIFIERS"] = ""
os.environ["TILE_CACHE_DIR"] = tempfile.mkdtemp(prefix="tirth-tiles-")

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


def login(client, identifier: str) -> dict:
    """Log in with the fixed test OTP and return auth headers."""
    from app.config import get_settings

    s = get_settings()
    assert client.post("/auth/otp/request", json={"identifier": identifier}).status_code == 200
    r = client.post("/auth/otp/verify", json={"identifier": identifier, "otp": s.test_user_otp})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def curator_headers(client):
    from app.config import get_settings

    return login(client, get_settings().test_curator_email)


@pytest.fixture()
def admin_headers(client):
    from app.config import get_settings

    return login(client, get_settings().test_admin_email)
