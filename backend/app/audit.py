"""Activity log: one row per admin / curator action. Callers add the row and commit with their change."""
import json

from sqlalchemy.orm import Session

from .models import AuditLog, User


def actor_label(user: User) -> str:
    return user.name or user.email or user.phone or f"User #{user.id}"


def log(
    db: Session,
    actor: User,
    action: str,
    target_type: str,
    target_id: int | None,
    target_label: str | None = None,
    **details,
) -> None:
    clean = {k: v for k, v in details.items() if v is not None}
    db.add(
        AuditLog(
            actor_id=actor.id,
            actor_name=actor_label(actor),
            action=action,
            target_type=target_type,
            target_id=target_id,
            target_label=(target_label or "")[:255] or None,
            details=json.dumps(clean, ensure_ascii=False, default=str) if clean else None,
        )
    )
