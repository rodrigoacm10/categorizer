"use client";

import React from "react";
import Link from "next/link";
import { Boxes, LogOut, User } from "lucide-react";
import { TenantSwitcher } from "./TenantSwitcher";
import { NetworkStatusIndicator } from "./NetworkStatusIndicator";
import { RoleBadge } from "./Badge";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { cn } from "../utils/cn";

export interface TopBarProps {
  className?: string;
}

/**
 * TopBar de Bancada Industrial (FT-08):
 * Barra superior compacta de 48px com identidade técnica,
 * TenantSwitcher com busca rápida, indicador de status de rede
 * e perfil de operador com RBAC.
 */
export const TopBar: React.FC<TopBarProps> = ({ className }) => {
  const { user, logout } = useAuth();
  const { role } = useTenant();

  return (
    <header
      className={cn(
        "h-12 border-b border-zinc-200 bg-white px-4 md:px-6 flex items-center justify-between z-30 select-none",
        className
      )}
    >
      {/* Lado Esquerdo: Identidade Técnica e TenantSwitcher */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 rounded"
          title="Ir para a Bancada Operacional"
        >
          <div className="flex h-7 w-7 items-center justify-center bg-zinc-950 text-white rounded transition-colors group-hover:bg-zinc-800">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-xs font-bold tracking-widest text-zinc-950 uppercase">
              EXTENSÃO
            </span>
            <span className="text-zinc-300 font-mono text-[11px]">//</span>
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline">
              BANCADA
            </span>
          </div>
        </Link>

        <div className="h-4 w-px bg-zinc-200 mx-1" aria-hidden="true" />

        <TenantSwitcher />
      </div>

      {/* Lado Direito: Conexão, Perfil e Logout */}
      <div className="flex items-center gap-3">
        <NetworkStatusIndicator />

        <div className="h-4 w-px bg-zinc-200" aria-hidden="true" />

        <div className="flex items-center gap-2">
          {role && <RoleBadge role={role} showDot={true} className="hidden sm:inline-flex" />}

          {user && (
            <div
              className="hidden md:flex items-center gap-1.5 text-xs text-zinc-700 font-medium px-1.5 py-0.5"
              title={user.email}
            >
              <User className="w-3.5 h-3.5 text-zinc-400" />
              <span className="truncate max-w-[120px]">
                {user.full_name || user.email}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={logout}
            title="Encerrar sessão na bancada"
            aria-label="Sair da bancada"
            className={cn(
              "p-1.5 rounded text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            )}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

TopBar.displayName = "TopBar";
