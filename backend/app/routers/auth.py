from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..otp import InvalidIdentifier, check_otp, issue_otp, normalize_identifier
from ..schemas import OtpRequest, OtpSent, OtpVerify, Token, UserOut, UserUpdate
from ..security import create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize(raw: str) -> tuple[str, str]:
    try:
        return normalize_identifier(raw)
    except InvalidIdentifier as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))


@router.post("/otp/request", response_model=OtpSent)
def request_otp(data: OtpRequest, db: Session = Depends(get_db)):
    _, identifier = _normalize(data.identifier)
    try:
        expires = issue_otp(db, identifier)
    except ValueError as e:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Please wait {e.args[0]}s before requesting another OTP")
    return OtpSent(message="OTP sent", identifier=identifier, expires_in_seconds=expires)


@router.post("/otp/verify", response_model=Token)
def verify_otp(data: OtpVerify, db: Session = Depends(get_db)):
    kind, identifier = _normalize(data.identifier)
    if not check_otp(db, identifier, data.otp):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired OTP")
    column = User.email if kind == "email" else User.phone
    user = db.query(User).filter(column == identifier).first()
    is_new = user is None
    if is_new:  # first successful OTP creates the account
        user = User(**{kind: identifier})
        db.add(user)
        db.commit()
        db.refresh(user)
    return Token(access_token=create_access_token(user.id), user=UserOut.model_validate(user), is_new_user=is_new)


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
