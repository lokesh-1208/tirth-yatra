"""User management and the activity log. Admins only.

Login is OTP-only (no passwords), so "reset login" means: clear any wrong-code block and
sign the user out of every device (their tokens stop working).
"""
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .. import audit
from ..config import get_settings
from ..database import get_db
from ..models import (
    AuditLog,
    Lead,
    LoginThrottle,
    OtpCode,
    Place,
    PlacePhoto,
    Report,
    SavedPlace,
    User,
    Verification,
)
from ..otp import InvalidIdentifier, normalize_identifier
from ..schemas import (
    AdminUserDetail,
    AdminUserOut,
    AdminUserUpdate,
    AuditOut,
    AuditPage,
    DeleteUserIn,
    LockIn,
    UserCreate,
)
from .admin import require_admin
from .reports import report_out

settings = get_settings()
router = APIRouter(prefix="/admin", tags=["admin users"], dependencies=[Depends(require_admin)])


# --- helpers -----------------------------------------------------------------------------------


def _identifiers(user: User) -> list[str]:
    return [i for i in (user.email, user.phone) if i]


def _counts(db: Session, model, column, ids: list[int]) -> dict[int, int]:
    if not ids:
        return {}
    rows = db.query(column, func.count()).filter(column.in_(ids)).group_by(column).all()
    return {k: n for k, n in rows}


def _users_out(db: Session, users: list[User]) -> list[AdminUserOut]:
    ids = [u.id for u in users]
    saved = _counts(db, SavedPlace, SavedPlace.user_id, ids)
    reports = _counts(db, Report, Report.user_id, ids)
    checks = _counts(db, Verification, Verification.checked_by_id, ids)
    idents = [i for u in users for i in _identifiers(u)]
    now = datetime.utcnow()
    blocks = {
        t.identifier: t.blocked_until
        for t in db.query(LoginThrottle).filter(LoginThrottle.identifier.in_(idents), LoginThrottle.blocked_until > now)
    } if idents else {}
    out = []
    for u in users:
        o = AdminUserOut.model_validate(u)
        o.role = u.role or "pilgrim"
        o.login_count = u.login_count or 0
        o.is_locked = bool(u.is_locked)
        until = [blocks[i] for i in _identifiers(u) if i in blocks]
        o.login_blocked_until = max(until) if until else None
        o.saved_count, o.reports_count, o.checks_count = saved.get(u.id, 0), reports.get(u.id, 0), checks.get(u.id, 0)
        out.append(o)
    return out


def _audit_out(row: AuditLog) -> AuditOut:
    return AuditOut(
        id=row.id,
        actor_id=row.actor_id,
        actor_name=row.actor_name,
        action=row.action,
        target_type=row.target_type,
        target_id=row.target_id,
        target_label=row.target_label,
        details=json.loads(row.details) if row.details else None,
        created_at=row.created_at,
    )


def _get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


def _label(user: User) -> str:
    return user.name or user.email or user.phone or f"User #{user.id}"


def _not_self(actor: User, target: User, what: str) -> None:
    if actor.id == target.id:
        raise HTTPException(status.HTTP_409_CONFLICT, f"You cannot {what} your own account")


def _keep_one_admin(db: Session, target: User) -> None:
    """Refuse a change that would leave the app with no admin."""
    if target.role == "admin":
        others = db.query(User).filter(User.role == "admin", User.id != target.id, User.is_locked.isnot(True)).count()
        if others == 0:
            raise HTTPException(status.HTTP_409_CONFLICT, "This is the only admin. Make someone else admin first.")


def _detail(db: Session, user: User) -> AdminUserDetail:
    base = _users_out(db, [user])[0].model_dump()
    reports = db.query(Report).filter(Report.user_id == user.id).order_by(Report.id.desc()).limit(10).all()
    on = (
        db.query(AuditLog)
        .filter(AuditLog.target_type == "user", AuditLog.target_id == user.id)
        .order_by(AuditLog.id.desc())
        .limit(20)
        .all()
    )
    by = db.query(AuditLog).filter(AuditLog.actor_id == user.id).order_by(AuditLog.id.desc()).limit(20).all()
    return AdminUserDetail(
        **base,
        recent_reports=[report_out(db, r) for r in reports],
        activity_on=[_audit_out(a) for a in on],
        activity_by=[_audit_out(a) for a in by],
    )


# --- users -------------------------------------------------------------------------------------


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    q: str | None = Query(None, description="Search name, email or phone"),
    role: str | None = Query(None, pattern="^(pilgrim|curator|admin)$"),
    state: str | None = Query(None, pattern="^(locked|blocked|active)$"),
    hide_test: bool = Query(False, description="Leave out automated-test accounts (@ the test email domain)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if hide_test:
        query = query.filter(or_(User.email.is_(None), ~User.email.endswith("@" + settings.test_email_domain)))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(User.name.ilike(like), User.email.ilike(like), User.phone.ilike(like)))
    if role == "pilgrim":
        query = query.filter(or_(User.role == "pilgrim", User.role.is_(None)))
    elif role:
        query = query.filter(User.role == role)
    if state == "locked":
        query = query.filter(User.is_locked.is_(True))
    elif state == "active":
        query = query.filter(User.is_locked.isnot(True))
    if state == "blocked":
        now = datetime.utcnow()
        blocked = [t.identifier for t in db.query(LoginThrottle).filter(LoginThrottle.blocked_until > now)]
        query = query.filter(or_(User.email.in_(blocked), User.phone.in_(blocked)))
    users = (
        query.order_by(User.last_login_at.is_(None), User.last_login_at.desc(), User.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return _users_out(db, users)


@router.post("/users", response_model=AdminUserDetail, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    try:
        kind, identifier = normalize_identifier(data.identifier)
    except InvalidIdentifier as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    column = User.email if kind == "email" else User.phone
    if db.query(User).filter(column == identifier).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email / phone already exists")
    user = User(**{kind: identifier}, name=data.name, role=data.role)
    db.add(user)
    db.flush()
    audit.log(db, actor, "user.create", "user", user.id, _label(user), role=data.role)
    db.commit()
    db.refresh(user)
    return _detail(db, user)


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def get_user(user_id: int, db: Session = Depends(get_db)):
    return _detail(db, _get_user(db, user_id))


@router.patch("/users/{user_id}", response_model=AdminUserDetail)
def update_user(user_id: int, data: AdminUserUpdate, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    user = _get_user(db, user_id)
    changes = data.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "name cannot be empty")
    if "role" in changes and changes["role"] != (user.role or "pilgrim"):
        if changes["role"] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "role cannot be empty")
        _not_self(actor, user, "change the role of")
        if changes["role"] != "admin":
            _keep_one_admin(db, user)
        audit.log(db, actor, "user.role", "user", user.id, _label(user), old=user.role or "pilgrim", new=changes["role"])
    fields = sorted(f for f, v in changes.items() if f != "role" and getattr(user, f) != v)
    for field, value in changes.items():
        setattr(user, field, value)
    if fields:
        audit.log(db, actor, "user.update", "user", user.id, _label(user), fields=fields)
    db.commit()
    db.refresh(user)
    return _detail(db, user)


@router.post("/users/{user_id}/lock", response_model=AdminUserDetail)
def lock_user(user_id: int, data: LockIn, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    user = _get_user(db, user_id)
    _not_self(actor, user, "lock")
    _keep_one_admin(db, user)
    user.is_locked = True
    user.locked_reason = data.reason.strip()
    user.locked_at = datetime.utcnow()
    user.locked_by_id = actor.id
    user.token_version = (user.token_version or 0) + 1  # signed out everywhere, right away
    audit.log(db, actor, "user.lock", "user", user.id, _label(user), reason=user.locked_reason)
    db.commit()
    db.refresh(user)
    return _detail(db, user)


@router.post("/users/{user_id}/unlock", response_model=AdminUserDetail)
def unlock_user(user_id: int, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    user = _get_user(db, user_id)
    if user.is_locked:
        user.is_locked = False
        user.locked_reason = None
        user.locked_at = None
        user.locked_by_id = None
        audit.log(db, actor, "user.unlock", "user", user.id, _label(user))
        db.commit()
        db.refresh(user)
    return _detail(db, user)


@router.post("/users/{user_id}/reset-login", response_model=AdminUserDetail)
def reset_login(user_id: int, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    """Clear wrong-code blocks and pending codes, and sign the user out of all devices."""
    user = _get_user(db, user_id)
    idents = _identifiers(user)
    if idents:
        db.query(LoginThrottle).filter(LoginThrottle.identifier.in_(idents)).delete(synchronize_session=False)
        db.query(OtpCode).filter(OtpCode.identifier.in_(idents)).delete(synchronize_session=False)
    user.token_version = (user.token_version or 0) + 1
    audit.log(db, actor, "user.reset_login", "user", user.id, _label(user))
    db.commit()
    db.refresh(user)
    return _detail(db, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, data: DeleteUserIn, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    """Delete the account and its personal data (for example when the person asks, under the DPDP Act).

    Their reports stay, without their name; places and checks they worked on stay.
    Earlier log entries about them lose their name too.
    """
    user = _get_user(db, user_id)
    _not_self(actor, user, "delete")
    _keep_one_admin(db, user)
    uid, idents = user.id, _identifiers(user)
    gone = f"User #{uid} (deleted)"

    db.query(Report).filter(Report.user_id == uid).update({Report.user_id: None}, synchronize_session=False)
    db.query(Report).filter(Report.resolved_by_id == uid).update({Report.resolved_by_id: None}, synchronize_session=False)
    db.query(Place).filter(Place.created_by_id == uid).update({Place.created_by_id: None}, synchronize_session=False)
    db.query(PlacePhoto).filter(PlacePhoto.uploaded_by_id == uid).update({PlacePhoto.uploaded_by_id: None}, synchronize_session=False)
    db.query(Verification).filter(Verification.checked_by_id == uid).update({Verification.checked_by_id: None}, synchronize_session=False)
    db.query(Lead).filter(Lead.created_by_id == uid).update({Lead.created_by_id: None}, synchronize_session=False)
    db.query(User).filter(User.locked_by_id == uid).update({User.locked_by_id: None}, synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.actor_id == uid).update({AuditLog.actor_id: None, AuditLog.actor_name: gone}, synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.target_type == "user", AuditLog.target_id == uid).update(
        {AuditLog.target_label: gone}, synchronize_session=False
    )
    if idents:
        db.query(OtpCode).filter(OtpCode.identifier.in_(idents)).delete(synchronize_session=False)
        db.query(LoginThrottle).filter(LoginThrottle.identifier.in_(idents)).delete(synchronize_session=False)
    db.delete(user)  # saved places go with it (cascade)
    audit.log(db, actor, "user.delete", "user", uid, gone)
    db.commit()


# --- activity log ------------------------------------------------------------------------------


@router.get("/audit", response_model=AuditPage)
def activity(
    target_type: str | None = Query(None, pattern="^(place|user|lead|report)$"),
    target_id: int | None = None,
    actor_id: int | None = None,
    action: str | None = Query(None, max_length=60, description="Exact action, or a prefix ending in '.' like 'user.'"),
    before_id: int | None = Query(None, description="For the next page: next_before_id from the previous page"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if target_type:
        query = query.filter(AuditLog.target_type == target_type)
    if target_id is not None:
        query = query.filter(AuditLog.target_id == target_id)
    if actor_id is not None:
        query = query.filter(AuditLog.actor_id == actor_id)
    if action:
        query = query.filter(AuditLog.action.startswith(action) if action.endswith(".") else AuditLog.action == action)
    if before_id is not None:
        query = query.filter(AuditLog.id < before_id)
    rows = query.order_by(AuditLog.id.desc()).limit(limit + 1).all()
    more = len(rows) > limit
    rows = rows[:limit]
    return AuditPage(entries=[_audit_out(r) for r in rows], next_before_id=rows[-1].id if more else None)
