import math
from collections.abc import Sequence

EARTH_RADIUS_KM = 6371.0088

# Small built-in gazetteer so route search works with city names in the MVP.
# Replace with real geocoding (Google Places / Nominatim) later. Coordinates are approximate.
CITIES: dict[str, tuple[float, float]] = {
    "jabalpur": (23.1815, 79.9864),
    "nemawar": (22.4350, 76.8650),
    "bhopal": (23.2599, 77.4126),
    "indore": (22.7196, 75.8577),
    "ujjain": (23.1765, 75.7885),
    "sagar": (23.8388, 78.7378),
    "katni": (23.8343, 80.3944),
    "narsinghpur": (22.9480, 79.1940),
    "itarsi": (22.6122, 77.7627),
    "hoshangabad": (22.7530, 77.7270),
    "dewas": (22.9676, 76.0534),
    "betul": (21.9057, 77.8985),
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def project_on_segment(
    plat: float, plon: float, alat: float, alon: float, blat: float, blon: float
) -> tuple[float, float]:
    """Return (distance_from_segment_km, distance_from_A_along_segment_km).

    Uses a local equirectangular projection, accurate enough for a few hundred km.
    """
    lat0 = math.radians((alat + blat) / 2)
    kx = math.cos(lat0) * math.pi / 180 * EARTH_RADIUS_KM
    ky = math.pi / 180 * EARTH_RADIUS_KM

    ax, ay = alon * kx, alat * ky
    bx, by = blon * kx, blat * ky
    px, py = plon * kx, plat * ky

    abx, aby = bx - ax, by - ay
    seg_len_sq = abx * abx + aby * aby
    if seg_len_sq == 0:
        return haversine_km(plat, plon, alat, alon), 0.0

    t = max(0.0, min(1.0, ((px - ax) * abx + (py - ay) * aby) / seg_len_sq))
    cx, cy = ax + t * abx, ay + t * aby
    dist = math.hypot(px - cx, py - cy)
    along = t * math.sqrt(seg_len_sq)
    return dist, along


def project_on_polyline(
    plat: float, plon: float, points: "Sequence[tuple[float, float]]", cumulative_km: "Sequence[float]"
) -> tuple[float, float]:
    """Return (distance_from_route_km, distance_from_start_along_route_km) for a place.

    `points` are (lat, lng); `cumulative_km[i]` is the route length up to points[i].
    """
    best_dist, best_along = float("inf"), 0.0
    for i in range(len(points) - 1):
        (alat, alon), (blat, blon) = points[i], points[i + 1]
        # Cheap reject: skip segments clearly farther than the best so far (0.01 deg ~ 1.1 km).
        if best_dist < 1e8:
            margin = best_dist / 100 + 0.02
            if (
                plat < min(alat, blat) - margin
                or plat > max(alat, blat) + margin
                or plon < min(alon, blon) - margin
                or plon > max(alon, blon) + margin
            ):
                continue
        dist, along = project_on_segment(plat, plon, alat, alon, blat, blon)
        if dist < best_dist:
            best_dist, best_along = dist, cumulative_km[i] + along
    return best_dist, best_along


def locate_in_order(
    targets: "Sequence[tuple[float, float]]",
    points: "Sequence[tuple[float, float]]",
    cumulative_km: "Sequence[float]",
) -> list[float]:
    """Distance from the start along the route for each target, searching forward from the previous one.

    Used for the stops a route was built through: they are visited in order, so a route that
    doubles back on itself still gives each stop the distance at which it is actually reached.
    """
    out: list[float] = []
    first_seg = 0
    for tlat, tlng in targets:
        best_dist, best_along, best_seg = float("inf"), cumulative_km[first_seg], first_seg
        for i in range(first_seg, len(points) - 1):
            (alat, alon), (blat, blon) = points[i], points[i + 1]
            dist, along = project_on_segment(tlat, tlng, alat, alon, blat, blon)
            if dist < best_dist:
                best_dist, best_along, best_seg = dist, cumulative_km[i] + along, i
        out.append(best_along)
        first_seg = best_seg
    return out


def cumulative_lengths(points: "Sequence[tuple[float, float]]") -> list[float]:
    out = [0.0]
    for i in range(1, len(points)):
        out.append(out[-1] + haversine_km(*points[i - 1], *points[i]))
    return out


def parse_coordinates(text: str) -> tuple[str, float, float] | None:
    """Parse 'lat,lng'. Returns (label, lat, lng) or None if it is not a coordinate pair."""
    if "," not in text:
        return None
    try:
        lat_s, lng_s = text.split(",", 1)
        lat, lng = float(lat_s), float(lng_s)
    except ValueError:
        return None
    if -90 <= lat <= 90 and -180 <= lng <= 180:
        return f"{lat:.4f},{lng:.4f}", lat, lng
    return None


def resolve_location(text: str) -> tuple[str, float, float] | None:
    """Accept 'lat,lng' or a known city name. Returns (label, lat, lng) or None."""
    text = text.strip()
    if "," in text:
        try:
            lat_s, lng_s = text.split(",", 1)
            lat, lng = float(lat_s), float(lng_s)
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return f"{lat:.4f},{lng:.4f}", lat, lng
        except ValueError:
            return None
    key = text.lower()
    if key in CITIES:
        lat, lng = CITIES[key]
        return text.title(), lat, lng
    return None
