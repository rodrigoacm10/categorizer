"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Warehouse,
  ChevronsUpDown,
  Check,
  Search,
  Plus,
  Loader2,
} from "lucide-react";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { tenantsApi } from "@/features/tenants/services/tenants.api";
import { TenantWithRole } from "@/features/tenants/types/tenant.types";
import { RoleBadge } from "./Badge";
import { cn } from "../utils/cn";

export interface TenantSwitcherProps {
  className?: string;
}

export const TenantSwitcher: React.FC<TenantSwitcherProps> = ({ className }) => {
  const router = useRouter();
  const { tenantId, role, setTenant } = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    queryClient = useQueryClient();
  } catch {
    queryClient = null;
  }

  const { data: tenants = [], isLoading } = useQuery<TenantWithRole[]>({
    queryKey: ["tenants", "switcher-list"],
    queryFn: () => tenantsApi.listTenantsWithRoles(),
    staleTime: 60 * 1000,
  });

  const activeTenant = useMemo(() => {
    return tenants.find((t) => t.id === tenantId) || null;
  }, [tenants, tenantId]);

  const filteredTenants = useMemo(() => {
    if (!searchQuery.trim()) return tenants;
    const q = searchQuery.toLowerCase().trim();
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q)
    );
  }, [tenants, searchQuery]);

  // Foco no input de busca ao abrir o dropdown
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Fechar ao clicar fora ou apertar Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectTenant = (selected: TenantWithRole) => {
    if (selected.id !== tenantId) {
      setTenant(selected.id, selected.role);
      if (queryClient) {
        queryClient.clear();
      }
    }
    setIsOpen(false);
    router.push("/dashboard");
  };

  const handleNavigateToTenants = () => {
    setIsOpen(false);
    router.push("/tenants");
  };

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      {/* Botão Gatilho do Switcher */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Alternar almoxarifado ativo"
        className={cn(
          "h-8 px-2.5 flex items-center gap-2 rounded border transition-colors select-none",
          "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-900 text-xs font-medium",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950",
          isOpen && "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900"
        )}
      >
        <Warehouse className="w-3.5 h-3.5 text-zinc-600 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-[140px] sm:max-w-[200px] text-zinc-950 font-semibold">
          {activeTenant ? activeTenant.name : "Selecionar Almoxarifado"}
        </span>
        {role && <RoleBadge role={role} showDot={false} className="hidden sm:inline-flex" />}
        <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-0.5" aria-hidden="true" />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Almoxarifados disponíveis"
          className={cn(
            "absolute left-0 mt-1 w-72 sm:w-80 z-50 rounded bg-white border border-zinc-200 shadow-md",
            "flex flex-col text-xs font-sans overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          {/* Cabeçalho do Dropdown com Busca Rápida */}
          <div className="p-2 border-b border-zinc-100 bg-zinc-50/70">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nome ou slug..."
                className={cn(
                  "w-full h-7 pl-8 pr-2 text-xs rounded border border-zinc-200 bg-white text-zinc-900",
                  "placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                )}
              />
            </div>
          </div>

          {/* Lista de Almoxarifados */}
          <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100 py-1">
            {isLoading ? (
              <div className="flex items-center justify-center p-4 text-zinc-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                <span>Carregando unidades...</span>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="p-4 text-center text-zinc-500">
                <p className="font-medium text-zinc-700">Nenhum almoxarifado encontrado</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Tente outro termo de busca ou crie uma nova unidade.
                </p>
              </div>
            ) : (
              filteredTenants.map((t) => {
                const isSelected = t.id === tenantId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectTenant(t)}
                    className={cn(
                      "w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors",
                      "hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none",
                      isSelected && "bg-zinc-50 font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={cn(
                          "w-5 h-5 rounded flex items-center justify-center shrink-0 text-[10px] font-mono",
                          isSelected
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-600"
                        )}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : <Warehouse className="w-3 h-3" />}
                      </div>
                      <div className="truncate">
                        <div className="truncate text-zinc-950 font-medium text-xs">
                          {t.name}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 truncate">
                          /{t.slug}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {t.role && <RoleBadge role={t.role} size="sm" showDot={false} />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Rodapé: Link para Gerenciar / Criar Almoxarifados */}
          <div className="p-1.5 border-t border-zinc-100 bg-zinc-50/70">
            <button
              type="button"
              onClick={handleNavigateToTenants}
              className={cn(
                "w-full h-7 px-2.5 flex items-center justify-center gap-1.5 rounded text-xs",
                "text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200/60 font-medium transition-colors"
              )}
            >
              <Plus className="w-3.5 h-3.5 text-zinc-500" />
              <span>Gerenciar / Criar Almoxarifado</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

TenantSwitcher.displayName = "TenantSwitcher";
