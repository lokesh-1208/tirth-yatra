def test_list_and_filter(client):
    all_places = client.get("/places").json()
    assert len(all_places) >= 6
    assert all(p["verified"] is False for p in all_places)  # seed data must never claim to be verified

    bhopal = client.get("/places", params={"q": "bhopal"}).json()
    assert len(bhopal) == 1

    digambar = client.get("/places", params={"sect": "digambar"}).json()
    sects = {p["sect"] for p in digambar}
    assert sects <= {"digambar", "all"}

    assert client.get("/places", params={"verified_only": True}).json() == []


def test_place_404(client):
    assert client.get("/places/99999").status_code == 404


def test_save_flow(client, auth_headers):
    pid = client.get("/places").json()[0]["id"]

    assert client.post(f"/places/{pid}/save").status_code == 401
    assert client.post(f"/places/{pid}/save", headers=auth_headers).status_code == 204
    assert client.post(f"/places/{pid}/save", headers=auth_headers).status_code == 204  # idempotent

    saved = client.get("/places/saved", headers=auth_headers).json()
    assert [p["id"] for p in saved] == [pid]
    assert client.get(f"/places/{pid}", headers=auth_headers).json()["is_saved"] is True
    assert client.get(f"/places/{pid}").json()["is_saved"] is False

    assert client.delete(f"/places/{pid}/save", headers=auth_headers).status_code == 204
    assert client.get("/places/saved", headers=auth_headers).json() == []


def test_route_jabalpur_to_nemawar(client):
    r = client.get("/route", params={"start": "Jabalpur", "end": "Nemawar", "max_detour_km": 30})
    assert r.status_code == 200
    data = r.json()
    # straight-line distance (road distance will be longer once real routing is added)
    assert 300 < data["total_km"] < 360
    cities = [p["city"] for p in data["places"]]
    assert "Narsinghpur" in cities and "Hoshangabad" in cities
    assert "Ujjain" not in cities
    distances = [p["distance_from_start_km"] for p in data["places"]]
    assert distances == sorted(distances)


def test_route_tight_corridor_returns_fewer(client):
    wide = client.get("/route", params={"start": "Jabalpur", "end": "Nemawar", "max_detour_km": 100}).json()
    tight = client.get("/route", params={"start": "Jabalpur", "end": "Nemawar", "max_detour_km": 2}).json()
    assert len(tight["places"]) <= len(wide["places"])


def test_route_accepts_coordinates_and_rejects_unknown(client):
    ok = client.get("/route", params={"start": "23.18,79.98", "end": "22.43,76.86"})
    assert ok.status_code == 200
    bad = client.get("/route", params={"start": "Atlantis", "end": "Nemawar"})
    assert bad.status_code == 422
