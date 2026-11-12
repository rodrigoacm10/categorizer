from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Union
from datetime import datetime
from decimal import Decimal

from app.modules.inventory.domain.enums import MovementType
from app.shared.utils.scale import from_scaled_int

# Compatibilidade retroativa
MovementTypeEnum = MovementType


class CreateStockMovementDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: str
    type: Optional[MovementType] = None
    quantity: Union[Decimal, float, str, int] = Field(
        ...,
        description="Para IN e OUT: quantidade a movimentar (> 0). Para ADJUSTMENT: nova quantidade contada no inventário (>= 0)."
    )
    reason: Optional[str] = Field(None, max_length=500)


class StockInRequestDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: str
    quantity: Union[Decimal, float, str, int] = Field(..., gt=0, description="Quantidade a dar entrada (> 0).")
    reason: Optional[str] = Field(None, max_length=500)
    type: Optional[MovementType] = MovementType.IN


class StockOutRequestDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: str
    quantity: Union[Decimal, float, str, int] = Field(..., gt=0, description="Quantidade a dar saída (> 0).")
    reason: Optional[str] = Field(None, max_length=500)
    type: Optional[MovementType] = MovementType.OUT


class StockAdjustmentRequestDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: str
    quantity: Union[Decimal, float, str, int] = Field(..., ge=0, description="Novo saldo apurado no inventário (>= 0).")
    reason: Optional[str] = Field(None, max_length=500, description="Motivo do ajuste de estoque.")
    type: Optional[MovementType] = MovementType.ADJUSTMENT


class StockMovementResponseDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    product_name: Optional[str] = None
    product_unit: Optional[str] = None
    type: str
    quantity: Decimal
    quantity_scaled: int
    balance_after: Decimal
    balance_after_scaled: int
    reason: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_at: datetime

    @classmethod
    def from_orm_model(cls, mov) -> "StockMovementResponseDto":
        p_name = mov.product.name if getattr(mov, "product", None) else None
        p_unit = mov.product.unit if getattr(mov, "product", None) else None
        return cls(
            id=str(mov.id),
            product_id=str(mov.product_id),
            product_name=p_name,
            product_unit=p_unit,
            type=str(mov.type),
            quantity=from_scaled_int(mov.quantity),
            quantity_scaled=mov.quantity,
            balance_after=from_scaled_int(mov.balance_after),
            balance_after_scaled=mov.balance_after,
            reason=mov.reason,
            idempotency_key=mov.idempotency_key,
            created_at=mov.created_at
        )


class ProductBalanceResponseDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: str
    product_name: str
    unit: str
    current_quantity: Decimal
    current_quantity_scaled: int
    is_low_stock: bool
    min_stock: Optional[Decimal] = None


class InventorySummaryResponseDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_products: int = Field(..., description="Total de produtos ativos no catálogo do tenant")
    low_stock_count: int = Field(..., description="Quantidade de produtos ativos onde current_quantity <= min_stock e current_quantity > 0")
    out_of_stock_count: int = Field(..., description="Quantidade de produtos ativos onde current_quantity == 0")
    movements_today: int = Field(..., description="Total de movimentações contábeis registradas nas últimas 24 horas no tenant")

