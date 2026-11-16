"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Scale,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { reconciliationApi } from "@/features/inventory/services/reconciliation.api";
import { InventoryReconciliationReport } from "@/features/inventory/types/reconciliation.types";
import { ReconciliationKPIStrip } from "@/features/inventory/components/ReconciliationKPIStrip";
import { ReconciliationBanner } from "@/features/inventory/components/ReconciliationBanner";
import { ReconciliationTable } from "@/features/inventory/components/ReconciliationTable";

/**
 * ReconciliationPage (/inventory/reconciliation - Impeccable Workbench):
 * Bancada operacional de auditoria contábil e reconciliação matemática do almoxarifado.
 * Valida a conservação estrita de saldo contábil: CurrentQuantity == Sum(Delta).
 * Acesso restrito via RBAC para OWNER, GESTOR e AUDITOR (Bloqueado para ALMOXARIFE).
 */
export default function ReconciliationPage() {
  const { tenantId, isLoading: isTenantLoading } = useTenant();
  const { can, role } = useRBAC();

  const canViewAudit = can("view_audit");
  const canReconcile = can("reconcile_inventory");

  const [report, setReport] = useState<InventoryReconciliationReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const runReconciliation = useCallback(
    async (isManual = false) => {
      if (!tenantId || !canViewAudit) return;

      if (isManual) {
        setIsAuditing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await reconciliationApi.getReconciliationReport(tenantId);
        setReport(data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Falha ao executar auditoria e reconciliação contábil do inventário.");
        }
      } finally {
        setIsLoading(false);
        setIsAuditing(false);
      }
    },
    [tenantId, canViewAudit]
  );

  useEffect(() => {
    if (!isTenantLoading && tenantId && canViewAudit) {
      runReconciliation(false);
    }
  }, [isTenantLoading, tenantId, canViewAudit, runReconciliation]);

  // Barreira RBAC: Papéis sem permissão view_audit (ex: ALMOXARIFE)
  if (!canViewAudit) {
    return (
      <div
        data-testid="reconciliation-access-denied"
        className="w-full max-w-7xl mx-auto p-6 font-sans text-xs"
      >
        <div className="bg-white border border-zinc-200 rounded p-8 max-w-xl mx-auto text-center">
          <div className="w-12 h-12 bg-rose-50 border border-rose-200 text-rose-700 rounded flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-zinc-950 mb-1">
            Acesso Restrito à Auditoria Contábil
          </h2>
          <p className="text-zinc-600 mb-6 leading-relaxed">
            Seu perfil de acesso atual (<strong className="font-mono">{role || "OPERADOR"}</strong>) não possui privilégios para executar ou consultar a reconciliação matemática de estoques. Esta funcionalidade é exclusiva para <strong>Proprietários (OWNER)</strong>, <strong>Gestores (GESTOR)</strong> e <strong>Auditores (AUDITOR)</strong>.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 rounded font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="reconciliation-page"
      className="w-full max-w-7xl mx-auto p-6 flex flex-col gap-5 font-sans"
    >
      {/* Cabeçalho da Bancada */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-zinc-900" />
            <h1 className="text-lg font-bold text-zinc-950 tracking-tight">
              Auditoria e Reconciliação Contábil
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-mono font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 rounded">
              MODO OPERATE
            </span>
          </div>
          <p className="text-xs text-zinc-600 mt-1">
            Auditoria matemática formal do inventário físico: valida se{" "}
            <code className="font-mono text-[11px] bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">
              Saldo em Catálogo == Σ(Movimentações no Ledger)
            </code>
          </p>
        </div>

        {/* Ações da Bancada */}
        <div className="flex items-center gap-2.5">
          {canReconcile && (
            <button
              type="button"
              data-testid="run-reconciliation-button"
              disabled={isLoading || isAuditing}
              onClick={() => runReconciliation(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-100 text-xs font-medium rounded transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isAuditing ? "animate-spin" : ""}`}
              />
              <span>{isAuditing ? "Auditando..." : "Executar Auditoria"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner de Erro Global */}
      {error && (
        <div
          data-testid="reconciliation-error-banner"
          className="p-3.5 bg-rose-50 border border-rose-200 rounded flex items-center justify-between text-xs text-rose-900"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => runReconciliation(true)}
            className="text-[11px] font-semibold underline hover:no-underline ml-4 shrink-0"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Faixa Contínua de KPIs */}
      <ReconciliationKPIStrip report={report} isLoading={isLoading} />

      {/* Banner de Veredito da Equação Contábil */}
      {report && !isLoading && (
        <ReconciliationBanner
          isReconciled={report.is_reconciled}
          totalProductsChecked={report.total_products_checked}
          discrepantCount={report.discrepant_products_count}
        />
      )}

      {/* Tabela de Discrepâncias de Produtos */}
      <ReconciliationTable
        discrepancies={report?.discrepancies ?? []}
        totalProductsChecked={report?.total_products_checked ?? 0}
        isLoading={isLoading}
      />
    </div>
  );
}
