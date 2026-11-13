"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi } from "@/features/categories/services/categories.api";
import { Category } from "@/features/categories/types/category.types";
import { CategoryListTable } from "@/features/categories/components/CategoryListTable";
import { CategoryModal } from "@/features/categories/components/CategoryModal";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { queryKeys } from "@/shared/lib/query-client";
import { Button } from "@/shared/components/Button";
import {
  Tag,
  Plus,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  FolderTree,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

/**
 * Página de Gestão de Categorias N:N (FT-11 / /categories):
 * Permite listagem, criação e exclusão de categorias com isolamento por tenant.
 * Proteção RBAC: Bloqueio estrito com banner para papéis ALMOXARIFE e AUDITOR.
 */
export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { can, role } = useRBAC();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const canView = can("view_categories");
  const canManage = can("manage_categories");

  // Query reativa de categorias escopada pelo tenant ativo
  const {
    data: categories = [],
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.categories.list(tenantId || ""),
    queryFn: () => categoriesApi.list(),
    enabled: !!tenantId && canView,
  });

  const handleDeleteCategory = async (category: Category) => {
    await categoriesApi.delete(category.id);
    if (tenantId) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.categories.list(tenantId),
      });
    }
    setActionFeedback(`Categoria "${category.name}" excluída com sucesso.`);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleCreateSuccess = (created: Category) => {
    if (tenantId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.categories.list(tenantId),
      });
    }
    setActionFeedback(`Categoria "${created.name}" criada com sucesso.`);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // 1. Bloqueio RBAC para ALMOXARIFE e AUDITOR
  if (!canView) {
    return (
      <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center">
        <div
          role="alert"
          aria-labelledby="rbac-restricted-title"
          className="w-full max-w-lg bg-white border border-amber-300 rounded p-6 shadow-xs select-none space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded text-amber-800 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2
                id="rbac-restricted-title"
                className="text-sm font-mono font-bold uppercase tracking-wider text-zinc-950"
              >
                Acesso Restrito // Papel Insuficiente
              </h2>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Seu perfil de acesso atual no almoxarifado (
                <strong className="font-mono text-zinc-900 font-semibold">{role || "VISITANTE"}</strong>
                ) não possui autorização para visualizar ou modificar o módulo de categorias.
              </p>
            </div>
          </div>

          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded text-[11px] font-mono text-zinc-600">
            <span>PERMISSÃO REQUERIDA: view_categories / manage_categories (OWNER, GESTOR)</span>
          </div>

          <div className="pt-2 flex justify-end">
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Voltar à Bancada Principal
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Visão Principal para OWNER e GESTOR
  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4 max-w-7xl mx-auto w-full">
      {/* Cabeçalho da Página / Barra de Ferramentas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-zinc-900" aria-hidden="true" />
            <h1 className="text-base font-semibold text-zinc-950 tracking-tight">
              Gestão de Categorias
            </h1>
            <span className="text-zinc-300 font-mono text-xs">//</span>
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              {tenantId || "ALMOXARIFADO"}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Categorização N:N e agrupamento de produtos para organização, filtros e inventário.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            title="Atualizar listagem de categorias"
            leftIcon={
              <RefreshCw
                className={cn("w-3.5 h-3.5", (isRefetching || isLoading) && "animate-spin")}
              />
            }
          >
            Atualizar
          </Button>

          <Button
            type="button"
            variant="solid"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            disabled={!canManage}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            data-testid="open-category-modal-button"
          >
            Nova Categoria
          </Button>
        </div>
      </div>

      {/* Banner de Feedback de Ação */}
      {actionFeedback && (
        <div
          role="status"
          className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center justify-between transition-all"
        >
          <span>{actionFeedback}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-emerald-700 hover:text-emerald-950 font-mono text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner de Erro de Rede / API */}
      {error && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded flex items-center justify-between"
        >
          <span>
            {error instanceof Error ? error.message : "Erro ao carregar categorias do almoxarifado."}
          </span>
          <Button variant="outline" size="xs" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Tabela de Alta Densidade de Categorias */}
      <CategoryListTable
        categories={categories}
        isLoading={isLoading}
        canDelete={canManage}
        onDeleteCategory={handleDeleteCategory}
        onOpenCreate={() => setIsModalOpen(true)}
      />

      {/* Modal de Criação de Categoria */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
