from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Category:
    name: str
    tenant_id: UUID
    id: UUID = field(default_factory=uuid4)
    description: Optional[str] = None
    color: Optional[str] = "#3B82F6"
    created_at: datetime = field(default_factory=utc_now)
