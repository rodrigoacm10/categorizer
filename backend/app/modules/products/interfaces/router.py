from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from app.shared.infrastructure.database import get_db
from app.modules.products.application.dtos import (
    ProductCreateDto, ProductUpdateDto, ProductResponseDto,
    CategoryCreateDto, CategoryResponseDto
)
from app.modules.products.application import use_cases
from app.modules.idempotency.interfaces.guard import check_or_start_idempotency
from app.modules.idempotency.infrastructure.repositories import IdempotencyRepository

router = APIRouter()

# ----------------- CATEGORIAS -----------------

@router.post("/categories", response_model=CategoryResponseDto, status_code=status.HTTP_201_CREATED)
def create_category_endpoint(dto: CategoryCreateDto, db: Session = Depends(get_db)):
    return use_cases.create_category(db, dto)

@router.get("/categories", response_model=List[CategoryResponseDto])
def list_categories_endpoint(db: Session = Depends(get_db)):
    return use_cases.list_categories(db)

# ----------------- PRODUTOS -----------------

@router.post("/products", response_model=ProductResponseDto, status_code=status.HTTP_201_CREATED)
def create_product_endpoint(
    dto: ProductCreateDto,
    response: Response,
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    endpoint = "/api/products"
    key, cached_response = check_or_start_idempotency(
        db=db,
        endpoint=endpoint,
        payload=dto.model_dump(),
        client_key=x_idempotency_key
    )

    if cached_response:
        response.headers["X-Cache"] = "HIT"
        response.headers["X-Idempotency-Key"] = key
        return cached_response

    try:
        created = use_cases.create_product(db, dto, idempotency_key=key)
        # Salva o resultado no registro de idempotência
        IdempotencyRepository(db).resolve(
            key=key,
            response_code=status.HTTP_201_CREATED,
            response_body=json.dumps(created.model_dump(), default=str)
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return created
    except Exception as exc:
        IdempotencyRepository(db).fail(key, str(exc))
        raise exc

@router.get("/products", response_model=List[ProductResponseDto])
def list_products_endpoint(
    category_id: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db)
):
    return use_cases.list_products(
        db=db,
        category_ids=category_id,
        search=search,
        include_inactive=include_inactive
    )

@router.get("/products/{product_id}", response_model=ProductResponseDto)
def get_product_endpoint(product_id: str, db: Session = Depends(get_db)):
    return use_cases.get_product_by_id(db, product_id)

@router.put("/products/{product_id}", response_model=ProductResponseDto)
def update_product_endpoint(product_id: str, dto: ProductUpdateDto, db: Session = Depends(get_db)):
    return use_cases.update_product(db, product_id, dto)

@router.delete("/products/{product_id}")
def delete_product_endpoint(
    product_id: str,
    response: Response,
    reason: Optional[str] = Query(None),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    endpoint = f"/api/products/{product_id}:delete"
    key, cached = check_or_start_idempotency(
        db=db,
        endpoint=endpoint,
        payload={"product_id": product_id, "reason": reason},
        client_key=x_idempotency_key
    )
    if cached:
        response.headers["X-Cache"] = "HIT"
        return cached

    try:
        res = use_cases.delete_product(db, product_id, reason=reason, idempotency_key=key)
        IdempotencyRepository(db).resolve(key, 200, json.dumps(res))
        return res
    except Exception as exc:
        IdempotencyRepository(db).fail(key, str(exc))
        raise exc
