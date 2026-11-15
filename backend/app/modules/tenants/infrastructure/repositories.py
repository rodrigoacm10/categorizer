from typing import Optional, List
from uuid import UUID
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from app.modules.auth.infrastructure.models import UserModel
from app.modules.tenants.domain.entities import TenantRole
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

    def list_by_tenant_paginated(
        self,
        tenant_id: UUID,
        role: Optional[TenantRole] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[TenantMembershipModel]:
        query = (
            self.db.query(TenantMembershipModel)
            .join(UserModel, TenantMembershipModel.user_id == UserModel.id)
            .options(joinedload(TenantMembershipModel.user))
            .filter(TenantMembershipModel.tenant_id == tenant_id)
        )
        if role is not None:
            role_value = role.value if isinstance(role, TenantRole) else str(role)
            query = query.filter(TenantMembershipModel.role == role_value)
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    UserModel.email.ilike(term),
                    UserModel.full_name.ilike(term),
                )
            )
        return (
            query.order_by(TenantMembershipModel.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def count_by_tenant(
        self,
        tenant_id: UUID,
        role: Optional[TenantRole] = None,
        search: Optional[str] = None,
    ) -> int:
        query = (
            self.db.query(TenantMembershipModel)
            .filter(TenantMembershipModel.tenant_id == tenant_id)
        )
        if role is not None:
            role_value = role.value if isinstance(role, TenantRole) else str(role)
            query = query.filter(TenantMembershipModel.role == role_value)
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.join(UserModel, TenantMembershipModel.user_id == UserModel.id).filter(
                or_(
                    UserModel.email.ilike(term),
                    UserModel.full_name.ilike(term),
                )
            )
        return query.count()

    def get_role_counts(self, tenant_id: UUID) -> dict:
        rows = (
            self.db.query(TenantMembershipModel.role, func.count(TenantMembershipModel.id))
            .filter(TenantMembershipModel.tenant_id == tenant_id)
            .group_by(TenantMembershipModel.role)
            .all()
        )
        counts = {r: c for r, c in rows}
        owners = counts.get(TenantRole.OWNER.value, 0)
        gestores = counts.get(TenantRole.GESTOR.value, 0)
        almoxarifes = counts.get(TenantRole.ALMOXARIFE.value, 0)
        auditores = counts.get(TenantRole.AUDITOR.value, 0)
        total = sum(counts.values())

        return {
            "total": total,
            "owners": owners,
            "gestores": gestores,
            "almoxarifes": almoxarifes,
            "auditores": auditores,
            "total_members": total,
            "owners_count": owners,
            "gestores_count": gestores,
            "almoxarifes_count": almoxarifes,
            "auditores_count": auditores,
        }
