from datetime import datetime
from fastapi import APIRouter, Depends, Header, Query, Response, status, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Union

from app.shared.infrastructure.database import get_db
from app.modules.inventory.domain.enums import MovementType
from app.modules.inventory.domain.exceptions import InsufficientStockError
from app.modules.inventory.infrastructure.unit_of_work import InventoryUnitOfWork
from app.modules.inventory.application.dtos import (
    CreateStockMovementDto,
    StockInRequestDto,
    StockOutRequestDto,
    StockAdjustmentRequestDto,
    StockMovementResponseDto,
    ProductBalanceResponseDto,
    MovementTypeEnum,
)
from app.modules.inventory.application.use_cases import (
    RegisterStockInUseCase,
    RegisterStockOutUseCase,
    RegisterStockAdjustmentUseCase,
    ListStockMovementsUseCase,
    GetProductBalanceUseCase,
    process_stock_movement,
    get_product_ledger,
    list_all_movements,
)
from app.modules.idempotency.interfaces.guard import IdempotencyGuard
from app.modules.tenants.interfaces.context import TenantContext, get_tenant_context
from app.modules.tenants.interfaces.rbac import require_roles
from app.modules.tenants.domain.entities import TenantRole
from app.shared.domain.exceptions import InsufficientPermissionsError

router = APIRouter()


def _check_movement_role_permission(role: TenantRole, movement_type: Optional[Union[MovementType, str]]):
    m_val = movement_type.value if hasattr(movement_type, "value") else str(movement_type)
    if m_val in (MovementType.IN.value, MovementType.OUT.value):
        if role not in (TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE):
            raise InsufficientPermissionsError(
                detail=f"Papel '{role.value}' não possui permissão para registrar {m_val}."
            )
    elif m_val == MovementType.ADJUSTMENT.value:
        if role not in (TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE, TenantRole.AUDITOR):
            raise InsufficientPermissionsError(
                detail=f"Papel '{role.value}' não possui permissão para registrar ajustes de estoque."
            )


@router.post("/in", response_model=StockMovementResponseDto, status_code=status.HTTP_201_CREATED)
def stock_in_endpoint(
    dto: CreateStockMovementDto,
    response: Response,
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE)),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Registra entrada física de estoque (IN) com bloqueio pessimista e idempotência garantida.
    """
    endpoint = "/api/inventory/in"
    guard = IdempotencyGuard(db, tenant_id=context.tenant.id)
    key, cached_response = guard.check_or_start(
        endpoint=endpoint,
        payload=dto.model_dump(),
        client_key=x_idempotency_key,
        method="POST",
    )

    if cached_response:
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Idempotency-Key"] = key
        return cached_response

    try:
        uow = InventoryUnitOfWork(db)
        use_case = RegisterStockInUseCase(uow)
        movement = use_case.execute(
            tenant_id=context.tenant.id,
            product_id=dto.product_id,
            quantity=dto.quantity,
            reason=dto.reason,
            idempotency_key=key,
        )
        guard.mark_completed(
            key=key,
            response_code=status.HTTP_201_CREATED,
            response_body=movement.model_dump(),
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return movement
    except Exception as exc:
        guard.mark_failed(key, str(exc))
        raise exc


@router.post("/out", response_model=StockMovementResponseDto, status_code=status.HTTP_201_CREATED)
def stock_out_endpoint(
    dto: CreateStockMovementDto,
    response: Response,
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE)),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Registra saída física de estoque (OUT) com bloqueio pessimista.
    Rejeita tentativas de saldo negativo com HTTP 422 Unprocessable Entity.
    """
    endpoint = "/api/inventory/out"
    guard = IdempotencyGuard(db, tenant_id=context.tenant.id)
    key, cached_response = guard.check_or_start(
        endpoint=endpoint,
        payload=dto.model_dump(),
        client_key=x_idempotency_key,
        method="POST",
    )

    if cached_response:
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Idempotency-Key"] = key
        return cached_response

    try:
        uow = InventoryUnitOfWork(db)
        use_case = RegisterStockOutUseCase(uow)
        movement = use_case.execute(
            tenant_id=context.tenant.id,
            product_id=dto.product_id,
            quantity=dto.quantity,
            reason=dto.reason,
            idempotency_key=key,
        )
        guard.mark_completed(
            key=key,
            response_code=status.HTTP_201_CREATED,
            response_body=movement.model_dump(),
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return movement
    except Exception as exc:
        guard.mark_failed(key, str(exc))
        raise exc


@router.post("/adjustment", response_model=StockMovementResponseDto, status_code=status.HTTP_201_CREATED)
def stock_adjustment_endpoint(
    dto: CreateStockMovementDto,
    response: Response,
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE, TenantRole.AUDITOR)),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Registra ajuste de inventário (ADJUSTMENT) com cálculo exato de delta e bloqueio pessimista.
    """
    endpoint = "/api/inventory/adjustment"
    guard = IdempotencyGuard(db, tenant_id=context.tenant.id)
    key, cached_response = guard.check_or_start(
        endpoint=endpoint,
        payload=dto.model_dump(),
        client_key=x_idempotency_key,
        method="POST",
    )

    if cached_response:
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Idempotency-Key"] = key
        return cached_response

    try:
        uow = InventoryUnitOfWork(db)
        use_case = RegisterStockAdjustmentUseCase(uow)
        movement = use_case.execute(
            tenant_id=context.tenant.id,
            product_id=dto.product_id,
            new_quantity=dto.quantity,
            reason=dto.reason,
            idempotency_key=key,
        )
        guard.mark_completed(
            key=key,
            response_code=status.HTTP_201_CREATED,
            response_body=movement.model_dump(),
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return movement
    except Exception as exc:
        guard.mark_failed(key, str(exc))
        raise exc


@router.post("/movements", response_model=StockMovementResponseDto, status_code=status.HTTP_201_CREATED)
def create_movement_endpoint(
    dto: CreateStockMovementDto,
    response: Response,
    context: TenantContext = Depends(get_tenant_context),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Endpoint genérico de movimentação de estoque com proteção de idempotência e RBAC.
    """
    _check_movement_role_permission(context.role, dto.type)

    endpoint = "/api/inventory/movements"
    guard = IdempotencyGuard(db, tenant_id=context.tenant.id)
    key, cached_response = guard.check_or_start(
        endpoint=endpoint,
        payload=dto.model_dump(),
        client_key=x_idempotency_key,
        method="POST",
    )

    if cached_response:
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Idempotency-Key"] = key
        return cached_response

    try:
        movement = process_stock_movement(
            db, dto, tenant_id=context.tenant.id, idempotency_key=key
        )
        guard.mark_completed(
            key=key,
            response_code=status.HTTP_201_CREATED,
            response_body=movement.model_dump(),
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return movement
    except Exception as exc:
        guard.mark_failed(key, str(exc))
        raise exc


@router.get("/movements", response_model=List[StockMovementResponseDto])
def list_movements_endpoint(
    product_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """
    Consulta o extrato geral do Livro-Razão paginado com filtros opcionais.
    """
    uow = InventoryUnitOfWork(db)
    use_case = ListStockMovementsUseCase(uow)
    return use_case.execute(
        tenant_id=context.tenant.id,
        product_id=product_id,
        movement_type=type,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )


@router.get("/products/{product_id}/movements", response_model=List[StockMovementResponseDto])
@router.get("/products/{product_id}/ledger", response_model=List[StockMovementResponseDto])
def get_product_movements_endpoint(
    product_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """
    Consulta o extrato cronológico de movimentações contábeis de um produto específico.
    """
    uow = InventoryUnitOfWork(db)
    with uow:
        product = uow.products.get_by_id(product_id=product_id, tenant_id=context.tenant.id, include_inactive=True)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Produto não encontrado neste tenant.",
            )
        use_case = ListStockMovementsUseCase(uow)
        return use_case.execute(
            tenant_id=context.tenant.id,
            product_id=product_id,
            limit=limit,
            offset=offset,
        )


@router.get("/products/{product_id}/balance", response_model=ProductBalanceResponseDto)
def get_product_balance_endpoint(
    product_id: str,
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """
    Retorna o saldo atual e status de estoque de um produto.
    """
    uow = InventoryUnitOfWork(db)
    use_case = GetProductBalanceUseCase(uow)
    return use_case.execute(tenant_id=context.tenant.id, product_id=product_id)
