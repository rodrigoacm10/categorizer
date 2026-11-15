import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LedgerTable } from "../LedgerTable";
import { StockMovement } from "../../types/inventory.types";

describe("LedgerTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockMovements: StockMovement[] = [
    {
      id: "mov-1",
      product_id: "prod-1",
      product_name: "Eletrodo AWS E7018",
      product_unit: "KG",
      type: "IN",
      quantity: 50,
      quantity_scaled: 50000,
      balance_after: 50,
      balance_after_scaled: 50000,
      reason: "Recebimento NF 1042",
      idempotency_key: "idem-key-001",
      created_at: "2026-11-13T10:00:00Z",
    },
    {
      id: "mov-2",
      product_id: "prod-1",
      product_name: "Eletrodo AWS E7018",
      product_unit: "KG",
      type: "OUT",
      quantity: 15,
      quantity_scaled: 15000,
      balance_after: 35,
      balance_after_scaled: 35000,
      reason: "Ordem de Serviço 88",
      idempotency_key: "idem-key-002",
      created_at: "2026-11-13T11:00:00Z",
    },
    {
      id: "mov-3",
      product_id: "prod-2",
      product_name: "Tubo Inox 304",
      product_unit: "MT",
      type: "ADJUSTMENT",
      quantity: 5,
      quantity_scaled: 5000,
      balance_after: 40,
      balance_after_scaled: 40000,
      reason: "Contagem cíclica",
      idempotency_key: "idem-key-003",
      created_at: "2026-11-13T12:00:00Z",
    },
    {
      id: "mov-4",
      product_id: "prod-3",
      product_name: "Parafuso Sextavado",
      product_unit: "UN",
      type: "PRODUCT_DELETED",
      quantity: 100,
      quantity_scaled: 100000,
      balance_after: 0,
      balance_after_scaled: 0,
      reason: "Descontinuação do SKU",
      idempotency_key: "idem-key-004",
      created_at: "2026-11-13T13:00:00Z",
    },
  ];

  it("renderiza estado vazio quando não houver movimentações", () => {
    render(<LedgerTable movements={[]} totalCount={0} />);

    expect(screen.getByText("Nenhuma movimentação registrada no Livro-Razão")).toBeDefined();
    expect(screen.getByText(/O extrato contábil perpétuo exibirá aqui/i)).toBeDefined();
    expect(screen.getByTestId("record-counter").textContent).toContain("Exibindo 0-0 de 0 lançamentos");
  });

  it("renderiza skeleton de carregamento quando isLoading for true", () => {
    render(<LedgerTable movements={[]} isLoading={true} />);

    expect(screen.getByTestId("ledger-table-container")).toBeDefined();
    expect(screen.queryByText("Nenhuma movimentação registrada no Livro-Razão")).toBeNull();
  });

  it("renderiza linhas contábeis com todas as colunas formatadas", () => {
    render(<LedgerTable movements={mockMovements} totalCount={4} />);

    // Verificação de produtos
    expect(screen.getAllByText("Eletrodo AWS E7018")).toHaveLength(2);
    expect(screen.getByText("Tubo Inox 304")).toBeDefined();
    expect(screen.getByText("Parafuso Sextavado")).toBeDefined();

    // Verificação dos Badges Semânticos
    expect(screen.getByTestId("movement-type-in")).toBeDefined();
    expect(screen.getByText("ENTRADA (IN)")).toBeDefined();

    expect(screen.getByTestId("movement-type-out")).toBeDefined();
    expect(screen.getByText("SAÍDA (OUT)")).toBeDefined();

    expect(screen.getByTestId("movement-type-adjustment")).toBeDefined();
    expect(screen.getByText("AJUSTE (Δ)")).toBeDefined();

    expect(screen.getByTestId("movement-type-deleted")).toBeDefined();
    expect(screen.getByText("INATIVAÇÃO")).toBeDefined();

    // Deltas com sinal explícito obrigatório (+/-)
    expect(screen.getByText("+50 KG")).toBeDefined();
    expect(screen.getByText("-15 KG")).toBeDefined();
    expect(screen.getByText("+5 MT")).toBeDefined();
    expect(screen.getByText("-100 UN")).toBeDefined();

    // Saldos resultantes pós-movimentação
    expect(screen.getByText("50 KG")).toBeDefined();
    expect(screen.getByText("35 KG")).toBeDefined();
    expect(screen.getByText("40 MT")).toBeDefined();
    expect(screen.getByText("0 UN")).toBeDefined();

    // Justificativas
    expect(screen.getByText("Recebimento NF 1042")).toBeDefined();
    expect(screen.getByText("Ordem de Serviço 88")).toBeDefined();
    expect(screen.getByText("Contagem cíclica")).toBeDefined();
    expect(screen.getByText("Descontinuação do SKU")).toBeDefined();

    // Chaves de idempotência
    expect(screen.getByText("idem-key-001")).toBeDefined();
    expect(screen.getByText("idem-key-002")).toBeDefined();
    expect(screen.getByText("idem-key-003")).toBeDefined();
    expect(screen.getByText("idem-key-004")).toBeDefined();
  });

  it("é estritamente somente-leitura (ZERO botões de edição ou exclusão)", () => {
    render(<LedgerTable movements={mockMovements} totalCount={4} />);

    expect(screen.queryByRole("button", { name: /editar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /excluir/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /remover/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /deletar/i })).toBeNull();
  });

  it("gerencia paginação compacta e dispara callbacks ao navegar", () => {
    const handlePageChange = vi.fn();
    const handleLimitChange = vi.fn();

    render(
      <LedgerTable
        movements={mockMovements}
        totalCount={80}
        limit={25}
        offset={25}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />
    );

    // Indicador e Contador
    expect(screen.getByTestId("record-counter").textContent).toContain("Exibindo 26-50 de 80 lançamentos");
    expect(screen.getByText("Página 2 de 4")).toBeDefined();

    // Botão Anterior ativo (offset = 25)
    const prevButton = screen.getByTestId("prev-page-button") as HTMLButtonElement;
    expect(prevButton.disabled).toBe(false);
    fireEvent.click(prevButton);
    expect(handlePageChange).toHaveBeenCalledWith(0);

    // Botão Próxima ativo (offset = 25, total = 80)
    const nextButton = screen.getByTestId("next-page-button") as HTMLButtonElement;
    expect(nextButton.disabled).toBe(false);
    fireEvent.click(nextButton);
    expect(handlePageChange).toHaveBeenCalledWith(50);

    // Seletor de limite
    const limitSelect = screen.getByTestId("limit-select");
    fireEvent.change(limitSelect, { target: { value: "50" } });
    expect(handleLimitChange).toHaveBeenCalledWith(50);
  });

  it("desabilita botão Anterior na primeira página e Próxima na última página", () => {
    const { rerender } = render(
      <LedgerTable movements={mockMovements} totalCount={30} limit={25} offset={0} />
    );

    const prevButton = screen.getByTestId("prev-page-button") as HTMLButtonElement;
    const nextButton = screen.getByTestId("next-page-button") as HTMLButtonElement;

    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(false);

    // Última página (offset = 25, limit = 25, total = 30)
    rerender(
      <LedgerTable movements={mockMovements} totalCount={30} limit={25} offset={25} />
    );

    expect(prevButton.disabled).toBe(false);
    expect(nextButton.disabled).toBe(true);
  });

  it("permite copiar a chave de idempotência para o clipboard", () => {
    const originalClipboard = navigator.clipboard;
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<LedgerTable movements={[mockMovements[0]]} totalCount={1} />);

    const copyBtn = screen.getByRole("button", {
      name: /Copiar chave de idempotência idem-key-001/i,
    });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("idem-key-001");

    Object.assign(navigator, { clipboard: originalClipboard });
  });
});
