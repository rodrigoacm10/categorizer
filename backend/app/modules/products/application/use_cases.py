from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import List, Optional, Union
from uuid import UUID
from datetime import datetime, timezone

from app.modules.products.infrastructure.models import ProductModel, CategoryModel
from app.modules.inventory.infrastructure.models import StockMovementModel
from app.modules.products.infrastructure.repositories import (
    SQLAlchemyProductRepository,
    SQLAlchemyCategoryRepository,
)
from app.modules.products.application.dtos import (
    ProductCreateDTO,
    ProductUpdateDTO,
    ProductResponseDTO,
    CategoryCreateDTO,
    CategoryResponseDTO,
)
from app.shared.domain.exceptions import (
    ProductNotFoundError,
    CategoryNotFoundError,
    ProductAlreadyExistsError,
    CategoryAlreadyExistsError,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CreateCategoryUseCase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SQLAlchemyCategoryRepository(db)

    def execute(self, dto: CategoryCreateDTO, tenant_id: UUID) -> CategoryResponseDTO:
        clean_name = dto.name.strip()
        existing = self.repo.get_by_name(clean_name, tenant_id)
        if existing:
            raise CategoryAlreadyExistsError(
                detail=f"Categoria '{dto.name}' já cadastrada no tenant."
            )

        cat = CategoryModel(
            tenant_id=tenant_id,
            name=clean_name,
            description=dto.description,
            color=dto.color or "#3B82F6",
        )
        self.repo.create(cat)
        self.db.commit()
        self.db.refresh(cat)
        return CategoryResponseDTO.model_validate(cat)


class ListCategoriesUseCase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SQLAlchemyCategoryRepository(db)

    def execute(self, tenant_id: UUID) -> List[CategoryResponseDTO]:
        categories = self.repo.list(tenant_id)
        counts = self.repo.get_products_count_by_category(tenant_id)
        return [
            CategoryResponseDTO(
                id=str(c.id),
                name=c.name,
                description=c.description,
                color=c.color,
                created_at=c.created_at,
                products_count=counts.get(c.id, 0),
            )
            for c in categories
        ]


class DeleteCategoryUseCase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SQLAlchemyCategoryRepository(db)

    def execute(self, category_id: Union[UUID, str], tenant_id: UUID) -> None:
        cat = self.repo.get_by_id(category_id, tenant_id)
        if not cat:
            raise CategoryNotFoundError(detail="Categoria não encontrada.")

        self.repo.delete(cat)
        self.db.commit()


class CreateProductUseCase:
    def __init__(self, db: Session):
        self.db = db
        self.product_repo = SQLAlchemyProductRepository(db)
        self.category_repo = SQLAlchemyCategoryRepository(db)

    def execute(
        self,
        dto: ProductCreateDTO,
        tenant_id: UUID,
        idempotency_key: Optional[str] = None,
    ) -> ProductResponseDTO:
        clean_name = dto.name.strip()
        existing = self.product_repo.get_by_name(clean_name, tenant_id, is_active=True)
        if existing:
            raise ProductAlreadyExistsError(
                detail=f"Já existe um produto ativo com o nome '{dto.name}' neste tenant."
            )

        categories = []
        if dto.category_ids:
            categories = self.category_repo.get_by_ids(dto.category_ids, tenant_id)
            if len(categories) != len(set(dto.category_ids)):
                found_ids = {str(c.id) for c in categories}
                missing = [cid for cid in dto.category_ids if str(cid) not in found_ids]
                raise CategoryNotFoundError(
                    detail=f"Categorias com IDs {missing} não foram encontradas no tenant."
                )

        initial_qty_scaled = dto.initial_quantity_raw
        min_stock_scaled = dto.min_stock_raw

        product = ProductModel(
            tenant_id=tenant_id,
            name=clean_name,
            description=dto.description,
            unit=dto.unit.strip().upper(),
            current_quantity=initial_qty_scaled,
            min_stock=min_stock_scaled,
            is_active=True,
            categories=categories,
        )
        self.product_repo.create(product)
        self.db.flush()

        if initial_qty_scaled > 0:
            movement = StockMovementModel(
                tenant_id=tenant_id,
                product_id=product.id,
                type="IN",
                quantity=initial_qty_scaled,
                balance_after=initial_qty_scaled,
                reason="Estoque inicial de cadastro",
                idempotency_key=idempotency_key,
            )
            self.db.add(movement)

        self.db.commit()
        self.db.refresh(product)
        return ProductResponseDTO.from_orm_model(product)


class ListProductsUseCase:
    def __init__(self, db: Session):
        self.db = db
        self.product_repo = SQLAlchemyProductRepository(db)

    def execute(
        self,
        tenant_id: UUID,
        category_id: Optional[Union[UUID, str, List[Union[UUID, str]]]] = None,
        low_stock_only: bool = False,
        search: Optional[str] = None,
        include_inactive: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ProductResponseDTO]:
        products = self.product_repo.list(
            tenant_id=tenant_id,
            category_id=category_id,
            low_stock_only=low_stock_only,
            search=search,
            include_inactive=include_inactive,
            limit=limit,
            offset=offset,
        )
        return [ProductResponseDTO.from_orm_model(p) for p in products]

    def count(
        self,
        tenant_id: UUID,
        category_id: Optional[Union[UUID, str, List[Union[UUID, str]]]] = None,
        low_stock_only: bool = False,
        search: Optional[str] = None,
        include_inactive: bool = False,
    ) -> int:
        return self.product_repo.count(
            tenant_id=tenant_id,
            category_id=category_id,
            low_stock_only=low_stock_only,
            search=search,
            include_inactive=include_inactive,
        )


class GetProductByIdUseCase:
    def __init__(self, db: Session):
        self.db = db
        self.product_repo = SQLAlchemyProductRepository(db)

    def execute(
        self,
        product_id: Union[UUID, str],
        tenant_id: UUID,
        include_inactive: bool = False,
    ) -> ProductResponseDTO:
        product = self.product_repo.get_by_id(
            product_id=product_id,
            tenant_id=tenant_id,
            include_inactive=include_inactive,
        )
        if not product:
            raise ProductNotFoundError(detail="Produto não encontrado.")
        return ProductResponseDTO.from_orm_model(product)


class UpdateProductUseCase:
    def __init__(self, db: Session):
        self.db = db
        self.product_repo = SQLAlchemyProductRepository(db)
        self.category_repo = SQLAlchemyCategoryRepository(db)

    def execute(
        self,
        product_id: Union[UUID, str],
        dto: ProductUpdateDTO,
        tenant_id: UUID,
    ) -> ProductResponseDTO:
        product = self.product_repo.get_by_id(
            product_id=product_id,
            tenant_id=tenant_id,
            include_inactive=True,
        )
        if not product:
            raise ProductNotFoundError(detail="Produto não encontrado.")

        if dto.name is not None:
            clean_name = dto.name.strip()
            existing = self.product_repo.get_by_name(clean_name, tenant_id, is_active=True)
            if existing and existing.id != product.id:
                raise ProductAlreadyExistsError(
                    detail=f"Já existe outro produto ativo com o nome '{clean_name}' neste tenant."
                )
            product.name = clean_name

        if dto.description is not None:
            product.description = dto.description

        if dto.unit is not None:
            product.unit = dto.unit.strip().upper()

        if dto.min_stock is not None:
            product.min_stock = dto.min_stock_raw

        if dto.category_ids is not None:
            categories = self.category_repo.get_by_ids(dto.category_ids, tenant_id)
            if len(categories) != len(set(dto.category_ids)):
                found_ids = {str(c.id) for c in categories}
                missing = [cid for cid in dto.category_ids if str(cid) not in found_ids]
                raise CategoryNotFoundError(
                    detail=f"Categorias com IDs {missing} não foram encontradas no tenant."
                )
            product.categories = categories

        # REGRA INEGOCIÁVEL: current_quantity NÃO é alterado aqui!
        product.updated_at = utc_now()
        self.db.commit()
        self.db.refresh(product)
        return ProductResponseDTO.from_orm_model(product)


class SoftDeleteProductUseCase:
    def __init__(self, db: Session):
        self.db = db
        self.product_repo = SQLAlchemyProductRepository(db)

    def execute(
        self,
        product_id: Union[UUID, str],
        tenant_id: UUID,
        reason: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> dict:
        product = self.product_repo.get_by_id(
            product_id=product_id,
            tenant_id=tenant_id,
            include_inactive=True,
        )
        if not product:
            raise ProductNotFoundError(detail="Produto não encontrado.")

        if not product.is_active:
            return {
                "message": "Produto já se encontra removido.",
                "product_id": str(product.id),
                "remaining_quantity_scaled": product.current_quantity,
            }

        # Registra evento imutável no Ledger
        movement = StockMovementModel(
            tenant_id=tenant_id,
            product_id=product.id,
            type="PRODUCT_DELETED",
            quantity=0,
            balance_after=product.current_quantity,
            reason=reason or "Produto removido do catálogo ativo",
            idempotency_key=idempotency_key,
        )
        self.db.add(movement)

        # Marca soft-delete
        product.is_active = False
        product.deleted_at = utc_now()
        product.updated_at = utc_now()

        self.db.commit()
        return {
            "message": f"Produto '{product.name}' removido com sucesso. Histórico de auditoria preservado.",
            "product_id": str(product.id),
            "remaining_quantity_scaled": product.current_quantity,
        }


# Procedural convenience wrappers for backwards compatibility
def create_category(db: Session, dto: CategoryCreateDTO, tenant_id: UUID) -> CategoryResponseDTO:
    return CreateCategoryUseCase(db).execute(dto, tenant_id)


def list_categories(db: Session, tenant_id: UUID) -> List[CategoryResponseDTO]:
    return ListCategoriesUseCase(db).execute(tenant_id)


def delete_category(db: Session, category_id: Union[UUID, str], tenant_id: UUID) -> None:
    return DeleteCategoryUseCase(db).execute(category_id, tenant_id)


def create_product(
    db: Session,
    dto: ProductCreateDTO,
    tenant_id: UUID,
    idempotency_key: Optional[str] = None,
) -> ProductResponseDTO:
    return CreateProductUseCase(db).execute(dto, tenant_id, idempotency_key=idempotency_key)


def list_products(
    db: Session,
    tenant_id: UUID,
    category_ids: Optional[Union[UUID, str, List[Union[UUID, str]]]] = None,
    category_id: Optional[Union[UUID, str, List[Union[UUID, str]]]] = None,
    low_stock_only: bool = False,
    search: Optional[str] = None,
    include_inactive: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> List[ProductResponseDTO]:
    cat_filter = category_id if category_id is not None else category_ids
    return ListProductsUseCase(db).execute(
        tenant_id=tenant_id,
        category_id=cat_filter,
        low_stock_only=low_stock_only,
        search=search,
        include_inactive=include_inactive,
        limit=limit,
        offset=offset,
    )


def count_products(
    db: Session,
    tenant_id: UUID,
    category_ids: Optional[Union[UUID, str, List[Union[UUID, str]]]] = None,
    category_id: Optional[Union[UUID, str, List[Union[UUID, str]]]] = None,
    low_stock_only: bool = False,
    search: Optional[str] = None,
    include_inactive: bool = False,
) -> int:
    cat_filter = category_id if category_id is not None else category_ids
    return ListProductsUseCase(db).count(
        tenant_id=tenant_id,
        category_id=cat_filter,
        low_stock_only=low_stock_only,
        search=search,
        include_inactive=include_inactive,
    )


def get_product_by_id(
    db: Session, product_id: Union[UUID, str], tenant_id: UUID, include_inactive: bool = False
) -> ProductResponseDTO:
    return GetProductByIdUseCase(db).execute(product_id, tenant_id, include_inactive=include_inactive)


def update_product(
    db: Session,
    product_id: Union[UUID, str],
    dto: ProductUpdateDTO,
    tenant_id: UUID,
) -> ProductResponseDTO:
    return UpdateProductUseCase(db).execute(product_id, dto, tenant_id)


def delete_product(
    db: Session,
    product_id: Union[UUID, str],
    tenant_id: UUID,
    reason: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> dict:
    return SoftDeleteProductUseCase(db).execute(
        product_id, tenant_id, reason=reason, idempotency_key=idempotency_key
    )
