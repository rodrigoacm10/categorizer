import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TopBar } from "../TopBar";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { useAuth } from "@/features/auth/hooks/useAuth";

const mockLogout = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/tenants/services/tenants.api", () => ({
  tenantsApi: {
    listTenantsWithRoles: vi.fn().mockResolvedValue([]),
  },
}));

describe("TopBar (FT-08)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    (useAuth as any).mockReturnValue({
      user: {
        id: "usr-1",
        email: "operador@extensao.local",
        full_name: "Operador de Bancada",
      },
      isLoading: false,
      isAuthenticated: true,
      logout: mockLogout,
    });
  });

  const renderWithProviders = (role: "OWNER" | "GESTOR" | "ALMOXARIFE" | "AUDITOR" = "OWNER") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId="tenant-test-123" initialRole={role}>
          <TopBar />
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  it("renderiza a identidade técnica 'EXTENSÃO // BANCADA' com link para /dashboard", () => {
    renderWithProviders();

    const logoLink = screen.getByRole("link", { name: /EXTENSÃO/i });
    expect(logoLink).toBeDefined();
    expect(logoLink.getAttribute("href")).toBe("/dashboard");
    expect(screen.getByText("EXTENSÃO")).toBeDefined();
    expect(screen.getByText("BANCADA")).toBeDefined();
  });

  it("renderiza o indicador de status de rede (Online)", () => {
    renderWithProviders();

    const networkIndicator = screen.getByRole("status");
    expect(networkIndicator).toBeDefined();
    expect(networkIndicator.textContent).toMatch(/online/i);
  });

  it("renderiza o perfil do usuário logado e o badge de papel RBAC", () => {
    renderWithProviders("GESTOR");

    expect(screen.getByText("Operador de Bancada")).toBeDefined();
    expect(screen.getAllByText("GESTOR").length).toBeGreaterThan(0);
  });

  it("aciona logout ao clicar no botão de encerramento de sessão", () => {
    renderWithProviders();

    const logoutBtn = screen.getByRole("button", { name: /Sair da bancada/i });
    expect(logoutBtn).toBeDefined();

    fireEvent.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
