import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProductDetailPage from "../page";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { productsApi } from "@/features/products/services/products.api";
import { categoriesApi } from "@/features/categories/services/categories.api";
import { inventoryApi } from "@/features/inventory/services/inventory.api";
import { Product } from "@/features/products/types/product.types";
import { TenantRole } from "@/shared/types/rbac.types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useParams: () => ({
    id: "prod-xyz-999",
  }),
}));

vi.mock("@/features/products/services/products.api", () => ({
  productsApi: {
    getById: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/features/categories/services/categories.api", () => ({
  categoriesApi: {
    list: vi.fn(),
  },
}));

vi.mock("@/features/inventory/services/inventory.api", () => ({
  inventoryApi: {
    getProductLedger: vi.fn(),
  },
}));

describe("ProductDetailPage (/products/[id] - FT-14)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.mocked(categoriesApi.list).mockResolvedValue([]);
    vi.mocked(inventoryApi.getProductLedger).mockResolvedValue([]);
  });

  const mockProduct: Product = {
    id: "prod-xyz-999",
    name: "Luva de Vaqueta Cano Curto",
    description: "EPI para proteção mecânica das mãos",
    unit: "PAR",
    current_quantity: 80,
    current_quantity_scaled: 80000,
    min_stock: 30,
    min_stock_scaled: 30000,
    is_low_stock: false,
    is_active: true,
    categories: [
      {
        id: "cat-1",
        name: "EPIs de Couro",
        color: "#D97706",
        created_at: "2026-11-13T10:00:00Z",
      },
    ],
    created_at: "2026-11-13T10:00:00Z",
    updated_at: "2026-11-13T10:00:00Z",
  };

  const renderPage = (
    role: TenantRole = "OWNER",
    productId = "prod-xyz-999"
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId="t-test-123" initialRole={role}>
          <ProductDetailPage params={{ id: productId }} />
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  it("renderiza o cabeçalho e a Aba 1 com formulário editável para OWNER", async () => {
    vi.mocked(productsApi.getById).mockResolvedValueOnce(mockProduct);

    renderPage("OWNER");

    // Aguarda carregar dados
    await waitFor(() => {
      expect(screen.getByTestId("product-detail-name").textContent).toBe(
        "Luva de Vaqueta Cano Curto"
      );
    });

    // Saldo físico em destaque no cabeçalho
    expect(screen.getByTestId("current-balance-value").textContent).toBe("80");
    expect(screen.getByTestId("current-balance-panel").textContent).toContain("PAR");

    // Aba 1 ativa por padrão
    expect(screen.getByTestId("tab-content-details")).toBeDefined();
    expect(screen.getByTestId("submit-product-button")).toBeDefined();

    // Invariante Crítica: Proibição de campo de saldo no formulário
    expect(screen.queryByLabelText(/saldo inicial/i)).toBeNull();
    expect(screen.queryByLabelText(/quantidade inicial/i)).toBeNull();
  });

  it("renderiza a Aba 1 em modo somente-leitura com campos desabilitados para ALMOXARIFE", async () => {
    vi.mocked(productsApi.getById).mockResolvedValueOnce(mockProduct);

    renderPage("ALMOXARIFE");

    await waitFor(() => {
      expect(screen.getByTestId("product-detail-name")).toBeDefined();
    });

    // Aviso de modo somente-leitura
    expect(screen.getByTestId("readonly-role-notice")).toBeDefined();
    expect(screen.getByTestId("readonly-role-notice").textContent).toContain("Modo Somente-Leitura");

    // Campos desabilitados e botão salvar ausente
    expect(screen.getByTestId("product-name-input")).toHaveProperty("disabled", true);
    expect(screen.queryByTestId("submit-product-button")).toBeNull();
  });

  it("renderiza a Aba 1 em modo somente-leitura para AUDITOR", async () => {
    vi.mocked(productsApi.getById).mockResolvedValueOnce(mockProduct);

    renderPage("AUDITOR");

    await waitFor(() => {
      expect(screen.getByTestId("product-detail-name")).toBeDefined();
    });

    expect(screen.getByTestId("readonly-role-notice")).toBeDefined();
    expect(screen.getByTestId("product-name-input")).toHaveProperty("disabled", true);
    expect(screen.queryByTestId("submit-product-button")).toBeNull();
  });

  it("alterna para a Aba 2 ('Extrato do Livro-Razão') e renderiza o histórico do produto", async () => {
    vi.mocked(productsApi.getById).mockResolvedValueOnce(mockProduct);
    vi.mocked(inventoryApi.getProductLedger).mockResolvedValueOnce([
      {
        id: "mov-1",
        product_id: "prod-xyz-999",
        type: "IN",
        quantity: 80,
        quantity_scaled: 80000,
        balance_after: 80,
        balance_after_scaled: 80000,
        reason: "Entrada por NF 994",
        idempotency_key: "idem-test-key",
        created_at: "2026-11-13T10:00:00Z",
      },
    ]);

    renderPage("OWNER");

    await waitFor(() => {
      expect(screen.getByTestId("product-detail-name")).toBeDefined();
    });

    // Clica na Aba 2
    const ledgerTab = screen.getByTestId("tab-ledger");
    fireEvent.click(ledgerTab);

    await waitFor(() => {
      expect(screen.getByTestId("tab-content-ledger")).toBeDefined();
      expect(screen.getByText("Entrada por NF 994")).toBeDefined();
      expect(screen.getByText("+80 PAR")).toBeDefined();
    });

    // Clica de volta na Aba 1
    const detailsTab = screen.getByTestId("tab-details");
    fireEvent.click(detailsTab);

    expect(screen.getByTestId("tab-content-details")).toBeDefined();
  });

  it("renderiza mensagem de erro quando produto não for encontrado (404)", async () => {
    vi.mocked(productsApi.getById).mockRejectedValueOnce(
      new Error("Produto não encontrado neste almoxarifado.")
    );

    renderPage("OWNER", "non-existent-id");

    await waitFor(() => {
      expect(screen.getByTestId("product-not-found")).toBeDefined();
      expect(
        screen.getByText("Produto não encontrado neste almoxarifado.")
      ).toBeDefined();
    });
  });

  it("permite atualizar dados cadastrais na Aba 1 e exibe banner de confirmação", async () => {
    vi.mocked(productsApi.getById).mockResolvedValueOnce(mockProduct);
    vi.mocked(productsApi.update).mockResolvedValueOnce({
      ...mockProduct,
      name: "Luva de Vaqueta Cano Curto Reforçada",
    });

    renderPage("OWNER");

    await waitFor(() => {
      expect(screen.getByTestId("product-name-input")).toBeDefined();
    });

    const nameInput = screen.getByTestId("product-name-input");
    fireEvent.change(nameInput, {
      target: { value: "Luva de Vaqueta Cano Curto Reforçada" },
    });

    fireEvent.click(screen.getByTestId("submit-product-button"));

    await waitFor(() => {
      expect(productsApi.update).toHaveBeenCalledWith("prod-xyz-999", {
        name: "Luva de Vaqueta Cano Curto Reforçada",
        description: "EPI para proteção mecânica das mãos",
        unit: "PAR",
        min_stock: 30,
        category_ids: ["cat-1"],
      });
      expect(screen.getByTestId("detail-feedback-banner")).toBeDefined();
      expect(
        screen.getByText("Dados cadastrais do produto atualizados com sucesso.")
      ).toBeDefined();
    });
  });
});
