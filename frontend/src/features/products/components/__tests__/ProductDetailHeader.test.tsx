import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductDetailHeader } from "../ProductDetailHeader";
import { Product } from "../../types/product.types";

describe("ProductDetailHeader (FT-14)", () => {
  const mockProduct: Product = {
    id: "prod-abc-123",
    name: "Cabo de Aço Galvanizado 6x19 8mm",
    description: "Cabo para içamento de carga conforme NBR 8400",
    unit: "M",
    current_quantity: 125.5,
    current_quantity_scaled: 125500,
    min_stock: 50,
    min_stock_scaled: 50000,
    is_low_stock: false,
    is_active: true,
    categories: [
      {
        id: "cat-1",
        name: "Cabos e Cordoalhas",
        color: "#2563EB",
        created_at: "2026-11-13T10:00:00Z",
      },
    ],
    created_at: "2026-11-13T10:00:00Z",
    updated_at: "2026-11-13T10:00:00Z",
  };

  it("renderiza os dados de identificação, nome, unidade e categorias", () => {
    render(<ProductDetailHeader product={mockProduct} />);

    expect(screen.getByTestId("product-detail-name").textContent).toBe(
      "Cabo de Aço Galvanizado 6x19 8mm"
    );
    expect(screen.getByTestId("product-detail-unit").textContent).toBe("M");
    expect(screen.getByTestId("product-detail-description").textContent).toContain(
      "Cabo para içamento de carga"
    );
    expect(screen.getByText("Cabos e Cordoalhas")).toBeDefined();
  });

  it("destaca o saldo físico atual com tipografia 2xl font-mono tabular-nums", () => {
    render(<ProductDetailHeader product={mockProduct} />);

    const balanceValue = screen.getByTestId("current-balance-value");
    expect(balanceValue).toBeDefined();
    expect(balanceValue.className).toContain("text-2xl");
    expect(balanceValue.className).toContain("font-mono");
    expect(balanceValue.className).toContain("tabular-nums");
    expect(balanceValue.textContent).toBe("125,5");

    // Unidade de medida associada
    expect(screen.getByTestId("current-balance-panel").textContent).toContain("M");
    expect(screen.getByTestId("current-balance-panel").textContent).toContain("50 M");
  });

  it("renderiza o badge semântico de status de estoque", () => {
    render(<ProductDetailHeader product={mockProduct} />);

    expect(screen.getByTestId("stock-badge-stock-ok")).toBeDefined();
    expect(screen.getByText("Em Estoque")).toBeDefined();
  });

  it("renderiza o link de 'Nova Movimentação' para `/inventory/move?product_id=...`", () => {
    render(<ProductDetailHeader product={mockProduct} />);

    const moveBtn = screen.getByTestId("new-movement-button");
    expect(moveBtn).toBeDefined();
    expect(moveBtn.closest("a")?.getAttribute("href")).toBe(
      "/inventory/move?product_id=prod-abc-123"
    );
  });

  it("renderiza alerta de item desativado quando is_active for falso", () => {
    const inactiveProduct: Product = {
      ...mockProduct,
      is_active: false,
    };

    render(<ProductDetailHeader product={inactiveProduct} />);

    expect(screen.getByText("Desativado")).toBeDefined();
    expect(screen.queryByTestId("new-movement-button")).toBeNull();
    expect(
      screen.getByText("Item Descontinuado (Movimentações Bloqueadas)")
    ).toBeDefined();
  });
});
