from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel


class SQLAlchemyTenantRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, tenant_id: UUID) -> Optional[TenantModel]:
        return self.db.query(TenantModel).filter(TenantModel.id == tenant_id).first()

    def get_by_slug(self, slug: str) -> Optional[TenantModel]:
        return self.db.query(TenantModel).filter(TenantModel.slug == slug.strip().lower()).first()

    def create(self, tenant: TenantModel) -> TenantModel:
        self.db.add(tenant)
        self.db.commit()
        self.db.refresh(tenant)
        return tenant

    def list_by_user_id(self, user_id: UUID) -> List[TenantModel]:
        return (
            self.db.query(TenantModel)
            .join(TenantMembershipModel, TenantModel.id == TenantMembershipModel.tenant_id)
            .filter(TenantMembershipModel.user_id == user_id, TenantModel.is_active == True)
            .order_by(TenantModel.name.asc())
            .all()
        )


class SQLAlchemyMembershipRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, user_id: UUID, tenant_id: UUID) -> Optional[TenantMembershipModel]:
        return (
            self.db.query(TenantMembershipModel)
            .filter(
                TenantMembershipModel.user_id == user_id,
                TenantMembershipModel.tenant_id == tenant_id,
            )
            .first()
        )

    def list_by_tenant(self, tenant_id: UUID) -> List[TenantMembershipModel]:
        return (
            self.db.query(TenantMembershipModel)
            .filter(TenantMembershipModel.tenant_id == tenant_id)
            .all()
        )

    def list_by_user(self, user_id: UUID) -> List[TenantMembershipModel]:
        return (
            self.db.query(TenantMembershipModel)
            .filter(TenantMembershipModel.user_id == user_id)
            .all()
        )

    def create(self, membership: TenantMembershipModel) -> TenantMembershipModel:
        self.db.add(membership)
        self.db.commit()
        self.db.refresh(membership)
        return membership

    def delete(self, membership: TenantMembershipModel):
        self.db.delete(membership)
        self.db.commit()

    def count_owners(self, tenant_id: UUID) -> int:
        return (
            self.db.query(TenantMembershipModel)
            .filter(
                TenantMembershipModel.tenant_id == tenant_id,
                TenantMembershipModel.role == "OWNER",
            )
            .count()
        )
