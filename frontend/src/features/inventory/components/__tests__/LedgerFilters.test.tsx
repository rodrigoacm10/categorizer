import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LedgerFilters, LedgerFiltersValue } from "../LedgerFilters";
import { Product } from "@/features/products/types/product.types";

describe("LedgerFilters", () => {
  const mockProducts: Product[] = [
    {
      id: "prod-1",
      name: "Chapa de Aço 1020",
      unit: "KG",
      current_quantity: 150,
      current_quantity_scaled: 150000,
      is_low_stock: false,
      is_active: true,
      categories: [],
      created_at: "2026-11-13T10:00:00Z",
      updated_at: "2026-11-13T10:00:00Z",
    },
    {
      id: "prod-2",
      name: "Tubo Inox 304",
      unit: "MT",
      current_quantity: 40,
      current_quantity_scaled: 40000,
      is_low_stock: false,
      is_active: true,
      categories: [],
      created_at: "2026-11-13T10:00:00Z",
      updated_at: "2026-11-13T10:00:00Z",
    },
  ];

  const defaultValues: LedgerFiltersValue = {
    productId: "",
    type: "",
    startDate: "",
    endDate: "",
  };

  it("renderiza todos os controles de filtro com valores padrão", () => {
    render(
      <LedgerFilters
        products={mockProducts}
        values={defaultValues}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByTestId("product-filter-select")).toBeDefined();
    expect(screen.getByTestId("type-filter-select")).toBeDefined();
    expect(screen.getByTestId("start-date-input")).toBeDefined();
    expect(screen.getByTestId("end-date-input")).toBeDefined();
    expect(screen.getByText("Nenhum filtro aplicado")).toBeDefined();
    expect(screen.queryByTestId("clear-filters-button")).toBeNull();
  });

  it("popula o dropdown de produtos corretamente", () => {
    render(
      <LedgerFilters
        products={mockProducts}
        values={defaultValues}
        onChange={vi.fn()}
      />
    );

    const productSelect = screen.getByTestId("product-filter-select") as HTMLSelectElement;
    expect(productSelect.options).toHaveLength(3); // "Todos os Produtos" + 2 produtos
    expect(productSelect.options[1].textContent).toContain("Chapa de Aço 1020 (KG)");
    expect(productSelect.options[2].textContent).toContain("Tubo Inox 304 (MT)");
  });

  it("chama onChange ao selecionar um produto", () => {
    const handleChange = vi.fn();
    render(
      <LedgerFilters
        products={mockProducts}
        values={defaultValues}
        onChange={handleChange}
      />
    );

    const productSelect = screen.getByTestId("product-filter-select");
    fireEvent.change(productSelect, { target: { value: "prod-1" } });

    expect(handleChange).toHaveBeenCalledWith({
      ...defaultValues,
      productId: "prod-1",
    });
  });

  it("chama onChange ao alterar o tipo de movimentação", () => {
    const handleChange = vi.fn();
    render(
      <LedgerFilters
        products={mockProducts}
        values={defaultValues}
        onChange={handleChange}
      />
    );

    const typeSelect = screen.getByTestId("type-filter-select");
    fireEvent.change(typeSelect, { target: { value: "IN" } });

    expect(handleChange).toHaveBeenCalledWith({
      ...defaultValues,
      type: "IN",
    });

    fireEvent.change(typeSelect, { target: { value: "PRODUCT_DELETED" } });
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultValues,
      type: "PRODUCT_DELETED",
    });
  });

  it("chama onChange ao alterar as datas do período", () => {
    const handleChange = vi.fn();
    render(
      <LedgerFilters
        products={mockProducts}
        values={defaultValues}
        onChange={handleChange}
      />
    );

    const startDateInput = screen.getByTestId("start-date-input");
    fireEvent.change(startDateInput, { target: { value: "2026-11-01" } });

    expect(handleChange).toHaveBeenCalledWith({
      ...defaultValues,
      startDate: "2026-11-01",
    });

    const endDateInput = screen.getByTestId("end-date-input");
    fireEvent.change(endDateInput, { target: { value: "2026-11-15" } });

    expect(handleChange).toHaveBeenCalledWith({
      ...defaultValues,
      endDate: "2026-11-15",
    });
  });

  it("exibe badge de contagem de filtros ativos e botão de limpar", () => {
    const activeValues: LedgerFiltersValue = {
      productId: "prod-1",
      type: "OUT",
      startDate: "2026-11-01",
      endDate: "",
    };

    render(
      <LedgerFilters
        products={mockProducts}
        values={activeValues}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByTestId("active-filters-badge")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("filtros ativos")).toBeDefined();
    expect(screen.getByTestId("clear-filters-button")).toBeDefined();
  });

  it("chama onChange com valores vazios ao clicar em limpar filtros", () => {
    const handleChange = vi.fn();
    const activeValues: LedgerFiltersValue = {
      productId: "prod-1",
      type: "ADJUSTMENT",
      startDate: "2026-11-01",
      endDate: "2026-11-15",
    };

    render(
      <LedgerFilters
        products={mockProducts}
        values={activeValues}
        onChange={handleChange}
      />
    );

    const clearButton = screen.getByTestId("clear-filters-button");
    fireEvent.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith({
      productId: "",
      type: "",
      startDate: "",
      endDate: "",
    });
  });

  it("desabilita o select de produto quando isLoadingProducts for true", () => {
    render(
      <LedgerFilters
        products={mockProducts}
        values={defaultValues}
        onChange={vi.fn()}
        isLoadingProducts={true}
      />
    );

    const productSelect = screen.getByTestId("product-filter-select") as HTMLSelectElement;
    expect(productSelect.disabled).toBe(true);
  });
});
