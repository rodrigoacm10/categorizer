from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID


class TenantRole(str, Enum):
    OWNER = "OWNER"
    GESTOR = "GESTOR"
    ALMOXARIFE = "ALMOXARIFE"
    AUDITOR = "AUDITOR"


@dataclass
class Tenant:
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    is_active: bool
    created_by_user_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime


@dataclass
class TenantMembership:
    id: UUID
    user_id: UUID
    tenant_id: UUID
    role: TenantRole
    created_at: datetime
    updated_at: datetime
