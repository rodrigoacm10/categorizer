from sqlalchemy.orm import Session
from app.modules.auth.application.dtos import (
    UserRegisterRequest,
    UserResponse,
    TokenResponse,
    UserProfileResponse,
    TenantBriefResponse,
)
from app.modules.auth.infrastructure.models import UserModel
from app.modules.auth.infrastructure.repositories import SQLAlchemyUserRepository
from app.modules.tenants.infrastructure.repositories import SQLAlchemyMembershipRepository
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings
from app.shared.domain.exceptions import EmailAlreadyExistsError, InvalidCredentialsError


def register_user(db: Session, dto: UserRegisterRequest) -> UserResponse:
    repo = SQLAlchemyUserRepository(db)
    normalized_email = dto.email.strip().lower()
    existing = repo.get_by_email(normalized_email)
    if existing:
        raise EmailAlreadyExistsError(detail=f"Email '{normalized_email}' já cadastrado por outro usuário.")

    hashed_password = get_password_hash(dto.password)
    user = repo.create(
        email=normalized_email,
        password_hash=hashed_password,
        full_name=dto.full_name,
        is_active=True,
    )
    return UserResponse.model_validate(user)


def authenticate_user(db: Session, email: str, password: str) -> TokenResponse:
    repo = SQLAlchemyUserRepository(db)
    normalized_email = email.strip().lower()
    user = repo.get_by_email(normalized_email)
    if not user or not user.is_active:
        raise InvalidCredentialsError()

    if not verify_password(password, user.password_hash):
        raise InvalidCredentialsError()

    token = create_access_token({"sub": str(user.id), "email": user.email})
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
    )


def get_user_profile(db: Session, user: UserModel) -> UserProfileResponse:
    membership_repo = SQLAlchemyMembershipRepository(db)
    memberships = membership_repo.list_by_user(user.id)
    tenants_brief = []
    for m in memberships:
        if m.tenant and m.tenant.is_active:
            tenants_brief.append(
                TenantBriefResponse(
                    tenant_id=m.tenant.id,
                    tenant_name=m.tenant.name,
                    tenant_slug=m.tenant.slug,
                    role=m.role,
                )
            )

    return UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        tenants=tenants_brief,
    )
