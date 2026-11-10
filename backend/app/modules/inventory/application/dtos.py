from pydantic import BaseModel, Field
from typing import Optional, Union
from datetime import datetime
from decimal import Decimal
from enum import Enum
from app.shared.utils.scale import from_scaled_int

class MovementTypeEnum(str, Enum):
    IN = "IN"
    OUT = "OUT"
    ADJUSTMENT = "ADJUSTMENT"
    PRODUCT_DELETED = "PRODUCT_DELETED"

class CreateStockMovementDto(BaseModel):
    product_id: str
    type: MovementTypeEnum
    quantity: Union[Decimal, float, str, int] = Field(
        ...,
        description="Para IN e OUT: quantidade a movimentar (> 0). Para ADJUSTMENT: nova quantidade contada no inventário (>= 0)."
    )
    reason: Optional[str] = Field(None, max_length=500)

class StockMovementResponseDto(BaseModel):
    id: str
    product_id: str
    product_name: Optional[str] = None
    product_unit: Optional[str] = None
    type: str
    quantity: Decimal
    quantity_scaled: int
    balance_after: Decimal
    balance_after_scaled: int
    reason: Optional[str]
    idempotency_key: Optional[str]
    created_at: datetime

    @classmethod
    def from_orm_model(cls, mov) -> "StockMovementResponseDto":
        p_name = mov.product.name if mov.product else None
        p_unit = mov.product.unit if mov.product else None
        return cls(
            id=mov.id,
            product_id=mov.product_id,
            product_name=p_name,
            product_unit=p_unit,
            type=mov.type,
            quantity=from_scaled_int(mov.quantity),
            quantity_scaled=mov.quantity,
            balance_after=from_scaled_int(mov.balance_after),
            balance_after_scaled=mov.balance_after,
            reason=mov.reason,
            idempotency_key=mov.idempotency_key,
            created_at=mov.created_at
        )
