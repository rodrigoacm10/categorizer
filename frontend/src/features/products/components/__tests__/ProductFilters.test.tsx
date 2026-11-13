import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ProductFilters, ProductFiltersValue } from "../ProductFilters";
import { Category } from "@/features/categories/types/category.types";

describe("ProductFilters (FT-12)", () => {
  const mockOnChange = vi.fn();

  const mockCategories: Category[] = [
    {
      id: "cat-1",
      name: "EPIs",
      color: "#2563EB",
      created_at: "2026-11-13T10:00:00Z",
    },
    {
      id: "cat-2",
      name: "Soldagem",
      color: "#16A34A",
      created_at: "2026-11-13T10:00:00Z",
    },
  ];

  const defaultValues: ProductFiltersValue = {
    search: "",
    categoryId: "",
    lowStockOnly: false,
    includeInactive: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza todos os controles de filtro da barra de ferramentas", () => {
    render(
      <ProductFilters
        categories={mockCategories}
        values={defaultValues}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId("product-search-input")).toBeDefined();
    expect(screen.getByTestId("category-filter-select")).toBeDefined();
    expect(screen.getByTestId("low-stock-checkbox")).toBeDefined();
    expect(screen.getByTestId("include-inactive-checkbox")).toBeDefined();
  });

  it("dispara onChange após debounce de 300ms ao digitar na busca", () => {
    render(
      <ProductFilters
        categories={mockCategories}
        values={defaultValues}
        onChange={mockOnChange}
      />
    );

    const input = screen.getByTestId("product-search-input");
    fireEvent.change(input, { target: { value: "broca" } });

    // Imediatamente não deve ter chamado onChange
    expect(mockOnChange).not.toHaveBeenCalled();

    // Avança 200ms
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mockOnChange).not.toHaveBeenCalled();

    // Avança mais 150ms (total 350ms)
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultValues,
      search: "broca",
    });
  });

  it("dispara onChange imediatamente ao selecionar uma categoria", () => {
    render(
      <ProductFilters
        categories={mockCategories}
        values={defaultValues}
        onChange={mockOnChange}
      />
    );

    const select = screen.getByTestId("category-filter-select");
    fireEvent.change(select, { target: { value: "cat-2" } });

    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultValues,
      categoryId: "cat-2",
    });
  });

  it("dispara onChange ao alternar os checkboxes de estoque baixo e inativos", () => {
    render(
      <ProductFilters
        categories={mockCategories}
        values={defaultValues}
        onChange={mockOnChange}
      />
    );

    const lowStockCb = screen.getByTestId("low-stock-checkbox");
    fireEvent.click(lowStockCb);
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultValues,
      lowStockOnly: true,
    });

    const inactiveCb = screen.getByTestId("include-inactive-checkbox");
    fireEvent.click(inactiveCb);
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultValues,
      includeInactive: true,
    });
  });

  it("exibe e aciona o botão de limpar filtros quando houver filtros ativos", () => {
    const activeValues: ProductFiltersValue = {
      search: "parafuso",
      categoryId: "cat-1",
      lowStockOnly: true,
      includeInactive: false,
    };

    render(
      <ProductFilters
        categories={mockCategories}
        values={activeValues}
        onChange={mockOnChange}
      />
    );

    const clearBtn = screen.getByTestId("clear-filters-button");
    expect(clearBtn).toBeDefined();

    fireEvent.click(clearBtn);

    expect(mockOnChange).toHaveBeenCalledWith({
      search: "",
      categoryId: "",
      lowStockOnly: false,
      includeInactive: false,
    });
  });
});
