import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../useAuth";
import { authApi } from "../../services/auth.api";
import { storage } from "@/shared/lib/storage";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("../../services/auth.api", () => ({
  authApi: {
    login: vi.fn(),
    getMe: vi.fn(),
    register: vi.fn(),
  },
}));

describe("useAuth hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.clearAll();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(TenantProvider, null, children);

  it("inicializa com estado não autenticado quando não há token", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("hidrata o perfil ao inicializar se houver token no storage", async () => {
    storage.setToken("token-existente");
    (authApi.getMe as any).mockResolvedValue({
      id: "u-1",
      email: "sessao@empresa.com",
      full_name: "Sessão Ativa",
      is_active: true,
      tenants: [],
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.user?.email).toBe("sessao@empresa.com");
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("limpa a sessão no logout e redireciona para /login", () => {
    storage.setToken("token-ativo");
    storage.setActiveTenantId("tenant-ativo");

    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.logout();
    });

    expect(storage.getToken()).toBeNull();
    expect(storage.getActiveTenantId()).toBeNull();
    expect(result.current.user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/login");
  });
});
