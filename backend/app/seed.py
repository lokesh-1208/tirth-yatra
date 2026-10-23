"""Sample data so the app has something to show.

IMPORTANT: these are SAMPLE entries with approximate coordinates and generic text.
They are all marked verified=False. Replace them with your own hand-verified records
and only set verified=True (plus verified_by / verified_on) after confirming by call
or local reference.
"""
from sqlalchemy.orm import Session

from .models import Place

SAMPLE_PLACES = [
    dict(
        name="Pisanhari Ki Madiya (sample entry)",
        faith="jain", sect="digambar", kind="tirth",
        deity="To be verified", city="Jabalpur", state="Madhya Pradesh",
        latitude=23.1500, longitude=79.8800,
        description="Sample entry. Replace with verified details.",
        how_to_reach="Sample entry. Add verified directions by car and public transport.",
    ),
    dict(
        name="Jain Temple, Narsinghpur (sample entry)",
        faith="jain", sect="all", kind="temple",
        deity="To be verified", city="Narsinghpur", state="Madhya Pradesh",
        latitude=22.9480, longitude=79.1940,
        description="Sample entry. Replace with verified details.",
        how_to_reach="Sample entry.",
    ),
    dict(
        name="Jain Temple, Hoshangabad (sample entry)",
        faith="jain", sect="all", kind="temple",
        deity="To be verified", city="Hoshangabad", state="Madhya Pradesh",
        latitude=22.7530, longitude=77.7270,
        description="Sample entry. Replace with verified details.",
        how_to_reach="Sample entry.",
    ),
    dict(
        name="Siddhodaya Siddhakshetra, Nemawar (sample entry)",
        faith="jain", sect="digambar", kind="tirth",
        deity="To be verified", city="Nemawar", state="Madhya Pradesh",
        latitude=22.4350, longitude=76.8650,
        description="Sample entry. Replace with verified details.",
        how_to_reach="Sample entry.",
    ),
    dict(
        name="Jain Temple, Bhopal (sample entry)",
        faith="jain", sect="all", kind="temple",
        deity="To be verified", city="Bhopal", state="Madhya Pradesh",
        latitude=23.2599, longitude=77.4126,
        description="Sample entry. Replace with verified details.",
        how_to_reach="Sample entry.",
    ),
    dict(
        name="Jain Temple, Ujjain (sample entry)",
        faith="jain", sect="shvetambar", kind="temple",
        deity="To be verified", city="Ujjain", state="Madhya Pradesh",
        latitude=23.1765, longitude=75.7885,
        description="Sample entry. Replace with verified details.",
        how_to_reach="Sample entry.",
    ),
]


def seed_places(db: Session) -> int:
    if db.query(Place).count() > 0:
        return 0
    for item in SAMPLE_PLACES:
        db.add(Place(**item, verified=False, status="live"))  # samples stay visible until you hide them
    db.commit()
    return len(SAMPLE_PLACES)
