from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from app.shared.infrastructure.database import get_db
from app.modules.inventory.application.dtos import (
    CreateStockMovementDto, StockMovementResponseDto
)
from app.modules.inventory.application import use_cases
from app.modules.idempotency.interfaces.guard import check_or_start_idempotency
from app.modules.idempotency.infrastructure.repositories import IdempotencyRepository

router = APIRouter()

@router.post("/movements", response_model=StockMovementResponseDto, status_code=status.HTTP_201_CREATED)
def create_movement_endpoint(
    dto: CreateStockMovementDto,
    response: Response,
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Registra movimentação de estoque com proteção rigorosa de idempotência:
    - O backend calcula o hash do payload + rota.
    - Se a mesma chave for reenviada, devolve a resposta cacheada (sem duplicar estoque).
    - Se a mesma chave for enviada com payload alterado, rejeita com 409 Conflict.
    - Se nenhuma chave for enviada, o backend previne duplo clique recente (10s window).
    """
    endpoint = "/api/inventory/movements"
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
        movement = use_cases.process_stock_movement(db, dto, idempotency_key=key)
        
        # Salva o resultado no registro de idempotência
        IdempotencyRepository(db).resolve(
            key=key,
            response_code=status.HTTP_201_CREATED,
            response_body=json.dumps(movement.model_dump(), default=str)
        )
        response.headers["X-Cache"] = "MISS"
        response.headers["X-Idempotency-Key"] = key
        return movement
    except Exception as exc:
        IdempotencyRepository(db).fail(key, str(exc))
        raise exc

@router.get("/movements", response_model=List[StockMovementResponseDto])
def list_movements_endpoint(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return use_cases.list_all_movements(
        db=db,
        limit=limit,
        offset=offset,
        movement_type=type
    )

@router.get("/products/{product_id}/ledger", response_model=List[StockMovementResponseDto])
def get_product_ledger_endpoint(product_id: str, db: Session = Depends(get_db)):
    return use_cases.get_product_ledger(db, product_id)
