import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InventoryMovementsPage from "../page";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { inventoryApi } from "@/features/inventory/services/inventory.api";
import { productsApi } from "@/features/products/services/products.api";
import { tenantsApi } from "@/features/tenants/services/tenants.api";
import { StockMovement, PaginatedStockMovements } from "@/features/inventory/types/inventory.types";
import { Product } from "@/features/products/types/product.types";
import { Tenant } from "@/features/tenants/types/tenant.types";

vi.mock("@/features/inventory/services/inventory.api", () => ({
  inventoryApi: {
    listMovements: vi.fn(),
    exportMovementsCsv: vi.fn(),
  },
}));

vi.mock("@/features/products/services/products.api", () => ({
  productsApi: {
    list: vi.fn(),
  },
}));

vi.mock("@/features/tenants/services/tenants.api", () => ({
  tenantsApi: {
    listTenants: vi.fn(),
  },
}));

let mockSearchParams = new URLSearchParams("");
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

describe("InventoryMovementsPage (/inventory/movements - FT-17)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("");
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const mockTenant: Tenant = {
    id: "tenant-123",
    name: "Almoxarifado Central",
    slug: "central",
    is_active: true,
    created_at: "2026-11-13T10:00:00Z",
    updated_at: "2026-11-13T10:00:00Z",
  };

  const mockProduct: Product = {
    id: "prod-1",
    name: "Chapa de Aço 1020",
    unit: "KG",
    current_quantity: 100,
    current_quantity_scaled: 100000,
    is_low_stock: false,
    is_active: true,
    categories: [],
    created_at: "2026-11-13T10:00:00Z",
    updated_at: "2026-11-13T10:00:00Z",
  };

  const mockMovement: StockMovement = {
    id: "mov-1",
    product_id: "prod-1",
    product_name: "Chapa de Aço 1020",
    product_unit: "KG",
    type: "IN",
    quantity: 50,
    quantity_scaled: 50000,
    balance_after: 100,
    balance_after_scaled: 100000,
    reason: "Recebimento NF 5542",
    idempotency_key: "idem-key-999",
    created_at: "2026-11-13T10:00:00Z",
  };

  const mockPaginated: PaginatedStockMovements = Object.assign([mockMovement], {
    items: [mockMovement],
    totalCount: 1,
    totalPages: 1,
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId="tenant-123" initialRole="ALMOXARIFE">
          <InventoryMovementsPage />
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  it("renderiza o cabeçalho, subtítulo e controles de ação da bancada", async () => {
    vi.mocked(tenantsApi.listTenants).mockResolvedValueOnce([mockTenant]);
    vi.mocked(productsApi.list).mockResolvedValueOnce([mockProduct]);
    vi.mocked(inventoryApi.listMovements).mockResolvedValueOnce(mockPaginated);

    renderPage();

    expect(screen.getByText("Extrato Geral do Livro-Razão")).toBeDefined();
    expect(
      screen.getByText(
        "Registro perpétuo, imutável e auditável de todos os lançamentos físicos de estoque (Append-Only)."
      )
    ).toBeDefined();

    expect(screen.getByTestId("export-csv-button")).toBeDefined();
    expect(screen.getByTestId("refresh-movements-button")).toBeDefined();
    expect(screen.getByTestId("go-to-move-button")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Chapa de Aço 1020")).toBeDefined();
      expect(screen.getByText("+50 KG")).toBeDefined();
      expect(screen.getByText("Recebimento NF 5542")).toBeDefined();
    });
  });

  it("aciona download de CSV ao clicar no botão 'Exportar CSV'", async () => {
    vi.mocked(tenantsApi.listTenants).mockResolvedValueOnce([mockTenant]);
    vi.mocked(productsApi.list).mockResolvedValueOnce([mockProduct]);
    vi.mocked(inventoryApi.listMovements).mockResolvedValueOnce(mockPaginated);
    vi.mocked(inventoryApi.exportMovementsCsv).mockResolvedValueOnce({
      blob: new Blob(["mock,csv"], { type: "text/csv" }),
      filename: "extrato-estoque-central-2026-11-15.csv",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Almoxarifado Central")).toBeDefined();
    });

    const exportBtn = screen.getByTestId("export-csv-button");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(inventoryApi.exportMovementsCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: undefined,
          type: undefined,
        }),
        "central"
      );
    });
  });

  it("exibe alerta visual quando a exportação de CSV falhar", async () => {
    vi.mocked(tenantsApi.listTenants).mockResolvedValueOnce([mockTenant]);
    vi.mocked(productsApi.list).mockResolvedValueOnce([mockProduct]);
    vi.mocked(inventoryApi.listMovements).mockResolvedValueOnce(mockPaginated);
    vi.mocked(inventoryApi.exportMovementsCsv).mockRejectedValueOnce(
      new Error("Serviço de exportação temporariamente indisponível")
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("export-csv-button")).toBeDefined();
    });

    const exportBtn = screen.getByTestId("export-csv-button");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(screen.getByTestId("export-error-alert")).toBeDefined();
      expect(
        screen.getByText("Serviço de exportação temporariamente indisponível")
      ).toBeDefined();
    });
  });

  it("inicializa filtros a partir de searchParams na URL", async () => {
    mockSearchParams = new URLSearchParams("product_id=prod-1&type=IN");

    vi.mocked(tenantsApi.listTenants).mockResolvedValueOnce([mockTenant]);
    vi.mocked(productsApi.list).mockResolvedValueOnce([mockProduct]);
    vi.mocked(inventoryApi.listMovements).mockResolvedValueOnce(mockPaginated);

    renderPage();

    await waitFor(() => {
      const productSelect = screen.getByTestId("product-filter-select") as HTMLSelectElement;
      const typeSelect = screen.getByTestId("type-filter-select") as HTMLSelectElement;

      expect(productSelect.value).toBe("prod-1");
      expect(typeSelect.value).toBe("IN");
    });
  });
});
