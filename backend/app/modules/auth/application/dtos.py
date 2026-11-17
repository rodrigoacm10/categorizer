import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.modules.tenants.domain.entities import TenantRole


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Senha com no mínimo 8 caracteres")
    full_name: str = Field(..., min_length=2, max_length=255)

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("A senha deve ter no mínimo 8 caracteres.")
        if not re.search(r"\d", v):
            raise ValueError("A senha deve conter pelo menos um número.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("A senha deve conter pelo menos uma letra maiúscula.")
        return v


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TenantBriefResponse(BaseModel):
    tenant_id: UUID
    tenant_name: str
    tenant_slug: str
    role: TenantRole

    model_config = {"from_attributes": True}


class UserProfileResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    is_active: bool
    tenants: List[TenantBriefResponse]

    model_config = {"from_attributes": True}
