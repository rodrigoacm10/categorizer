"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { TenantRole } from "../types/members.types";
import { cn } from "@/shared/utils/cn";

export interface MemberFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedRole?: TenantRole;
  onRoleChange: (role?: TenantRole) => void;
  onReset: () => void;
  totalFiltered?: number;
}

const ROLE_OPTIONS: { label: string; value?: TenantRole }[] = [
  { label: "Todos", value: undefined },
  { label: "Proprietários", value: "OWNER" },
  { label: "Gestores", value: "GESTOR" },
  { label: "Almoxarifes", value: "ALMOXARIFE" },
  { label: "Auditores", value: "AUDITOR" },
];

/**
 * MemberFilters (FT-19 / Impeccable Workbench):
 * Barra de filtragem industrial de membros por texto e papel funcional.
 * Design sem cards flutuantes, bordas de 1px e controle reativo.
 */
export const MemberFilters: React.FC<MemberFiltersProps> = ({
  search,
  onSearchChange,
  selectedRole,
  onRoleChange,
  onReset,
  totalFiltered,
}) => {
  const [localSearch, setLocalSearch] = React.useState(search);

  // Sincroniza estado local quando o valor externo mudar (ex: reset de filtros)
  React.useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce de 200ms para a busca textual, evitando disparos a cada tecla
  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [localSearch, search, onSearchChange]);

  const handleClear = () => {
    setLocalSearch("");
    onSearchChange("");
  };

  const hasActiveFilters = Boolean(localSearch.trim() || selectedRole);

  return (
    <div
      data-testid="member-filters"
      className="w-full bg-white border border-zinc-200 rounded p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs"
    >
      <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Campo de Busca Textual com Debounce */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            data-testid="member-search-input"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full h-8 pl-8 pr-7 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 transition-colors"
          />
          {localSearch && (
            <button
              type="button"
              data-testid="clear-search-button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 rounded-sm"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Segmented Pills de Papéis */}
        <div
          data-testid="role-filter-pills"
          className="flex items-center overflow-x-auto bg-zinc-100 p-0.5 rounded border border-zinc-200/80 shrink-0"
        >
          {ROLE_OPTIONS.map((opt) => {
            const isSelected = selectedRole === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                data-testid={`role-pill-${opt.value || "all"}`}
                onClick={() => onRoleChange(opt.value)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1",
                  isSelected
                    ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/60 font-semibold"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contador e Botão de Reset */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        {totalFiltered !== undefined && (
          <span
            data-testid="total-members-counter"
            className="text-[11px] text-zinc-600 font-mono tabular-nums"
          >
            {totalFiltered} {totalFiltered === 1 ? "membro localizado" : "membros localizados"}
          </span>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            data-testid="reset-filters-button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 px-2 py-1 bg-zinc-100 hover:bg-zinc-200 rounded transition-colors border border-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
          >
            <X className="w-3 h-3" />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>
    </div>
  );
};
