import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MovementForm } from "../MovementForm";
import { inventoryApi } from "../../services/inventory.api";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { Product } from "@/features/products/types/product.types";
import { StockMovement } from "../../types/inventory.types";

const mockUseSearchParams = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("@/features/tenants/hooks/useTenant", () => ({
  useTenant: () => ({ tenantId: "tenant-123" }),
}));

vi.mock("@/shared/hooks/useRBAC", () => ({
  useRBAC: vi.fn(),
}));

vi.mock("../../services/inventory.api", () => ({
  inventoryApi: {
    lookupProduct: vi.fn(),
    registerStockIn: vi.fn(),
    registerStockOut: vi.fn(),
    registerStockAdjustment: vi.fn(),
  },
}));

describe("MovementForm (FT-15 & FT-16)", () => {
  const mockProduct: Product = {
    id: "prod-100",
    name: "Cabo de Cobre 16mm",
    unit: "M",
    current_quantity: "50",
    current_quantity_scaled: 50000,
    is_low_stock: false,
    is_active: true,
    categories: [{ id: "cat-1", name: "Elétrica", created_at: "" }],
    created_at: "2026-11-13T10:00:00Z",
    updated_at: "2026-11-13T10:00:00Z",
  };

  const mockMovementResult: StockMovement = {
    id: "mov-501",
    product_id: "prod-100",
    type: "IN",
    quantity: "20",
    quantity_scaled: 20000,
    balance_after: "70",
    balance_after_scaled: 70000,
    reason: "Recebimento NF 890",
    created_at: "2026-11-13T11:00:00Z",
    is_replay: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams(""));
    vi.mocked(useRBAC).mockReturnValue({
      role: "ALMOXARIFE",
      can: vi.fn((action: string) => ["stock_in", "stock_out", "stock_adjustment"].includes(action)),
      hasRole: vi.fn(),
      isOwner: vi.fn().mockReturnValue(false),
      isGestor: vi.fn().mockReturnValue(false),
      isAlmoxarife: vi.fn().mockReturnValue(true),
      isAuditor: vi.fn().mockReturnValue(false),
    });
  });

  it("renderiza campo de código de barras com foco e botão de busca", () => {
    render(<MovementForm />);

    const searchInput = screen.getByTestId("barcode-search-input");
    expect(searchInput).toBeDefined();
    expect(screen.getByRole("button", { name: /Buscar/i })).toBeDefined();
  });

  it("busca produto ao pressionar Enter no leitor de código de barras", async () => {
    vi.mocked(inventoryApi.lookupProduct).mockResolvedValueOnce(mockProduct);

    render(<MovementForm />);
    const searchInput = screen.getByTestId("barcode-search-input");

    fireEvent.change(searchInput, { target: { value: "789000123" } });
    fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(inventoryApi.lookupProduct).toHaveBeenCalledWith("789000123");
    });

    expect(screen.getByTestId("selected-product-card")).toBeDefined();
    expect(screen.getByText("Cabo de Cobre 16mm")).toBeDefined();
    expect(screen.getByTestId("selected-product-balance").textContent).toContain("50 M");
  });

  it("exibe mensagem amigável de erro se a busca do produto falhar", async () => {
    vi.mocked(inventoryApi.lookupProduct).mockRejectedValueOnce(
      new Error('Produto não encontrado com o código "SKU_INVALIDO".')
    );

    render(<MovementForm />);
    const searchInput = screen.getByTestId("barcode-search-input");

    fireEvent.change(searchInput, { target: { value: "SKU_INVALIDO" } });
    fireEvent.click(screen.getByRole("button", { name: /Buscar/i }));

    await waitFor(() => {
      expect(screen.getByTestId("search-error-message")).toBeDefined();
    });
    expect(screen.getByTestId("search-error-message").textContent).toContain("SKU_INVALIDO");
  });

  it("carrega automaticamente o produto se query param ?product_id=... for fornecido", async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("product_id=prod-100"));
    vi.mocked(inventoryApi.lookupProduct).mockResolvedValueOnce(mockProduct);

    render(<MovementForm />);

    await waitFor(() => {
      expect(inventoryApi.lookupProduct).toHaveBeenCalledWith("prod-100");
    });
    expect(screen.getByText("Cabo de Cobre 16mm")).toBeDefined();
  });

  it("registra entrada (IN) com sucesso e atualiza saldo contábil local", async () => {
    vi.mocked(inventoryApi.lookupProduct).mockResolvedValueOnce(mockProduct);
    vi.mocked(inventoryApi.registerStockIn).mockResolvedValueOnce(mockMovementResult);

    render(<MovementForm />);

    // Seleciona produto
    const searchInput = screen.getByTestId("barcode-search-input");
    fireEvent.change(searchInput, { target: { value: "prod-100" } });
    fireEvent.click(screen.getByRole("button", { name: /Buscar/i }));

    await waitFor(() => {
      expect(screen.getByText("Cabo de Cobre 16mm")).toBeDefined();
    });

    // Preenche quantidade e justificativa
    const qtyInput = screen.getByTestId("movement-quantity-input");
    fireEvent.change(qtyInput, { target: { value: "20" } });

    const reasonInput = screen.getByTestId("movement-reason-input");
    fireEvent.change(reasonInput, { target: { value: "Recebimento NF 890" } });

    const submitBtn = screen.getByTestId("submit-movement-button");
    expect(submitBtn.hasAttribute("disabled")).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(inventoryApi.registerStockIn).toHaveBeenCalledWith(
        {
          product_id: "prod-100",
          quantity: "20",
          reason: "Recebimento NF 890",
        },
        expect.any(String)
      );
    });

    // Feedback de sucesso
    expect(screen.getByTestId("success-alert")).toBeDefined();
    expect(screen.getByTestId("selected-product-balance").textContent).toContain("70 M");
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it("bloqueia saída (OUT) no cliente quando a quantidade solicitada excede o saldo físico", async () => {
    vi.mocked(inventoryApi.lookupProduct).mockResolvedValueOnce(mockProduct);

    render(<MovementForm />);

    // Seleciona produto
    const searchInput = screen.getByTestId("barcode-search-input");
    fireEvent.change(searchInput, { target: { value: "prod-100" } });
    fireEvent.click(screen.getByRole("button", { name: /Buscar/i }));

    await waitFor(() => {
      expect(screen.getByText("Cabo de Cobre 16mm")).toBeDefined();
    });

    // Troca para a aba Saída
    fireEvent.click(screen.getByRole("tab", { name: /Saída \(-\)/i }));

    // Tenta retirar 60 (saldo é 50)
    const qtyInput = screen.getByTestId("movement-quantity-input");
    fireEvent.change(qtyInput, { target: { value: "60" } });

    const reasonInput = screen.getByTestId("movement-reason-input");
    fireEvent.change(reasonInput, { target: { value: "OS 104" } });

    // Alerta de saldo negativo exibido
    expect(screen.getByTestId("negative-balance-alert")).toBeDefined();

    // Botão DESABILITADO obrigatoriamente
    const submitBtn = screen.getByTestId("submit-movement-button");
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
    expect(inventoryApi.registerStockOut).not.toHaveBeenCalled();
  });

  it("exibe badge de replay quando a resposta da API retornar cache de idempotência (X-Cache: HIT)", async () => {
    vi.mocked(inventoryApi.lookupProduct).mockResolvedValueOnce(mockProduct);
    vi.mocked(inventoryApi.registerStockIn).mockResolvedValueOnce({
      ...mockMovementResult,
      is_replay: true,
    });

    render(<MovementForm />);

    const searchInput = screen.getByTestId("barcode-search-input");
    fireEvent.change(searchInput, { target: { value: "prod-100" } });
    fireEvent.click(screen.getByRole("button", { name: /Buscar/i }));

    await waitFor(() => {
      expect(screen.getByText("Cabo de Cobre 16mm")).toBeDefined();
    });

    fireEvent.change(screen.getByTestId("movement-quantity-input"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByTestId("submit-movement-button"));

    await waitFor(() => {
      expect(screen.getByTestId("replay-badge")).toBeDefined();
    });
  });

  it("aba de Ajuste Físico (ADJUSTMENT) exige justificativa de no mínimo 5 caracteres e exibe delta no botão", async () => {
    vi.mocked(inventoryApi.lookupProduct).mockResolvedValueOnce(mockProduct);
    vi.mocked(inventoryApi.registerStockAdjustment).mockResolvedValueOnce({
      ...mockMovementResult,
      type: "ADJUSTMENT",
      balance_after: "55",
      balance_after_scaled: 55000,
    });

    render(<MovementForm />);

    const searchInput = screen.getByTestId("barcode-search-input");
    fireEvent.change(searchInput, { target: { value: "prod-100" } });
    fireEvent.click(screen.getByRole("button", { name: /Buscar/i }));

    await waitFor(() => {
      expect(screen.getByText("Cabo de Cobre 16mm")).toBeDefined();
    });

    // Troca para Ajuste Físico
    fireEvent.click(screen.getByRole("tab", { name: /Ajuste Físico/i }));

    // Saldo atual é 50 M. Contagem física deu 55 M -> Delta = +5 M
    const qtyInput = screen.getByTestId("movement-quantity-input");
    fireEvent.change(qtyInput, { target: { value: "55" } });

    const submitBtn = screen.getByTestId("submit-movement-button");
    expect(submitBtn.textContent).toContain("Registrar Ajuste (+5 M)");

    // Com justificativa curta (< 5 chars), botão fica desabilitado
    const reasonInput = screen.getByTestId("movement-reason-input");
    fireEvent.change(reasonInput, { target: { value: "abc" } });
    expect(submitBtn.hasAttribute("disabled")).toBe(true);

    // Com justificativa válida (>= 5 chars), botão fica habilitado
    fireEvent.change(reasonInput, { target: { value: "Contagem de inventário físico Galpão A" } });
    expect(submitBtn.hasAttribute("disabled")).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(inventoryApi.registerStockAdjustment).toHaveBeenCalledWith(
        {
          product_id: "prod-100",
          quantity: "55",
          reason: "Contagem de inventário físico Galpão A",
        },
        expect.any(String)
      );
    });
  });

  it("desabilita abas de Entrada e Saída para papel AUDITOR exibindo aviso de permissão", async () => {
    vi.mocked(useRBAC).mockReturnValue({
      role: "AUDITOR",
      can: vi.fn((action: string) => action === "stock_adjustment"), // AUDITOR pode apenas ajuste
      hasRole: vi.fn(),
      isOwner: vi.fn().mockReturnValue(false),
      isGestor: vi.fn().mockReturnValue(false),
      isAlmoxarife: vi.fn().mockReturnValue(false),
      isAuditor: vi.fn().mockReturnValue(true),
    });

    vi.mocked(inventoryApi.lookupProduct).mockResolvedValueOnce(mockProduct);

    render(<MovementForm />);

    const searchInput = screen.getByTestId("barcode-search-input");
    fireEvent.change(searchInput, { target: { value: "prod-100" } });
    fireEvent.click(screen.getByRole("button", { name: /Buscar/i }));

    await waitFor(() => {
      expect(screen.getByText("Cabo de Cobre 16mm")).toBeDefined();
    });

    // Na aba IN: aviso de permissão para AUDITOR
    expect(screen.getByTestId("permission-warning-banner")).toBeDefined();
    expect(screen.getByTestId("submit-movement-button").hasAttribute("disabled")).toBe(true);

    // Na aba OUT: aviso de permissão para AUDITOR
    fireEvent.click(screen.getByRole("tab", { name: /Saída \(-\)/i }));
    expect(screen.getByTestId("permission-warning-banner")).toBeDefined();
    expect(screen.getByTestId("submit-movement-button").hasAttribute("disabled")).toBe(true);

    // Na aba ADJUSTMENT: habilitada para AUDITOR!
    fireEvent.click(screen.getByRole("tab", { name: /Ajuste Físico/i }));
    expect(screen.queryByTestId("permission-warning-banner")).toBeNull();
  });
});
