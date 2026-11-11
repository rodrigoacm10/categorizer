from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Union
from uuid import UUID, uuid4

from app.modules.inventory.domain.enums import MovementType


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class StockMovement:
    tenant_id: UUID
    product_id: UUID
    type: Union[MovementType, str]
    quantity: int  # Delta em escala x1000 (+ ou -)
    balance_after: int  # Saldo resultante em escala x1000
    id: UUID = field(default_factory=uuid4)
    reason: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_at: datetime = field(default_factory=utc_now)

    def __post_init__(self):
        if isinstance(self.type, MovementType):
            self.type = self.type.value
        elif isinstance(self.type, str):
            self.type = self.type.strip().upper()
