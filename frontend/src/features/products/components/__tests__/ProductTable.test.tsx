import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductTable } from "../ProductTable";
import { Product } from "../../types/product.types";

describe("ProductTable (FT-12)", () => {
  const mockDeactivate = vi.fn();
  const mockOpenCreate = vi.fn();

  const mockProducts: Product[] = [
    {
      id: "prod-1",
      name: "Eletrodo Revestido AWS E7018",
      description: "Consumível de solda 3.25mm",
      unit: "KG",
      current_quantity: "15.5",
      current_quantity_scaled: 15500,
      min_stock: "20.0",
      min_stock_scaled: 20000,
      is_low_stock: true,
      is_active: true,
      categories: [
        {
          id: "cat-1",
          name: "Soldagem",
          color: "#2563EB",
          created_at: "2026-11-13T10:00:00Z",
        },
      ],
      created_at: "2026-11-13T10:00:00Z",
      updated_at: "2026-11-13T10:00:00Z",
    },
    {
      id: "prod-2",
      name: "Disco de Desbaste 7 pol",
      description: "Abrasivo para esmerilhadeira",
      unit: "UN",
      current_quantity: "0",
      current_quantity_scaled: 0,
      min_stock: "10",
      min_stock_scaled: 10000,
      is_low_stock: true,
      is_active: true,
      categories: [],
      created_at: "2026-11-13T10:00:00Z",
      updated_at: "2026-11-13T10:00:00Z",
    },
    {
      id: "prod-3",
      name: "Broca Videa 8mm",
      description: "Broca para concreto descontinuada",
      unit: "UN",
      current_quantity: "0",
      current_quantity_scaled: 0,
      min_stock: null,
      min_stock_scaled: null,
      is_low_stock: false,
      is_active: false,
      categories: [],
      created_at: "2026-11-13T10:00:00Z",
      updated_at: "2026-11-13T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o estado de carregamento com skeleton de alta densidade", () => {
    render(
      <ProductTable
        products={[]}
        isLoading={true}
        onDeactivateProduct={mockDeactivate}
      />
    );

    const table = screen.getByRole("table");
    expect(table).toBeDefined();
    expect(screen.queryByText("Nenhum produto cadastrado no catálogo")).toBeNull();
  });

  it("renderiza o estado vazio quando a lista de produtos estiver vazia", () => {
    render(
      <ProductTable
        products={[]}
        isLoading={false}
        onDeactivateProduct={mockDeactivate}
        onOpenCreate={mockOpenCreate}
      />
    );

    expect(screen.getByText("Nenhum produto cadastrado no catálogo")).toBeDefined();
    const createBtn = screen.getByRole("button", { name: /Novo Produto/i });
    expect(createBtn).toBeDefined();
    fireEvent.click(createBtn);
    expect(mockOpenCreate).toHaveBeenCalledTimes(1);
  });

  it("renderiza produtos com colunas formatadas, saldos e badges semânticos", () => {
    render(
      <ProductTable
        products={mockProducts}
        isLoading={false}
        onDeactivateProduct={mockDeactivate}
      />
    );

    // Produto 1
    expect(screen.getByText("Eletrodo Revestido AWS E7018")).toBeDefined();
    expect(screen.getByText("Soldagem")).toBeDefined();
    expect(screen.getByText("Estoque Baixo")).toBeDefined();

    // Produto 2: Zerado
    expect(screen.getByText("Disco de Desbaste 7 pol")).toBeDefined();
    expect(screen.getByText("Zerado")).toBeDefined();

    // Produto 3: Inativo
    expect(screen.getByText("Broca Videa 8mm")).toBeDefined();
    expect(screen.getByText("Inativo")).toBeDefined();
  });

  it("renderiza links para ficha técnica (/products/[id]) e movimentação", () => {
    render(
      <ProductTable
        products={mockProducts}
        isLoading={false}
        onDeactivateProduct={mockDeactivate}
      />
    );

    const fichaLink = screen.getByLabelText(
      "Ver Ficha e Histórico de Eletrodo Revestido AWS E7018"
    );
    expect(fichaLink.getAttribute("href")).toBe("/products/prod-1");

    const moveLink = screen.getByLabelText(
      "Registrar Movimentação Física para Eletrodo Revestido AWS E7018"
    );
    expect(moveLink.getAttribute("href")).toBe("/inventory/move?product_id=prod-1");
  });

  it("chama onDeactivateProduct ao clicar no botão de inativação", () => {
    render(
      <ProductTable
        products={mockProducts}
        isLoading={false}
        canDeactivate={true}
        onDeactivateProduct={mockDeactivate}
      />
    );

    const inativarBtn = screen.getByLabelText(
      "Inativar produto Eletrodo Revestido AWS E7018"
    );
    fireEvent.click(inativarBtn);

    expect(mockDeactivate).toHaveBeenCalledWith(mockProducts[0]);
  });

  it("oculta o botão de inativação quando canDeactivate é false (ALMOXARIFE / AUDITOR)", () => {
    render(
      <ProductTable
        products={mockProducts}
        isLoading={false}
        canDeactivate={false}
        onDeactivateProduct={mockDeactivate}
      />
    );

    expect(
      screen.queryByLabelText("Inativar produto Eletrodo Revestido AWS E7018")
    ).toBeNull();
  });

  it("não exibe o botão de inativação para produto já inativo", () => {
    render(
      <ProductTable
        products={mockProducts}
        isLoading={false}
        canDeactivate={true}
        onDeactivateProduct={mockDeactivate}
      />
    );

    // Produto 3 já está inativo
    expect(screen.queryByLabelText("Inativar produto Broca Videa 8mm")).toBeNull();
  });
});
