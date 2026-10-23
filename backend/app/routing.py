"""Road route A -> (stops ->) B. OSRM when available, straight line otherwise.

The public OSRM demo server is for light use only. Set OSRM_URL to a self-hosted instance
(or swap this module for Google Directions / Mapbox) before real traffic.
"""
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from functools import lru_cache

import httpx

from .config import get_settings
from .geo import haversine_km

log = logging.getLogger(__name__)
settings = get_settings()

LatLng = tuple[float, float]
Coords = tuple[LatLng, ...]  # ((lat, lng), ...)

# Most stops a pilgrim can add between start and end ("break journey").
MAX_STOPS = 5


@dataclass(frozen=True)
class RoadRoute:
    points: Coords
    distance_km: float
    duration_min: float | None
    source: str  # "road" | "straight"


def _straight(waypoints: Coords) -> RoadRoute:
    """Straight lines from point to point, through every stop in order."""
    km = sum(haversine_km(*waypoints[i - 1], *waypoints[i]) for i in range(1, len(waypoints)))
    return RoadRoute(waypoints, km, None, "straight")


@lru_cache(maxsize=256)
def _osrm(waypoints: Coords) -> RoadRoute | None:
    # OSRM takes "lng,lat;lng,lat;..." and routes through the points in the given order.
    path = ";".join(f"{lng},{lat}" for lat, lng in waypoints)
    url = f"{settings.osrm_url}/route/v1/driving/{path}"
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
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as e:
        log.warning("OSRM routing failed: %s", e)
        return None


def get_route(waypoints: Sequence[LatLng]) -> RoadRoute:
    """Route through `waypoints` in order: start, any stops, end."""
    if len(waypoints) < 2:
        raise ValueError("A route needs at least a start and an end")
    # Round to ~1 m so near-identical requests share the cache.
    wps: Coords = tuple((round(lat, 5), round(lng, 5)) for lat, lng in waypoints)
    if settings.external_geo_enabled:
        road = _osrm(wps)
        if road and len(road.points) >= 2:
            return road
    return _straight(wps)


def simplify(points: Coords, max_points: int = 400) -> list[tuple[float, float]]:
    """Cheap decimation for sending the line to the client (always keeps first and last)."""
    if len(points) <= max_points:
        return list(points)
    step = (len(points) - 1) / (max_points - 1)
    out = [points[round(i * step)] for i in range(max_points - 1)]
    out.append(points[-1])
    return out
