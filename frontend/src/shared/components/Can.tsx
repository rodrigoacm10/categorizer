"use client";

import React, { ReactNode } from "react";
import { ActionType, TenantRole } from "@/shared/types/rbac.types";
import { useRBAC } from "@/shared/hooks/useRBAC";

export interface CanProps {
  I: ActionType;
  role?: TenantRole;
  fallback?: ReactNode;
  children?: ReactNode;
}

/**
 * Componente declarativo para renderização condicional orientada a RBAC.
 * Exemplo:
 * <Can I="create_product" fallback={<p>Apenas gestores</p>}>
 *   <Button>Novo Produto</Button>
 * </Can>
 */
export function Can({ I, role, fallback = null, children }: CanProps) {
  const { can } = useRBAC(role);

  if (can(I)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
