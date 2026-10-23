"""Admin section API: only users with role "curator" may call it.

Curators add and edit places, record checks (the proof behind "verified"), manage contacts,
photos and translations, publish places to the app, and keep a list of leads to call.
"""
import calendar
import re
import secrets
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Lead, Place, PlaceContact, PlacePhoto, PlaceTranslation, User, Verification
from ..otp import InvalidIdentifier, normalize_identifier
from ..presenters import cover_url, photo_url
from ..schemas import (
    LANGUAGE_PATTERN,
    AdminPlaceOut,
    AdminPlaceSummary,
    AdminSummary,
    CheckIn,
    CheckOut,
    ContactIn,
    ContactOut,
    ContactUpdate,
    LeadIn,
    LeadOut,
    LeadStatus,
    LeadUpdate,
    PhotoOut,
    PhotoUpdate,
    PlaceCreate,
    PlaceStatus,
    PlaceUpdate,
    StatusChange,
    TranslationIn,
    TranslationOut,
)
from ..security import get_current_user

settings = get_settings()

ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
# First bytes of each allowed type, so a renamed file of another kind is refused.
_MAGIC = {".jpg": (b"\xff\xd8\xff",), ".png": (b"\x89PNG\r\n\x1a\n",), ".webp": (b"RIFF",)}


def require_curator(user: User = Depends(get_current_user)) -> User:
    if not user.is_curator:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only curators can use the admin section")
    return user


router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_curator)])


# --- helpers -----------------------------------------------------------------------------------


def add_months(d: date, months: int) -> date:
    """Same day `months` later, clamped to the month's last day (31 Jan + 1 month = 28/29 Feb)."""
    m = d.month - 1 + months
    year, month = d.year + m // 12, m % 12 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def _get_place(db: Session, place_id: int) -> Place:
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    return place


def _summary(place: Place) -> AdminPlaceSummary:
    out = AdminPlaceSummary.model_validate(place)
    out.status = place.status or "live"
    out.cover_url = cover_url(place)
    return out


def _photo_out(photo: PlacePhoto) -> PhotoOut:
    return PhotoOut(
        id=photo.id,
        url=photo_url(photo),
        caption=photo.caption,
        photographer=photo.photographer,
        permission_note=photo.permission_note,
        is_cover=photo.is_cover,
        created_at=photo.created_at,
    )


def _full(place: Place) -> AdminPlaceOut:
    base = _summary(place).model_dump()
    extra = {f: getattr(place, f) for f in AdminPlaceOut.model_fields if f not in base and hasattr(place, f)}
    for skip in ("translations", "contacts", "photos", "checks"):
        extra.pop(skip, None)
    return AdminPlaceOut(
        **base,
        **extra,
        default_language=settings.default_language,
        translations=[TranslationOut.model_validate(t) for t in sorted(place.translations, key=lambda t: t.language)],
        contacts=[ContactOut.model_validate(c) for c in place.contacts],
        photos=[_photo_out(p) for p in place.photos],
        checks=[CheckOut.model_validate(c) for c in place.checks],
    )


def _normalize_phone(raw: str) -> str:
    try:
        kind, value = normalize_identifier(raw)
    except InvalidIdentifier:
        kind, value = "", ""
    if kind != "phone":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter a valid phone number")
    return value


def _check_language(language: str) -> str:
    if not re.fullmatch(LANGUAGE_PATTERN, language):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Language must be a code like hi, mr or gu")
    if language == settings.default_language:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"{language} is the default language: edit the place's own fields instead",
        )
    return language


# --- summary -----------------------------------------------------------------------------------


@router.get("/summary", response_model=AdminSummary)
def summary(db: Session = Depends(get_db)):
    counts = {s: 0 for s in ("draft", "in_review", "live", "hidden")}
    for st, n in db.query(Place.status, func.count(Place.id)).group_by(Place.status).all():
        counts[st or "live"] = counts.get(st or "live", 0) + n
    due = _due_query(db).order_by(Place.recheck_due.is_(None).desc(), Place.recheck_due).all()
    open_leads = db.query(Lead).filter(Lead.status.in_(("to_call", "called"))).count()
    recent = (
        db.query(Verification, Place.name)
        .join(Place, Place.id == Verification.place_id)
        .order_by(Verification.id.desc())
        .limit(5)
        .all()
    )
    return AdminSummary(
        counts=counts,
        recheck_due=len(due),
        open_leads=open_leads,
        due_places=[_summary(p) for p in due[:10]],
        recent_checks=[
            {"place_id": v.place_id, "place_name": name, "method": v.method, "checked_on": v.checked_on.isoformat(),
             "checked_by_name": v.checked_by_name}
            for v, name in recent
        ],
    )


def _due_query(db: Session):
    """Live places never checked, or whose re-check date is today or earlier."""
    return db.query(Place).filter(
        Place.status == "live",
        (Place.recheck_due.is_(None)) | (Place.recheck_due <= date.today()),
    )


# --- places ------------------------------------------------------------------------------------


@router.get("/places", response_model=list[AdminPlaceSummary])
def list_places(
    q: str | None = Query(None, description="Search name, city or district"),
    status_: PlaceStatus | None = Query(None, alias="status"),
    recheck_due: bool = False,
    db: Session = Depends(get_db),
):
    query = _due_query(db) if recheck_due else db.query(Place)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(Place.name.ilike(like) | Place.city.ilike(like) | Place.district.ilike(like))
    if status_:
        query = query.filter(Place.status == status_)
    return [_summary(p) for p in query.order_by(Place.name).all()]


@router.post("/places", response_model=AdminPlaceOut, status_code=status.HTTP_201_CREATED)
def create_place(data: PlaceCreate, db: Session = Depends(get_db), user: User = Depends(require_curator)):
    lead = None
    if data.lead_id is not None:
        lead = db.get(Lead, data.lead_id)
        if not lead:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
        if lead.place_id:
            raise HTTPException(status.HTTP_409_CONFLICT, "This lead already has a draft place")
    place = Place(**data.model_dump(exclude={"lead_id"}), status="draft", verified=False, created_by_id=user.id)
    db.add(place)
    db.flush()
    if lead:
        lead.place_id = place.id
        lead.status = "drafted"
    db.commit()
    db.refresh(place)
    return _full(place)


@router.get("/places/{place_id}", response_model=AdminPlaceOut)
def get_place(place_id: int, db: Session = Depends(get_db)):
    return _full(_get_place(db, place_id))


@router.patch("/places/{place_id}", response_model=AdminPlaceOut)
def update_place(place_id: int, data: PlaceUpdate, db: Session = Depends(get_db)):
    place = _get_place(db, place_id)
    changes = data.model_dump(exclude_unset=True)
    for field in ("name", "latitude", "longitude", "kind", "faith"):
        if field in changes and changes[field] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{field} cannot be empty")
    for field, value in changes.items():
        setattr(place, field, value)
    db.commit()
    db.refresh(place)
    return _full(place)


@router.post("/places/{place_id}/status", response_model=AdminPlaceOut)
def change_status(place_id: int, data: StatusChange, db: Session = Depends(get_db)):
    place = _get_place(db, place_id)
    if data.status == "live" and not place.checks:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Log at least one check (call, visit or local reference) before making it live"
        )
    place.status = data.status
    db.commit()
    db.refresh(place)
    return _full(place)


# --- translations ------------------------------------------------------------------------------


@router.put("/places/{place_id}/translations/{language}", response_model=AdminPlaceOut)
def put_translation(place_id: int, language: str, data: TranslationIn, db: Session = Depends(get_db)):
    place = _get_place(db, place_id)
    language = _check_language(language)
    row = next((t for t in place.translations if t.language == language), None)
    if not row:
        row = PlaceTranslation(place_id=place.id, language=language)
        db.add(row)
    for field, value in data.model_dump().items():
        setattr(row, field, (value or "").strip() or None)
    db.commit()
    db.refresh(place)
    return _full(place)


@router.delete("/places/{place_id}/translations/{language}", response_model=AdminPlaceOut)
def delete_translation(place_id: int, language: str, db: Session = Depends(get_db)):
    place = _get_place(db, place_id)
    row = next((t for t in place.translations if t.language == language), None)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No text in that language")
    db.delete(row)
    db.commit()
    db.refresh(place)
    return _full(place)


# --- contacts ----------------------------------------------------------------------------------


@router.post("/places/{place_id}/contacts", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
def add_contact(place_id: int, data: ContactIn, db: Session = Depends(get_db)):
    place = _get_place(db, place_id)
    contact = PlaceContact(place_id=place.id, **{**data.model_dump(), "phone": _normalize_phone(data.phone)})
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


def _get_contact(db: Session, place_id: int, contact_id: int) -> PlaceContact:
    contact = db.get(PlaceContact, contact_id)
    if not contact or contact.place_id != place_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact not found")
    return contact


@router.patch("/places/{place_id}/contacts/{contact_id}", response_model=ContactOut)
def update_contact(place_id: int, contact_id: int, data: ContactUpdate, db: Session = Depends(get_db)):
    contact = _get_contact(db, place_id, contact_id)
    changes = data.model_dump(exclude_unset=True)
    if "phone" in changes:
        changes["phone"] = _normalize_phone(changes["phone"] or "")
    for field in ("name", "role", "show_publicly"):
        if field in changes and changes[field] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{field} cannot be empty")
    for field, value in changes.items():
        setattr(contact, field, value)
    if contact.show_publicly and not contact.consent_on:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Record when the person agreed to be listed before showing them to pilgrims",
        )
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/places/{place_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(place_id: int, contact_id: int, db: Session = Depends(get_db)):
    """Removing a contact deletes their details (they asked to be removed, or they changed)."""
    db.delete(_get_contact(db, place_id, contact_id))
    db.commit()


# --- photos ------------------------------------------------------------------------------------


@router.post("/places/{place_id}/photos", response_model=PhotoOut, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    place_id: int,
    file: UploadFile = File(...),
    no_deity_confirmed: bool = Form(False, description="The photo shows the mandir or kshetra, never the deity"),
    caption: str | None = Form(None, max_length=200),
    photographer: str | None = Form(None, max_length=120),
    permission_note: str | None = Form(None, max_length=300),
    make_cover: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Depends(require_curator),
):
    place = _get_place(db, place_id)
    if not no_deity_confirmed:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Confirm the photo shows no deity image")
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload a JPEG, PNG or WebP image")
    limit = int(settings.max_upload_mb * 1024 * 1024)
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Photo must be {settings.max_upload_mb:g} MB or smaller")
    if not content.startswith(_MAGIC[ext]):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "The file is not a valid image")

    folder = Path(settings.upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    file_name = f"place-{place.id}-{secrets.token_hex(8)}{ext}"  # never trust the uploaded name
    (folder / file_name).write_bytes(content)

    first = not place.photos
    photo = PlacePhoto(
        place_id=place.id,
        file_name=file_name,
        caption=caption,
        photographer=photographer,
        permission_note=permission_note,
        is_cover=False,
        uploaded_by_id=user.id,
    )
    db.add(photo)
    db.flush()
    if make_cover or first:
        _set_cover(place, photo)
    db.commit()
    db.refresh(photo)
    return _photo_out(photo)


def _set_cover(place: Place, photo: PlacePhoto | None) -> None:
    for p in place.photos:
        p.is_cover = photo is not None and p.id == photo.id
    if photo is not None:
        photo.is_cover = True
    place.photo_url = photo_url(photo) if photo else None


def _get_photo(db: Session, place_id: int, photo_id: int) -> PlacePhoto:
    photo = db.get(PlacePhoto, photo_id)
    if not photo or photo.place_id != place_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    return photo


@router.patch("/places/{place_id}/photos/{photo_id}", response_model=PhotoOut)
def update_photo(place_id: int, photo_id: int, data: PhotoUpdate, db: Session = Depends(get_db)):
    place = _get_place(db, place_id)
    photo = _get_photo(db, place_id, photo_id)
    changes = data.model_dump(exclude_unset=True)
    make_cover = changes.pop("is_cover", None)
    for field, value in changes.items():
        setattr(photo, field, value)
    if make_cover is True:
        _set_cover(place, photo)
    elif make_cover is False and photo.is_cover:
        _set_cover(place, None)  # no cover: pilgrims see the auto cover
    db.commit()
    db.refresh(photo)
    return _photo_out(photo)


@router.delete("/places/{place_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(place_id: int, photo_id: int, db: Session = Depends(get_db)):
    place = _get_place(db, place_id)
    photo = _get_photo(db, place_id, photo_id)
    was_cover = photo.is_cover
    (Path(settings.upload_dir) / photo.file_name).unlink(missing_ok=True)
    place.photos.remove(photo)
    db.delete(photo)
    if was_cover:
        _set_cover(place, None)
    db.commit()


# --- checks ------------------------------------------------------------------------------------


@router.post("/places/{place_id}/checks", response_model=AdminPlaceOut, status_code=status.HTTP_201_CREATED)
def log_check(place_id: int, data: CheckIn, db: Session = Depends(get_db), user: User = Depends(require_curator)):
    place = _get_place(db, place_id)
    checked_on = data.checked_on or date.today()
    if checked_on > date.today():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A check cannot be dated in the future")
    who = user.name or user.email or user.phone or f"user {user.id}"
    db.add(
        Verification(
            place_id=place.id,
            method=data.method,
            checked_with=data.checked_with,
            confirmed=data.confirmed,
            checked_on=checked_on,
            recheck_after_months=data.recheck_after_months,
            checked_by_id=user.id,
            checked_by_name=who,
        )
    )
    # The newest check (by date) decides the badge and the next re-check date.
    if not place.verified_on or checked_on >= place.verified_on:
        place.verified = True
        place.verified_by = who
        place.verified_on = checked_on
        place.verified_method = data.method
        place.recheck_due = add_months(checked_on, data.recheck_after_months)
    db.commit()
    db.refresh(place)
    return _full(place)


# --- leads -------------------------------------------------------------------------------------


@router.get("/leads", response_model=list[LeadOut])
def list_leads(status_: LeadStatus | None = Query(None, alias="status"), db: Session = Depends(get_db)):
    query = db.query(Lead)
    if status_:
        query = query.filter(Lead.status == status_)
    return query.order_by(Lead.updated_at.desc(), Lead.id.desc()).all()


@router.post("/leads", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def add_lead(data: LeadIn, db: Session = Depends(get_db), user: User = Depends(require_curator)):
    lead = Lead(**data.model_dump(), created_by_id=user.id)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.patch("/leads/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: int, data: LeadUpdate, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("status") == "drafted" and not lead.place_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Create the draft place from this lead to mark it drafted")
    if "name" in changes and changes["name"] is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "name cannot be empty")
    for field, value in changes.items():
        setattr(lead, field, value)
    db.commit()
    db.refresh(lead)
    return lead
