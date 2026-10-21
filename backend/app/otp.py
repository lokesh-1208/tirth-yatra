import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .config import get_settings
from .models import OtpCode, User

settings = get_settings()
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class InvalidIdentifier(ValueError):
    pass


def normalize_identifier(raw: str) -> tuple[str, str]:
    """Return (kind, value) where kind is 'email' or 'phone'.

    Phones become +E.164; a bare 10-digit number is assumed to be Indian (+91).
    """
    raw = raw.strip()
    if "@" in raw:
        if not _EMAIL_RE.match(raw):
            raise InvalidIdentifier("Enter a valid email address")
        return "email", raw.lower()
    cleaned = re.sub(r"[\s\-()]", "", raw)
    digits = re.sub(r"\D", "", cleaned)
    if cleaned.startswith("+"):
        num = "+" + digits
    elif len(digits) == 10:
        num = "+91" + digits
    elif len(digits) == 11 and digits.startswith("0"):
        num = "+91" + digits[1:]
    else:
        num = "+" + digits
    if not re.fullmatch(r"\+\d{10,14}", num):
        raise InvalidIdentifier("Enter a valid email or phone number")
    return "phone", num


def _hash(identifier: str, code: str) -> str:
    return hashlib.sha256(f"{settings.secret_key}:{identifier}:{code}".encode()).hexdigest()


def is_test_identifier(identifier: str) -> bool:
    if not settings.enable_test_user:
        return False
    return identifier in (settings.test_user_email, settings.test_user_phone) or identifier.endswith(
        "@" + settings.test_email_domain
    )


def send_otp(identifier: str, code: str) -> None:
    """Delivery hook. Swap for an SMS (MSG91/Twilio) / email provider in production."""
    print(f"[OTP] {identifier}: {code}")


def issue_otp(db: Session, identifier: str) -> int:
    """Create and 'send' an OTP. Raises ValueError(seconds_to_wait) when resent too soon."""
    now = datetime.utcnow()
    is_test = is_test_identifier(identifier)
    last = db.query(OtpCode).filter(OtpCode.identifier == identifier).order_by(OtpCode.id.desc()).first()
    if last and not is_test:
        wait = settings.otp_resend_seconds - (now - last.created_at).total_seconds()
        if wait > 0:
            raise ValueError(int(wait) + 1)
    db.query(OtpCode).filter(OtpCode.identifier == identifier).delete()
    code = settings.test_user_otp if is_test else f"{secrets.randbelow(10**6):06d}"
    db.add(
        OtpCode(
            identifier=identifier,
            code_hash=_hash(identifier, code),
            expires_at=now + timedelta(minutes=settings.otp_expire_minutes),
        )
    )
    db.commit()
    if not is_test:
        send_otp(identifier, code)
    return settings.otp_expire_minutes * 60


def check_otp(db: Session, identifier: str, code: str) -> bool:
    row = db.query(OtpCode).filter(OtpCode.identifier == identifier).order_by(OtpCode.id.desc()).first()
    if not row or row.expires_at < datetime.utcnow() or row.attempts >= settings.otp_max_attempts:
        return False
    row.attempts += 1
    ok = hmac.compare_digest(row.code_hash, _hash(identifier, code.strip()))
    if ok:
        db.delete(row)
    db.commit()
    return ok


def ensure_test_user(db: Session) -> None:
    if not settings.enable_test_user:
        return
    if not db.query(User).filter(User.email == settings.test_user_email).first():
        db.add(
            User(
                email=settings.test_user_email,
                phone=settings.test_user_phone,
                name="Test Yatri",
                faith="jain",
                sect="digambar",
            )
        )
        db.commit()
