from typing import Optional
from uuid import UUID

from supabase import Client


def log_action(
    db: Client,
    user_id: str,
    action: str,
    entity_type: str,
    entity_id: Optional[UUID] = None,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
) -> None:
    db.table("audit_log").insert(
        {
            "user_id": user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id else None,
            "before": before,
            "after": after,
        }
    ).execute()
