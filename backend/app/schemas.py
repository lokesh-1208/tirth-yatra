from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    faith: str | None = None
    sect: str | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    faith: str | None = None
    sect: str | None = None
    language: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    faith: str | None = None
    sect: str | None = None
    language: str = "en"


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


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
    verified: bool
    verified_by: str | None = None
    verified_on: date | None = None
    is_saved: bool = False


class RoutePlace(PlaceOut):
    detour_km: float
    distance_from_start_km: float


class RouteResult(BaseModel):
    start: str
    end: str
    total_km: float
    max_detour_km: float
    places: list[RoutePlace]
