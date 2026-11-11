"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { storage } from "@/shared/lib/storage";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { authApi } from "../services/auth.api";
import {
  LoginCredentials,
  RegisterPayload,
  UserProfile,
  AuthToken,
  UserResponse,
} from "../types/auth.types";

export interface UseAuthReturn {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<{ token: AuthToken; user: UserProfile }>;
  register: (payload: RegisterPayload) => Promise<UserResponse>;
  logout: () => void;
  refreshUser: () => Promise<UserProfile | null>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { setTenant, clearTenant } = useTenant();
  const router = useRouter();

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    const token = storage.getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      const profile = await authApi.getMe();
      setUser(profile);
      return profile;
    } catch {
      storage.clearAll();
      clearTenant();
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [clearTenant]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setIsLoading(true);
      try {
        const tokenData = await authApi.login(credentials);
        storage.setToken(tokenData.access_token);

        const profile = await authApi.getMe();
        setUser(profile);

        // Regra de Redirecionamento Inteligente (FT-05):
        // Se pertencer a exatamente 1 tenant, seleciona-o automaticamente e vai para /dashboard.
        // Se múltiplos ou nenhum (0), direciona para /tenants.
        if (profile.tenants && profile.tenants.length === 1) {
          const singleTenant = profile.tenants[0];
          setTenant(singleTenant.tenant_id, singleTenant.role);
          router.push("/dashboard");
        } else {
          router.push("/tenants");
        }

        return { token: tokenData, user: profile };
      } finally {
        setIsLoading(false);
      }
    },
    [router, setTenant]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setIsLoading(true);
      try {
        return await authApi.register(payload);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    storage.clearAll();
    clearTenant();
    setUser(null);
    router.push("/login");
  }, [clearTenant, router]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user || !!storage.getToken(),
    login,
    register,
    logout,
    refreshUser,
  };
}
