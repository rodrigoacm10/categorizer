import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProductsPage from "../page";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { productsApi } from "@/features/products/services/products.api";
import { categoriesApi } from "@/features/categories/services/categories.api";
import { Product } from "@/features/products/types/product.types";
import { Category } from "@/features/categories/types/category.types";

vi.mock("@/features/products/services/products.api", () => ({
  productsApi: {
    list: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/features/categories/services/categories.api", () => ({
  categoriesApi: {
    list: vi.fn(),
  },
}));

describe("ProductsPage (/products - FT-12)", () => {
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
          <ProductsPage />
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  const mockCategories: Category[] = [
    {
      id: "cat-1",
      name: "EPIs",
      color: "#2563EB",
      created_at: "2026-11-13T10:00:00Z",
    },
  ];

  const mockProducts: Product[] = [
    {
      id: "prod-1",
      name: "Óculos de Proteção Ampla Visão",
      description: "EPI para proteção ocular",
      unit: "UN",
      current_quantity: "50",
      current_quantity_scaled: 50000,
      min_stock: "20",
      min_stock_scaled: 20000,
      is_low_stock: false,
      is_active: true,
      categories: [mockCategories[0]],
      created_at: "2026-11-13T10:00:00Z",
      updated_at: "2026-11-13T10:00:00Z",
    },
  ];

  it("renderiza o cabeçalho e esconde o botão 'Novo Produto' para o papel ALMOXARIFE", async () => {
    (categoriesApi.list as any).mockResolvedValueOnce(mockCategories);
    (productsApi.list as any).mockResolvedValueOnce(mockProducts);

    renderWithRole("ALMOXARIFE");

    expect(screen.getByText("Catálogo de Produtos Físicos")).toBeDefined();
    expect(screen.queryByTestId("new-product-button")).toBeNull();

    await waitFor(() => {
      expect(screen.getByText("Óculos de Proteção Ampla Visão")).toBeDefined();
    });
  });

  it("exibe o botão 'Novo Produto' e 'Categorias' para o papel OWNER", async () => {
    (categoriesApi.list as any).mockResolvedValueOnce(mockCategories);
    (productsApi.list as any).mockResolvedValueOnce(mockProducts);

    renderWithRole("OWNER");

    expect(screen.getByTestId("new-product-button")).toBeDefined();
    expect(screen.getByRole("button", { name: /Categorias/i })).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Óculos de Proteção Ampla Visão")).toBeDefined();
    });
  });

  it("abre o modal de inativação ao clicar na ação da tabela", async () => {
    (categoriesApi.list as any).mockResolvedValueOnce(mockCategories);
    (productsApi.list as any).mockResolvedValueOnce(mockProducts);

    renderWithRole("GESTOR");

    await waitFor(() => {
      expect(screen.getByText("Óculos de Proteção Ampla Visão")).toBeDefined();
    });

    const inativarBtn = screen.getByLabelText(
      "Inativar produto Óculos de Proteção Ampla Visão"
    );
    fireEvent.click(inativarBtn);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(
      screen.getByText(/Inativar Produto \/\/ Soft-Delete Contábil/i)
    ).toBeDefined();
  });
});
