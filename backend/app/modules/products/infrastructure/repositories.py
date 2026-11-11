from typing import Optional, List, Union
from uuid import UUID
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_

from app.modules.products.infrastructure.models import ProductModel, CategoryModel, product_categories


class SQLAlchemyCategoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, category_id: Union[UUID, str], tenant_id: UUID) -> Optional[CategoryModel]:
        cat_uuid = UUID(str(category_id)) if not isinstance(category_id, UUID) else category_id
        return (
            self.db.query(CategoryModel)
            .filter(CategoryModel.id == cat_uuid, CategoryModel.tenant_id == tenant_id)
            .first()
        )

    def get_by_name(self, name: str, tenant_id: UUID) -> Optional[CategoryModel]:
        return (
            self.db.query(CategoryModel)
            .filter(CategoryModel.tenant_id == tenant_id, CategoryModel.name.ilike(name.strip()))
            .first()
        )

    def get_by_ids(self, category_ids: List[Union[UUID, str]], tenant_id: UUID) -> List[CategoryModel]:
        if not category_ids:
            return []
        uuids = [UUID(str(cid)) if not isinstance(cid, UUID) else cid for cid in category_ids]
        return (
            self.db.query(CategoryModel)
            .filter(CategoryModel.tenant_id == tenant_id, CategoryModel.id.in_(uuids))
            .all()
        )

    def list(self, tenant_id: UUID) -> List[CategoryModel]:
        return (
            self.db.query(CategoryModel)
            .filter(CategoryModel.tenant_id == tenant_id)
            .order_by(CategoryModel.name.asc())
            .all()
        )

    def create(self, category: CategoryModel) -> CategoryModel:
        self.db.add(category)
        self.db.flush()
        return category

    def delete(self, category: CategoryModel) -> None:
        self.db.delete(category)
        self.db.flush()


class SQLAlchemyProductRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(
        self, product_id: Union[UUID, str], tenant_id: UUID, include_inactive: bool = False
    ) -> Optional[ProductModel]:
        p_uuid = UUID(str(product_id)) if not isinstance(product_id, UUID) else product_id
        query = (
            self.db.query(ProductModel)
            .options(selectinload(ProductModel.categories))
            .filter(ProductModel.id == p_uuid, ProductModel.tenant_id == tenant_id)
        )
        if not include_inactive:
            query = query.filter(ProductModel.is_active == True)
        return query.first()

    def get_by_name(
        self, name: str, tenant_id: UUID, is_active: Optional[bool] = True
    ) -> Optional[ProductModel]:
        query = self.db.query(ProductModel).filter(
            ProductModel.tenant_id == tenant_id,
            ProductModel.name.ilike(name.strip()),
        )
        if is_active is not None:
            query = query.filter(ProductModel.is_active == is_active)
        return query.first()

    def list(
        self,
        tenant_id: UUID,
        category_id: Optional[Union[UUID, str, List[Union[UUID, str]]]] = None,
        low_stock_only: bool = False,
        search: Optional[str] = None,
        include_inactive: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ProductModel]:
        query = (
            self.db.query(ProductModel)
            .options(selectinload(ProductModel.categories))
            .filter(ProductModel.tenant_id == tenant_id)
        )

        if not include_inactive:
            query = query.filter(ProductModel.is_active == True)

        if category_id:
            if isinstance(category_id, list):
                uuids = [UUID(str(cid)) if not isinstance(cid, UUID) else cid for cid in category_id]
                query = query.filter(ProductModel.categories.any(CategoryModel.id.in_(uuids)))
            else:
                c_uuid = UUID(str(category_id)) if not isinstance(category_id, UUID) else category_id
                query = query.filter(ProductModel.categories.any(CategoryModel.id == c_uuid))

        if low_stock_only:
            query = query.filter(
                ProductModel.min_stock.isnot(None),
                ProductModel.current_quantity <= ProductModel.min_stock,
            )

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    ProductModel.name.ilike(term),
                    ProductModel.description.ilike(term),
                )
            )

        return (
            query.order_by(ProductModel.name.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def create(self, product: ProductModel) -> ProductModel:
        self.db.add(product)
        self.db.flush()
        return product

    def update(self, product: ProductModel) -> ProductModel:
        self.db.flush()
        return product

    def delete(self, product: ProductModel) -> None:
        self.db.flush()


ProductRepository = SQLAlchemyProductRepository
CategoryRepository = SQLAlchemyCategoryRepository
