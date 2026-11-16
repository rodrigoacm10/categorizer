"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TenantRole } from "@/shared/types/rbac.types";
import { storage } from "@/shared/lib/storage";

export interface TenantContextValue {
  tenantId: string | null;
  role: TenantRole | null;
  setTenant: (tenantId: string, role?: TenantRole) => void;
  clearTenant: () => void;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export interface TenantProviderProps {
  children: ReactNode;
  initialTenantId?: string | null;
  initialRole?: TenantRole | null;
}

export function TenantProvider({
  children,
  initialTenantId = null,
  initialRole = null,
}: TenantProviderProps) {
  const [tenantId, setTenantIdState] = useState<string | null>(() => {
    if (initialTenantId) return initialTenantId;
    return typeof window !== "undefined" ? storage.getActiveTenantId() : null;
  });
  const [role, setRoleState] = useState<TenantRole | null>(() => {
    if (initialRole) return initialRole;
    return typeof window !== "undefined"
      ? (storage.getActiveTenantRole() as TenantRole | null)
      : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (initialTenantId && initialRole) return false;
    return typeof window !== "undefined" ? false : true;
  });

  // Hook do React Query para invalidar dados do tenant anterior ao trocar de unidade
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    queryClient = useQueryClient();
  } catch {
    // Pode ser utilizado sem QueryClientProvider em testes unitários simples
    queryClient = null;
  }

  // Hidratação a partir de cookies e localStorage no carregamento inicial do cliente
  useEffect(() => {
    const savedTenantId = storage.getActiveTenantId();
    const savedRole = storage.getActiveTenantRole() as TenantRole | null;

    if (savedTenantId && !initialTenantId) {
      setTenantIdState(savedTenantId);
    }
    if (savedRole && !initialRole) {
      setRoleState(savedRole);
    }
    setIsLoading(false);
  }, [initialTenantId, initialRole]);

  const setTenant = useCallback(
    (newTenantId: string, newRole?: TenantRole) => {
      // Invalida cache de queries do tenant anterior para prevenir vazamento de dados
      if (queryClient && tenantId && tenantId !== newTenantId) {
        queryClient.removeQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && key.includes(tenantId);
          },
        });
      }

      setTenantIdState(newTenantId);
      storage.setActiveTenantId(newTenantId);

      if (newRole) {
        setRoleState(newRole);
        storage.setActiveTenantRole(newRole);
      }
    },
    [queryClient, tenantId]
  );

  const clearTenant = useCallback(() => {
    if (queryClient && tenantId) {
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes(tenantId);
        },
      });
    }

    setTenantIdState(null);
    setRoleState(null);
    storage.removeActiveTenantId();
    storage.removeActiveTenantRole();
  }, [queryClient, tenantId]);

  const value: TenantContextValue = {
    tenantId,
    role,
    setTenant,
    clearTenant,
    isLoading,
  };

  return React.createElement(TenantContext.Provider, { value }, children);
}

/**
 * Hook para acessar o almoxarifado (tenant) ativo e seu papel associado.
 */
export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    // Fallback gracioso para leitura direta do storage caso renderizado fora do Provider
    const fallbackTenantId = storage.getActiveTenantId();
    const fallbackRole = storage.getActiveTenantRole() as TenantRole | null;

    return {
      tenantId: fallbackTenantId,
      role: fallbackRole,
      setTenant: (id, role) => {
        storage.setActiveTenantId(id);
        if (role) storage.setActiveTenantRole(role);
      },
      clearTenant: () => {
        storage.removeActiveTenantId();
        storage.removeActiveTenantRole();
      },
      isLoading: false,
    };
  }
  return context;
}
