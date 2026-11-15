"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/features/inventory/services/inventory.api";
import { productsApi } from "@/features/products/services/products.api";
import { tenantsApi } from "@/features/tenants/services/tenants.api";
import { ListMovementsParams } from "@/features/inventory/types/inventory.types";
import {
  LedgerFilters,
  LedgerFiltersValue,
} from "@/features/inventory/components/LedgerFilters";
import { LedgerTable } from "@/features/inventory/components/LedgerTable";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { queryKeys } from "@/shared/lib/query-client";
import { Button } from "@/shared/components/Button";
import {
  History,
  Download,
  RefreshCw,
  LayoutDashboard,
  ArrowLeftRight,
  Lock,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

function LedgerLoadingFallback() {
  return (
    <div
      className="p-8 text-center text-xs font-mono text-zinc-400 border border-zinc-200 bg-white"
      data-testid="ledger-loading-fallback"
    >
      Carregando extrato do Livro-Razão...
    </div>
  );
}

function InventoryMovementsContent() {
  const searchParams = useSearchParams();
  const { tenantId } = useTenant();

  // 1. Estado dos Filtros (inicializado via searchParams para links profundos)
  const [filters, setFilters] = useState<LedgerFiltersValue>({
    productId: searchParams?.get("product_id") || "",
    type: searchParams?.get("type") || "",
    startDate: searchParams?.get("start_date") || "",
    endDate: searchParams?.get("end_date") || "",
  });

  // 2. Estado de Paginação (limit e offset)
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  // 3. Estado de Exportação de CSV
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // 4. Consulta de Tenancy para obter o slug do almoxarifado no nome do CSV
  const { data: tenants = [] } = useQuery({
    queryKey: queryKeys.tenants.list,
    queryFn: () => tenantsApi.listTenants(),
    staleTime: 5 * 60 * 1000,
  });
  const currentTenant = tenants.find((t) => t.id === tenantId);
  const tenantSlug = currentTenant?.slug || tenantId || "almoxarifado";

  // 5. Consulta de Produtos do Tenant para alimentar o seletor de filtros
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: queryKeys.products.all(tenantId || ""),
    queryFn: () => productsApi.list({ include_inactive: true }),
    enabled: !!tenantId,
  });

  // 6. Consulta do Extrato Geral Paginado
  const queryParams: ListMovementsParams = {
    product_id: filters.productId || undefined,
    type: filters.type || undefined,
    start_date: filters.startDate || undefined,
    end_date: filters.endDate || undefined,
    limit,
    offset,
  };

  const {
    data: movementsData,
    isLoading: isLoadingMovements,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.inventory.movements(tenantId || "", queryParams as Record<string, unknown>),
    queryFn: () => inventoryApi.listMovements(queryParams),
    enabled: !!tenantId,
  });

  const handleFiltersChange = (newFilters: LedgerFiltersValue) => {
    setFilters(newFilters);
    setOffset(0); // Reinicia paginação ao alterar qualquer critério de busca
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      await inventoryApi.exportMovementsCsv(
        {
          product_id: filters.productId || undefined,
          type: filters.type || undefined,
          start_date: filters.startDate || undefined,
          end_date: filters.endDate || undefined,
        },
        tenantSlug
      );
    } catch (err) {
      setExportError((err as Error).message || "Falha ao exportar extrato CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const movements = movementsData?.items || movementsData || [];
  const totalCount = movementsData?.totalCount ?? movements.length;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white font-sans select-none">
      {/* Top Bar / Navegação Superior de Bancada */}
      <header className="h-12 border-b border-zinc-200 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-zinc-50/50">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/dashboard"
            className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 font-medium transition-colors"
          >
            <LayoutDashboard className="w-4 h-4 text-zinc-600" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="font-semibold text-zinc-900 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>Livro-Razão Contábil</span>
          </span>
        </div>

        {/* Links Rápidos Operacionais */}
        <div className="flex items-center gap-2">
          <Link href="/inventory/move">
            <Button
              variant="outline"
              size="xs"
              leftIcon={<ArrowLeftRight className="w-3.5 h-3.5 text-zinc-500" />}
              data-testid="go-to-move-button"
              className="rounded-none sm:rounded-sm text-xs font-mono"
            >
              Movimentar Saldo
            </Button>
          </Link>
        </div>
      </header>

      {/* Conteúdo Principal da Bancada */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-4">
        {/* Cabeçalho do Extrato e Ações */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-900" aria-hidden="true" />
              <h1 className="text-base font-semibold text-zinc-950 tracking-tight">
                Extrato Geral do Livro-Razão
              </h1>
              <span className="text-zinc-300 font-mono text-xs">//</span>
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                {tenantSlug}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Registro perpétuo, imutável e auditável de todos os lançamentos físicos de estoque (Append-Only).
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 mr-2"
              title="Livro Contábil Imutável"
            >
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Imutável / Somente-Leitura</span>
            </div>

            {/* Botão de Exportação CSV */}
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleExportCsv}
              isLoading={isExporting}
              leftIcon={<Download className="w-3.5 h-3.5 text-zinc-600" />}
              data-testid="export-csv-button"
              title="Exportar extrato contábil filtrado em CSV"
            >
              Exportar CSV
            </Button>

            {/* Botão de Atualização Reativa */}
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => refetch()}
              disabled={isRefetching || isLoadingMovements}
              leftIcon={
                <RefreshCw
                  className={cn("w-3.5 h-3.5", isRefetching && "animate-spin")}
                />
              }
              data-testid="refresh-movements-button"
              title="Atualizar lançamentos do Livro-Razão"
            >
              Atualizar
            </Button>
          </div>
        </div>

        {/* Notificação de Erro na Exportação */}
        {exportError && (
          <div
            role="alert"
            className="p-3 bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center justify-between gap-2 rounded"
            data-testid="export-error-alert"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{exportError}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportError(null)}
              className="text-xs text-rose-700 hover:underline font-mono"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Notificação de Erro no Carregamento */}
        {error && (
          <div
            role="alert"
            className="p-3 bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center gap-2 rounded"
            data-testid="query-error-alert"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Erro ao carregar os lançamentos do Livro-Razão: {(error as Error).message}
            </span>
          </div>
        )}

        {/* Barra de Filtros Industriais */}
        <LedgerFilters
          products={products}
          values={filters}
          onChange={handleFiltersChange}
          isLoadingProducts={isLoadingProducts}
        />

        {/* Tabela do Livro-Razão Contábil */}
        <LedgerTable
          movements={movements}
          totalCount={totalCount}
          limit={limit}
          offset={offset}
          isLoading={isLoadingMovements}
          onPageChange={setOffset}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setOffset(0);
          }}
        />
      </main>
    </div>
  );
}

/**
 * Rota do Extrato Geral do Livro-Razão (FT-17 / /inventory/movements):
 * Envolvido em Suspense boundary para conformidade estrita com Next.js 14 App Router.
 */
export default function InventoryMovementsPage() {
  return (
    <Suspense fallback={<LedgerLoadingFallback />}>
      <InventoryMovementsContent />
    </Suspense>
  );
}
