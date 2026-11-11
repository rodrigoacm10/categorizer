from typing import Optional, List, Union
from uuid import UUID
from sqlalchemy.orm import Session

from app.modules.products.infrastructure.models import CategoryModel


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
