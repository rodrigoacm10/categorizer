"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/features/products/services/products.api";
import { Product } from "@/features/products/types/product.types";
import { ProductDetailHeader } from "@/features/products/components/ProductDetailHeader";
import { ProductForm } from "@/features/products/components/ProductForm";
import { ProductLedgerHistory } from "@/features/products/components/ProductLedgerHistory";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { queryKeys } from "@/shared/lib/query-client";
import { Button } from "@/shared/components/Button";
import {
  FileText,
  History,
  Lock,
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface ProductDetailPageProps {
  params: {
    id: string;
  };
}

export type WorkbenchTab = "details" | "ledger";

/**
 * Página da Ficha do Produto e Extrato do Ledger Individual (FT-14 / /products/[id]):
 * Interface de bancada industrial de alta densidade organizada em duas abas operacionais:
 * - Aba 1: Dados Cadastrais (edição com RBAC restrito; proibição de edição de saldos).
 * - Aba 2: Extrato do Livro-Razão (tabela append-only imutável com deltas e saldos).
 */
export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const routerParams = useParams();
  const productId = params?.id || (routerParams?.id as string);

  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { can, role } = useRBAC();

  const [activeTab, setActiveTab] = useState<WorkbenchTab>("details");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // RBAC: Apenas OWNER e GESTOR podem editar dados cadastrais
  const canEdit = can("edit_product");

  // Query dos dados do produto escopada pelo tenant ativo
  const {
    data: product,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Product>({
    queryKey: queryKeys.products.detail(tenantId || "", productId),
    queryFn: () => productsApi.getById(productId),
    enabled: !!tenantId && !!productId,
  });

  const handleUpdateSuccess = (updatedProduct: Product) => {
    setFeedbackMessage("Dados cadastrais do produto atualizados com sucesso.");
    if (tenantId) {
      queryClient.setQueryData(
        queryKeys.products.detail(tenantId, productId),
        updatedProduct
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all(tenantId),
      });
    }
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // 1. Estado de Carregamento (Skeleton)
  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-6 bg-white font-sans animate-pulse" data-testid="product-detail-skeleton">
        <div className="h-4 w-32 bg-zinc-200 rounded" />
        <div className="h-28 bg-zinc-100 rounded border border-zinc-200" />
        <div className="h-10 w-64 bg-zinc-200 rounded" />
        <div className="h-64 bg-zinc-50 rounded border border-zinc-200" />
      </div>
    );
  }

  // 2. Estado de Erro ou Produto Não Encontrado
  if (isError || !product) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center font-sans">
        <div
          role="alert"
          className="w-full max-w-md bg-white border border-rose-300 rounded p-6 text-center space-y-4 shadow-xs"
          data-testid="product-not-found"
        >
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-zinc-950">
              Produto Não Encontrado
            </h2>
            <p className="text-xs text-zinc-600">
              {error instanceof Error
                ? error.message
                : "O item solicitado não existe ou não pertence ao almoxarifado ativo."}
            </p>
          </div>
          <Link href="/products" className="inline-block pt-2">
            <Button
              variant="solid"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Voltar ao Catálogo de Produtos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white font-sans">
      {/* Cabeçalho Unificado da Ficha Técnica */}
      <ProductDetailHeader product={product} />

      {/* Banner de Feedback de Atualização */}
      {feedbackMessage && (
        <div
          role="status"
          className="border-b border-emerald-200 bg-emerald-50 px-6 py-2.5 text-xs text-emerald-900 flex items-center gap-2"
          data-testid="detail-feedback-banner"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{feedbackMessage}</span>
        </div>
      )}

      {/* Barra de Abas Industriais de Bancada */}
      <div className="border-b border-zinc-200 bg-zinc-50/70 px-4 sm:px-6 flex items-center gap-1 select-none">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={cn(
            "h-10 px-4 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 -mb-[1px]",
            activeTab === "details"
              ? "border-zinc-950 text-zinc-950 bg-white font-bold"
              : "border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/60"
          )}
          data-testid="tab-details"
          aria-selected={activeTab === "details"}
          role="tab"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Dados Cadastrais</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ledger")}
          className={cn(
            "h-10 px-4 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 -mb-[1px]",
            activeTab === "ledger"
              ? "border-zinc-950 text-zinc-950 bg-white font-bold"
              : "border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/60"
          )}
          data-testid="tab-ledger"
          aria-selected={activeTab === "ledger"}
          role="tab"
        >
          <History className="w-3.5 h-3.5" />
          <span>Extrato do Livro-Razão</span>
        </button>
      </div>

      {/* Conteúdo da Bancada Operacional */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-4xl w-full">
        {activeTab === "details" && (
          <div className="space-y-4" data-testid="tab-content-details">
            {/* Aviso de Modo Somente-Leitura para ALMOXARIFE e AUDITOR */}
            {!canEdit && (
              <div
                className="border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-600 flex items-center gap-2 rounded-none"
                data-testid="readonly-role-notice"
              >
                <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>
                  Modo Somente-Leitura // Seu perfil atual ({role || "OPERADOR"}) possui permissão apenas de visualização. Edição cadastral é restrita a Administradores (OWNER) e Gestores (GESTOR).
                </span>
              </div>
            )}

            <ProductForm
              initialData={product}
              mode="edit"
              readOnly={!canEdit}
              onSuccess={handleUpdateSuccess}
            />
          </div>
        )}

        {activeTab === "ledger" && (
          <div data-testid="tab-content-ledger">
            <ProductLedgerHistory
              productId={product.id}
              productUnit={product.unit}
            />
          </div>
        )}
      </main>
    </div>
  );
}
