from fastapi import HTTPException, status
from typing import Optional, Dict, Any


class ProblemDetailsException(HTTPException):
    def __init__(
        self,
        status_code: int,
        type_suffix: str,
        title: str,
        detail: str,
        instance: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.type_uri = f"https://api.estoque.local/errors/{type_suffix}"
        self.title = title
        self.status = status_code
        self.problem_detail = detail
        self.instance = instance

    def to_dict(self) -> Dict[str, Any]:
        data = {
            "type": self.type_uri,
            "title": self.title,
            "status": self.status,
            "detail": self.problem_detail,
        }
        if self.instance:
            data["instance"] = self.instance
        return data


class MissingTenantHeaderError(ProblemDetailsException):
    def __init__(self, detail: str = "Cabeçalho X-Tenant-ID ausente em rota protegida que exige escopo de tenant.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            type_suffix="missing-tenant-header",
            title="Cabeçalho X-Tenant-ID Obrigatório",
            detail=detail,
            instance=instance,
        )


class InvalidCredentialsError(ProblemDetailsException):
    def __init__(self, detail: str = "Credenciais inválidas.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            type_suffix="invalid-credentials",
            title="Credenciais Inválidas",
            detail=detail,
            instance=instance,
            headers={"WWW-Authenticate": "Bearer"},
        )


class TokenExpiredError(ProblemDetailsException):
    def __init__(self, detail: str = "Token JWT expirou.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            type_suffix="token-expired",
            title="Token Expirado",
            detail=detail,
            instance=instance,
            headers={"WWW-Authenticate": "Bearer"},
        )


class InvalidTokenError(ProblemDetailsException):
    def __init__(self, detail: str = "Assinatura ou estrutura de token JWT inválida ou corrompida.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            type_suffix="invalid-token",
            title="Token Inválido",
            detail=detail,
            instance=instance,
            headers={"WWW-Authenticate": "Bearer"},
        )


class TenantAccessDeniedError(ProblemDetailsException):
    def __init__(self, detail: str = "O usuário autenticado não possui vínculo ativo com a organização solicitada.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            type_suffix="tenant-access-denied",
            title="Acesso Negado ao Tenant",
            detail=detail,
            instance=instance,
        )


class InsufficientPermissionsError(ProblemDetailsException):
    def __init__(self, detail: str = "Papel do usuário no tenant não autoriza a operação.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            type_suffix="insufficient-permissions",
            title="Permissões Insuficientes",
            detail=detail,
            instance=instance,
        )


class TenantNotFoundError(ProblemDetailsException):
    def __init__(self, detail: str = "O ID de tenant especificado não existe ou está inativado.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            type_suffix="tenant-not-found",
            title="Tenant Não Encontrado",
            detail=detail,
            instance=instance,
        )


class UserNotFoundError(ProblemDetailsException):
    def __init__(self, detail: str = "Email informado para inclusão de membro não corresponde a um usuário registrado.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            type_suffix="user-not-found",
            title="Usuário Não Encontrado",
            detail=detail,
            instance=instance,
        )


class EmailAlreadyExistsError(ProblemDetailsException):
    def __init__(self, detail: str = "Email já cadastrado por outro usuário.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            type_suffix="email-already-exists",
            title="Email Já Cadastrado",
            detail=detail,
            instance=instance,
        )


class TenantSlugAlreadyExistsError(ProblemDetailsException):
    def __init__(self, detail: str = "Slug de tenant já em uso.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            type_suffix="tenant-slug-already-exists",
            title="Slug de Tenant Já Utilizado",
            detail=detail,
            instance=instance,
        )


class MemberAlreadyExistsError(ProblemDetailsException):
    def __init__(self, detail: str = "Usuário já é membro daquele tenant.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            type_suffix="member-already-exists",
            title="Membro Já Vinculado",
            detail=detail,
            instance=instance,
        )


class SoleOwnerRemovalError(ProblemDetailsException):
    def __init__(self, detail: str = "Tentativa de remover ou rebaixar o único OWNER remanescente do tenant.", instance: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            type_suffix="sole-owner-removal",
            title="Único Owner Não Pode Ser Removido",
            detail=detail,
            instance=instance,
        )
