"use client";

import React from "react";
import Link from "next/link";
import { ProductForm } from "@/features/products/components/ProductForm";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { Button } from "@/shared/components/Button";
import {
  Boxes,
  ArrowLeft,
  ShieldAlert,
  ChevronRight,
  PackagePlus,
} from "lucide-react";

/**
 * Página de Cadastro de Produtos Físicos (FT-13 / /products/new):
 * Interface operacional de alta densidade para inclusão de novos itens no catálogo.
 * Proteção RBAC: Bloqueio estrito com banner para papéis ALMOXARIFE e AUDITOR.
 * Regra Contábil Mandatória: Novos itens iniciam obrigatoriamente com saldo ZERO no Livro-Razão.
 */
export default function NewProductPage() {
  const { can, role } = useRBAC();
  const { isLoading: isTenantLoading } = useTenant();
  const canCreate = can("create_product");

  if (isTenantLoading) {
    return (
      <div className="flex-1 p-8 text-center text-xs font-mono text-zinc-400">
        Verificando permissões de operador...
      </div>
    );
  }

  // Bloqueio RBAC para ALMOXARIFE e AUDITOR
  if (!canCreate) {
    return (
      <div
        className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center font-sans"
        data-testid="rbac-restricted-container"
      >
        <div
          role="alert"
          aria-labelledby="rbac-restricted-title"
          className="w-full max-w-lg bg-white border border-amber-300 rounded p-6 shadow-xs select-none space-y-4"
          data-testid="rbac-restricted-banner"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded text-amber-800 shrink-0">
              <ShieldAlert className="w-6 h-6" aria-hidden="true" />
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
                <strong className="font-mono text-zinc-900 font-semibold">
                  {role || "OPERADOR"}
                </strong>
                ) não possui autorização para cadastrar novos produtos. Apenas Administradores
                (OWNER) e Gestores (GESTOR) têm permissão de criação cadastral.
              </p>
            </div>
          </div>

          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded text-[11px] font-mono text-zinc-600">
            <span>PERMISSÃO REQUERIDA: create_product (OWNER, GESTOR)</span>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <Link href="/products">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Boxes className="w-3.5 h-3.5" />}
              >
                Ir para o Catálogo
              </Button>
            </Link>

            <Link href="/dashboard">
              <Button
                variant="solid"
                size="sm"
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                data-testid="back-to-dashboard-button"
              >
                Voltar ao Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white font-sans">
      {/* Top Bar / Breadcrumb de Navegação Operacional */}
      <div className="h-12 border-b border-zinc-200 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-zinc-50/50">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/products"
            className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 font-medium transition-colors"
          >
            <Boxes className="w-4 h-4 text-zinc-600" />
            <span>Catálogo</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-semibold text-zinc-900 flex items-center gap-1.5">
            <PackagePlus className="w-3.5 h-3.5 text-blue-600" />
            <span>Novo Produto Físico</span>
          </span>
        </div>

        <Link href="/products">
          <Button
            variant="ghost"
            size="xs"
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            data-testid="back-to-products-button"
          >
            Voltar ao Catálogo
          </Button>
        </Link>
      </div>

      {/* Conteúdo Principal: Bancada de Formulário */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full">
        <div className="mb-6 space-y-1">
          <h1 className="text-base font-bold text-zinc-950 uppercase tracking-wide flex items-center gap-2">
            <span>Ficha Cadastral de Novo Produto</span>
          </h1>
          <p className="text-xs text-zinc-500">
            Cadastre os metadados do item, especificações de embalagem, unidade de medida contábil e ponto de reposição mínima.
          </p>
        </div>

        <ProductForm mode="create" />
      </main>
    </div>
  );
}
