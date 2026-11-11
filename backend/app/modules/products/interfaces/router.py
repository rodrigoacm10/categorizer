from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.shared.infrastructure.database import get_db
from app.modules.products.application.dtos import (
    ProductCreateDTO,
    ProductUpdateDTO,
    ProductResponseDTO,
    CategoryCreateDTO,
    CategoryResponseDTO,
)
from app.modules.products.application import use_cases
from app.modules.idempotency.interfaces.guard import IdempotencyGuard
from app.modules.tenants.interfaces.context import TenantContext, get_tenant_context
from app.modules.tenants.interfaces.rbac import require_roles
from app.modules.tenants.domain.entities import TenantRole

router = APIRouter()

# ----------------- CATEGORIAS -----------------


@router.post(
    "/categories",
    response_model=CategoryResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Criar categoria",
)
def create_category_endpoint(
    dto: CategoryCreateDTO,
    response: Response,
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR)),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    endpoint = "/api/categories"
    guard = IdempotencyGuard(db, tenant_id=context.tenant.id)
    key, cached = guard.check_or_start(
        endpoint=endpoint,
        payload=dto.model_dump(),
        client_key=x_idempotency_key,
        method="POST",
    )
    if cached:
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Idempotency-Key"] = key
        return cached

    try:
        created = use_cases.create_category(db, dto, tenant_id=context.tenant.id)
        guard.mark_completed(
            key=key,
            response_code=status.HTTP_201_CREATED,
            response_body=created.model_dump(),
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return created
    except Exception as exc:
        guard.mark_failed(key, str(exc))
        raise exc


@router.get(
    "/categories",
    response_model=List[CategoryResponseDTO],
    summary="Listar categorias do tenant",
)
def list_categories_endpoint(
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    return use_cases.list_categories(db, tenant_id=context.tenant.id)


@router.delete(
    "/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir categoria",
)
def delete_category_endpoint(
    category_id: str,
    response: Response,
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR)),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    endpoint = f"/api/categories/{category_id}:delete"
    guard = IdempotencyGuard(db, tenant_id=context.tenant.id)
    key, cached = guard.check_or_start(
        endpoint=endpoint,
        payload={"category_id": category_id},
        client_key=x_idempotency_key,
        method="DELETE",
    )
    if cached:
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Idempotency-Key"] = key
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    try:
        use_cases.delete_category(db, category_id, tenant_id=context.tenant.id)
        guard.mark_completed(
            key=key,
            response_code=status.HTTP_204_NO_CONTENT,
            response_body={},
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as exc:
        guard.mark_failed(key, str(exc))
        raise exc


# ----------------- PRODUTOS -----------------


@router.post(
    "/products",
    response_model=ProductResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Criar produto",
)
def create_product_endpoint(
    dto: ProductCreateDTO,
    response: Response,
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR)),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    endpoint = "/api/products"
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
        created = use_cases.create_product(
            db, dto, tenant_id=context.tenant.id, idempotency_key=key
        )
        guard.mark_completed(
            key=key,
            response_code=status.HTTP_201_CREATED,
            response_body=created.model_dump(),
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return created
    except Exception as exc:
        guard.mark_failed(key, str(exc))
        raise exc


@router.get(
    "/products",
    response_model=List[ProductResponseDTO],
    summary="Listar produtos do tenant",
)
def list_products_endpoint(
    category_id: Optional[List[str]] = Query(None),
    low_stock_only: bool = Query(False),
    search: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    return use_cases.list_products(
        db=db,
        tenant_id=context.tenant.id,
        category_ids=category_id,
        low_stock_only=low_stock_only,
        search=search,
        include_inactive=include_inactive,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/products/{product_id}",
    response_model=ProductResponseDTO,
    summary="Obter produto por ID",
)
def get_product_endpoint(
    product_id: str,
    context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    return use_cases.get_product_by_id(db, product_id, tenant_id=context.tenant.id)


@router.put(
    "/products/{product_id}",
    response_model=ProductResponseDTO,
    summary="Atualizar produto",
)
def update_product_endpoint(
    product_id: str,
    dto: ProductUpdateDTO,
    response: Response,
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR)),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    endpoint = f"/api/products/{product_id}"
    guard = IdempotencyGuard(db, tenant_id=context.tenant.id)
    key, cached = guard.check_or_start(
        endpoint=endpoint,
        payload=dto.model_dump(),
        client_key=x_idempotency_key,
        method="PUT",
    )
    if cached:
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Idempotency-Key"] = key
        return cached

    try:
        updated = use_cases.update_product(db, product_id, dto, tenant_id=context.tenant.id)
        guard.mark_completed(
            key=key,
            response_code=status.HTTP_200_OK,
            response_body=updated.model_dump(),
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return updated
    except Exception as exc:
        guard.mark_failed(key, str(exc))
        raise exc


@router.delete(
    "/products/{product_id}",
    summary="Desativar produto (Soft-delete com evento contábil)",
)
def delete_product_endpoint(
    product_id: str,
    response: Response,
    reason: Optional[str] = Query(None),
    context: TenantContext = Depends(require_roles(TenantRole.OWNER, TenantRole.GESTOR)),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    endpoint = f"/api/products/{product_id}:delete"
    guard = IdempotencyGuard(db, tenant_id=context.tenant.id)
    key, cached = guard.check_or_start(
        endpoint=endpoint,
        payload={"product_id": product_id, "reason": reason},
        client_key=x_idempotency_key,
        method="DELETE",
    )
    if cached:
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Idempotency-Key"] = key
        return cached

    try:
        res = use_cases.delete_product(
            db, product_id, tenant_id=context.tenant.id, reason=reason, idempotency_key=key
        )
        guard.mark_completed(
            key=key,
            response_code=status.HTTP_200_OK,
            response_body=res,
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return res
    except Exception as exc:
        guard.mark_failed(key, str(exc))
        raise exc
