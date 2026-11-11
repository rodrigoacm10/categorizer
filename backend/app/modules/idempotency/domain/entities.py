from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID

from app.modules.idempotency.domain.enums import IdempotencyStatus


@dataclass
class IdempotencyRecord:
    key: str
    tenant_id: UUID
    request_hash: str
    endpoint: str
    status: IdempotencyStatus
    response_code: Optional[int] = None
    response_body: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
