from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import List, Optional
from app.modules.products.infrastructure.models import Product
from app.modules.inventory.infrastructure.models import StockMovement
from app.modules.inventory.application.dtos import (
    CreateStockMovementDto, StockMovementResponseDto, MovementTypeEnum
)
from app.shared.utils.scale import to_scaled_int, from_scaled_int

def process_stock_movement(
    db: Session,
    dto: CreateStockMovementDto,
    idempotency_key: Optional[str] = None
) -> StockMovementResponseDto:
    # Busca o produto com lock transacional
    product = db.query(Product).filter(Product.id == dto.product_id).with_for_update().first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )

    if not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Não é possível movimentar o estoque do produto '{product.name}' pois ele está inativo/removido."
        )

    scaled_qty = to_scaled_int(dto.quantity)
    current_balance = product.current_quantity

    if dto.type == MovementTypeEnum.IN:
        if scaled_qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A quantidade de entrada deve ser maior que zero."
            )
        delta = scaled_qty
        new_balance = current_balance + delta

    elif dto.type == MovementTypeEnum.OUT:
        if scaled_qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A quantidade de saída deve ser maior que zero."
            )
        if current_balance < scaled_qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Saldo insuficiente. Saldo disponível: {from_scaled_int(current_balance)} {product.unit}, solicitado para saída: {from_scaled_int(scaled_qty)} {product.unit}."
            )
        delta = -scaled_qty
        new_balance = current_balance - scaled_qty

    elif dto.type == MovementTypeEnum.ADJUSTMENT:
        if scaled_qty < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A nova quantidade do ajuste não pode ser negativa."
            )
        delta = scaled_qty - current_balance
        new_balance = scaled_qty

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de movimentação inválido: {dto.type}"
        )

    # Atualiza saldo do produto
    product.current_quantity = new_balance

    # Grava registro imutável no Ledger
    movement = StockMovement(
        product_id=product.id,
        type=dto.type.value,
        quantity=delta,
        balance_after=new_balance,
        reason=dto.reason or ("Entrada no estoque" if dto.type == MovementTypeEnum.IN else "Saída de estoque" if dto.type == MovementTypeEnum.OUT else "Ajuste de inventário"),
        idempotency_key=idempotency_key
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)

    return StockMovementResponseDto.from_orm_model(movement)

def get_product_ledger(db: Session, product_id: str) -> List[StockMovementResponseDto]:
    # Permite ver o histórico mesmo se o produto estiver inativo (requisito de auditoria)
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )

    movements = db.query(StockMovement).filter(
        StockMovement.product_id == product_id
    ).order_by(StockMovement.created_at.desc()).all()

    return [StockMovementResponseDto.from_orm_model(m) for m in movements]

def list_all_movements(
    db: Session,
    limit: int = 100,
    offset: int = 0,
    movement_type: Optional[str] = None
) -> List[StockMovementResponseDto]:
    query = db.query(StockMovement)
    if movement_type:
        query = query.filter(StockMovement.type == movement_type.upper())

    movements = query.order_by(StockMovement.created_at.desc()).offset(offset).limit(limit).all()
    return [StockMovementResponseDto.from_orm_model(m) for m in movements]
