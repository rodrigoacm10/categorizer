"use client";

import { useTenant } from "@/features/tenants/hooks/useTenant";
import {
  ActionType,
  TenantRole,
  RBAC_PERMISSIONS_MATRIX,
} from "@/shared/types/rbac.types";

export interface UseRBACReturn {
  role: TenantRole | null;
  can: (action: ActionType) => boolean;
  hasRole: (roles: TenantRole | TenantRole[]) => boolean;
  isOwner: () => boolean;
  isGestor: () => boolean;
  isAlmoxarife: () => boolean;
  isAuditor: () => boolean;
}

/**
 * Hook de autorização RBAC pervasivo para o frontend.
 * Avalia capacidades do operador em relação ao seu papel no tenant ativo.
 */
export function useRBAC(overrideRole?: TenantRole | null): UseRBACReturn {
  const { role: tenantRole } = useTenant();
  const currentRole = overrideRole !== undefined ? overrideRole : tenantRole;

  const can = (action: ActionType): boolean => {
    if (!currentRole) return false;
    // OWNER possui acesso irrestrito a todas as capacidades
    if (currentRole === "OWNER") return true;

    const allowedRoles = RBAC_PERMISSIONS_MATRIX[action];
    if (!allowedRoles) return false;

    return allowedRoles.includes(currentRole);
  };

  const hasRole = (roles: TenantRole | TenantRole[]): boolean => {
    if (!currentRole) return false;
    if (Array.isArray(roles)) {
      return roles.includes(currentRole);
    }
    return currentRole === roles;
  };

  const isOwner = (): boolean => currentRole === "OWNER";
  const isGestor = (): boolean => currentRole === "GESTOR";
  const isAlmoxarife = (): boolean => currentRole === "ALMOXARIFE";
  const isAuditor = (): boolean => currentRole === "AUDITOR";

  return {
    role: currentRole,
    can,
    hasRole,
    isOwner,
    isGestor,
    isAlmoxarife,
    isAuditor,
  };
}
