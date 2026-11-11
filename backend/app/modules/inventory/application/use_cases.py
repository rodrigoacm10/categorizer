from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Union
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.inventory.domain.enums import MovementType
from app.modules.inventory.domain.exceptions import (
    InsufficientStockError,
    InvalidMovementError,
)
from app.modules.inventory.infrastructure.models import StockMovementModel
from app.modules.inventory.infrastructure.unit_of_work import InventoryUnitOfWork
from app.modules.inventory.application.dtos import (
    CreateStockMovementDto,
    StockMovementResponseDto,
    ProductBalanceResponseDto,
    MovementTypeEnum,
)
from app.shared.domain.exceptions import ProductNotFoundError
from app.shared.utils.scale import to_scaled_int, from_scaled_int


class RegisterStockInUseCase:
    """
    Caso de Uso: Entrada de Estoque (IN).
    - Valida quantidade positiva (> 0).
    - Bloqueia exclusivamente a linha do produto no PostgreSQL com SELECT ... FOR UPDATE.
    - Incrementa o saldo do produto: balance_after = current_quantity + quantity.
    - Insere registro imutável no Ledger com tipo IN e delta positivo (+quantity).
    - Efetua commit atômico e retorna DTO com novo saldo.
    """
    def __init__(self, uow: InventoryUnitOfWork):
        self.uow = uow

    def execute(
        self,
        tenant_id: UUID,
        product_id: Union[UUID, str],
        quantity: Union[Decimal, float, str, int],
        reason: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> StockMovementResponseDto:
        scaled_qty = to_scaled_int(quantity)
        if scaled_qty <= 0:
            raise InvalidMovementError("A quantidade de entrada deve ser maior que zero.")

        with self.uow:
            product = self.uow.get_product_for_update(
                tenant_id_or_product_id=tenant_id,
                product_id=product_id,
                include_inactive=True,
            )
            if not product:
                raise ProductNotFoundError("Produto não encontrado neste tenant.")

            if not product.is_active:
                raise InvalidMovementError(
                    f"Não é possível movimentar o estoque do produto '{product.name}' pois ele está inativo/removido."
                )

            new_balance = product.current_quantity + scaled_qty
            product.current_quantity = new_balance

            movement = StockMovementModel(
                tenant_id=tenant_id,
                product_id=product.id,
                type=MovementType.IN.value,
                quantity=scaled_qty,
                balance_after=new_balance,
                reason=reason or "Entrada no estoque",
                idempotency_key=idempotency_key,
            )
            self.uow.movements.append(movement)
            movement.product = product

            return StockMovementResponseDto.from_orm_model(movement)


class RegisterStockOutUseCase:
    """
    Caso de Uso: Saída de Estoque (OUT).
    - Valida quantidade positiva (> 0).
    - Bloqueia exclusivamente a linha do produto no PostgreSQL com SELECT ... FOR UPDATE.
    - Validação Estrita de Saldo: Se current_quantity < quantity, lança InsufficientStockError (HTTP 422).
    - Decrementa o saldo do produto: balance_after = current_quantity - quantity.
    - Insere registro imutável no Ledger com tipo OUT e delta negativo (-quantity).
    - Efetua commit atômico e retorna DTO com novo saldo.
    """
    def __init__(self, uow: InventoryUnitOfWork):
        self.uow = uow

    def execute(
        self,
        tenant_id: UUID,
        product_id: Union[UUID, str],
        quantity: Union[Decimal, float, str, int],
        reason: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> StockMovementResponseDto:
        scaled_qty = to_scaled_int(quantity)
        if scaled_qty <= 0:
            raise InvalidMovementError("A quantidade de saída deve ser maior que zero.")

        with self.uow:
            product = self.uow.get_product_for_update(
                tenant_id_or_product_id=tenant_id,
                product_id=product_id,
                include_inactive=True,
            )
            if not product:
                raise ProductNotFoundError("Produto não encontrado neste tenant.")

            if not product.is_active:
                raise InvalidMovementError(
                    f"Não é possível movimentar o estoque do produto '{product.name}' pois ele está inativo/removido."
                )

            current_balance = product.current_quantity
            if current_balance < scaled_qty:
                raise InsufficientStockError(
                    product_id=product.id,
                    current=current_balance,
                    requested=scaled_qty,
                    unit=product.unit,
                )

            new_balance = current_balance - scaled_qty
            product.current_quantity = new_balance

            movement = StockMovementModel(
                tenant_id=tenant_id,
                product_id=product.id,
                type=MovementType.OUT.value,
                quantity=-scaled_qty,
                balance_after=new_balance,
                reason=reason or "Saída de estoque",
                idempotency_key=idempotency_key,
            )
            self.uow.movements.append(movement)
            movement.product = product

            return StockMovementResponseDto.from_orm_model(movement)


class RegisterStockAdjustmentUseCase:
    """
    Caso de Uso: Ajuste Físico de Inventário (ADJUSTMENT).
    - Valida motivo obrigatório (não nulo nem vazio).
    - Valida nova quantidade apurada não-negativa (>= 0).
    - Bloqueia exclusivamente a linha do produto no PostgreSQL com SELECT ... FOR UPDATE.
    - Calcula delta contábil: Delta = new_quantity - current_quantity (+ ou -).
    - Atualiza saldo do produto para new_quantity.
    - Insere registro imutável no Ledger com tipo ADJUSTMENT, quantity=Delta, balance_after=new_quantity.
    - Efetua commit atômico e retorna confirmação.
    """
    def __init__(self, uow: InventoryUnitOfWork):
        self.uow = uow

    def execute(
        self,
        tenant_id: UUID,
        product_id: Union[UUID, str],
        new_quantity: Union[Decimal, float, str, int],
        reason: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> StockMovementResponseDto:
        if reason is not None and not reason.strip():
            raise InvalidMovementError("Motivo do ajuste de estoque não pode ser vazio.")
        effective_reason = reason.strip() if reason and reason.strip() else "Ajuste de inventário"

        scaled_new_qty = to_scaled_int(new_quantity)
        if scaled_new_qty < 0:
            raise InvalidMovementError("A nova quantidade do ajuste não pode ser negativa.")

        with self.uow:
            product = self.uow.get_product_for_update(
                tenant_id_or_product_id=tenant_id,
                product_id=product_id,
                include_inactive=True,
            )
            if not product:
                raise ProductNotFoundError("Produto não encontrado neste tenant.")

            if not product.is_active:
                raise InvalidMovementError(
                    f"Não é possível movimentar o estoque do produto '{product.name}' pois ele está inativo/removido."
                )

            current_balance = product.current_quantity
            delta = scaled_new_qty - current_balance
            product.current_quantity = scaled_new_qty

            movement = StockMovementModel(
                tenant_id=tenant_id,
                product_id=product.id,
                type=MovementType.ADJUSTMENT.value,
                quantity=delta,
                balance_after=scaled_new_qty,
                reason=effective_reason,
                idempotency_key=idempotency_key,
            )
            self.uow.movements.append(movement)
            movement.product = product

            return StockMovementResponseDto.from_orm_model(movement)


class ListStockMovementsUseCase:
    """
    Caso de Uso: Consulta de Movimentações Contábeis (Extrato do Ledger).
    - Suporta filtros por produto, tipo de movimentação, período (data inicial/final) e paginação.
    - Ordenação padrão estrita: cronológica decrescente (created_at DESC).
    """
    def __init__(self, uow: InventoryUnitOfWork):
        self.uow = uow

    def execute(
        self,
        tenant_id: UUID,
        product_id: Optional[Union[UUID, str]] = None,
        movement_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[StockMovementResponseDto]:
        with self.uow:
            movements = self.uow.movements.list_all(
                tenant_id=tenant_id,
                product_id=product_id,
                movement_type=movement_type,
                start_date=start_date,
                end_date=end_date,
                limit=limit,
                offset=offset,
            )
            return [StockMovementResponseDto.from_orm_model(m) for m in movements]


class GetProductBalanceUseCase:
    """
    Caso de Uso: Consulta de Saldo Atual do Produto.
    - Retorna o saldo contábil atual, unidades e indicador de estoque baixo.
    """
    def __init__(self, uow: InventoryUnitOfWork):
        self.uow = uow

    def execute(
        self,
        tenant_id: UUID,
        product_id: Union[UUID, str],
    ) -> ProductBalanceResponseDto:
        with self.uow:
            product = self.uow.products.get_by_id(
                product_id=product_id,
                tenant_id=tenant_id,
                include_inactive=True,
            )
            if not product:
                raise ProductNotFoundError("Produto não encontrado neste tenant.")

            is_low = product.is_low_stock() if hasattr(product, "is_low_stock") else (
                product.min_stock is not None and product.current_quantity <= product.min_stock
            )
            min_stock_dec = from_scaled_int(product.min_stock) if product.min_stock is not None else None

            return ProductBalanceResponseDto(
                product_id=str(product.id),
                product_name=product.name,
                unit=product.unit,
                current_quantity=from_scaled_int(product.current_quantity),
                current_quantity_scaled=product.current_quantity,
                is_low_stock=is_low,
                min_stock=min_stock_dec,
            )


# Aliases e compatibilidade com chamadas procedurais legadas
GetLedgerUseCase = ListStockMovementsUseCase


def process_stock_movement(
    db: Session,
    dto: CreateStockMovementDto,
    tenant_id: UUID,
    idempotency_key: Optional[str] = None,
) -> StockMovementResponseDto:
    uow = InventoryUnitOfWork(db)
    m_type = dto.type.value if hasattr(dto.type, "value") else str(dto.type)

    if m_type == MovementType.IN.value:
        return RegisterStockInUseCase(uow).execute(
            tenant_id=tenant_id,
            product_id=dto.product_id,
            quantity=dto.quantity,
            reason=dto.reason,
            idempotency_key=idempotency_key,
        )
    elif m_type == MovementType.OUT.value:
        try:
            return RegisterStockOutUseCase(uow).execute(
                tenant_id=tenant_id,
                product_id=dto.product_id,
                quantity=dto.quantity,
                reason=dto.reason,
                idempotency_key=idempotency_key,
            )
        except InsufficientStockError as err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err.problem_detail,
            )
    elif m_type == MovementType.ADJUSTMENT.value:
        return RegisterStockAdjustmentUseCase(uow).execute(
            tenant_id=tenant_id,
            product_id=dto.product_id,
            new_quantity=dto.quantity,
            reason=dto.reason,
            idempotency_key=idempotency_key,
        )
    else:
        raise InvalidMovementError(f"Tipo de movimentação inválido: {dto.type}")


def get_product_ledger(
    db: Session,
    product_id: str,
    tenant_id: UUID,
) -> List[StockMovementResponseDto]:
    uow = InventoryUnitOfWork(db)
    with uow:
        product = uow.products.get_by_id(product_id=product_id, tenant_id=tenant_id, include_inactive=True)
        if not product:
            raise ProductNotFoundError("Produto não encontrado neste tenant.")
        return ListStockMovementsUseCase(uow).execute(tenant_id=tenant_id, product_id=product_id)


def list_all_movements(
    db: Session,
    tenant_id: UUID,
    limit: int = 100,
    offset: int = 0,
    movement_type: Optional[str] = None,
) -> List[StockMovementResponseDto]:
    uow = InventoryUnitOfWork(db)
    return ListStockMovementsUseCase(uow).execute(
        tenant_id=tenant_id,
        movement_type=movement_type,
        limit=limit,
        offset=offset,
    )
