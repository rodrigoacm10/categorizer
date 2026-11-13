from datetime import datetime, timezone
import math
from fastapi import APIRouter, Depends, Header, Query, Response, status, HTTPException
from fastapi.responses import StreamingResponse
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
    InventorySummaryResponseDto,
    MovementTypeEnum,
)
from app.modules.inventory.application.use_cases import (
    RegisterStockInUseCase,
    RegisterStockOutUseCase,
    RegisterStockAdjustmentUseCase,
    ListStockMovementsUseCase,
    ExportStockMovementsUseCase,
    GetProductBalanceUseCase,
    GetInventorySummaryUseCase,
    get_inventory_summary,
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


def _check_summary_role_permission(role: TenantRole):
    if role not in (TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE, TenantRole.AUDITOR):
        raise InsufficientPermissionsError(
            detail=f"Papel '{role.value}' não possui permissão para acessar o resumo de inventário."
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


@router.get("/movements/export")
def export_movements_endpoint(
    product_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE, TenantRole.AUDITOR)),
    db: Session = Depends(get_db),
):
    """
    Exporta o extrato do Livro-Razão Contábil do tenant em formato CSV (StreamingResponse).
    Restrito a usuários autorizados (OWNER, GESTOR, ALMOXARIFE, AUDITOR) com isolamento estrito de tenant.
    """
    uow = InventoryUnitOfWork(db)
    use_case = ExportStockMovementsUseCase(uow)
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"extrato-estoque-{context.tenant.slug}-{date_str}.csv"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }
    generator = use_case.execute(
        tenant_id=context.tenant.id,
        operator_email=context.user.email,
        product_id=product_id,
        movement_type=type,
        start_date=start_date,
        end_date=end_date,
    )
    return StreamingResponse(generator, media_type="text/csv", headers=headers)


@router.get("/movements", response_model=List[StockMovementResponseDto])
def list_movements_endpoint(
    response: Response,
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
    total_count = use_case.count(
        tenant_id=context.tenant.id,
        product_id=product_id,
        movement_type=type,
        start_date=start_date,
        end_date=end_date,
    )
    total_pages = math.ceil(total_count / limit) if limit > 0 else 1

    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Total-Pages"] = str(total_pages)

    expose = response.headers.get("Access-Control-Expose-Headers")
    headers_to_expose = ["X-Total-Count", "X-Total-Pages"]
    if expose:
        parts = [p.strip() for p in expose.split(",")]
        for h in headers_to_expose:
            if h not in parts:
                parts.append(h)
        response.headers["Access-Control-Expose-Headers"] = ", ".join(parts)
    else:
        response.headers["Access-Control-Expose-Headers"] = ", ".join(headers_to_expose)

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


@router.get("/summary", response_model=InventorySummaryResponseDto)
def get_inventory_summary_endpoint(
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """
    Retorna o resumo consolidado de KPIs do estoque e movimentações do tenant nas últimas 24 horas.
    Acessível a qualquer membro ativo do tenant (OWNER, GESTOR, ALMOXARIFE, AUDITOR).
    Rejeitado com HTTP 403 se o usuário não possuir vínculo ativo com o tenant.
    """
    _check_summary_role_permission(context.role)
    uow = InventoryUnitOfWork(db)
    use_case = GetInventorySummaryUseCase(uow)
    return use_case.execute(tenant_id=context.tenant.id)

