import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from app.core.config import settings
from app.shared.domain.exceptions import TokenExpiredError, InvalidTokenError


def get_password_hash(password: str) -> str:
    """Gera hash bcrypt com salt (12 rounds) para a senha fornecida."""
    # Bcrypt tem limite estrito de 72 bytes
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha em texto puro corresponde ao hash bcrypt armazenado."""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Gera um token JWT assinado digitalmente com HS256 contendo:
    sub, email, exp, iat, type="access".
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodifica e valida assinatura e expiração do JWT."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError()
    except jwt.PyJWTError:
        raise InvalidTokenError()
