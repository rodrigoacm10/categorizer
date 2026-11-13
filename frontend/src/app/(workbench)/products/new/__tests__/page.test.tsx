import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NewProductPage from "../page";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { categoriesApi } from "@/features/categories/services/categories.api";
import { TenantRole } from "@/shared/types/rbac.types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/features/categories/services/categories.api", () => ({
  categoriesApi: {
    list: vi.fn(),
  },
}));

describe("NewProductPage (/products/new - FT-13)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.mocked(categoriesApi.list).mockResolvedValue([]);
  });

  const renderWithRole = (role: TenantRole) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId="t-test-123" initialRole={role}>
          <NewProductPage />
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  it("bloqueia acesso direto para ALMOXARIFE e exibe banner com botão para /dashboard", () => {
    renderWithRole("ALMOXARIFE");

    expect(screen.getByTestId("rbac-restricted-banner")).toBeDefined();
    expect(screen.getByText("Acesso Restrito // Papel Insuficiente")).toBeDefined();
    expect(screen.getByText("ALMOXARIFE")).toBeDefined();
    expect(
      screen.getByText(/não possui autorização para cadastrar novos produtos/i)
    ).toBeDefined();

    const dashboardBtn = screen.getByTestId("back-to-dashboard-button");
    expect(dashboardBtn).toBeDefined();
    expect(dashboardBtn.closest("a")?.getAttribute("href")).toBe("/dashboard");

    // Não deve renderizar o formulário
    expect(screen.queryByTestId("product-form")).toBeNull();
  });

  it("bloqueia acesso direto para AUDITOR e exibe banner com botão para /dashboard", () => {
    renderWithRole("AUDITOR");

    expect(screen.getByTestId("rbac-restricted-banner")).toBeDefined();
    expect(screen.getByText("Acesso Restrito // Papel Insuficiente")).toBeDefined();
    expect(screen.getByText("AUDITOR")).toBeDefined();
    expect(
      screen.getByText(/não possui autorização para cadastrar novos produtos/i)
    ).toBeDefined();

    const dashboardBtn = screen.getByTestId("back-to-dashboard-button");
    expect(dashboardBtn).toBeDefined();
    expect(dashboardBtn.closest("a")?.getAttribute("href")).toBe("/dashboard");

    expect(screen.queryByTestId("product-form")).toBeNull();
  });

  it("renderiza a página e o formulário para o papel OWNER", () => {
    renderWithRole("OWNER");

    expect(screen.queryByTestId("rbac-restricted-banner")).toBeNull();
    expect(screen.getByText("Ficha Cadastral de Novo Produto")).toBeDefined();
    expect(screen.getByTestId("product-form")).toBeDefined();
    expect(screen.getByTestId("zero-stock-banner")).toBeDefined();
  });

  it("renderiza a página e o formulário para o papel GESTOR", () => {
    renderWithRole("GESTOR");

    expect(screen.queryByTestId("rbac-restricted-banner")).toBeNull();
    expect(screen.getByText("Ficha Cadastral de Novo Produto")).toBeDefined();
    expect(screen.getByTestId("product-form")).toBeDefined();
    expect(screen.getByTestId("zero-stock-banner")).toBeDefined();
  });
});
