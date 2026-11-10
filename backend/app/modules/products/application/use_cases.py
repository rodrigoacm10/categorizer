from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import List, Optional
from datetime import datetime, timezone
from app.modules.products.infrastructure.models import Product, Category
from app.modules.inventory.infrastructure.models import StockMovement
from app.modules.products.application.dtos import (
    ProductCreateDto, ProductUpdateDto, ProductResponseDto,
    CategoryCreateDto, CategoryResponseDto
)
from app.shared.utils.scale import to_scaled_int

def create_category(db: Session, dto: CategoryCreateDto) -> CategoryResponseDto:
    existing = db.query(Category).filter(Category.name.ilike(dto.name.strip())).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Categoria '{dto.name}' já cadastrada."
        )
    cat = Category(
        name=dto.name.strip(),
        description=dto.description,
        color=dto.color or "#3B82F6"
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryResponseDto.model_validate(cat)

def list_categories(db: Session) -> List[CategoryResponseDto]:
    cats = db.query(Category).order_by(Category.name.asc()).all()
    return [CategoryResponseDto.model_validate(c) for c in cats]

def create_product(db: Session, dto: ProductCreateDto, idempotency_key: Optional[str] = None) -> ProductResponseDto:
    # Verifica duplicidade de nome em produtos ativos
    existing = db.query(Product).filter(
        Product.name.ilike(dto.name.strip()),
        Product.is_active == True
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Já existe um produto ativo com o nome '{dto.name}'."
        )

    # Resolve categorias
    categories = []
    if dto.category_ids:
        categories = db.query(Category).filter(Category.id.in_(dto.category_ids)).all()

    scaled_initial_qty = to_scaled_int(dto.initial_quantity or 0)
    scaled_min_stock = to_scaled_int(dto.min_stock) if dto.min_stock is not None else None

    product = Product(
        name=dto.name.strip(),
        description=dto.description,
        unit=dto.unit.strip().upper(),
        current_quantity=scaled_initial_qty,
        min_stock=scaled_min_stock,
        is_active=True,
        categories=categories
    )
    db.add(product)
    db.flush()

    # Se informou quantidade inicial > 0, cria o primeiro registro no Ledger
    if scaled_initial_qty > 0:
        movement = StockMovement(
            product_id=product.id,
            type="IN",
            quantity=scaled_initial_qty,
            balance_after=scaled_initial_qty,
            reason="Estoque inicial de cadastro",
            idempotency_key=idempotency_key
        )
        db.add(movement)

    db.commit()
    db.refresh(product)
    return ProductResponseDto.from_orm_model(product)

def list_products(
    db: Session,
    category_ids: Optional[List[str]] = None,
    search: Optional[str] = None,
    include_inactive: bool = False
) -> List[ProductResponseDto]:
    query = db.query(Product)
    
    if not include_inactive:
        query = query.filter(Product.is_active == True)

    if search:
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            (Product.name.ilike(search_filter)) | 
            (Product.description.ilike(search_filter))
        )

    if category_ids:
        # Produto que possui QUALQUER UMA das categorias filtradas
        query = query.join(Product.categories).filter(Category.id.in_(category_ids)).distinct()

    products = query.order_by(Product.name.asc()).all()
    return [ProductResponseDto.from_orm_model(p) for p in products]

def get_product_by_id(db: Session, product_id: str) -> ProductResponseDto:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )
    return ProductResponseDto.from_orm_model(product)

def update_product(db: Session, product_id: str, dto: ProductUpdateDto) -> ProductResponseDto:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )

    if dto.name is not None:
        product.name = dto.name.strip()
    if dto.description is not None:
        product.description = dto.description
    if dto.unit is not None:
        product.unit = dto.unit.strip().upper()
    if dto.min_stock is not None:
        product.min_stock = to_scaled_int(dto.min_stock)
    if dto.category_ids is not None:
        categories = db.query(Category).filter(Category.id.in_(dto.category_ids)).all()
        product.categories = categories

    db.commit()
    db.refresh(product)
    return ProductResponseDto.from_orm_model(product)

def delete_product(db: Session, product_id: str, reason: Optional[str] = None, idempotency_key: Optional[str] = None) -> dict:
    """
    Regra de Ouro:
    - O produto é removido do catálogo ativo (is_active = False, deleted_at = NOW()).
    - O histórico de movimentações NUNCA é apagado.
    - É gerado um registro de auditoria imutável no Ledger (tipo: PRODUCT_DELETED).
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )

    if not product.is_active:
        return {"message": "Produto já se encontra removido.", "product_id": product_id}

    # Registra no Ledger a exclusão
    movement = StockMovement(
        product_id=product.id,
        type="PRODUCT_DELETED",
        quantity=0,
        balance_after=product.current_quantity,
        reason=reason or "Produto removido do catálogo ativo",
        idempotency_key=idempotency_key
    )
    db.add(movement)

    # Marca soft-delete
    product.is_active = False
    product.deleted_at = datetime.now(timezone.utc)

    db.commit()
    return {
        "message": f"Produto '{product.name}' removido com sucesso. Histórico de auditoria preservado.",
        "product_id": str(product.id),
        "remaining_quantity_scaled": product.current_quantity
    }
