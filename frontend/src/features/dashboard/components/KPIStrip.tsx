"use client";

import React from "react";
import {
  Boxes,
  AlertTriangle,
  AlertCircle,
  ArrowLeftRight,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { DashboardSummary } from "../services/dashboard.api";
import { useDashboardSummary } from "../hooks/useDashboardSummary";

export interface KPIStripProps {
  summary?: DashboardSummary;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  className?: string;
}

export const KPIStrip: React.FC<KPIStripProps> = ({
  summary: propSummary,
  isLoading: propIsLoading,
  isError: propIsError,
  onRetry: propOnRetry,
  className,
}) => {
  // Se os dados não forem passados via props, consome a query reativa do almoxarifado
  const query = useDashboardSummary();

  const isLoading =
    propIsLoading !== undefined
      ? propIsLoading
      : propSummary !== undefined
      ? false
      : query.isLoading;

  const isError =
    propIsError !== undefined
      ? propIsError
      : propSummary !== undefined
      ? false
      : query.isError;
  const summary = propSummary || query.data;
  const handleRetry = propOnRetry || (() => query.refetch());

  // Estado de Erro
  if (isError) {
    return (
      <div
        role="alert"
        className={cn(
          "w-full border border-rose-200 bg-rose-50/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono",
          className
        )}
      >
        <div className="flex items-center gap-2 text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
          <span>Falha ao carregar indicadores de estoque do almoxarifado.</span>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-rose-200 text-rose-900 hover:bg-rose-100/50 font-sans text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-950"
        >
          <RotateCcw className="w-3.5 h-3.5 text-rose-700" aria-hidden="true" />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  // Estado de Carregamento (Skeletons discretos de 1px)
  if (isLoading || !summary) {
    return (
      <div
        data-testid="kpi-strip-skeleton"
        aria-busy="true"
        aria-label="Carregando indicadores de estoque"
        className={cn(
          "w-full border border-zinc-200 bg-zinc-50/60 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
          className
        )}
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 bg-zinc-200/80 rounded animate-pulse" />
              <div className="h-4 w-4 bg-zinc-200/80 rounded animate-pulse" />
            </div>
            <div className="h-7 w-20 bg-zinc-200/90 rounded animate-pulse my-0.5" />
            <div className="h-3 w-36 bg-zinc-200/70 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const {
    totalProducts = 0,
    lowStockCount = 0,
    zeroStockCount = 0,
    movementsTodayCount = 0,
  } = summary;

  const metrics = [
    {
      id: "catalog-total",
      label: "ITENS NO CATÁLOGO",
      value: totalProducts,
      subtitle: "SKUs ativos no almoxarifado",
      icon: Boxes,
      isWarning: false,
      isDanger: false,
    },
    {
      id: "low-stock-alert",
      label: "ALERTA ESTOQUE BAIXO",
      value: lowStockCount,
      subtitle: "Abaixo do ponto de reposição",
      icon: AlertTriangle,
      isWarning: lowStockCount > 0,
      isDanger: false,
    },
    {
      id: "zero-stock-alert",
      label: "ESTOQUE ZERADO",
      value: zeroStockCount,
      subtitle: "SKUs com saldo igual a zero",
      icon: AlertCircle,
      isWarning: false,
      isDanger: zeroStockCount > 0,
    },
    {
      id: "movements-24h",
      label: "MOVIMENTAÇÕES HOJE",
      value: movementsTodayCount,
      subtitle: "Lançamentos nas últimas 24h",
      icon: ArrowLeftRight,
      isWarning: false,
      isDanger: false,
    },
  ];

  return (
    <section
      aria-label="Faixa Contínua de KPIs do Almoxarifado"
      className={cn(
        "w-full border border-zinc-200 bg-zinc-50/60 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 select-none",
        className
      )}
    >
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div
            key={metric.id}
            data-testid={`kpi-cell-${metric.id}`}
            className={cn(
              "p-4 flex flex-col justify-between gap-2 transition-colors",
              metric.isDanger && "bg-rose-50/30",
              metric.isWarning && "bg-amber-50/30"
            )}
          >
            {/* Cabeçalho da Métrica */}
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[11px] font-mono font-semibold tracking-wider uppercase text-zinc-600">
                {metric.label}
              </span>
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  metric.isDanger
                    ? "text-rose-600"
                    : metric.isWarning
                    ? "text-amber-600"
                    : "text-zinc-400"
                )}
                aria-hidden="true"
              />
            </div>

            {/* Valor Numérico Tabular */}
            <div className="flex items-baseline gap-2">
              <span
                data-testid={`kpi-value-${metric.id}`}
                className={cn(
                  "text-2xl font-mono font-bold tracking-tight tabular-nums",
                  metric.isDanger
                    ? "text-rose-700"
                    : metric.isWarning
                    ? "text-amber-700"
                    : "text-zinc-950"
                )}
              >
                {metric.value.toLocaleString("pt-BR")}
              </span>

              {metric.isDanger && (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                  Crítico
                </span>
              )}
              {metric.isWarning && !metric.isDanger && (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                  Alerta
                </span>
              )}
            </div>

            {/* Subtítulo Operacional */}
            <p className="text-xs text-zinc-500 font-sans truncate">
              {metric.subtitle}
            </p>
          </div>
        );
      })}
    </section>
  );
};

KPIStrip.displayName = "KPIStrip";
