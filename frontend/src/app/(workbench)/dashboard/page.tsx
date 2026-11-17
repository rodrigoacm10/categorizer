"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Warehouse,
  Boxes,
  History,
  ArrowRight,
} from "lucide-react";
import { KPIStrip } from "@/features/dashboard/components/KPIStrip";
import { QuickActionToolbar } from "@/features/dashboard/components/QuickActionToolbar";
import { CriticalStockTable } from "@/features/dashboard/components/CriticalStockTable";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { tenantsApi } from "@/features/tenants/services/tenants.api";
import { queryKeys } from "@/shared/lib/query-client";
import { RoleBadge } from "@/shared/components/Badge";

export default function DashboardPage() {
  const { tenantId, role } = useTenant();

  const { data: tenants = [] } = useQuery({
    queryKey: queryKeys.tenants.list,
    queryFn: () => tenantsApi.listTenants(),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  const activeTenant = tenants.find((t) => t.id === tenantId);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
      {/* Subheader Operacional de Contexto do Almoxarifado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center bg-zinc-950 text-white rounded shrink-0">
            <Warehouse className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-zinc-950 uppercase tracking-wide font-mono">
                Bancada de Operações de Estoque
              </h1>
              {role && <RoleBadge role={role} size="sm" showDot={true} />}
            </div>
            <p className="text-xs text-zinc-500">
              {activeTenant ? (
                <>
                  Unidade ativa: <span className="font-semibold text-zinc-800">{activeTenant.name}</span>
                </>
              ) : (
                "Visão consolidada de indicadores, alertas de reposição e movimentações do almoxarifado."
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <Link
            href="/inventory/movements"
            className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-950 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-zinc-400" />
            <span>Extrato do Livro-Razão</span>
            <ArrowRight className="w-3 h-3 text-zinc-400" />
          </Link>
        </div>
      </div>

      {/* 1. Faixa Contínua de KPIs (FT-09) */}
      <section aria-label="Indicadores Operacionais">
        <KPIStrip />
      </section>

      {/* 2. Barra de Ações Rápidas de Bancada (FT-10) */}
      <section aria-label="Ações Rápidas">
        <QuickActionToolbar />
      </section>

      {/* 3. Tabela de Alertas Críticos de Reposição (FT-10) */}
      <section aria-label="Alertas Críticos de Estoque">
        <CriticalStockTable />
      </section>

      {/* 4. Atalhos e Informações Rápidas de Bancada */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="border border-zinc-200 bg-white p-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-950 uppercase">
              <Boxes className="w-4 h-4 text-zinc-700" />
              <span>Catálogo Técnico de Produtos</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Consulte a listagem completa de SKUs, unidades de medida e pontos de reposição cadastrados no almoxarifado.
            </p>
          </div>
          <Link
            href="/products"
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-medium text-zinc-900 transition-colors"
          >
            <span>Ver Catálogo</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="border border-zinc-200 bg-white p-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-950 uppercase">
              <History className="w-4 h-4 text-zinc-700" />
              <span>Extrato Perpétuo do Ledger</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Auditoria imutável de todas as entradas, saídas e ajustes com chaves de idempotência RFC 9474 rastreadas.
            </p>
          </div>
          <Link
            href="/inventory/movements"
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-medium text-zinc-900 transition-colors"
          >
            <span>Ver Extrato</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}
