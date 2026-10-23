import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .config import get_settings
from .models import LoginThrottle, OtpCode, User

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
    return identifier in (
        settings.test_user_email,
        settings.test_user_phone,
        settings.test_curator_email,
        settings.test_admin_email,
    ) or identifier.endswith(
        "@" + settings.test_email_domain
    )


def _identifiers(raw_list: str) -> set[str]:
    out: set[str] = set()
    for raw in raw_list.split(","):
        if raw.strip():
            try:
                out.add(normalize_identifier(raw)[1])
            except InvalidIdentifier:
                pass
    return out


def curator_identifiers() -> set[str]:
    return _identifiers(settings.curator_identifiers)


def role_for_identifier(identifier: str) -> str | None:
    """Role this (normalized) login identifier is configured for: "admin", "curator" or None."""
    if identifier in _identifiers(settings.admin_identifiers):
        return "admin"
    if identifier in curator_identifiers():
        return "curator"
    if settings.enable_test_user:
        local, _, domain = identifier.partition("@")
        qa = domain == settings.test_email_domain
        if identifier == settings.test_admin_email or (qa and local.startswith("admin")):
            return "admin"
        if identifier == settings.test_curator_email or (qa and local.startswith("curator")):
            return "curator"
    return None


def is_curator_identifier(identifier: str) -> bool:
    return role_for_identifier(identifier) is not None


ROLE_RANK = {None: 0, "pilgrim": 0, "curator": 1, "admin": 2}


# --- wrong-code blocking -------------------------------------------------------------------------


def blocked_until(db: Session, identifier: str) -> datetime | None:
    row = db.get(LoginThrottle, identifier)
    if row and row.blocked_until and row.blocked_until > datetime.utcnow():
        return row.blocked_until
    return None


def record_failure(db: Session, identifier: str) -> None:
    row = db.get(LoginThrottle, identifier) or LoginThrottle(identifier=identifier, failures=0)
    if row.blocked_until and row.blocked_until <= datetime.utcnow():
        row.blocked_until, row.failures = None, 0  # an old block has run out: start counting again
    row.failures = (row.failures or 0) + 1
    if row.failures >= settings.otp_max_failures:
        row.blocked_until = datetime.utcnow() + timedelta(minutes=settings.otp_block_minutes)
        row.failures = 0
    db.merge(row)
    db.commit()


def clear_failures(db: Session, identifier: str) -> None:
    db.query(LoginThrottle).filter(LoginThrottle.identifier == identifier).delete()
    db.commit()


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
    """Validate and consume an OTP. Consumption is one atomic DELETE, so concurrent
    requests can never both succeed with the same code (and never hit a stale row)."""
    if is_test_identifier(identifier):  # stateless: always valid, so parallel test logins can't clash
        return hmac.compare_digest(code.strip(), settings.test_user_otp)
    row = db.query(OtpCode).filter(OtpCode.identifier == identifier).order_by(OtpCode.id.desc()).first()
    if not row or row.expires_at < datetime.utcnow() or row.attempts >= settings.otp_max_attempts:
        return False
    rows = db.query(OtpCode).filter(OtpCode.id == row.id)
    if hmac.compare_digest(row.code_hash, _hash(identifier, code.strip())):
        consumed = rows.delete(synchronize_session=False)
        db.commit()
        return consumed == 1
    rows.update({OtpCode.attempts: OtpCode.attempts + 1}, synchronize_session=False)
    db.commit()
    return False


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
    if not db.query(User).filter(User.email == settings.test_curator_email).first():
        db.add(User(email=settings.test_curator_email, name="Test Curator", faith="jain", sect="digambar", role="curator"))
        db.commit()
    if not db.query(User).filter(User.email == settings.test_admin_email).first():
        db.add(User(email=settings.test_admin_email, name="Test Admin", faith="jain", sect="digambar", role="admin"))
        db.commit()
