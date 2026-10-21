"""Road route A -> B. OSRM when available, straight line otherwise.

The public OSRM demo server is for light use only. Set OSRM_URL to a self-hosted instance
(or swap this module for Google Directions / Mapbox) before real traffic.
"""
import logging
from dataclasses import dataclass
from functools import lru_cache

import httpx

from .config import get_settings
from .geo import haversine_km

log = logging.getLogger(__name__)
settings = get_settings()

Coords = tuple[tuple[float, float], ...]  # ((lat, lng), ...)


@dataclass(frozen=True)
class RoadRoute:
    points: Coords
    distance_km: float
    duration_min: float | None
    source: str  # "road" | "straight"


def _straight(alat: float, alon: float, blat: float, blon: float) -> RoadRoute:
    return RoadRoute(((alat, alon), (blat, blon)), haversine_km(alat, alon, blat, blon), None, "straight")


@lru_cache(maxsize=256)
def _osrm(alat: float, alon: float, blat: float, blon: float) -> RoadRoute | None:
    url = f"{settings.osrm_url}/route/v1/driving/{alon},{alat};{blon},{blat}"
    try:
        r = httpx.get(
            url,
            params={"overview": "full", "geometries": "geojson"},
            headers={"User-Agent": settings.http_user_agent},
            timeout=settings.external_timeout_seconds,
        )
        r.raise_for_status()
        data = r.json()
        if data.get("code") != "Ok":
            return None
        route = data["routes"][0]
        pts = tuple((lat, lng) for lng, lat in route["geometry"]["coordinates"])
        return RoadRoute(pts, route["distance"] / 1000, route["duration"] / 60, "road")
    except (httpx.HTTPError, ValueError, KeyError, IndexError) as e:
        log.warning("OSRM routing failed: %s", e)
        return None


def get_route(alat: float, alon: float, blat: float, blon: float) -> RoadRoute:
    if settings.external_geo_enabled:
        # Round to ~1 m so near-identical requests share the cache.
        road = _osrm(round(alat, 5), round(alon, 5), round(blat, 5), round(blon, 5))
        if road and len(road.points) >= 2:
            return road
    return _straight(alat, alon, blat, blon)


def simplify(points: Coords, max_points: int = 400) -> list[tuple[float, float]]:
    """Cheap decimation for sending the line to the client (always keeps first and last)."""
    if len(points) <= max_points:
        return list(points)
    step = (len(points) - 1) / (max_points - 1)
    out = [points[round(i * step)] for i in range(max_points - 1)]
    out.append(points[-1])
    return out
