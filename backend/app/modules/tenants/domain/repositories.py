from abc import ABC, abstractmethod
from typing import Optional, List
from uuid import UUID
from app.modules.tenants.domain.entities import Tenant, TenantMembership


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
