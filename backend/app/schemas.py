from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    role: str | None = "pilgrim"


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
    verified_method: str | None = None
    address: str | None = None
    district: str | None = None
    landmarks: str | None = None
    contacts: list["PublicContact"] = []  # only people who agreed to be shown
    language: str = "en"  # language the text fields are in (falls back to the default language)
    is_saved: bool = False


class RoutePlace(PlaceOut):
    detour_km: float
    distance_from_start_km: float


class GeoPointOut(BaseModel):
    label: str
    lat: float
    lng: float


class RouteStop(GeoPointOut):
    """A stop the pilgrim chose between start and end ("break journey")."""

    distance_from_start_km: float


class RouteResult(BaseModel):
    start: str
    end: str
    start_point: GeoPointOut
    end_point: GeoPointOut
    stops: list[RouteStop] = []  # in travel order; empty for a direct A -> B trip
    total_km: float
    duration_min: float | None = None
    source: str = "straight"  # "road" when a real road route was found
    geometry: list[tuple[float, float]] = []  # (lat, lng) polyline for drawing the route
    max_detour_km: float
    places: list[RoutePlace]


# ---------------------------------------------------------------------------------------------
# Pilgrim-facing extras
# ---------------------------------------------------------------------------------------------


class PublicContact(BaseModel):
    name: str
    role: str
    phone: str


PlaceOut.model_rebuild()
RoutePlace.model_rebuild()

# ---------------------------------------------------------------------------------------------
# Admin (curator) schemas
# ---------------------------------------------------------------------------------------------

PlaceStatus = Literal["draft", "in_review", "live", "hidden"]
Sect = Literal["digambar", "shvetambar", "all"]
Kind = Literal["tirth", "siddha_kshetra", "atishay_kshetra", "temple", "dharamshala"]
CheckMethod = Literal["call", "visit", "local_reference"]
ContactRole = Literal["manager", "pujari", "trustee", "other"]
LeadStatus = Literal["to_call", "called", "drafted", "rejected"]
LANGUAGE_PATTERN = r"^[a-z]{2,3}(-[A-Z]{2})?$"


class _PlaceFields(BaseModel):
    faith: str = Field(default="jain", min_length=2, max_length=40)
    sect: Sect | None = None
    kind: Kind = "temple"
    deity: str | None = Field(default=None, max_length=120)  # moolnayak
    description: str | None = None
    city: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=300)
    pincode: str | None = Field(default=None, pattern=r"^\d{6}$")
    how_to_reach: str | None = None
    darshan_timings: str | None = None
    stay_info: str | None = None
    food_info: str | None = None
    landmarks: str | None = None


class PlaceCreate(_PlaceFields):
    name: str = Field(min_length=2, max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    lead_id: int | None = None  # the lead this draft comes from, if any


class PlaceUpdate(BaseModel):
    """Every field optional: only what is sent is changed. Status changes go through /status."""

    name: str | None = Field(default=None, min_length=2, max_length=200)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    faith: str | None = Field(default=None, min_length=2, max_length=40)
    sect: Sect | None = None
    kind: Kind | None = None
    deity: str | None = Field(default=None, max_length=120)
    description: str | None = None
    city: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=300)
    pincode: str | None = Field(default=None, pattern=r"^\d{6}$")
    how_to_reach: str | None = None
    darshan_timings: str | None = None
    stay_info: str | None = None
    food_info: str | None = None
    landmarks: str | None = None


class StatusChange(BaseModel):
    status: PlaceStatus


class TranslationIn(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    how_to_reach: str | None = None
    darshan_timings: str | None = None
    stay_info: str | None = None
    food_info: str | None = None
    landmarks: str | None = None


class TranslationOut(TranslationIn):
    model_config = ConfigDict(from_attributes=True)

    language: str


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    role: ContactRole = "manager"
    phone: str = Field(min_length=6, max_length=20)
    consent_on: date | None = None
    show_publicly: bool = False

    @model_validator(mode="after")
    def _consent_before_showing(self):
        if self.show_publicly and not self.consent_on:
            raise ValueError("Record when the person agreed to be listed before showing them to pilgrims")
        return self


class ContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    role: ContactRole | None = None
    phone: str | None = Field(default=None, min_length=6, max_length=20)
    consent_on: date | None = None
    show_publicly: bool | None = None


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: str
    phone: str
    consent_on: date | None = None
    show_publicly: bool


class PhotoUpdate(BaseModel):
    caption: str | None = Field(default=None, max_length=200)
    photographer: str | None = Field(default=None, max_length=120)
    permission_note: str | None = Field(default=None, max_length=300)
    is_cover: bool | None = None


class PhotoOut(BaseModel):
    id: int
    url: str
    caption: str | None = None
    photographer: str | None = None
    permission_note: str | None = None
    is_cover: bool
    created_at: datetime


class CheckIn(BaseModel):
    method: CheckMethod
    checked_with: str | None = Field(default=None, max_length=200)
    confirmed: str | None = None
    checked_on: date | None = None  # default: today
    recheck_after_months: int = Field(default=6, ge=1, le=24)


class CheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    method: str
    checked_with: str | None = None
    confirmed: str | None = None
    checked_on: date
    recheck_after_months: int
    checked_by_name: str | None = None
    created_at: datetime


class AdminPlaceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str | None = None
    district: str | None = None
    sect: str | None = None
    kind: str
    status: str
    verified: bool
    verified_on: date | None = None
    recheck_due: date | None = None
    cover_url: str | None = None


class AdminPlaceOut(AdminPlaceSummary):
    faith: str
    deity: str | None = None
    description: str | None = None
    state: str | None = None
    address: str | None = None
    pincode: str | None = None
    latitude: float
    longitude: float
    how_to_reach: str | None = None
    darshan_timings: str | None = None
    stay_info: str | None = None
    food_info: str | None = None
    landmarks: str | None = None
    verified_by: str | None = None
    verified_method: str | None = None
    updated_at: datetime | None = None
    default_language: str
    translations: list[TranslationOut] = []
    contacts: list[ContactOut] = []
    photos: list[PhotoOut] = []
    checks: list[CheckOut] = []


class AdminSummary(BaseModel):
    counts: dict[str, int]  # places by status
    recheck_due: int  # live places whose re-check date has passed (or never checked)
    open_leads: int  # leads still to call or called
    open_reports: int = 0  # pilgrim reports waiting for review
    due_places: list[AdminPlaceSummary]
    recent_checks: list[dict]


class LeadIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    area: str | None = Field(default=None, max_length=200)
    source: str | None = Field(default=None, max_length=300)
    notes: str | None = None


class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    area: str | None = Field(default=None, max_length=200)
    source: str | None = Field(default=None, max_length=300)
    notes: str | None = None
    status: LeadStatus | None = None


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    area: str | None = None
    source: str | None = None
    status: str
    notes: str | None = None
    place_id: int | None = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------------------------
# Pilgrim reports and the review queue
# ---------------------------------------------------------------------------------------------

ReportKind = Literal["correction", "new_place"]
ReportTopic = Literal["timings", "contact", "location", "name", "stay", "food", "closed", "other"]
ReportStatus = Literal["open", "resolved", "dismissed"]


class ReportIn(BaseModel):
    kind: ReportKind
    place_id: int | None = None  # required for a correction
    topic: ReportTopic = "other"
    message: str = Field(min_length=5, max_length=2000)
    place_name: str | None = Field(default=None, max_length=200)  # required for a new place
    area: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _shape(self):
        if self.kind == "correction" and self.place_id is None:
            raise ValueError("Say which place the correction is about")
        if self.kind == "new_place" and not (self.place_name or "").strip():
            raise ValueError("Enter the name of the missing place")
        return self


class ReportOut(BaseModel):
    """What the pilgrim sees of their own report."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    place_id: int | None = None
    place_title: str | None = None  # the place's name now, or the suggested name
    topic: str
    message: str
    area: str | None = None
    status: str
    curator_note: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None


class AdminReportOut(ReportOut):
    reporter_name: str | None = None
    reporter_contact: str | None = None  # email or phone, so the curator can follow up
    place_status: str | None = None
    lead_id: int | None = None


class ReportReview(BaseModel):
    status: ReportStatus
    curator_note: str | None = Field(default=None, max_length=1000)


# ---------------------------------------------------------------------------------------------
# User management and the activity log (admins only)
# ---------------------------------------------------------------------------------------------

Role = Literal["pilgrim", "curator", "admin"]


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    role: str = "pilgrim"
    faith: str | None = None
    sect: str | None = None
    language: str = "en"
    created_at: datetime | None = None
    last_login_at: datetime | None = None
    login_count: int = 0
    is_locked: bool = False
    locked_reason: str | None = None
    locked_at: datetime | None = None
    login_blocked_until: datetime | None = None  # too many wrong OTPs
    saved_count: int = 0
    reports_count: int = 0
    checks_count: int = 0

    @field_validator("login_count", "is_locked", "role", "language", mode="before")
    @classmethod
    def _defaults_for_old_rows(cls, v, info):
        if v is None:
            return {"login_count": 0, "is_locked": False, "role": "pilgrim", "language": "en"}[info.field_name]
        return v


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: int | None = None
    actor_name: str | None = None
    action: str
    target_type: str
    target_id: int | None = None
    target_label: str | None = None
    details: dict | None = None
    created_at: datetime


class AuditPage(BaseModel):
    entries: list[AuditOut]
    next_before_id: int | None = None  # pass as before_id for the next page; None = no more


class AdminUserDetail(AdminUserOut):
    recent_reports: list[ReportOut] = []
    activity_on: list[AuditOut] = []  # what was done to this account
    activity_by: list[AuditOut] = []  # what this user did in the admin section


class UserCreate(BaseModel):
    """Add a team member (or anyone) before their first login. They log in with OTP as usual."""

    identifier: str = Field(min_length=3, max_length=255)  # email or phone
    name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role = "curator"


class AdminUserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    faith: str | None = Field(default=None, max_length=40)
    sect: str | None = Field(default=None, max_length=40)
    language: str | None = Field(default=None, pattern=LANGUAGE_PATTERN)
    role: Role | None = None


class LockIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class DeleteUserIn(BaseModel):
    confirm: Literal["DELETE"]  # typed by the admin, so an account is never deleted by accident
