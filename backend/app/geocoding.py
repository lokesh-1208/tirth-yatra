"""Place-name -> coordinates. Nominatim (OpenStreetMap) with the built-in city list as offline fallback.

The public Nominatim server is for light use only (1 req/s, identifying User-Agent). Point
NOMINATIM_URL at a self-hosted instance or a paid provider before real traffic.
"""
import logging
from dataclasses import dataclass
from functools import lru_cache

import httpx

from .config import get_settings
from .geo import CITIES

log = logging.getLogger(__name__)
settings = get_settings()


@dataclass(frozen=True)
class GeoPoint:
    label: str
    lat: float
    lng: float


def _short_label(item: dict) -> str:
    """'Jabalpur, Madhya Pradesh' instead of Nominatim's very long display_name."""
    addr = item.get("address") or {}
    name = item.get("name") or addr.get("city") or addr.get("town") or addr.get("village") or ""
    state = addr.get("state") or ""
    parts = [p for p in (name, state) if p]
    return ", ".join(parts) if parts else item.get("display_name", "").split(",")[0]


def _gazetteer(q: str, limit: int) -> list[GeoPoint]:
    q = q.strip().lower()
    hits = [k for k in CITIES if k.startswith(q)] or [k for k in CITIES if q in k]
    return [GeoPoint(k.title(), *CITIES[k]) for k in hits[:limit]]


@lru_cache(maxsize=512)
def _nominatim(q: str, limit: int) -> tuple[GeoPoint, ...] | None:
    """None means 'service unavailable' (so callers fall back); () means 'no match'."""
    params = {"q": q, "format": "jsonv2", "limit": limit, "addressdetails": 1}
    if settings.geocode_country_codes:
        params["countrycodes"] = settings.geocode_country_codes
    try:
        r = httpx.get(
            f"{settings.nominatim_url}/search",
            params=params,
            headers={"User-Agent": settings.http_user_agent},
            timeout=settings.external_timeout_seconds,
        )
        r.raise_for_status()
        return tuple(GeoPoint(_short_label(i), float(i["lat"]), float(i["lon"])) for i in r.json())
    except (httpx.HTTPError, ValueError, KeyError) as e:
        log.warning("Nominatim lookup failed for %r: %s", q, e)
        return None


def search(q: str, limit: int = 5) -> list[GeoPoint]:
    q = q.strip()
    if len(q) < 2:
        return []
    if settings.external_geo_enabled:
        found = _nominatim(q.lower(), limit)
        if found is not None:
            return list(found)
    return _gazetteer(q, limit)


def geocode(q: str) -> GeoPoint | None:
    hits = search(q, 1)
    return hits[0] if hits else None
