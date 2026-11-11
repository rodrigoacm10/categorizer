from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from app.modules.products.infrastructure.models import Product, Category
from app.modules.inventory.infrastructure.models import StockMovement
from app.modules.products.application.dtos import (
    ProductCreateDto,
    ProductUpdateDto,
    ProductResponseDto,
    CategoryCreateDto,
    CategoryResponseDto,
)
from app.shared.utils.scale import to_scaled_int


def create_category(db: Session, dto: CategoryCreateDto, tenant_id: UUID) -> CategoryResponseDto:
    existing = (
        db.query(Category)
        .filter(Category.tenant_id == tenant_id, Category.name.ilike(dto.name.strip()))
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Categoria '{dto.name}' já cadastrada no tenant.",
        )
    cat = Category(
        tenant_id=tenant_id,
        name=dto.name.strip(),
        description=dto.description,
        color=dto.color or "#3B82F6",
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryResponseDto.model_validate(cat)


def list_categories(db: Session, tenant_id: UUID) -> List[CategoryResponseDto]:
    cats = (
        db.query(Category)
        .filter(Category.tenant_id == tenant_id)
        .order_by(Category.name.asc())
        .all()
    )
    return [CategoryResponseDto.model_validate(c) for c in cats]


def create_product(
    db: Session,
    dto: ProductCreateDto,
    tenant_id: UUID,
    idempotency_key: Optional[str] = None,
) -> ProductResponseDto:
    # Verifica duplicidade de nome em produtos ativos no mesmo tenant
    existing = (
        db.query(Product)
        .filter(
            Product.tenant_id == tenant_id,
            Product.name.ilike(dto.name.strip()),
            Product.is_active == True,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Já existe um produto ativo com o nome '{dto.name}' neste tenant.",
        )

    # Resolve categorias isoladas pelo tenant
    categories = []
    if dto.category_ids:
        categories = (
            db.query(Category)
            .filter(Category.tenant_id == tenant_id, Category.id.in_(dto.category_ids))
            .all()
        )

    scaled_initial_qty = to_scaled_int(dto.initial_quantity or 0)
    scaled_min_stock = to_scaled_int(dto.min_stock) if dto.min_stock is not None else None

    product = Product(
        tenant_id=tenant_id,
        name=dto.name.strip(),
        description=dto.description,
        unit=dto.unit.strip().upper(),
        current_quantity=scaled_initial_qty,
        min_stock=scaled_min_stock,
        is_active=True,
        categories=categories,
    )
    db.add(product)
    db.flush()

    # Se informou quantidade inicial > 0, cria o primeiro registro no Ledger com tenant_id
    if scaled_initial_qty > 0:
        movement = StockMovement(
            tenant_id=tenant_id,
            product_id=product.id,
            type="IN",
            quantity=scaled_initial_qty,
            balance_after=scaled_initial_qty,
            reason="Estoque inicial de cadastro",
            idempotency_key=idempotency_key,
        )
        db.add(movement)

    db.commit()
    db.refresh(product)
    return ProductResponseDto.from_orm_model(product)


def list_products(
    db: Session,
    tenant_id: UUID,
    category_ids: Optional[List[str]] = None,
    search: Optional[str] = None,
    include_inactive: bool = False,
) -> List[ProductResponseDto]:
    query = db.query(Product).filter(Product.tenant_id == tenant_id)

    if not include_inactive:
        query = query.filter(Product.is_active == True)

    if search:
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            (Product.name.ilike(search_filter)) | (Product.description.ilike(search_filter))
        )

    if category_ids:
        query = query.join(Product.categories).filter(Category.id.in_(category_ids)).distinct()

    products = query.order_by(Product.name.asc()).all()
    return [ProductResponseDto.from_orm_model(p) for p in products]


def get_product_by_id(db: Session, product_id: str, tenant_id: UUID) -> ProductResponseDto:
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.tenant_id == tenant_id)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado.",
        )
    return ProductResponseDto.from_orm_model(product)


def update_product(
    db: Session,
    product_id: str,
    dto: ProductUpdateDto,
    tenant_id: UUID,
) -> ProductResponseDto:
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.tenant_id == tenant_id)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado.",
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
        categories = (
            db.query(Category)
            .filter(Category.tenant_id == tenant_id, Category.id.in_(dto.category_ids))
            .all()
        )
        product.categories = categories

    db.commit()
    db.refresh(product)
    return ProductResponseDto.from_orm_model(product)


def delete_product(
    db: Session,
    product_id: str,
    tenant_id: UUID,
    reason: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> dict:
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.tenant_id == tenant_id)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado.",
        )

    if not product.is_active:
        return {"message": "Produto já se encontra removido.", "product_id": product_id}

    # Registra no Ledger a exclusão com tenant_id
    movement = StockMovement(
        tenant_id=tenant_id,
        product_id=product.id,
        type="PRODUCT_DELETED",
        quantity=0,
        balance_after=product.current_quantity,
        reason=reason or "Produto removido do catálogo ativo",
        idempotency_key=idempotency_key,
    )
    db.add(movement)

    # Marca soft-delete
    product.is_active = False
    product.deleted_at = datetime.now(timezone.utc)

    db.commit()
    return {
        "message": f"Produto '{product.name}' removido com sucesso. Histórico de auditoria preservado.",
        "product_id": str(product.id),
        "remaining_quantity_scaled": product.current_quantity,
    }
