from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from app.shared.infrastructure.database import get_db
from app.modules.auth.application.dtos import (
    UserRegisterRequest,
    UserResponse,
    TokenResponse,
    UserProfileResponse,
)
from app.modules.auth.application import use_cases
from app.modules.auth.interfaces.dependencies import get_current_user
from app.modules.auth.infrastructure.models import UserModel
from app.shared.domain.exceptions import InvalidCredentialsError

router = APIRouter(prefix="/auth", tags=["Autenticação & Usuários"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_endpoint(
    dto: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    """Cadastro público de novo usuário."""
    return use_cases.register_user(db, dto)


@router.post("/login", response_model=TokenResponse)
async def login_endpoint(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Autenticação pública e emissão de token JWT:
    Suporta payload JSON (email, password) ou OAuth2 Form (username, password).
    """
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            raise InvalidCredentialsError()
        email = body.get("email") or body.get("username")
        password = body.get("password")
    else:
        try:
            form = await request.form()
        except Exception:
            raise InvalidCredentialsError()
        email = form.get("username") or form.get("email")
        password = form.get("password")

    if not email or not password:
        raise InvalidCredentialsError()

    return use_cases.authenticate_user(db, email=str(email), password=str(password))


@router.get("/me", response_model=UserProfileResponse)
def get_me_endpoint(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulta perfil do usuário autenticado e seus tenants vinculados."""
    return use_cases.get_user_profile(db, current_user)
