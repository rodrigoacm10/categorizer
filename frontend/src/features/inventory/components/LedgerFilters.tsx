"use client";

import React from "react";
import { Product } from "@/features/products/types/product.types";
import { Filter, Calendar, Package, X, RotateCcw } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface LedgerFiltersValue {
  productId: string;
  type: string;
  startDate: string;
  endDate: string;
}

export interface LedgerFiltersProps {
  products?: Product[];
  values: LedgerFiltersValue;
  onChange: (newValues: LedgerFiltersValue) => void;
  isLoadingProducts?: boolean;
  className?: string;
}

/**
 * LedgerFilters (FT-17 / Impeccable Workbench):
 * Barra de filtros de alta densidade para o extrato geral do Livro-Razão Contábil:
 * - Dropdown/seleção de Produto (com dados do tenant ativo)
 * - Seletor de Tipo de Movimentação (Todas, IN, OUT, ADJUSTMENT, PRODUCT_DELETED)
 * - Filtro por Período com Data Inicial e Data Final
 * - Contagem visual de filtros ativos e botão rápido para Limpar Filtros
 */
export const LedgerFilters: React.FC<LedgerFiltersProps> = ({
  products = [],
  values,
  onChange,
  isLoadingProducts = false,
  className,
}) => {
  const activeCount = [
    Boolean(values.productId),
    Boolean(values.type),
    Boolean(values.startDate),
    Boolean(values.endDate),
  ].filter(Boolean).length;

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...values,
      productId: e.target.value,
    });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...values,
      type: e.target.value,
    });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...values,
      startDate: e.target.value,
    });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...values,
      endDate: e.target.value,
    });
  };

  const handleClearFilters = () => {
    onChange({
      productId: "",
      type: "",
      startDate: "",
      endDate: "",
    });
  };

  return (
    <div
      role="search"
      aria-label="Filtros do Livro-Razão"
      className={cn(
        "w-full bg-white border border-zinc-200 rounded p-2.5 sm:p-3",
        "flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 select-none",
        className
      )}
      data-testid="ledger-filters-toolbar"
    >
      {/* Controles de Filtragem */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs text-zinc-700 flex-1">
        {/* Filtro por Produto */}
        <div className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
          <label htmlFor="product-filter-select" className="sr-only">
            Filtrar por Produto
          </label>
          <select
            id="product-filter-select"
            value={values.productId}
            onChange={handleProductChange}
            disabled={isLoadingProducts}
            aria-label="Filtrar por Produto"
            className={cn(
              "h-8 px-2.5 bg-white border border-zinc-300 text-zinc-900 rounded text-xs",
              "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
              "transition-colors cursor-pointer max-w-[200px] truncate"
            )}
            data-testid="product-filter-select"
          >
            <option value="">Todos os Produtos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.unit})
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 w-px bg-zinc-200 hidden sm:block" aria-hidden="true" />

        {/* Seletor de Tipo de Movimentação */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
          <label htmlFor="type-filter-select" className="sr-only">
            Tipo de Movimentação
          </label>
          <select
            id="type-filter-select"
            value={values.type}
            onChange={handleTypeChange}
            aria-label="Tipo de Movimentação"
            className={cn(
              "h-8 px-2.5 bg-white border border-zinc-300 text-zinc-900 rounded text-xs",
              "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
              "transition-colors cursor-pointer"
            )}
            data-testid="type-filter-select"
          >
            <option value="">Todos os Tipos</option>
            <option value="IN">Entrada (IN)</option>
            <option value="OUT">Saída (OUT)</option>
            <option value="ADJUSTMENT">Ajuste (ADJUSTMENT)</option>
            <option value="PRODUCT_DELETED">Inativação (PRODUCT_DELETED)</option>
          </select>
        </div>

        <div className="h-4 w-px bg-zinc-200 hidden sm:block" aria-hidden="true" />

        {/* Filtro por Período */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
          <span className="text-[11px] font-medium text-zinc-500">De:</span>
          <label htmlFor="start-date-input" className="sr-only">
            Data Inicial
          </label>
          <input
            type="date"
            id="start-date-input"
            value={values.startDate}
            onChange={handleStartDateChange}
            aria-label="Data Inicial"
            className={cn(
              "h-8 px-2 bg-white border border-zinc-300 text-zinc-900 rounded text-xs font-mono",
              "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
              "transition-colors"
            )}
            data-testid="start-date-input"
          />

          <span className="text-[11px] font-medium text-zinc-500 ml-1">Até:</span>
          <label htmlFor="end-date-input" className="sr-only">
            Data Final
          </label>
          <input
            type="date"
            id="end-date-input"
            value={values.endDate}
            onChange={handleEndDateChange}
            aria-label="Data Final"
            className={cn(
              "h-8 px-2 bg-white border border-zinc-300 text-zinc-900 rounded text-xs font-mono",
              "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
              "transition-colors"
            )}
            data-testid="end-date-input"
          />
        </div>
      </div>

      {/* Indicador de Filtros Ativos e Limpar */}
      <div className="flex items-center gap-2.5 shrink-0 justify-between lg:justify-end border-t lg:border-t-0 pt-2 lg:pt-0 border-zinc-100">
        {activeCount > 0 ? (
          <>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-100 text-zinc-800 border border-zinc-200"
              data-testid="active-filters-badge"
            >
              <span className="font-bold">{activeCount}</span>
              <span>{activeCount === 1 ? "filtro ativo" : "filtros ativos"}</span>
            </span>

            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-rose-600 hover:underline transition-colors"
              data-testid="clear-filters-button"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar filtros</span>
            </button>
          </>
        ) : (
          <span className="text-[11px] font-mono text-zinc-400 hidden lg:inline">
            Nenhum filtro aplicado
          </span>
        )}
      </div>
    </div>
  );
};

LedgerFilters.displayName = "LedgerFilters";
