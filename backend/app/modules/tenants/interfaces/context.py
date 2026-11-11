from dataclasses import dataclass
from typing import Optional
from uuid import UUID
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from app.shared.infrastructure.database import get_db
from app.modules.auth.infrastructure.models import UserModel
from app.modules.auth.interfaces.dependencies import get_current_user
from app.modules.tenants.domain.entities import TenantRole
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel
from app.modules.tenants.infrastructure.repositories import (
    SQLAlchemyTenantRepository,
    SQLAlchemyMembershipRepository,
)
from app.shared.domain.exceptions import (
    MissingTenantHeaderError,
    TenantNotFoundError,
    TenantAccessDeniedError,
)


@dataclass
class TenantContext:
    tenant: TenantModel
    user: UserModel
    role: TenantRole
    membership: TenantMembershipModel


def get_tenant_context(
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TenantContext:
    """
    Injeta o contexto do tenant ativo na requisição:
    1. Valida presença e formato UUID do cabeçalho X-Tenant-ID.
    2. Valida existência e ativação do Tenant.
    3. Valida vínculo de associação (membership) do usuário logado.
    4. Constrói TenantContext com papel (role) atribuído.
    """
    if not x_tenant_id or not x_tenant_id.strip():
        raise MissingTenantHeaderError()

    try:
        tenant_uuid = UUID(x_tenant_id.strip())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato do cabeçalho X-Tenant-ID inválido. Esperado UUID válido.",
        )

    tenant_repo = SQLAlchemyTenantRepository(db)
    tenant = tenant_repo.get_by_id(tenant_uuid)
    if not tenant or not tenant.is_active:
        raise TenantNotFoundError(detail=f"Organização/Tenant (ID: {x_tenant_id}) não encontrado ou inativo.")

    membership_repo = SQLAlchemyMembershipRepository(db)
    membership = membership_repo.get(user_id=current_user.id, tenant_id=tenant.id)
    if not membership:
        raise TenantAccessDeniedError(
            detail=f"O usuário autenticado não possui vínculo ativo com a organização solicitada (ID: {x_tenant_id})."
        )

    return TenantContext(
        tenant=tenant,
        user=current_user,
        role=TenantRole(membership.role),
        membership=membership,
    )


def get_current_tenant(
    context: TenantContext = Depends(get_tenant_context),
) -> TenantModel:
    """Retorna o modelo do tenant ativo validado."""
    return context.tenant
