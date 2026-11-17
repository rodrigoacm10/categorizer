"use client";

import React from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useStockSimulation, UseStockSimulationReturn } from "../hooks/useStockSimulation";
import { MovementType } from "../types/inventory.types";
import { Product } from "@/features/products/types/product.types";
import { cn } from "@/shared/utils/cn";

export interface BalancePreviewProps {
  currentQuantity?: number | string | null;
  movementType: MovementType | string;
  quantityInput?: number | string | null;
  targetProduct?: Product | null;
  unit?: string;
  className?: string;
  simulation?: UseStockSimulationReturn;
}

/**
 * Painel de Pré-visualização Contábil em Tempo Real (FT-18).
 * Componente da bancada industrial (OPERATE mode) com divisórias nítidas de 1px,
 * números monoespaçados tabulares e alerta visual com bloqueio em caso de saldo negativo.
 */
export function BalancePreview({
  currentQuantity,
  movementType,
  quantityInput,
  targetProduct,
  unit,
  className,
  simulation: precomputedSimulation,
}: BalancePreviewProps) {
  const internalSimulation = useStockSimulation({
    currentQuantity,
    movementType,
    quantityInput,
    targetProduct,
    unit,
  });

  const sim = precomputedSimulation || internalSimulation;
  const { isNegative, formattedCurrentBalance, formattedDelta, formattedProjectedBalance, delta } = sim;

  const normalizedType = (movementType || "IN").toUpperCase();

  // Cores semânticas industriais para o delta
  let deltaColorClass = "text-zinc-700";
  let deltaPrefixSymbol = "";

  if (normalizedType === "IN") {
    deltaColorClass = "text-emerald-700";
  } else if (normalizedType === "OUT") {
    deltaColorClass = isNegative ? "text-rose-700" : "text-zinc-700";
  } else if (normalizedType === "ADJUSTMENT") {
    deltaColorClass = "text-indigo-700";
    deltaPrefixSymbol = "Δ ";
  }

  return (
    <div
      data-testid="balance-preview"
      aria-live="polite"
      className={cn(
        "border rounded-sm transition-colors text-xs select-none",
        isNegative
          ? "border-rose-400 bg-rose-50 text-rose-900"
          : "border-zinc-200 bg-zinc-50/80 text-zinc-800",
        className
      )}
    >
      {/* Grade de 3 colunas contábeis */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200">
        {/* Coluna 1: Saldo Físico Atual */}
        <div className="p-3 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Saldo Físico Atual
          </span>
          <div className="mt-1 flex items-baseline justify-between sm:justify-end gap-2">
            <span
              data-testid="current-balance-value"
              className="font-mono tabular-nums text-sm font-medium text-zinc-900 text-right"
            >
              {formattedCurrentBalance}
            </span>
          </div>
        </div>

        {/* Coluna 2: Delta da Operação */}
        <div className="p-3 flex flex-col justify-between bg-white/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Delta da Operação
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {normalizedType}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between sm:justify-end gap-2">
            <span
              data-testid="delta-value"
              className={cn(
                "font-mono tabular-nums text-sm font-semibold text-right",
                deltaColorClass
              )}
            >
              {deltaPrefixSymbol}{formattedDelta}
            </span>
          </div>
        </div>

        {/* Coluna 3: Saldo Físico Projetado */}
        <div
          className={cn(
            "p-3 flex flex-col justify-between",
            isNegative ? "bg-rose-100/50" : "bg-white/70"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Saldo Físico Projetado
            </span>
            <ArrowRight className="w-3 h-3 text-zinc-400 hidden sm:inline" />
          </div>
          <div className="mt-1 flex items-baseline justify-between sm:justify-end gap-2">
            <span
              data-testid="projected-balance-value"
              className={cn(
                "font-mono tabular-nums text-sm font-bold text-right",
                isNegative ? "text-rose-700" : "text-zinc-950"
              )}
            >
              {formattedProjectedBalance}
            </span>
          </div>
        </div>
      </div>

      {/* Banner de Bloqueio Mandatório em caso de saldo negativo */}
      {isNegative && (
        <div
          role="alert"
          data-testid="negative-balance-alert"
          className="border-t border-rose-300 px-3 py-2 bg-rose-100/80 flex items-center gap-2 text-rose-900 text-xs font-medium"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
          <span>
            Operação bloqueada: A quantidade solicitada excede o saldo físico disponível.
          </span>
        </div>
      )}
    </div>
  );
}
