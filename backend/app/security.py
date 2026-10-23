from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import User

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    claims = {"sub": str(user.id), "ver": user.token_version or 0, "exp": expire}
    return jwt.encode(claims, settings.secret_key, algorithm=settings.algorithm)


def _decode(token: str) -> tuple[int, int] | None:
    """(user id, token version) or None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return int(payload["sub"]), int(payload.get("ver", 0))
    except (JWTError, KeyError, ValueError, TypeError):
        return None


def _user_for(token: str, db: Session) -> User | None:
    """The token's user, unless the account is locked or the token was signed out (old version)."""
    decoded = _decode(token)
    if not decoded:
        return None
    user = db.get(User, decoded[0])
    if not user or user.is_locked or decoded[1] != (user.token_version or 0):
        return None
    return user


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme), db: Session = Depends(get_db)) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", {"WWW-Authenticate": "Bearer"})
    if not creds:
        raise unauthorized
    user = _user_for(creds.credentials, db)
    if not user:
        raise unauthorized
    return user


def get_optional_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme), db: Session = Depends(get_db)) -> User | None:
    if not creds:
        return None
    return _user_for(creds.credentials, db)
