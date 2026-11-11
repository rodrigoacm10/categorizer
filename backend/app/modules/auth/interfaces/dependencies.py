from uuid import UUID
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.shared.infrastructure.database import get_db
from app.modules.auth.infrastructure.models import UserModel
from app.modules.auth.infrastructure.repositories import SQLAlchemyUserRepository
from app.core.security import decode_access_token
from app.shared.domain.exceptions import InvalidCredentialsError, InvalidTokenError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> UserModel:
    payload = decode_access_token(token)
    sub = payload.get("sub")
    if not sub:
        raise InvalidTokenError(detail="Token JWT não contém claim 'sub'.")

    try:
        user_id = UUID(sub)
    except ValueError:
        raise InvalidTokenError(detail="Identificador de usuário inválido no token.")

    user_repo = SQLAlchemyUserRepository(db)
    user = user_repo.get_by_id(user_id)
    if not user or not user.is_active:
        raise InvalidCredentialsError(detail="Usuário inativo ou inexistente.")

    return user
