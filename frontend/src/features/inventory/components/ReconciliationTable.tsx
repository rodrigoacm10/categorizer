"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Filter, History, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { ProductDiscrepancy, ReconciliationFilterMode } from "../types/reconciliation.types";
import { cn } from "@/shared/utils/cn";

export interface ReconciliationTableProps {
  discrepancies: ProductDiscrepancy[];
  totalProductsChecked: number;
  isLoading?: boolean;
}

/**
 * ReconciliationTable (Impeccable Workbench / Operate Mode):
 * Tabela de alta densidade para auditoria contábil de integridade de estoque.
 * Apresenta saldos físicos cadastrados, saldos matemáticos esperados e o delta exato.
 */
export const ReconciliationTable: React.FC<ReconciliationTableProps> = ({
  discrepancies,
  totalProductsChecked,
  isLoading = false,
}) => {
  const [search, setSearch] = useState<string>("");
  const [filterMode, setFilterMode] = useState<ReconciliationFilterMode>("all");

  const filteredItems = useMemo(() => {
    return discrepancies.filter((item) => {
      // Filtro de discrepâncias
      if (filterMode === "discrepant_only" && !item.has_discrepancy) {
        return false;
      }

      // Filtro de busca textual por nome do produto ou ID
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchesName = item.product_name.toLowerCase().includes(query);
        const matchesId = item.product_id.toLowerCase().includes(query);
        if (!matchesName && !matchesId) return false;
      }

      return true;
    });
  }, [discrepancies, filterMode, search]);

  const formatDelta = (diff: number) => {
    const formatted = Math.abs(diff).toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
    if (diff > 0) return `+${formatted}`;
    if (diff < 0) return `-${formatted}`;
    return "0";
  };

  const formatQuantity = (val: number) => {
    return val.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  };

  return (
    <div className="w-full flex flex-col gap-3 font-sans text-xs">
      {/* Barra de Filtros e Busca de Auditoria */}
      <div
        data-testid="reconciliation-toolbar"
        className="w-full bg-white border border-zinc-200 rounded p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3"
      >
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Busca Textual */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="reconciliation-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por produto ou identificador..."
              className="w-full h-8 pl-8 pr-3 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 transition-colors"
            />
          </div>

          {/* Segmented Pills de Filtro */}
          <div
            data-testid="reconciliation-filter-pills"
            className="flex items-center bg-zinc-100 p-0.5 rounded border border-zinc-200/80 shrink-0"
          >
            <button
              type="button"
              data-testid="filter-pill-all"
              onClick={() => setFilterMode("all")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1",
                filterMode === "all"
                  ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/60 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
              )}
            >
              Todos ({discrepancies.length})
            </button>
            <button
              type="button"
              data-testid="filter-pill-discrepant"
              onClick={() => setFilterMode("discrepant_only")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1",
                filterMode === "discrepant_only"
                  ? "bg-white text-rose-700 shadow-sm border border-rose-200 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
              )}
            >
              Apenas Divergentes ({discrepancies.filter((d) => d.has_discrepancy).length})
            </button>
          </div>
        </div>

        {/* Contador Informativo */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-600 font-mono tabular-nums">
          <span>{filteredItems.length} itens listados</span>
        </div>
      </div>

      {/* Tabela de Alta Densidade de Auditoria Contábil */}
      <div className="w-full bg-white border border-zinc-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table
            data-testid="reconciliation-table"
            className="w-full text-left border-collapse text-xs"
          >
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-100 uppercase tracking-wider text-[11px] select-none font-semibold">
                <th scope="col" className="py-2.5 px-4 w-[35%]">
                  Produto Auditado
                </th>
                <th scope="col" className="py-2.5 px-4 text-right w-[15%]">
                  Saldo Físico (Catálogo)
                </th>
                <th scope="col" className="py-2.5 px-4 text-right w-[15%]">
                  Saldo Esperado (Razão)
                </th>
                <th scope="col" className="py-2.5 px-4 text-right w-[15%]">
                  Divergência (Δ)
                </th>
                <th scope="col" className="py-2.5 px-4 text-center w-[10%]">
                  Veredito
                </th>
                <th scope="col" className="py-2.5 px-4 text-right w-[10%]">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="py-3 px-4">
                      <div className="h-3.5 bg-zinc-200 rounded w-44 mb-1" />
                      <div className="h-2.5 bg-zinc-100 rounded w-28" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-3.5 bg-zinc-200 rounded w-16 ml-auto" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-3.5 bg-zinc-200 rounded w-16 ml-auto" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-3.5 bg-zinc-200 rounded w-12 ml-auto" />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="h-5 bg-zinc-200 rounded w-16 mx-auto" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-5 bg-zinc-200 rounded w-14 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    data-testid="reconciliation-empty-row"
                    className="py-12 text-center text-zinc-500 font-sans"
                  >
                    <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-zinc-900 text-sm">
                      Nenhuma divergência localizada
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {discrepancies.length === 0
                        ? `Todos os ${totalProductsChecked} produtos auditados estão 100% íntegros com o Livro-Razão.`
                        : "Nenhum produto corresponde aos critérios de filtro informados."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const hasDiscrepancy = item.has_discrepancy;

                  return (
                    <tr
                      key={item.product_id}
                      data-testid={`reconciliation-row-${item.product_id}`}
                      className={cn(
                        "transition-colors",
                        hasDiscrepancy
                          ? "bg-rose-50/40 hover:bg-rose-50/70"
                          : "hover:bg-zinc-50/70"
                      )}
                    >
                      {/* Nome do Produto e ID */}
                      <td className="py-2.5 px-4">
                        <div className="flex flex-col">
                          <span
                            data-testid={`product-name-${item.product_id}`}
                            className="font-semibold text-zinc-950"
                          >
                            {item.product_name}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500">
                            ID: {item.product_id}
                          </span>
                        </div>
                      </td>

                      {/* Saldo Físico (Catálogo) */}
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-900">
                        {formatQuantity(item.current_quantity)}
                      </td>

                      {/* Saldo Esperado (Razão) */}
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-900">
                        {formatQuantity(item.expected_quantity)}
                      </td>

                      {/* Divergência Contábil (Δ) */}
                      <td
                        data-testid={`discrepancy-diff-${item.product_id}`}
                        className={cn(
                          "py-2.5 px-4 text-right font-mono tabular-nums font-semibold",
                          hasDiscrepancy ? "text-rose-700" : "text-emerald-700"
                        )}
                      >
                        {formatDelta(item.difference)}
                      </td>

                      {/* Veredito */}
                      <td className="py-2.5 px-4 text-center">
                        {hasDiscrepancy ? (
                          <span
                            data-testid={`verdict-divergent-${item.product_id}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200"
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Divergente
                          </span>
                        ) : (
                          <span
                            data-testid={`verdict-ok-${item.product_id}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Íntegro
                          </span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="py-2.5 px-4 text-right">
                        <Link
                          href={`/inventory/movements?product_id=${item.product_id}`}
                          data-testid={`action-ledger-${item.product_id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-700 hover:text-zinc-950 px-2 py-1 bg-zinc-100 hover:bg-zinc-200 rounded transition-colors border border-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
                          title={`Ver extrato contábil de ${item.product_name}`}
                        >
                          <History className="w-3 h-3" />
                          <span>Extrato</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
