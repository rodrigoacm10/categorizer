"use client";

import React from "react";
import { Boxes, AlertTriangle, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { InventoryReconciliationReport } from "../types/reconciliation.types";
import { cn } from "@/shared/utils/cn";

export interface ReconciliationKPIStripProps {
  report?: InventoryReconciliationReport | null;
  isLoading?: boolean;
}

/**
 * ReconciliationKPIStrip (Impeccable Workbench):
 * Faixa horizontal contínua de indicadores de auditoria matemática do estoque.
 * Apresenta 4 métricas com números tabulares e divisores verticais retos de 1px.
 */
export const ReconciliationKPIStrip: React.FC<ReconciliationKPIStripProps> = ({
  report,
  isLoading = false,
}) => {
  const isReconciled = report?.is_reconciled ?? false;
  const discrepanciesCount = report?.discrepant_products_count ?? 0;
  const totalChecked = report?.total_products_checked ?? 0;

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return "--:--";
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "--:--";
    }
  };

  const formatDateShort = (dateStr?: string) => {
    if (!dateStr) return "Aguardando execução";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pt-BR");
    } catch {
      return "Data indisponível";
    }
  };

  const items = [
    {
      id: "total",
      label: "Produtos Auditados",
      value: isLoading ? "--" : totalChecked.toString(),
      subtext: "100% do catálogo do tenant",
      icon: Boxes,
      colorText: "text-zinc-950",
    },
    {
      id: "discrepancies",
      label: "Discrepâncias",
      value: isLoading ? "--" : discrepanciesCount.toString(),
      subtext: discrepanciesCount === 0 ? "Zero desvios contábeis" : "Requer conciliação manual",
      icon: AlertTriangle,
      colorText: discrepanciesCount > 0 ? "text-rose-700" : "text-emerald-700",
    },
    {
      id: "integrity",
      label: "Status da Equação",
      value: isLoading ? "--" : isReconciled ? "Equilibrada" : "Divergente",
      subtext: "Σ Movimentações = Saldo",
      icon: isReconciled ? ShieldCheck : ShieldAlert,
      colorText: isReconciled ? "text-emerald-700" : "text-rose-700",
      badge: isReconciled ? "Auditoria OK" : "Atenção",
      badgeColor: isReconciled
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : "bg-rose-50 text-rose-800 border-rose-200",
    },
    {
      id: "timestamp",
      label: "Última Verificação",
      value: isLoading ? "--:--" : formatTimestamp(report?.generated_at),
      subtext: formatDateShort(report?.generated_at),
      icon: Clock,
      colorText: "text-zinc-900",
    },
  ];

  return (
    <div
      data-testid="reconciliation-kpi-strip"
      className="w-full bg-zinc-50/60 border border-zinc-200 rounded divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 grid grid-cols-2 md:grid-cols-4"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            data-testid={`reconciliation-kpi-${item.id}`}
            className="p-3.5 flex flex-col justify-between transition-colors hover:bg-white"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-600 font-sans">
                {item.label}
              </span>
              <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            </div>

            <div className="flex items-baseline gap-2">
              {isLoading ? (
                <div className="h-7 w-16 bg-zinc-200 animate-pulse rounded" />
              ) : (
                <span
                  data-testid={`reconciliation-kpi-value-${item.id}`}
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
                  data-testid={`reconciliation-kpi-badge-${item.id}`}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-semibold uppercase border rounded tracking-wider",
                    item.badgeColor
                  )}
                >
                  {item.badge}
                </span>
              )}
            </div>

            <div className="mt-1 text-[11px] text-zinc-600 font-sans truncate">
              {item.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
};
