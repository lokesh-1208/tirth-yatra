"""Map tiles for the app's Leaflet maps, fetched once from the tile provider and cached on disk.

Why a proxy: OpenStreetMap's tile servers refuse requests they cannot identify (the app's maps run
in sandboxed frames that send no usable Referer). Fetching here sends our User-Agent, and the disk
cache keeps load on the volunteer-run servers low, as their tile usage policy asks.
Before real traffic, point TILE_URL_TEMPLATE at a paid / self-hosted tile provider.
"""
import logging
import time
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Response, status

from ..config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(tags=["map"])

MAX_ZOOM = 19
_TYPES = {"png": "image/png", "jpg": "image/jpeg"}


def tile_path(z: int, x: int, y: int) -> Path:
    return Path(settings.tile_cache_dir) / str(z) / str(x) / f"{y}.png"


def _fetch(z: int, x: int, y: int) -> bytes | None:
    url = settings.tile_url_template.format(z=z, x=x, y=y)
    try:
        r = httpx.get(url, headers={"User-Agent": settings.http_user_agent}, timeout=settings.external_timeout_seconds)
        r.raise_for_status()
        return r.content
    except httpx.HTTPError as e:
        log.warning("Tile fetch failed for %s: %s", url, e)
        return None


@router.get("/tiles/{z}/{x}/{y}.png", responses={200: {"content": {"image/png": {}}}})
def get_tile(z: int, x: int, y: int):
    if not 0 <= z <= MAX_ZOOM or not (0 <= x < 2**z and 0 <= y < 2**z):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such tile")
    if not settings.external_geo_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Map tiles are switched off (EXTERNAL_GEO_ENABLED=false)")

    path = tile_path(z, x, y)
    max_age = settings.tile_cache_days * 86400
    if path.exists() and time.time() - path.stat().st_mtime < max_age:
        content = path.read_bytes()
    else:
        content = _fetch(z, x, y)
        if content is None:
            if path.exists():  # provider down: an old tile is better than none
                content = path.read_bytes()
            else:
                raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not load the map tile")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
    return Response(content, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})
