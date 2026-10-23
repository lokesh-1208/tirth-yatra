from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..otp import (
    ROLE_RANK,
    InvalidIdentifier,
    blocked_until,
    check_otp,
    clear_failures,
    issue_otp,
    normalize_identifier,
    record_failure,
    role_for_identifier,
)
from ..schemas import OtpRequest, OtpSent, OtpVerify, Token, UserOut, UserUpdate
from ..security import create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

LOCKED_MESSAGE = "This account is locked. Please contact the Tirth Yatra team."


def _refuse_if_blocked(db: Session, identifier: str) -> None:
    until = blocked_until(db, identifier)
    if until:
        minutes = max(1, int((until - datetime.utcnow()).total_seconds() // 60) + 1)
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many wrong codes. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
        )


def _normalize(raw: str) -> tuple[str, str]:
    try:
        return normalize_identifier(raw)
    except InvalidIdentifier as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))


@router.post("/otp/request", response_model=OtpSent)
def request_otp(data: OtpRequest, db: Session = Depends(get_db)):
    _, identifier = _normalize(data.identifier)
    _refuse_if_blocked(db, identifier)
    try:
        expires = issue_otp(db, identifier)
    except ValueError as e:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Please wait {e.args[0]}s before requesting another OTP")
    return OtpSent(message="OTP sent", identifier=identifier, expires_in_seconds=expires)


@router.post("/otp/verify", response_model=Token)
def verify_otp(data: OtpVerify, db: Session = Depends(get_db)):
    kind, identifier = _normalize(data.identifier)
    _refuse_if_blocked(db, identifier)
    if not check_otp(db, identifier, data.otp):
        record_failure(db, identifier)
        _refuse_if_blocked(db, identifier)  # that was the last allowed try
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired OTP")
    clear_failures(db, identifier)
    column = User.email if kind == "email" else User.phone
    user = db.query(User).filter(column == identifier).first()
    if user and user.is_locked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, LOCKED_MESSAGE)
    is_new = user is None
    if is_new:  # first successful OTP creates the account
        user = User(**{kind: identifier})
        db.add(user)
        db.commit()
        db.refresh(user)
    configured = role_for_identifier(identifier)
    if ROLE_RANK[configured] > ROLE_RANK[user.role]:  # only ever upgrades, never demotes
        user.role = configured
    user.last_login_at = datetime.utcnow()
    user.login_count = (user.login_count or 0) + 1
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(user), user=UserOut.model_validate(user), is_new_user=is_new)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(data: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
