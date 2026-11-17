from typing import Union, Sequence
from fastapi import Depends
from app.modules.tenants.domain.entities import TenantRole
from app.modules.tenants.interfaces.context import TenantContext, get_tenant_context
from app.shared.domain.exceptions import InsufficientPermissionsError


def require_roles(*allowed_roles: Union[TenantRole, str]):
    """
    Dependency factory que verifica se o papel do usuário no tenant
    está presente na lista de papéis autorizados.
    """
    valid_role_values = {
        r.value if isinstance(r, TenantRole) else str(r) for r in allowed_roles
    }

    def role_checker(context: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if context.role.value not in valid_role_values:
            allowed_names = ", ".join(sorted(valid_role_values))
            raise InsufficientPermissionsError(
                detail=f"Papel do usuário no tenant ({context.role.value}) não autoriza a operação. Papéis permitidos: {allowed_names}."
            )
        return context

    return role_checker


# Alias para suporte a require_role ou require_roles
require_role = require_roles
