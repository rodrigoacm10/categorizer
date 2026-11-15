from abc import ABC, abstractmethod
from typing import Optional, List
from uuid import UUID
from app.modules.tenants.domain.entities import Tenant, TenantMembership, TenantRole


class ITenantRepository(ABC):
    @abstractmethod
    def get_by_id(self, tenant_id: UUID) -> Optional[Tenant]:
        pass

    @abstractmethod
    def get_by_slug(self, slug: str) -> Optional[Tenant]:
        pass

    @abstractmethod
    def create(self, tenant: Tenant) -> Tenant:
        pass

    @abstractmethod
    def list_by_user_id(self, user_id: UUID) -> List[Tenant]:
        pass


class ITenantMembershipRepository(ABC):
    @abstractmethod
    def get(self, user_id: UUID, tenant_id: UUID) -> Optional[TenantMembership]:
        pass

    @abstractmethod
    def list_by_tenant(self, tenant_id: UUID) -> List[TenantMembership]:
        pass

    @abstractmethod
    def create(self, membership: TenantMembership) -> TenantMembership:
        pass

    @abstractmethod
    def delete(self, user_id: UUID, tenant_id: UUID) -> bool:
        pass

    @abstractmethod
    def list_by_tenant_paginated(
        self,
        tenant_id: UUID,
        role: Optional[TenantRole] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[TenantMembership]:
        pass

    @abstractmethod
    def count_by_tenant(
        self,
        tenant_id: UUID,
        role: Optional[TenantRole] = None,
        search: Optional[str] = None,
    ) -> int:
        pass

    @abstractmethod
    def get_role_counts(self, tenant_id: UUID) -> dict:
        pass
