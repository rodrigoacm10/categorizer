from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.modules.tenants.domain.entities import TenantRole


class TenantCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: Optional[str] = Field(None, min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    description: Optional[str] = None


class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantMemberAddRequest(BaseModel):
    email: EmailStr
    role: TenantRole = TenantRole.ALMOXARIFE


class TenantMemberUpdateRequest(BaseModel):
    role: TenantRole


class TenantMemberResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    full_name: str
    role: TenantRole
    joined_at: datetime

    model_config = {"from_attributes": True}
