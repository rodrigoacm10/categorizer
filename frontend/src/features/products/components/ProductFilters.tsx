"use client";

import React, { useState, useEffect } from "react";
import { Category } from "@/features/categories/types/category.types";
import { SearchInput } from "@/shared/components/SearchInput";
import { Filter, X } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface ProductFiltersValue {
  search: string;
  categoryId: string;
  lowStockOnly: boolean;
  includeInactive: boolean;
}

export interface ProductFiltersProps {
  categories: Category[];
  values: ProductFiltersValue;
  onChange: (newValues: ProductFiltersValue) => void;
  isLoadingCategories?: boolean;
  className?: string;
}

/**
 * ProductFilters (FT-12 / Catalog Toolbar):
 * Barra de filtros de alta densidade da bancada de catálogo:
 * - Busca textual por nome/descrição com debounce de 300ms
 * - Filtro por Categoria via dropdown
 * - Checkbox "Apenas Estoque Baixo"
 * - Checkbox "Incluir Inativos"
 */
export const ProductFilters: React.FC<ProductFiltersProps> = ({
  categories,
  values,
  onChange,
  isLoadingCategories = false,
  className,
}) => {
  // Estado local para o input de busca para suportar debounce de 300ms
  const [localSearch, setLocalSearch] = useState(values.search);

  // Sincroniza estado local se o valor externo mudar (ex: reset de filtros)
  useEffect(() => {
    setLocalSearch(values.search);
  }, [values.search]);

  // Debounce de 300ms para a busca textual
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== values.search) {
        onChange({
          ...values,
          search: localSearch,
        });
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [localSearch, values, onChange]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...values,
      categoryId: e.target.value,
    });
  };

  const handleLowStockToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...values,
      lowStockOnly: e.target.checked,
    });
  };

  const handleIncludeInactiveToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...values,
      includeInactive: e.target.checked,
    });
  };

  const hasActiveFilters =
    Boolean(values.search) ||
    Boolean(values.categoryId) ||
    values.lowStockOnly ||
    values.includeInactive;

  const handleClearFilters = () => {
    setLocalSearch("");
    onChange({
      search: "",
      categoryId: "",
      lowStockOnly: false,
      includeInactive: false,
    });
  };

  return (
    <div
      aria-label="Filtros de Catálogo"
      className={cn(
        "w-full bg-white border border-zinc-200 rounded p-2.5 sm:p-3",
        "flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 select-none",
        className
      )}
    >
      {/* Esquerda: Busca Textual com Debounce e Atalho */}
      <div className="flex-1 max-w-xl">
        <SearchInput
          id="quick-search-input"
          value={localSearch}
          onChange={setLocalSearch}
          onClear={() => {
            setLocalSearch("");
            onChange({ ...values, search: "" });
          }}
          size="sm"
          placeholder="Buscar produto por nome, especificação ou código..."
          shortcutHint="Ctrl+K"
          data-testid="product-search-input"
        />
      </div>

      {/* Direita: Dropdown de Categorias e Checkboxes Operacionais */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs text-zinc-700">
        {/* Dropdown de Categorias */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Filter className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
          <select
            id="category-filter-select"
            value={values.categoryId}
            onChange={handleCategoryChange}
            disabled={isLoadingCategories}
            aria-label="Filtrar por Categoria"
            className={cn(
              "h-8 px-2.5 bg-white border border-zinc-300 text-zinc-900 rounded text-xs",
              "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
              "transition-colors cursor-pointer"
            )}
            data-testid="category-filter-select"
          >
            <option value="">Todas as Categorias</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 w-px bg-zinc-200 hidden sm:block" aria-hidden="true" />

        {/* Checkbox: Apenas Estoque Baixo */}
        <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-zinc-950">
          <input
            type="checkbox"
            checked={values.lowStockOnly}
            onChange={handleLowStockToggle}
            className={cn(
              "w-4 h-4 rounded border-zinc-300 text-zinc-900 accent-zinc-950",
              "focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
            )}
            data-testid="low-stock-checkbox"
          />
          <span className="font-medium">Apenas Estoque Baixo</span>
        </label>

        {/* Checkbox: Incluir Inativos */}
        <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-zinc-950">
          <input
            type="checkbox"
            checked={values.includeInactive}
            onChange={handleIncludeInactiveToggle}
            className={cn(
              "w-4 h-4 rounded border-zinc-300 text-zinc-900 accent-zinc-950",
              "focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
            )}
            data-testid="include-inactive-checkbox"
          />
          <span className="font-medium text-zinc-600">Incluir Inativos</span>
        </label>

        {/* Botão de Limpar Filtros */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-rose-600 hover:underline transition-colors ml-auto md:ml-0"
            data-testid="clear-filters-button"
          >
            <X className="w-3 h-3" />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>
    </div>
  );
};

ProductFilters.displayName = "ProductFilters";
