from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, index=True, nullable=True)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    faith: Mapped[str | None] = mapped_column(String(40), nullable=True)
    sect: Mapped[str | None] = mapped_column(String(40), nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="en")
    # "pilgrim" (default), "curator" (places, reports, leads) or "admin" (everything a curator can do,
    # plus users and the activity log). NULL on older rows = pilgrim.
    role: Mapped[str | None] = mapped_column(String(20), nullable=True, default="pilgrim")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    # --- account controls ---
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    login_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    # Bumped to sign the user out everywhere: tokens carry the version they were issued with.
    token_version: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    is_locked: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    locked_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    locked_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    @property
    def is_curator(self) -> bool:
        """Can use the admin section (places, reports, leads). Admins can too."""
        return self.role in ("curator", "admin")

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    saved: Mapped[list["SavedPlace"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class LoginThrottle(Base):
    """Wrong-OTP counter per login identifier. Too many wrong codes block logins for a while."""

    __tablename__ = "login_throttles"

    identifier: Mapped[str] = mapped_column(String(255), primary_key=True)
    failures: Mapped[int] = mapped_column(Integer, default=0)
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OtpCode(Base):
    """One-time login code. `identifier` is a normalized email or +E.164 phone."""

    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    identifier: Mapped[str] = mapped_column(String(255), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    faith: Mapped[str] = mapped_column(String(40), default="jain", index=True)
    sect: Mapped[str | None] = mapped_column(String(40), nullable=True)  # digambar / shvetambar / all
    kind: Mapped[str] = mapped_column(String(40), default="tirth")  # tirth, atishay_kshetra, temple, dharamshala
    deity: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    state: Mapped[str | None] = mapped_column(String(80), nullable=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    how_to_reach: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Detail tabs in the app. Left empty until verified; the app shows "Not added yet".
    darshan_timings: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    stay_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    food_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    verified_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # --- Phase 1 (admin) ---
    # draft -> in_review -> live; hidden takes a place off the app. Only "live" places reach pilgrims.
    # NULL on rows from before Phase 1 is backfilled to "live" at startup (see database.backfill_defaults).
    status: Mapped[str | None] = mapped_column(String(20), nullable=True, default="draft", index=True)
    verified_method: Mapped[str | None] = mapped_column(String(30), nullable=True)  # call / visit / local_reference
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Directions that work without network ("turn left after the river bridge").
    landmarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    recheck_due: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.utcnow, onupdate=datetime.utcnow)

    saved_by: Mapped[list["SavedPlace"]] = relationship(back_populates="place", cascade="all, delete-orphan")
    translations: Mapped[list["PlaceTranslation"]] = relationship(back_populates="place", cascade="all, delete-orphan")
    contacts: Mapped[list["PlaceContact"]] = relationship(
        back_populates="place", cascade="all, delete-orphan", order_by="PlaceContact.id"
    )
    photos: Mapped[list["PlacePhoto"]] = relationship(
        back_populates="place", cascade="all, delete-orphan", order_by="PlacePhoto.id"
    )
    checks: Mapped[list["Verification"]] = relationship(
        back_populates="place", cascade="all, delete-orphan", order_by="Verification.id.desc()"
    )


class SavedPlace(Base):
    __tablename__ = "saved_places"
    __table_args__ = (UniqueConstraint("user_id", "place_id", name="uq_user_place"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="saved")
    place: Mapped[Place] = relationship(back_populates="saved_by")


class PlaceTranslation(Base):
    """A place's text in one more language. The place's own columns are in settings.default_language."""

    __tablename__ = "place_translations"
    __table_args__ = (UniqueConstraint("place_id", "language", name="uq_place_language"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(10))
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    how_to_reach: Mapped[str | None] = mapped_column(Text, nullable=True)
    darshan_timings: Mapped[str | None] = mapped_column(Text, nullable=True)
    stay_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    food_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    landmarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    place: Mapped[Place] = relationship(back_populates="translations")


class PlaceContact(Base):
    """A local contact person. Personal data: listed only with recorded consent."""

    __tablename__ = "place_contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(40), default="manager")  # manager / pujari / trustee / other
    phone: Mapped[str] = mapped_column(String(20))
    consent_on: Mapped[date | None] = mapped_column(Date, nullable=True)  # when they agreed to be listed
    show_publicly: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    place: Mapped[Place] = relationship(back_populates="contacts")


class PlacePhoto(Base):
    """A photo uploaded by the team. Never a photo of the deity (confirmed on upload)."""

    __tablename__ = "place_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    file_name: Mapped[str] = mapped_column(String(200))  # stored under settings.upload_dir
    caption: Mapped[str | None] = mapped_column(String(200), nullable=True)
    photographer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    permission_note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False)
    uploaded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    place: Mapped[Place] = relationship(back_populates="photos")


class Verification(Base):
    """One check of a place's details (the proof behind the "verified" badge)."""

    __tablename__ = "verifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    method: Mapped[str] = mapped_column(String(30))  # call / visit / local_reference
    checked_with: Mapped[str | None] = mapped_column(String(200), nullable=True)  # person and role
    confirmed: Mapped[str | None] = mapped_column(Text, nullable=True)  # what was confirmed
    checked_on: Mapped[date] = mapped_column(Date)
    recheck_after_months: Mapped[int] = mapped_column(Integer, default=6)
    checked_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    checked_by_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    place: Mapped[Place] = relationship(back_populates="checks")


class Lead(Base):
    """A place heard of somewhere, to be called / visited before it becomes a draft place."""

    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    area: Mapped[str | None] = mapped_column(String(200), nullable=True)  # town / district
    source: Mapped[str | None] = mapped_column(String(300), nullable=True)  # where you heard of it
    status: Mapped[str] = mapped_column(String(20), default="to_call", index=True)  # to_call / called / drafted / rejected
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    place_id: Mapped[int | None] = mapped_column(ForeignKey("places.id", ondelete="SET NULL"), nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Report(Base):
    """Something a pilgrim sent: a correction to a place, or a place that is missing.

    Nothing a pilgrim sends changes the app directly: a curator reviews it first.
    """

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(20))  # correction / new_place
    place_id: Mapped[int | None] = mapped_column(ForeignKey("places.id", ondelete="SET NULL"), nullable=True, index=True)
    topic: Mapped[str] = mapped_column(String(20), default="other")  # timings / contact / location / name / stay / food / closed / other
    message: Mapped[str] = mapped_column(Text)
    place_name: Mapped[str | None] = mapped_column(String(200), nullable=True)  # for a new place
    area: Mapped[str | None] = mapped_column(String(200), nullable=True)  # town / district, for a new place
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open / resolved / dismissed
    curator_note: Mapped[str | None] = mapped_column(Text, nullable=True)  # shown to the pilgrim
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class AuditLog(Base):
    """Who did what in the admin section, and when. Rows are never edited."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)  # kept if the user is deleted
    action: Mapped[str] = mapped_column(String(60), index=True)  # e.g. place.status, user.lock
    target_type: Mapped[str] = mapped_column(String(20), index=True)  # place / user / lead / report
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    target_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
