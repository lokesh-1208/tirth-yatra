"""Unit tests for the map tile proxy (no real network calls)."""
import os
import time

import pytest

from app.config import get_settings
from app.routers import tiles

S = get_settings()
PNG = b"\x89PNG\r\n\x1a\n" + b"tile"


class _Resp:
    def __init__(self, content=PNG, fail=False):
        self.content = content
        self._fail = fail

    def raise_for_status(self):
        if self._fail:
            raise tiles.httpx.HTTPStatusError("403", request=None, response=None)


@pytest.fixture()
def online(monkeypatch, tmp_path):
    monkeypatch.setattr(S, "external_geo_enabled", True)
    monkeypatch.setattr(S, "tile_cache_dir", str(tmp_path))
    calls = []

    def fake_get(url, headers=None, timeout=None):
        calls.append((url, headers))
        return _Resp()

    monkeypatch.setattr(tiles.httpx, "get", fake_get)
    return calls


def test_tile_is_fetched_with_our_user_agent_then_cached(client, online):
    r = client.get("/tiles/7/90/56.png")
    assert r.status_code == 200 and r.content == PNG
    assert r.headers["content-type"] == "image/png"
    url, headers = online[0]
    assert url == "https://tile.openstreetmap.org/7/90/56.png"
    assert headers["User-Agent"] == S.http_user_agent

    assert client.get("/tiles/7/90/56.png").content == PNG
    assert len(online) == 1  # second request served from the disk cache


def test_old_cached_tile_is_refreshed(client, online):
    client.get("/tiles/5/22/14.png")
    path = tiles.tile_path(5, 22, 14)
    old = time.time() - (S.tile_cache_days + 1) * 86400
    os.utime(path, (old, old))
    client.get("/tiles/5/22/14.png")
    assert len(online) == 2


def test_provider_failure_uses_old_tile_or_502(client, online, monkeypatch):
    client.get("/tiles/6/45/28.png")  # cached
    path = tiles.tile_path(6, 45, 28)
    old = time.time() - (S.tile_cache_days + 1) * 86400
    os.utime(path, (old, old))
    monkeypatch.setattr(tiles.httpx, "get", lambda *a, **k: _Resp(fail=True))
    assert client.get("/tiles/6/45/28.png").status_code == 200  # stale tile beats no tile
    assert client.get("/tiles/6/45/29.png").status_code == 502  # nothing cached


@pytest.mark.parametrize("path", ["/tiles/20/0/0.png", "/tiles/3/8/0.png", "/tiles/3/0/-1.png", "/tiles/-1/0/0.png"])
def test_invalid_tiles_are_404(client, online, path):
    assert client.get(path).status_code == 404
    assert online == []


def test_tiles_off_when_external_geo_disabled(client):
    assert client.get("/tiles/1/0/0.png").status_code == 503
