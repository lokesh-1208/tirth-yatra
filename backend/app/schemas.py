from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class OtpRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255)  # email or phone


class OtpVerify(OtpRequest):
    otp: str = Field(min_length=4, max_length=8)


class OtpSent(BaseModel):
    message: str
    identifier: str  # normalized
    expires_in_seconds: int


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    faith: str | None = None
    sect: str | None = None
    language: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    faith: str | None = None
    sect: str | None = None
    language: str = "en"


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    is_new_user: bool = False


class PlaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    faith: str
    sect: str | None = None
    kind: str
    deity: str | None = None
    description: str | None = None
    city: str | None = None
    state: str | None = None
    latitude: float
    longitude: float
    how_to_reach: str | None = None
    photo_url: str | None = None
    darshan_timings: str | None = None
    contact_phone: str | None = None
    stay_info: str | None = None
    food_info: str | None = None
    verified: bool
    verified_by: str | None = None
    verified_on: date | None = None
    is_saved: bool = False


class RoutePlace(PlaceOut):
    detour_km: float
    distance_from_start_km: float


class GeoPointOut(BaseModel):
    label: str
    lat: float
    lng: float


class RouteResult(BaseModel):
    start: str
    end: str
    start_point: GeoPointOut
    end_point: GeoPointOut
    total_km: float
    duration_min: float | None = None
    source: str = "straight"  # "road" when a real road route was found
    geometry: list[tuple[float, float]] = []  # (lat, lng) polyline for drawing the route
    max_detour_km: float
    places: list[RoutePlace]
