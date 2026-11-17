import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductLedgerHistory } from "../ProductLedgerHistory";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { inventoryApi } from "@/features/inventory/services/inventory.api";
import { StockMovement } from "@/features/inventory/types/inventory.types";

vi.mock("@/features/inventory/services/inventory.api", () => ({
  inventoryApi: {
    getProductLedger: vi.fn(),
  },
}));

describe("ProductLedgerHistory (FT-14)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const mockMovements: StockMovement[] = [
    {
      id: "mov-1",
      product_id: "prod-1",
      type: "IN",
      quantity: 50,
      quantity_scaled: 50000,
      balance_after: 50,
      balance_after_scaled: 50000,
      reason: "Entrada inicial por NF 12345",
      idempotency_key: "idem-key-001",
      created_at: "2026-11-13T10:00:00Z",
    },
    {
      id: "mov-2",
      product_id: "prod-1",
      type: "OUT",
      quantity: 15,
      quantity_scaled: 15000,
      balance_after: 35,
      balance_after_scaled: 35000,
      reason: "Requisição para linha de montagem",
      idempotency_key: "idem-key-002",
      created_at: "2026-11-13T11:00:00Z",
    },
    {
      id: "mov-3",
      product_id: "prod-1",
      type: "ADJUSTMENT",
      quantity: 5,
      quantity_scaled: 5000,
      balance_after: 40,
      balance_after_scaled: 40000,
      reason: "Contagem de inventário cíclico",
      idempotency_key: "idem-key-003",
      created_at: "2026-11-13T12:00:00Z",
    },
    {
      id: "mov-4",
      product_id: "prod-1",
      type: "PRODUCT_DELETED",
      quantity: 0,
      quantity_scaled: 0,
      balance_after: 40,
      balance_after_scaled: 40000,
      reason: "Produto desativado pelo gestor",
      idempotency_key: null,
      created_at: "2026-11-13T13:00:00Z",
    },
  ];

  const renderComponent = (productId = "prod-1", productUnit = "KG") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId="t-test-123" initialRole="OWNER">
          <ProductLedgerHistory productId={productId} productUnit={productUnit} />
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  it("renderiza o extrato do Livro-Razão com deltas sinalizados (+ e -) e saldos resultantes", async () => {
    vi.mocked(inventoryApi.getProductLedger).mockResolvedValueOnce(mockMovements);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("4 registros")).toBeDefined();
    });

    // Badges semânticos de eventos
    expect(screen.getByTestId("movement-type-in")).toBeDefined();
    expect(screen.getByText("ENTRADA (IN)")).toBeDefined();

    expect(screen.getByTestId("movement-type-out")).toBeDefined();
    expect(screen.getByText("SAÍDA (OUT)")).toBeDefined();

    expect(screen.getByTestId("movement-type-adjustment")).toBeDefined();
    expect(screen.getByText("AJUSTE (Δ)")).toBeDefined();

    expect(screen.getByTestId("movement-type-deleted")).toBeDefined();
    expect(screen.getByText("INATIVAÇÃO")).toBeDefined();

    // Deltas com sinal explícito
    expect(screen.getByText("+50 KG")).toBeDefined();
    expect(screen.getByText("-15 KG")).toBeDefined();
    expect(screen.getByText("+5 KG")).toBeDefined();

    // Saldo resultante
    expect(screen.getByText("50 KG")).toBeDefined();
    expect(screen.getByText("35 KG")).toBeDefined();
    expect(screen.getAllByText("40 KG")).toHaveLength(2);

    // Justificativas e Chaves de Idempotência
    expect(screen.getByText("Entrada inicial por NF 12345")).toBeDefined();
    expect(screen.getByText("Requisição para linha de montagem")).toBeDefined();
    expect(screen.getByText("idem-key-001")).toBeDefined();
    expect(screen.getByText("idem-key-002")).toBeDefined();
  });

  it("é estritamente somente-leitura (sem controles de edição ou exclusão)", async () => {
    vi.mocked(inventoryApi.getProductLedger).mockResolvedValueOnce(mockMovements);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Imutável / Somente-Leitura")).toBeDefined();
    });

    // Zero botões de edição ou deleção no extrato
    expect(screen.queryByRole("button", { name: /editar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /excluir/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /remover/i })).toBeNull();
  });

  it("renderiza mensagem amigável quando não houver lançamentos no extrato", async () => {
    vi.mocked(inventoryApi.getProductLedger).mockResolvedValueOnce([]);

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText("Nenhuma movimentação registrada no Livro-Razão")
      ).toBeDefined();
    });
  });

  it("permite recarregar os dados pelo botão de atualizar", async () => {
    vi.mocked(inventoryApi.getProductLedger).mockResolvedValue(mockMovements);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("4 registros")).toBeDefined();
    });

    const refreshBtn = screen.getByTestId("refresh-ledger-button");
    fireEvent.click(refreshBtn);

    expect(inventoryApi.getProductLedger).toHaveBeenCalledTimes(2);
  });
});
