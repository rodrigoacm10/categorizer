"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface ReconciliationBannerProps {
  isReconciled: boolean;
  totalProductsChecked: number;
  discrepantCount: number;
  className?: string;
}

/**
 * ReconciliationBanner (Impeccable Workbench):
 * Banner de alto contraste comunicando o resultado formal da auditoria contábil.
 * Baseado em superfícies planas industriais e sem cards flutuantes.
 */
export const ReconciliationBanner: React.FC<ReconciliationBannerProps> = ({
  isReconciled,
  totalProductsChecked,
  discrepantCount,
  className,
}) => {
  if (isReconciled) {
    return (
      <div
        data-testid="reconciliation-banner-success"
        className={cn(
          "w-full bg-emerald-50/70 border border-emerald-200/90 rounded p-4 flex items-start gap-3 text-xs text-emerald-950 font-sans",
          className
        )}
      >
        <div className="p-1 bg-emerald-100 rounded text-emerald-800 shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-emerald-950 text-sm">
              Equação Contábil Balanceada (Zero Divergência)
            </h3>
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 rounded tracking-wider">
              Auditado: 100% Íntegro
            </span>
          </div>
          <p className="text-emerald-800 mt-1 leading-relaxed">
            A prova contábil formal foi concluída com sucesso para todos os{" "}
            <strong className="font-mono tabular-nums">{totalProductsChecked}</strong> produtos cadastrados.
            A equação contábil <code className="font-mono text-[11px] bg-emerald-100/60 px-1 py-0.5 rounded">CurrentQuantity == Sum(Delta)</code> é estritamente verdadeira em todo o Livro-Razão.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="reconciliation-banner-discrepancy"
      className={cn(
        "w-full bg-rose-50/70 border border-rose-200/90 rounded p-4 flex items-start gap-3 text-xs text-rose-950 font-sans",
        className
      )}
    >
      <div className="p-1 bg-rose-100 rounded text-rose-800 shrink-0 mt-0.5">
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-rose-950 text-sm">
            Divergência Contábil Detectada no Estoque
          </h3>
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase bg-rose-100 text-rose-800 border border-rose-300 rounded tracking-wider">
            {discrepantCount} {discrepantCount === 1 ? "Produto com Desvio" : "Produtos com Desvios"}
          </span>
        </div>
        <p className="text-rose-800 mt-1 leading-relaxed">
          Foram encontradas inconsistências matemáticas entre o histórico de movimentações e o saldo físico em catálogo.
          Verifique a tabela detalhada abaixo e registre movimentações de <strong>Ajuste de Inventário (ADJUSTMENT)</strong> com justificativa formal para reequilibrar os saldos.
        </p>
      </div>
    </div>
  );
};
