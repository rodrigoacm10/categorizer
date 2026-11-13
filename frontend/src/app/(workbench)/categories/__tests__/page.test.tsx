import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CategoriesPage from "../page";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { categoriesApi } from "@/features/categories/services/categories.api";
import { Category } from "@/features/categories/types/category.types";

vi.mock("@/features/categories/services/categories.api", () => ({
  categoriesApi: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("CategoriesPage (/categories - FT-11)", () => {
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
  });

  const renderWithRole = (
    role: "OWNER" | "GESTOR" | "ALMOXARIFE" | "AUDITOR" = "OWNER"
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId="t-test-123" initialRole={role}>
          <CategoriesPage />
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  const mockCategories: Category[] = [
    {
      id: "cat-1",
      name: "EPIs",
      description: "Equipamentos de Proteção Individual",
      color: "#2563EB",
      created_at: "2026-11-13T10:00:00Z",
    },
  ];

  it("bloqueia o acesso com banner de permissão quando o papel for ALMOXARIFE", () => {
    renderWithRole("ALMOXARIFE");

    expect(screen.getByText(/Acesso Restrito \/\/ Papel Insuficiente/i)).toBeDefined();
    expect(screen.getByText(/ALMOXARIFE/i)).toBeDefined();
    expect(screen.queryByText(/Nova Categoria/i)).toBeNull();
  });

  it("bloqueia o acesso com banner de permissão quando o papel for AUDITOR", () => {
    renderWithRole("AUDITOR");

    expect(screen.getByText(/Acesso Restrito \/\/ Papel Insuficiente/i)).toBeDefined();
    expect(screen.getByText(/AUDITOR/i)).toBeDefined();
    expect(screen.queryByText(/Nova Categoria/i)).toBeNull();
  });

  it("renderiza a página com título e tabela quando o papel for OWNER", async () => {
    (categoriesApi.list as any).mockResolvedValueOnce(mockCategories);

    renderWithRole("OWNER");

    expect(screen.getByText("Gestão de Categorias")).toBeDefined();
    expect(screen.getByTestId("open-category-modal-button")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("EPIs")).toBeDefined();
    });
  });

  it("abre o modal de nova categoria ao clicar no botão 'Nova Categoria'", async () => {
    (categoriesApi.list as any).mockResolvedValueOnce(mockCategories);

    renderWithRole("GESTOR");

    const openBtn = screen.getByTestId("open-category-modal-button");
    fireEvent.click(openBtn);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/Nova Categoria \/\/ Catálogo N:N/i)).toBeDefined();
  });
});
