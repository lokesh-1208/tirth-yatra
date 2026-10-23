"""Pilgrim reports: "Report wrong info" on a place, and "Missing a place?".

Reports only go into the curators' review queue; nothing a pilgrim sends changes the app directly.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Place, Report, User
from ..schemas import ReportIn, ReportOut
from ..security import get_current_user

settings = get_settings()
router = APIRouter(prefix="/reports", tags=["reports"])


def report_title(db: Session, report: Report) -> str | None:
    if report.place_id:
        place = db.get(Place, report.place_id)
        if place:
            return place.name
    return report.place_name


def report_out(db: Session, report: Report) -> ReportOut:
    out = ReportOut.model_validate(report)
    out.place_title = report_title(db, report)
    return out


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def send_report(data: ReportIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    since = datetime.utcnow() - timedelta(days=1)
    sent_today = db.query(Report).filter(Report.user_id == user.id, Report.created_at >= since).count()
    if sent_today >= settings.max_reports_per_day:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"You can send up to {settings.max_reports_per_day} reports a day. Thank you for helping!",
        )

    if data.kind == "correction":
        place = db.get(Place, data.place_id)
        if not place or place.status != "live":
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
        duplicate = (
            db.query(Report)
            .filter(
                Report.user_id == user.id,
                Report.place_id == place.id,
                Report.topic == data.topic,
                Report.status == "open",
            )
            .first()
        )
        if duplicate:
            raise HTTPException(status.HTTP_409_CONFLICT, "You already reported this. We are looking into it.")
        report = Report(user_id=user.id, kind="correction", place_id=place.id, topic=data.topic, message=data.message.strip())
    else:
        report = Report(
            user_id=user.id,
            kind="new_place",
            topic="other",
            message=data.message.strip(),
            place_name=(data.place_name or "").strip(),
            area=(data.area or "").strip() or None,
        )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report_out(db, report)


@router.get("/mine", response_model=list[ReportOut])
def my_reports(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Report).filter(Report.user_id == user.id).order_by(Report.id.desc()).all()
    return [report_out(db, r) for r in rows]
