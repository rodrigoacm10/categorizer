import math
import re
import unicodedata
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.modules.tenants.application.dtos import (
    TenantCreateRequest,
    TenantResponse,
    TenantMemberAddRequest,
    TenantMemberResponse,
    TenantMembersSummaryResponse,
)
from app.modules.tenants.domain.entities import TenantRole
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel
from app.modules.tenants.infrastructure.repositories import (
    SQLAlchemyTenantRepository,
    SQLAlchemyMembershipRepository,
)
from app.modules.auth.infrastructure.models import UserModel
from app.modules.auth.infrastructure.repositories import SQLAlchemyUserRepository
from app.shared.domain.exceptions import (
    TenantSlugAlreadyExistsError,
    TenantNotFoundError,
    UserNotFoundError,
    MemberAlreadyExistsError,
    SoleOwnerRemovalError,
    InsufficientPermissionsError,
)


def slugify(text: str) -> str:
    """Converte texto para formato slug kebab-case alfanumérico."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", text)


def create_tenant(db: Session, user: UserModel, dto: TenantCreateRequest) -> TenantResponse:
    repo = SQLAlchemyTenantRepository(db)
    slug = dto.slug.strip().lower() if dto.slug else slugify(dto.name)

    existing = repo.get_by_slug(slug)
    if existing:
        raise TenantSlugAlreadyExistsError(detail=f"Slug '{slug}' já está em uso por outro tenant.")

    # Criação atômica do Tenant e da associação OWNER
    tenant = TenantModel(
        name=dto.name.strip(),
        slug=slug,
        description=dto.description,
        is_active=True,
        created_by_user_id=user.id,
    )
    db.add(tenant)
    db.flush()  # Garante id do tenant

    membership = TenantMembershipModel(
        user_id=user.id,
        tenant_id=tenant.id,
        role=TenantRole.OWNER.value,
    )
    db.add(membership)
    db.commit()
    db.refresh(tenant)

    return TenantResponse.model_validate(tenant)


def list_user_tenants(db: Session, user_id: UUID) -> List[TenantResponse]:
    repo = SQLAlchemyTenantRepository(db)
    tenants = repo.list_by_user_id(user_id)
    return [TenantResponse.model_validate(t) for t in tenants]


def get_tenant_by_id(db: Session, tenant_id: UUID) -> TenantResponse:
    repo = SQLAlchemyTenantRepository(db)
    tenant = repo.get_by_id(tenant_id)
    if not tenant or not tenant.is_active:
        raise TenantNotFoundError()
    return TenantResponse.model_validate(tenant)


def get_tenant_members_summary(db: Session, tenant_id: UUID) -> TenantMembersSummaryResponse:
    membership_repo = SQLAlchemyMembershipRepository(db)
    counts = membership_repo.get_role_counts(tenant_id)
    return TenantMembersSummaryResponse(
        total_members=counts["total_members"],
        owners_count=counts["owners_count"],
        gestores_count=counts["gestores_count"],
        almoxarifes_count=counts["almoxarifes_count"],
        auditores_count=counts["auditores_count"],
    )


def list_tenant_members(db: Session, tenant_id: UUID) -> List[TenantMemberResponse]:
    membership_repo = SQLAlchemyMembershipRepository(db)
    memberships = membership_repo.list_by_tenant(tenant_id)
    result = []
    for m in memberships:
        user = m.user
        result.append(
            TenantMemberResponse(
                user_id=m.user_id,
                email=user.email,
                full_name=user.full_name,
                role=TenantRole(m.role),
                joined_at=m.created_at,
            )
        )
    return result


def list_tenant_members_paginated(
    db: Session,
    tenant_id: UUID,
    role: Optional[TenantRole] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[List[TenantMemberResponse], int, int]:
    membership_repo = SQLAlchemyMembershipRepository(db)
    total_count = membership_repo.count_by_tenant(tenant_id, role=role, search=search)
    total_pages = math.ceil(total_count / limit) if limit > 0 else 1
    memberships = membership_repo.list_by_tenant_paginated(
        tenant_id=tenant_id,
        role=role,
        search=search,
        limit=limit,
        offset=offset,
    )
    result = [
        TenantMemberResponse(
            user_id=m.user_id,
            email=m.user.email,
            full_name=m.user.full_name,
            role=TenantRole(m.role),
            joined_at=m.created_at,
        )
        for m in memberships
    ]
    return result, total_count, total_pages


def add_tenant_member(
    db: Session,
    tenant_id: UUID,
    dto: TenantMemberAddRequest,
    current_user_role: TenantRole,
) -> TenantMemberResponse:
    # Regra RBAC: GESTOR só pode convidar ALMOXARIFE ou AUDITOR
    if current_user_role == TenantRole.GESTOR:
        if dto.role not in (TenantRole.ALMOXARIFE, TenantRole.AUDITOR):
            raise InsufficientPermissionsError(
                detail="Gestor pode convidar apenas membros com papéis Almoxarife ou Auditor."
            )

    user_repo = SQLAlchemyUserRepository(db)
    target_user = user_repo.get_by_email(dto.email)
    if not target_user:
        raise UserNotFoundError(detail=f"Usuário com email '{dto.email}' não encontrado.")

    membership_repo = SQLAlchemyMembershipRepository(db)
    existing_membership = membership_repo.get(target_user.id, tenant_id)
    if existing_membership:
        raise MemberAlreadyExistsError(detail="Usuário já é membro deste tenant.")

    membership = TenantMembershipModel(
        user_id=target_user.id,
        tenant_id=tenant_id,
        role=dto.role.value,
    )
    membership = membership_repo.create(membership)

    return TenantMemberResponse(
        user_id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        role=dto.role,
        joined_at=membership.created_at,
    )


def update_tenant_member_role(
    db: Session,
    tenant_id: UUID,
    target_user_id: UUID,
    new_role: TenantRole,
) -> TenantMemberResponse:
    membership_repo = SQLAlchemyMembershipRepository(db)
    membership = membership_repo.get(target_user_id, tenant_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membro não encontrado no tenant.",
        )

    # Se está tentando alterar papel do OWNER para outro, não pode ser o único OWNER
    if membership.role == TenantRole.OWNER.value and new_role != TenantRole.OWNER:
        owner_count = membership_repo.count_owners(tenant_id)
        if owner_count <= 1:
            raise SoleOwnerRemovalError(
                detail="Não é possível alterar o papel do único OWNER remanescente do tenant."
            )

    membership.role = new_role.value
    db.commit()
    db.refresh(membership)

    return TenantMemberResponse(
        user_id=membership.user_id,
        email=membership.user.email,
        full_name=membership.user.full_name,
        role=TenantRole(membership.role),
        joined_at=membership.created_at,
    )


def remove_tenant_member(
    db: Session,
    tenant_id: UUID,
    target_user_id: UUID,
) -> dict:
    membership_repo = SQLAlchemyMembershipRepository(db)
    membership = membership_repo.get(target_user_id, tenant_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membro não encontrado no tenant.",
        )

    if membership.role == TenantRole.OWNER.value:
        owner_count = membership_repo.count_owners(tenant_id)
        if owner_count <= 1:
            raise SoleOwnerRemovalError(
                detail="Não é possível remover o único OWNER remanescente do tenant."
            )

    membership_repo.delete(membership)
    return {"message": "Membro removido com sucesso."}


def get_tenant_member_by_id(db: Session, tenant_id: UUID, user_id: UUID) -> TenantMemberResponse:
    membership_repo = SQLAlchemyMembershipRepository(db)
    membership = membership_repo.get(user_id, tenant_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membro não encontrado no tenant.",
        )
    return TenantMemberResponse(
        user_id=membership.user_id,
        email=membership.user.email,
        full_name=membership.user.full_name,
        role=TenantRole(membership.role),
        joined_at=membership.created_at,
    )


def leave_tenant(db: Session, tenant_id: UUID, user_id: UUID) -> dict:
    membership_repo = SQLAlchemyMembershipRepository(db)
    membership = membership_repo.get(user_id, tenant_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membro não encontrado no tenant.",
        )

    if membership.role == TenantRole.OWNER.value:
        owner_count = membership_repo.count_owners(tenant_id)
        if owner_count <= 1:
            raise SoleOwnerRemovalError(
                detail="Não é possível sair do tenant sendo o único OWNER remanescente."
            )

    membership_repo.delete(membership)
    return {"message": "Saída do tenant realizada com sucesso."}
