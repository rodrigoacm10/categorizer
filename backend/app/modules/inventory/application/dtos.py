from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Union, List
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

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


class ProductDiscrepancyDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: UUID = Field(..., description="Identificador único do produto")
    product_name: str = Field(..., description="Nome do produto no catálogo")
    current_quantity: float = Field(..., description="Quantidade física registrada atualmente no cadastro do produto")
    expected_quantity: float = Field(..., description="Quantidade matemática esperada resultante da soma contábil de todas as movimentações")
    difference: float = Field(..., description="Diferença entre saldo atual e saldo esperado (current_quantity - expected_quantity)")
    has_discrepancy: bool = Field(..., description="Indicador se existe divergência matemática entre o saldo cadastrado e o livro-razão")


class InventoryReconciliationReportDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tenant_id: UUID = Field(..., description="Identificador do tenant auditado")
    total_products_checked: int = Field(..., description="Total de produtos auditados no tenant")
    discrepant_products_count: int = Field(..., description="Quantidade de produtos com divergência contábil")
    is_reconciled: bool = Field(..., description="True se 100% dos produtos auditados estão íntegros matematicamente")
    discrepancies: List[ProductDiscrepancyDto] = Field(default_factory=list, description="Lista de detalhes dos produtos com divergência detectada")
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Data e hora UTC da geração do relatório de auditoria")


