from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from app.shared.infrastructure.database import get_db
from app.modules.inventory.application.dtos import (
    CreateStockMovementDto, StockMovementResponseDto, MovementTypeEnum
)
from app.modules.inventory.application import use_cases
from app.modules.idempotency.interfaces.guard import check_or_start_idempotency
from app.modules.idempotency.infrastructure.repositories import IdempotencyRepository
from app.modules.tenants.interfaces.context import TenantContext, get_tenant_context
from app.modules.tenants.interfaces.rbac import require_roles
from app.modules.tenants.domain.entities import TenantRole
from app.shared.domain.exceptions import InsufficientPermissionsError

router = APIRouter()


def _check_movement_role_permission(role: TenantRole, movement_type: MovementTypeEnum):
    if movement_type in (MovementTypeEnum.IN, MovementTypeEnum.OUT):
        if role not in (TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE):
            raise InsufficientPermissionsError(
                detail=f"Papel '{role.value}' não possui permissão para registrar {movement_type.value}."
            )
    elif movement_type == MovementTypeEnum.ADJUSTMENT:
        if role not in (TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE, TenantRole.AUDITOR):
            raise InsufficientPermissionsError(
                detail=f"Papel '{role.value}' não possui permissão para registrar ajustes de estoque."
            )


@router.post("/movements", response_model=StockMovementResponseDto, status_code=status.HTTP_201_CREATED)
def create_movement_endpoint(
    dto: CreateStockMovementDto,
    response: Response,
    context: TenantContext = Depends(get_tenant_context),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Registra movimentação de estoque com proteção rigorosa de idempotência e isolamento por tenant.
    """
    _check_movement_role_permission(context.role, dto.type)

    endpoint = "/api/inventory/movements"
    key, cached_response = check_or_start_idempotency(
        db=db,
        endpoint=endpoint,
        payload=dto.model_dump(),
        client_key=x_idempotency_key,
        tenant_id=context.tenant.id,
    )

    if cached_response:
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Idempotency-Key"] = key
        return cached_response

    try:
        movement = use_cases.process_stock_movement(
            db, dto, tenant_id=context.tenant.id, idempotency_key=key
        )
        
        # Salva o resultado no registro de idempotência
        IdempotencyRepository(db).resolve(
            key=key,
            response_code=status.HTTP_201_CREATED,
            response_body=json.dumps(movement.model_dump(), default=str),
            tenant_id=context.tenant.id,
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return movement
    except Exception as exc:
        IdempotencyRepository(db).fail(key, str(exc), tenant_id=context.tenant.id)
        raise exc


@router.post("/in", response_model=StockMovementResponseDto, status_code=status.HTTP_201_CREATED)
def stock_in_endpoint(
    dto: CreateStockMovementDto,
    response: Response,
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE)),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    dto.type = MovementTypeEnum.IN
    return create_movement_endpoint(dto, response, context, x_idempotency_key, db)


@router.post("/out", response_model=StockMovementResponseDto, status_code=status.HTTP_201_CREATED)
def stock_out_endpoint(
    dto: CreateStockMovementDto,
    response: Response,
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE)),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    dto.type = MovementTypeEnum.OUT
    return create_movement_endpoint(dto, response, context, x_idempotency_key, db)


@router.post("/adjustment", response_model=StockMovementResponseDto, status_code=status.HTTP_201_CREATED)
def stock_adjustment_endpoint(
    dto: CreateStockMovementDto,
    response: Response,
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE, TenantRole.AUDITOR)),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    dto.type = MovementTypeEnum.ADJUSTMENT
    return create_movement_endpoint(dto, response, context, x_idempotency_key, db)


@router.get("/movements", response_model=List[StockMovementResponseDto])
def list_movements_endpoint(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    type: Optional[str] = Query(None),
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    return use_cases.list_all_movements(
        db=db,
        tenant_id=context.tenant.id,
        limit=limit,
        offset=offset,
        movement_type=type
    )


@router.get("/products/{product_id}/ledger", response_model=List[StockMovementResponseDto])
def get_product_ledger_endpoint(
    product_id: str,
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    return use_cases.get_product_ledger(db, product_id, tenant_id=context.tenant.id)
