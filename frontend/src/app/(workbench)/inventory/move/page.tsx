"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, History, LayoutDashboard, Terminal } from "lucide-react";
import { MovementForm } from "@/features/inventory/components/MovementForm";
import { Button } from "@/shared/components/Button";

/**
 * Tela de Bancada Operacional de Movimentação Física (FT-15, FT-16 e FT-18 / /inventory/move):
 * Terminal de alta densidade para movimentações de galpão (Entradas, Saídas e Ajustes)
 * com suporte a leitor USB, simulação em tempo real de saldos e gravação imutável no Livro-Razão.
 */
export default function InventoryMovePage() {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white font-sans">
      {/* Top Bar / Cabeçalho de Bancada Industrial */}
      <header className="h-12 border-b border-zinc-200 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-zinc-50/50 select-none">
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
            <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
            <span>Bancada de Movimentações</span>
          </span>
        </div>

        {/* Links Rápidos Operacionais */}
        <div className="flex items-center gap-2">
          <Link href="/inventory/movements">
            <Button
              variant="outline"
              size="xs"
              leftIcon={<History className="w-3.5 h-3.5 text-zinc-500" />}
              data-testid="view-ledger-button"
              className="rounded-none sm:rounded-sm text-xs font-mono"
            >
              Ver Extrato
            </Button>
          </Link>

          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="xs"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              data-testid="back-to-dashboard-button"
              className="rounded-none sm:rounded-sm text-xs"
            >
              Voltar ao Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full">
        {/* Título e Metadados Técnicos da Bancada */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-4">
          <div>
            <h1 className="text-base font-bold text-zinc-950 uppercase tracking-wide flex items-center gap-2">
              <span>Bancada de Movimentação Física</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Terminal de alta velocidade para entradas, saídas e contagem de inventário com bloqueio pessimista e idempotência RFC 9474.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 shrink-0">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <span>OPERATE MODE // FT-15 & FT-16</span>
          </div>
        </div>

        {/* Integração com o MovementForm protegido por Suspense boundary */}
        <Suspense
          fallback={
            <div className="p-8 text-center text-xs font-mono text-zinc-400 border border-zinc-200">
              Carregando bancada de movimentação...
            </div>
          }
        >
          <MovementForm />
        </Suspense>
      </main>
    </div>
  );
}
