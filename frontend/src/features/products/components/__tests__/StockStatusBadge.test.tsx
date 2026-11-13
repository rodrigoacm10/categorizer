import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StockStatusBadge, resolveStockStatus } from "../StockStatusBadge";

describe("StockStatusBadge (FT-12)", () => {
  it("resolveStockStatus determina corretamente os quatro estados semânticos", () => {
    // Inativo
    expect(resolveStockStatus({ isActive: false, currentQuantity: 100 })).toBe("stock-inactive");

    // Zerado
    expect(resolveStockStatus({ isActive: true, currentQuantity: 0, minStock: 10 })).toBe("stock-empty");
    expect(resolveStockStatus({ isActive: true, currentQuantity: -5, minStock: 10 })).toBe("stock-empty");

    // Estoque Baixo
    expect(resolveStockStatus({ isActive: true, currentQuantity: 5, minStock: 10 })).toBe("stock-low");
    expect(resolveStockStatus({ isActive: true, currentQuantity: 20, isLowStock: true })).toBe("stock-low");

    // Em Estoque
    expect(resolveStockStatus({ isActive: true, currentQuantity: 50, minStock: 10 })).toBe("stock-ok");
  });

  it("renderiza badge com texto 'Em Estoque' para status stock-ok", () => {
    render(<StockStatusBadge status="stock-ok" />);

    expect(screen.getByText("Em Estoque")).toBeDefined();
    const badge = screen.getByTestId("stock-badge-stock-ok");
    expect(badge.className).toContain("bg-emerald-50");
  });

  it("renderiza badge com texto 'Estoque Baixo' para status stock-low", () => {
    render(<StockStatusBadge isLowStock={true} currentQuantity={5} minStock={10} />);

    expect(screen.getByText("Estoque Baixo")).toBeDefined();
    const badge = screen.getByTestId("stock-badge-stock-low");
    expect(badge.className).toContain("bg-amber-50");
  });

  it("renderiza badge com texto 'Zerado' para saldo 0", () => {
    render(<StockStatusBadge currentQuantity={0} />);

    expect(screen.getByText("Zerado")).toBeDefined();
    const badge = screen.getByTestId("stock-badge-stock-empty");
    expect(badge.className).toContain("bg-rose-50");
  });

  it("renderiza badge com texto 'Inativo' quando isActive é false", () => {
    render(<StockStatusBadge isActive={false} />);

    expect(screen.getByText("Inativo")).toBeDefined();
    const badge = screen.getByTestId("stock-badge-stock-inactive");
    expect(badge.className).toContain("bg-zinc-100");
  });
});
