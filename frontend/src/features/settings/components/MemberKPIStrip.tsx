"use client";

import React from "react";
import { Users, Crown, Shield, Package, Eye } from "lucide-react";
import { TenantMembersSummary } from "../types/members.types";
import { cn } from "@/shared/utils/cn";

export interface MemberKPIStripProps {
  summary: TenantMembersSummary | null;
  isLoading?: boolean;
}

/**
 * MemberKPIStrip (FT-19 / Impeccable Workbench):
 * Faixa contínua de indicadores de governança e papéis da equipe.
 * Zero cards soltos ou sombras difusas: painel contínuo com divisores retos de 1px.
 */
export const MemberKPIStrip: React.FC<MemberKPIStripProps> = ({
  summary,
  isLoading = false,
}) => {
  const items = [
    {
      id: "total",
      label: "TOTAL DE MEMBROS",
      value: summary?.total_members ?? 0,
      icon: Users,
      colorText: "text-zinc-900",
      subtext: "Vínculos ativos",
    },
    {
      id: "owners",
      label: "PROPRIETÁRIOS",
      value: summary?.owners_count ?? 0,
      icon: Crown,
      colorText: summary?.owners_count === 1 ? "text-amber-700" : "text-zinc-900",
      subtext: summary?.owners_count === 1 ? "Titular único ativo" : "Acesso irrestrito",
      badge: summary?.owners_count === 1 ? "Titular Único" : undefined,
    },
    {
      id: "gestores",
      label: "GESTORES",
      value: summary?.gestores_count ?? 0,
      icon: Shield,
      colorText: "text-blue-700",
      subtext: "Catálogo e equipe",
    },
    {
      id: "almoxarifes",
      label: "ALMOXARIFES",
      value: summary?.almoxarifes_count ?? 0,
      icon: Package,
      colorText: "text-emerald-700",
      subtext: "Entrada e saída",
    },
    {
      id: "auditores",
      label: "AUDITORES",
      value: summary?.auditores_count ?? 0,
      icon: Eye,
      colorText: "text-purple-700",
      subtext: "Ajuste e extrato",
    },
  ];

  return (
    <div
      data-testid="member-kpi-strip"
      className="w-full bg-white border border-zinc-200 rounded divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 grid grid-cols-2 md:grid-cols-5"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            data-testid={`kpi-item-${item.id}`}
            className="p-3.5 flex flex-col justify-between transition-colors hover:bg-zinc-50/50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-500 font-sans">
                {item.label}
              </span>
              <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            </div>

            <div className="flex items-baseline gap-2">
              {isLoading ? (
                <div className="h-7 w-12 bg-zinc-200 animate-pulse rounded" />
              ) : (
                <span
                  data-testid={`kpi-value-${item.id}`}
                  className={cn(
                    "text-2xl font-bold font-mono tabular-nums leading-tight",
                    item.colorText
                  )}
                >
                  {item.value}
                </span>
              )}
              {item.badge && !isLoading && (
                <span
                  data-testid="sole-owner-indicator"
                  className="px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-amber-50 text-amber-800 border border-amber-200 rounded tracking-wider"
                >
                  {item.badge}
                </span>
              )}
            </div>

            <div className="mt-1 text-[11px] text-zinc-500 font-sans truncate">
              {item.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
};
