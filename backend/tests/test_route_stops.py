"""Unit tests for "break journey": routes through stops chosen by the pilgrim."""
import pytest

from app import routing
from app.geo import cumulative_lengths, haversine_km, locate_in_order

JABALPUR = (23.1815, 79.9864)
HOSHANGABAD = (22.7530, 77.7270)
NEMAWAR = (22.4350, 76.8650)


# --- routing.get_route -------------------------------------------------------------------------


def test_straight_route_passes_through_every_stop_in_order():
    r = routing.get_route([JABALPUR, HOSHANGABAD, NEMAWAR])
    assert r.source == "straight"
    assert r.points == (JABALPUR, HOSHANGABAD, NEMAWAR)
    legs = haversine_km(*JABALPUR, *HOSHANGABAD) + haversine_km(*HOSHANGABAD, *NEMAWAR)
    assert r.distance_km == pytest.approx(legs)
    assert r.distance_km >= haversine_km(*JABALPUR, *NEMAWAR)  # a detour is never shorter


def test_route_needs_start_and_end():
    with pytest.raises(ValueError):
        routing.get_route([JABALPUR])


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


@pytest.fixture()
def online(monkeypatch):
    """Pretend external routing is switched on, with a clean cache, and never hit the network."""
    monkeypatch.setattr(routing.settings, "external_geo_enabled", True)
    routing._osrm.cache_clear()
    yield
    routing._osrm.cache_clear()


def test_osrm_is_asked_for_all_waypoints_in_order(monkeypatch, online):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        coords = [[79.9864, 23.1815], [77.727, 22.753], [76.865, 22.435]]  # lng, lat as OSRM returns
        return _FakeResponse(
            {"code": "Ok", "routes": [{"geometry": {"coordinates": coords}, "distance": 420000, "duration": 30000}]}
        )

    monkeypatch.setattr(routing.httpx, "get", fake_get)
    r = routing.get_route([JABALPUR, HOSHANGABAD, NEMAWAR])

    assert len(calls) == 1
    assert calls[0].endswith("/route/v1/driving/79.9864,23.1815;77.727,22.753;76.865,22.435")
    assert r.source == "road" and r.distance_km == 420 and r.duration_min == 500
    assert r.points[1] == (22.753, 77.727)  # converted back to (lat, lng)


def test_osrm_failure_falls_back_to_straight_line_through_stops(monkeypatch, online):
    def broken_get(url, **kwargs):
        raise routing.httpx.ConnectError("no network")

    monkeypatch.setattr(routing.httpx, "get", broken_get)
    r = routing.get_route([JABALPUR, HOSHANGABAD, NEMAWAR])
    assert r.source == "straight" and len(r.points) == 3


def test_osrm_no_route_falls_back(monkeypatch, online):
    monkeypatch.setattr(routing.httpx, "get", lambda url, **kw: _FakeResponse({"code": "NoRoute"}))
    assert routing.get_route([JABALPUR, NEMAWAR]).source == "straight"


# --- geo.locate_in_order -----------------------------------------------------------------------


def test_stops_on_a_route_that_doubles_back_get_increasing_distances():
    # Out east along lat 20, then back west along almost the same line.
    road = [(20.0, 70.0), (20.0, 72.0), (20.01, 70.0)]
    cum = cumulative_lengths(road)
    far_east, back_in_middle = locate_in_order([(20.0, 72.0), (20.005, 71.0)], road, cum)
    assert far_east == pytest.approx(cum[1], abs=0.5)
    assert back_in_middle > far_east  # reached on the way back, not on the way out


def test_locate_in_order_with_no_targets():
    road = [(20.0, 70.0), (20.0, 71.0)]
    assert locate_in_order([], road, cumulative_lengths(road)) == []


# --- GET /route?via=... -------------------------------------------------------------------------


def test_route_without_stops_has_empty_stops(client):
    data = client.get("/route", params={"start": "Jabalpur", "end": "Nemawar"}).json()
    assert data["stops"] == []


def test_route_through_a_stop_returns_it_with_its_distance(client):
    r = client.get("/route", params={"start": "Jabalpur", "end": "Nemawar", "via": "Hoshangabad"})
    assert r.status_code == 200
    data = r.json()
    assert [s["label"] for s in data["stops"]] == ["Hoshangabad"]
    stop = data["stops"][0]
    assert 0 < stop["distance_from_start_km"] < data["total_km"]
    assert len(data["geometry"]) == 3  # straight line offline: start, stop, end


def test_stop_off_the_direct_road_brings_its_places_in(client):
    direct = client.get("/route", params={"start": "Jabalpur", "end": "Nemawar", "max_detour_km": 25}).json()
    via_bhopal = client.get(
        "/route", params={"start": "Jabalpur", "end": "Nemawar", "via": "Bhopal", "max_detour_km": 25}
    ).json()
    assert "Bhopal" not in [p["city"] for p in direct["places"]]
    assert "Bhopal" in [p["city"] for p in via_bhopal["places"]]
    assert via_bhopal["total_km"] > direct["total_km"]


def test_two_stops_keep_travel_order_and_places_stay_sorted(client):
    params = [("start", "Jabalpur"), ("end", "Nemawar"), ("via", "Narsinghpur"), ("via", "Bhopal")]
    data = client.get("/route", params=params).json()
    assert [s["label"] for s in data["stops"]] == ["Narsinghpur", "Bhopal"]
    stop_km = [s["distance_from_start_km"] for s in data["stops"]]
    assert stop_km == sorted(stop_km)
    place_km = [p["distance_from_start_km"] for p in data["places"]]
    assert place_km == sorted(place_km)


def test_blank_stops_are_ignored(client):
    params = [("start", "Jabalpur"), ("end", "Nemawar"), ("via", ""), ("via", "  ")]
    data = client.get("/route", params=params).json()
    assert data["stops"] == []


def test_unknown_stop_is_rejected_with_its_number(client):
    params = [("start", "Jabalpur"), ("end", "Nemawar"), ("via", "Bhopal"), ("via", "Atlantis")]
    r = client.get("/route", params=params)
    assert r.status_code == 422
    assert r.json()["detail"] == "Unknown stop 2: Atlantis"


def test_too_many_stops_is_rejected(client):
    towns = ["Narsinghpur", "Itarsi", "Hoshangabad", "Bhopal", "Dewas", "Indore"]
    assert len(towns) == routing.MAX_STOPS + 1
    params = [("start", "Jabalpur"), ("end", "Nemawar")] + [("via", t) for t in towns]
    r = client.get("/route", params=params)
    assert r.status_code == 422
    assert str(routing.MAX_STOPS) in r.json()["detail"]


def test_stops_can_be_coordinates(client):
    params = [("start", "Jabalpur"), ("end", "Nemawar"), ("via", "22.7530,77.7270")]
    data = client.get("/route", params=params).json()
    assert data["stops"][0]["lat"] == pytest.approx(22.753)
