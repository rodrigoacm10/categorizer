"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/features/products/services/products.api";
import { categoriesApi } from "@/features/categories/services/categories.api";
import { Product } from "@/features/products/types/product.types";
import { ProductTable } from "@/features/products/components/ProductTable";
import {
  ProductFilters,
  ProductFiltersValue,
} from "@/features/products/components/ProductFilters";
import { DeactivateProductModal } from "@/features/products/components/DeactivateProductModal";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { queryKeys } from "@/shared/lib/query-client";
import { Button } from "@/shared/components/Button";
import {
  Boxes,
  Plus,
  RefreshCw,
  FolderTree,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

const PAGE_SIZE = 50;

/**
 * Página do Catálogo de Produtos Físicos (FT-12 / /products):
 * Centro de busca de alta densidade e conferência contábil de saldos de estoque.
 * Integra filtros debounced, listagem reativa via TanStack Query e soft-delete com RBAC.
 */
export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { tenantId, tenantName } = useTenant();
  const { can } = useRBAC();

  const canCreate = can("create_product");
  const canDeactivate = can("inactivate_product");

  // Estado dos Filtros de Catálogo
  const [filters, setFilters] = useState<ProductFiltersValue>({
    search: "",
    categoryId: "",
    lowStockOnly: false,
    includeInactive: false,
  });

  // Estado de Paginação
  const [page, setPage] = useState(0);

  // Estado do Modal de Inativação
  const [productToDeactivate, setProductToDeactivate] = useState<Product | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // 1. Query das Categorias do Tenant (para alimentar o dropdown)
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: queryKeys.categories.list(tenantId || ""),
    queryFn: () => categoriesApi.list(),
    enabled: !!tenantId,
  });

  // 2. Query dos Produtos Filtrados
  const queryFilterParams = {
    search: filters.search || undefined,
    category_id: filters.categoryId || undefined,
    low_stock_only: filters.lowStockOnly || undefined,
    include_inactive: filters.includeInactive || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const {
    data: products = [],
    isLoading: isLoadingProducts,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.products.list(tenantId || "", queryFilterParams),
    queryFn: () => productsApi.list(queryFilterParams),
    enabled: !!tenantId,
  });

  // Mudança nos filtros reseta a página para 0
  const handleFiltersChange = (newFilters: ProductFiltersValue) => {
    setFilters(newFilters);
    setPage(0);
  };

  // Sucesso na inativação de produto
  const handleDeactivateSuccess = (deactivatedProduct: Product, message: string) => {
    if (tenantId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all(tenantId),
      });
    }
    setFeedbackMessage(
      `Produto "${deactivatedProduct.name}" inativado com sucesso. Evento PRODUCT_DELETED registrado.`
    );
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4 max-w-7xl mx-auto w-full select-none">
      {/* Cabeçalho da Bancada / Toolbar Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-zinc-900" aria-hidden="true" />
            <h1 className="text-base font-semibold text-zinc-950 tracking-tight">
              Catálogo de Produtos Físicos
            </h1>
            <span className="text-zinc-300 font-mono text-xs">//</span>
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              {tenantName || "ALMOXARIFADO"}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Controle de itens armazenados, saldo contábil em tempo real e pontos de reposição.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Link rápido para categorias para OWNER e GESTOR */}
          {can("view_categories") && (
            <Link href="/categories">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FolderTree className="w-3.5 h-3.5" />}
                title="Ir para Gerenciamento de Categorias"
              >
                Categorias
              </Button>
            </Link>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching || isLoadingProducts}
            title="Atualizar listagem de produtos"
            leftIcon={
              <RefreshCw
                className={cn(
                  "w-3.5 h-3.5",
                  (isRefetching || isLoadingProducts) && "animate-spin"
                )}
              />
            }
          >
            Atualizar
          </Button>

          {/* Botão Novo Produto (Oculto para ALMOXARIFE e AUDITOR) */}
          {canCreate && (
            <Link href="/products/new">
              <Button
                type="button"
                variant="solid"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                data-testid="new-product-button"
              >
                Novo Produto
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Banner de Feedback Operacional */}
      {feedbackMessage && (
        <div
          role="status"
          className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center justify-between"
        >
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-mono text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner de Erro de Conexão */}
      {error && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded flex items-center justify-between"
        >
          <span>
            {error instanceof Error ? error.message : "Erro ao carregar catálogo de produtos."}
          </span>
          <Button variant="outline" size="xs" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Barra de Filtros de Catálogo */}
      <ProductFilters
        categories={categories}
        values={filters}
        onChange={handleFiltersChange}
        isLoadingCategories={isLoadingCategories}
      />

      {/* Tabela de Produtos de Alta Densidade */}
      <ProductTable
        products={products}
        isLoading={isLoadingProducts}
        canDeactivate={canDeactivate}
        onDeactivateProduct={(product) => setProductToDeactivate(product)}
        onOpenCreate={() => {}}
      />

      {/* Barra de Paginação Industrial */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-200 text-xs font-mono text-zinc-600">
        <span data-testid="products-count-label">
          Exibindo {products.length} itens {page > 0 ? `(Página ${page + 1})` : ""}
        </span>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={page === 0 || isLoadingProducts}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            data-testid="pagination-prev-button"
          >
            Anterior
          </Button>

          <span className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded text-[11px]">
            {page + 1}
          </span>

          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={products.length < PAGE_SIZE || isLoadingProducts}
            onClick={() => setPage((p) => p + 1)}
            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            data-testid="pagination-next-button"
          >
            Próxima
          </Button>
        </div>
      </div>

      {/* Modal de Inativação (Soft-Delete) */}
      <DeactivateProductModal
        product={productToDeactivate}
        isOpen={Boolean(productToDeactivate)}
        onClose={() => setProductToDeactivate(null)}
        onSuccess={handleDeactivateSuccess}
      />
    </div>
  );
}
