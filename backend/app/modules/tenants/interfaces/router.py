from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.orm import Session
from app.shared.infrastructure.database import get_db
from app.modules.auth.infrastructure.models import UserModel
from app.modules.auth.interfaces.dependencies import get_current_user
from app.modules.tenants.application.dtos import (
    TenantCreateRequest,
    TenantResponse,
    TenantMemberAddRequest,
    TenantMemberUpdateRequest,
    TenantMemberResponse,
)
from app.modules.tenants.application import use_cases
from app.modules.tenants.domain.entities import TenantRole
from app.modules.tenants.infrastructure.repositories import SQLAlchemyMembershipRepository
from app.shared.domain.exceptions import (
    TenantAccessDeniedError,
    InsufficientPermissionsError,
)

router = APIRouter(prefix="/tenants", tags=["Organizações & Tenants"])


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant_endpoint(
    dto: TenantCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cria novo tenant e associa o usuário criador como OWNER de forma atômica."""
    return use_cases.create_tenant(db, current_user, dto)


@router.get("", response_model=List[TenantResponse])
def list_tenants_endpoint(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista todos os tenants nos quais o usuário possui vínculo ativo."""
    return use_cases.list_user_tenants(db, current_user.id)


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant_endpoint(
    tenant_id: UUID,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulta detalhes de um tenant específico."""
    membership_repo = SQLAlchemyMembershipRepository(db)
    membership = membership_repo.get(current_user.id, tenant_id)
    if not membership:
        raise TenantAccessDeniedError(detail="Usuário não é membro deste tenant.")
    return use_cases.get_tenant_by_id(db, tenant_id)


@router.get("/{tenant_id}/members", response_model=List[TenantMemberResponse])
def list_members_endpoint(
    tenant_id: UUID,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista todos os membros do tenant. Requer que o usuário seja membro do tenant."""
    membership_repo = SQLAlchemyMembershipRepository(db)
    membership = membership_repo.get(current_user.id, tenant_id)
    if not membership:
        raise TenantAccessDeniedError(detail="Usuário não possui vínculo com este tenant.")
    return use_cases.list_tenant_members(db, tenant_id)


@router.post("/{tenant_id}/members", response_model=TenantMemberResponse, status_code=status.HTTP_201_CREATED)
def add_member_endpoint(
    tenant_id: UUID,
    dto: TenantMemberAddRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Adiciona novo membro ao tenant. Requer permissão de OWNER ou GESTOR."""
    membership_repo = SQLAlchemyMembershipRepository(db)
    membership = membership_repo.get(current_user.id, tenant_id)
    if not membership:
        raise TenantAccessDeniedError(detail="Usuário não possui vínculo com este tenant.")

    caller_role = TenantRole(membership.role)
    if caller_role not in (TenantRole.OWNER, TenantRole.GESTOR):
        raise InsufficientPermissionsError(detail="Apenas OWNER ou GESTOR podem adicionar membros ao tenant.")

    return use_cases.add_tenant_member(db, tenant_id, dto, caller_role)


@router.put("/{tenant_id}/members/{user_id}", response_model=TenantMemberResponse)
def update_member_role_endpoint(
    tenant_id: UUID,
    user_id: UUID,
    dto: TenantMemberUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Altera o papel de um membro do tenant. Requer papel OWNER."""
    membership_repo = SQLAlchemyMembershipRepository(db)
    membership = membership_repo.get(current_user.id, tenant_id)
    if not membership:
        raise TenantAccessDeniedError(detail="Usuário não possui vínculo com este tenant.")

    if membership.role != TenantRole.OWNER.value:
        raise InsufficientPermissionsError(detail="Apenas OWNER pode alterar papéis de membros.")

    return use_cases.update_tenant_member_role(db, tenant_id, user_id, dto.role)


@router.delete("/{tenant_id}/members/{user_id}")
def remove_member_endpoint(
    tenant_id: UUID,
    user_id: UUID,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove um membro do tenant. Requer papel OWNER."""
    membership_repo = SQLAlchemyMembershipRepository(db)
    membership = membership_repo.get(current_user.id, tenant_id)
    if not membership:
        raise TenantAccessDeniedError(detail="Usuário não possui vínculo com este tenant.")

    if membership.role != TenantRole.OWNER.value:
        raise InsufficientPermissionsError(detail="Apenas OWNER pode remover membros do tenant.")

    return use_cases.remove_tenant_member(db, tenant_id, user_id)
