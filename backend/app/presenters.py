"""Turning Place rows into API responses: languages, public contacts, photo URLs."""
from .config import get_settings
from .models import Place, PlacePhoto
from .schemas import PlaceOut, PublicContact

settings = get_settings()

# Text fields that can be translated. The place's own columns hold settings.default_language.
TRANSLATABLE = ("name", "description", "how_to_reach", "darshan_timings", "stay_info", "food_info", "landmarks")


def photo_url(photo: PlacePhoto) -> str:
    """Path under the API host; the app prefixes its API URL."""
    return f"/uploads/{photo.file_name}"


def cover_url(place: Place) -> str | None:
    cover = next((p for p in place.photos if p.is_cover), None)
    return photo_url(cover) if cover else place.photo_url


def pick_language(requested: str | None, user_language: str | None) -> str:
    return (requested or user_language or settings.default_language).strip() or settings.default_language


def localized_text(place: Place, language: str) -> tuple[dict[str, str | None], str]:
    """Translatable fields in `language`, each falling back to the default language when missing.

    Returns (fields, language_used): language_used is `language` when a translation row exists.
    """
    base = {f: getattr(place, f) for f in TRANSLATABLE}
    if language == settings.default_language:
        return base, language
    tr = next((t for t in place.translations if t.language == language), None)
    if not tr:
        return base, settings.default_language
    return {f: (getattr(tr, f) or base[f]) for f in TRANSLATABLE}, language


def public_contacts(place: Place) -> list[PublicContact]:
    return [
        PublicContact(name=c.name, role=c.role, phone=c.phone)
        for c in place.contacts
        if c.show_publicly and c.consent_on
    ]


def place_out(place: Place, saved_ids: set[int], language: str) -> PlaceOut:
    text, used = localized_text(place, language)
    contacts = public_contacts(place)
    computed = {"contacts", "language", "is_saved", "contact_phone", "photo_url", *TRANSLATABLE}
    data = {f: getattr(place, f) for f in PlaceOut.model_fields if f not in computed}
    return PlaceOut(
        **data,
        **text,
        language=used,
        contacts=contacts,
        # Older single-number field: first public contact, else the legacy column.
        contact_phone=contacts[0].phone if contacts else place.contact_phone,
        photo_url=cover_url(place),
        is_saved=place.id in saved_ids,
    )
