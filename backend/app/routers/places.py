from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import geocoding, routing
from ..geo import cumulative_lengths, parse_coordinates, project_on_polyline
from ..models import Place, SavedPlace, User
from ..schemas import GeoPointOut, PlaceOut, RoutePlace, RouteResult
from ..security import get_current_user, get_optional_user

router = APIRouter(tags=["places"])


def _saved_ids(db: Session, user: User | None) -> set[int]:
    if not user:
        return set()
    return {row.place_id for row in db.query(SavedPlace).filter(SavedPlace.user_id == user.id)}


def _out(place: Place, saved: set[int]) -> PlaceOut:
    out = PlaceOut.model_validate(place)
    out.is_saved = place.id in saved
    return out


@router.get("/places", response_model=list[PlaceOut])
def list_places(
    q: str | None = Query(None, description="Search name or city"),
    faith: str | None = None,
    sect: str | None = None,
    kind: str | None = None,
    verified_only: bool = False,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    query = db.query(Place)
    if q:
        like = f"%{q}%"
        query = query.filter(Place.name.ilike(like) | Place.city.ilike(like))
    if faith:
        query = query.filter(Place.faith == faith)
    if sect:
        # a place with sect "all" is relevant to every sect
        query = query.filter((Place.sect == sect) | (Place.sect == "all"))
    if kind:
        query = query.filter(Place.kind == kind)
    if verified_only:
        query = query.filter(Place.verified.is_(True))
    saved = _saved_ids(db, user)
    return [_out(p, saved) for p in query.order_by(Place.name).all()]


@router.get("/places/saved", response_model=list[PlaceOut])
def saved_places(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(Place)
        .join(SavedPlace, SavedPlace.place_id == Place.id)
        .filter(SavedPlace.user_id == user.id)
        .order_by(SavedPlace.created_at.desc())
        .all()
    )
    return [_out(p, {p.id for p in rows}) for p in rows]


@router.get("/places/{place_id}", response_model=PlaceOut)
def get_place(place_id: int, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    return _out(place, _saved_ids(db, user))


@router.post("/places/{place_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def save_place(place_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not db.get(Place, place_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    exists = db.query(SavedPlace).filter_by(user_id=user.id, place_id=place_id).first()
    if not exists:
        db.add(SavedPlace(user_id=user.id, place_id=place_id))
        db.commit()


@router.delete("/places/{place_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def unsave_place(place_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(SavedPlace).filter_by(user_id=user.id, place_id=place_id).first()
    if row:
        db.delete(row)
        db.commit()


def _resolve(text: str) -> tuple[str, float, float] | None:
    text = text.strip()
    coords = parse_coordinates(text)
    if coords:
        return coords
    hit = geocoding.geocode(text)
    return (hit.label, hit.lat, hit.lng) if hit else None


@router.get("/geocode", response_model=list[GeoPointOut])
def geocode(q: str = Query(..., min_length=2, max_length=100), limit: int = Query(5, ge=1, le=10)):
    """Place-name suggestions for the route planner's start / end fields."""
    return [GeoPointOut(label=p.label, lat=p.lat, lng=p.lng) for p in geocoding.search(q, limit)]


@router.get("/route", response_model=RouteResult)
def places_along_route(
    start: str = Query(..., description="Place name or 'lat,lng'"),
    end: str = Query(..., description="Place name or 'lat,lng'"),
    max_detour_km: float = Query(25, ge=1, le=200),
    faith: str | None = None,
    sect: str | None = None,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Places within `max_detour_km` of the driving route A→B, ordered along the trip.

    The route comes from OSRM (falls back to a straight line if it is unreachable; see
    `source` in the response). Switch to a PostGIS ST_DWithin corridor query when moving to PostgreSQL.
    """
    a = _resolve(start)
    b = _resolve(end)
    if not a:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown start location: {start}")
    if not b:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown end location: {end}")
    (a_label, alat, alon), (b_label, blat, blon) = a, b

    road = routing.get_route(alat, alon, blat, blon)
    cumulative = cumulative_lengths(road.points)

    query = db.query(Place)
    if faith:
        query = query.filter(Place.faith == faith)
    if sect:
        query = query.filter((Place.sect == sect) | (Place.sect == "all"))

    saved = _saved_ids(db, user)
    results: list[RoutePlace] = []
    for p in query.all():
        detour, along = project_on_polyline(p.latitude, p.longitude, road.points, cumulative)
        if detour <= max_detour_km:
            base = _out(p, saved).model_dump()
            results.append(RoutePlace(**base, detour_km=round(detour, 1), distance_from_start_km=round(along, 1)))
    results.sort(key=lambda r: r.distance_from_start_km)

    return RouteResult(
        start=a_label,
        end=b_label,
        start_point=GeoPointOut(label=a_label, lat=alat, lng=alon),
        end_point=GeoPointOut(label=b_label, lat=blat, lng=blon),
        total_km=round(road.distance_km, 1),
        duration_min=round(road.duration_min) if road.duration_min else None,
        source=road.source,
        geometry=routing.simplify(road.points),
        max_detour_km=max_detour_km,
        places=results,
    )
