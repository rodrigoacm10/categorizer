import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CriticalStockTable } from "../CriticalStockTable";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { productsApi } from "@/features/products/services/products.api";
import { Product } from "@/features/products/types/product.types";

vi.mock("@/features/products/services/products.api", () => ({
  productsApi: {
    list: vi.fn(),
  },
}));

describe("CriticalStockTable (FT-10)", () => {
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

  const renderWithProviders = (
    ui: React.ReactElement,
    role: "OWNER" | "GESTOR" | "ALMOXARIFE" | "AUDITOR" = "OWNER"
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId="tenant-test-123" initialRole={role}>
          {ui}
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  const mockCriticalProducts: Product[] = [
    {
      id: "prod-1111-2222-3333",
      name: "Parafuso Sextavado Aço Inox M10",
      description: "Fixador de alta resistência DIN 933",
      unit: "UN",
      current_quantity: "0",
      current_quantity_scaled: 0,
      min_stock: "50",
      min_stock_scaled: 50000,
      is_low_stock: true,
      is_active: true,
      categories: [],
      created_at: "2026-11-10T10:00:00Z",
      updated_at: "2026-11-10T10:00:00Z",
    },
    {
      id: "prod-4444-5555-6666",
      name: "Óleo Lubrificante Sintético ISO VG 68",
      description: "Lubrificação de mancais e redutores",
      unit: "L",
      current_quantity: "2.5",
      current_quantity_scaled: 2500,
      min_stock: "10.0",
      min_stock_scaled: 10000,
      is_low_stock: true,
      is_active: true,
      categories: [],
      created_at: "2026-11-10T10:00:00Z",
      updated_at: "2026-11-10T10:00:00Z",
    },
  ];

  it("renderiza a tabela de alta densidade com produtos críticos e badges semânticos", () => {
    renderWithProviders(<CriticalStockTable items={mockCriticalProducts} />);

    // Cabeçalho da Seção
    expect(screen.getByText(/Alertas Críticos de Reposição/i)).toBeDefined();
    expect(screen.getByTestId("critical-items-count").textContent).toContain("2 itens críticos");

    // Produto 1: Zerado
    expect(screen.getByText("Parafuso Sextavado Aço Inox M10")).toBeDefined();
    expect(screen.getByText("Zerado")).toBeDefined();

    // Produto 2: Estoque Baixo
    expect(screen.getByText("Óleo Lubrificante Sintético ISO VG 68")).toBeDefined();
    expect(screen.getByText("Estoque Baixo")).toBeDefined();

    // Ações Rápidas de Repor
    const reporLinks = screen.getAllByRole("link", { name: /Repor/i });
    expect(reporLinks.length).toBe(2);
    expect(reporLinks[0].getAttribute("href")).toBe(
      "/inventory/move?mode=IN&product_id=prod-1111-2222-3333"
    );
  });

  it("desabilita a ação rápida de Repor quando o operador possui papel AUDITOR", () => {
    renderWithProviders(<CriticalStockTable items={mockCriticalProducts} />, "AUDITOR");

    // Não deve existir link de reposição para auditor
    expect(screen.queryByRole("link", { name: /Repor/i })).toBeNull();

    // Elementos desabilitados com tooltip/title explicativo
    const reporSpans = screen.getAllByTitle(
      "Papel AUDITOR não tem permissão para repor estoque"
    );
    expect(reporSpans.length).toBe(2);
  });

  it("exibe estado vazio quando não houver nenhum produto em alerta de reposição", () => {
    renderWithProviders(<CriticalStockTable items={[]} />);

    expect(screen.getByText(/Nenhum item com estoque crítico/i)).toBeDefined();
    expect(
      screen.getByText(
        /Todos os saldos físicos estão rigorosamente em conformidade com o estoque mínimo cadastrado/i
      )
    ).toBeDefined();
  });

  it("exibe estado de erro e permite tentar novamente com botão de retry", () => {
    const mockRetry = vi.fn();
    renderWithProviders(<CriticalStockTable isError={true} onRetry={mockRetry} />);

    expect(
      screen.getByText(/Falha ao carregar a lista de produtos com estoque crítico/i)
    ).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: /Tentar novamente/i });
    fireEvent.click(retryBtn);

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it("consome dados reativos de productsApi.list({ low_stock_only: true })", async () => {
    (productsApi.list as any).mockResolvedValueOnce(mockCriticalProducts);

    renderWithProviders(<CriticalStockTable />);

    await waitFor(() => {
      expect(screen.getByText("Parafuso Sextavado Aço Inox M10")).toBeDefined();
      expect(productsApi.list).toHaveBeenCalledWith({ low_stock_only: true });
    });
  });
});
