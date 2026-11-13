"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Minus,
  SlidersHorizontal,
  Search,
  ScanBarcode,
  Info,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { TenantRole } from "@/shared/types/rbac.types";

export interface QuickActionToolbarProps {
  className?: string;
  roleOverride?: TenantRole | null;
  onSearchSubmit?: (query: string) => void;
}

export const QuickActionToolbar: React.FC<QuickActionToolbarProps> = ({
  className,
  roleOverride,
  onSearchSubmit,
}) => {
  const router = useRouter();
  const { can, role } = useRBAC(roleOverride);
  const [searchQuery, setSearchQuery] = useState("");

  const canStockIn = can("stock_in");
  const canStockOut = can("stock_out");
  const canStockAdjustment = can("stock_adjustment");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (onSearchSubmit) {
      onSearchSubmit(searchQuery.trim());
    } else {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div
      aria-label="Barra de Ações Rápidas de Bancada"
      className={cn(
        "border border-zinc-200 bg-white p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 select-none",
        className
      )}
    >
      {/* Campo de Busca Rápida / Leitor de Código de Barras */}
      <form
        onSubmit={handleSearchSubmit}
        className="relative flex-1 max-w-md flex items-center"
      >
        <Search className="w-4 h-4 absolute left-3 text-zinc-400 pointer-events-none" />
        <input
          id="quick-search-input"
          data-quick-search="true"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar produto, código ou EAN (Ctrl+K)..."
          className={cn(
            "w-full h-9 pl-9 pr-20 text-xs rounded border border-zinc-200 bg-zinc-50/50 text-zinc-950",
            "placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:bg-white focus:ring-1 focus:ring-zinc-900",
            "font-sans transition-colors"
          )}
        />
        <div className="absolute right-2 flex items-center gap-1.5 pointer-events-none">
          <ScanBarcode className="w-3.5 h-3.5 text-zinc-400" />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-white border border-zinc-200 rounded shadow-2xs">
            Ctrl+K
          </kbd>
        </div>
      </form>

      {/* Botões de Ação Rápida */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Registrar Entrada (+) */}
        {canStockIn ? (
          <Link
            href="/inventory/move?mode=IN"
            aria-label="Registrar Entrada de Estoque"
            className={cn(
              "h-9 px-3.5 inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors shadow-2xs",
              "bg-zinc-950 text-white hover:bg-zinc-800 active:bg-black",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            )}
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Registrar Entrada (+)</span>
          </Link>
        ) : (
          <div className="relative group">
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-label="Registrar Entrada de Estoque (Desabilitado)"
              title="Papel AUDITOR não tem permissão para registrar entradas físicas"
              className={cn(
                "h-9 px-3.5 inline-flex items-center gap-1.5 rounded text-xs font-medium cursor-not-allowed",
                "bg-zinc-100 text-zinc-400 border border-zinc-200 select-none opacity-60"
              )}
            >
              <Plus className="w-3.5 h-3.5 text-zinc-400" />
              <span>Registrar Entrada (+)</span>
            </button>
            <div
              role="tooltip"
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex items-center gap-1 px-2 py-1 bg-zinc-900 text-zinc-100 text-[11px] rounded shadow-md whitespace-nowrap z-30 font-sans"
            >
              <Info className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>Papel AUDITOR não tem permissão para registrar entradas físicas</span>
            </div>
          </div>
        )}

        {/* Registrar Saída (-) */}
        {canStockOut ? (
          <Link
            href="/inventory/move?mode=OUT"
            aria-label="Registrar Saída de Estoque"
            className={cn(
              "h-9 px-3.5 inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors border shadow-2xs",
              "bg-white border-zinc-200 text-zinc-950 hover:bg-zinc-50 active:bg-zinc-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            )}
          >
            <Minus className="w-3.5 h-3.5 text-rose-500" />
            <span>Registrar Saída (-)</span>
          </Link>
        ) : (
          <div className="relative group">
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-label="Registrar Saída de Estoque (Desabilitado)"
              title="Papel AUDITOR não tem permissão para registrar saídas físicas"
              className={cn(
                "h-9 px-3.5 inline-flex items-center gap-1.5 rounded text-xs font-medium cursor-not-allowed",
                "bg-zinc-100 text-zinc-400 border border-zinc-200 select-none opacity-60"
              )}
            >
              <Minus className="w-3.5 h-3.5 text-zinc-400" />
              <span>Registrar Saída (-)</span>
            </button>
            <div
              role="tooltip"
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex items-center gap-1 px-2 py-1 bg-zinc-900 text-zinc-100 text-[11px] rounded shadow-md whitespace-nowrap z-30 font-sans"
            >
              <Info className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>Papel AUDITOR não tem permissão para registrar saídas físicas</span>
            </div>
          </div>
        )}

        {/* Ajuste de Inventário (Δ) */}
        {canStockAdjustment ? (
          <Link
            href="/inventory/move?mode=ADJUSTMENT"
            aria-label="Ajuste de Inventário"
            className={cn(
              "h-9 px-3.5 inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors border shadow-2xs",
              "bg-indigo-50/70 border-indigo-200 text-indigo-950 hover:bg-indigo-100 active:bg-indigo-200/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-950"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-700" />
            <span>Ajuste de Inventário (Δ)</span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded text-xs font-medium bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Ajuste de Inventário (Δ)</span>
          </button>
        )}
      </div>
    </div>
  );
};

QuickActionToolbar.displayName = "QuickActionToolbar";
