"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Warehouse,
  ArrowRight,
  ShieldCheck,
  Activity,
  Layers,
  History,
  Plus,
} from "lucide-react";
import { Button, RoleBadge } from "@/shared/components";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { storage } from "@/shared/lib/storage";

export default function DashboardPage() {
  const router = useRouter();
  const { tenantId, role } = useTenant();

  useEffect(() => {
    const token = storage.getToken();
    if (!token) {
      router.push("/login");
    } else if (!tenantId) {
      router.push("/tenants");
    }
  }, [router, tenantId]);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 flex flex-col justify-between">
      {/* TopBar Industrial da Bancada */}
      <header className="h-12 border-b border-zinc-200 bg-white px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center bg-zinc-900 text-white rounded">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-bold tracking-widest text-zinc-950 uppercase">
              EXTENSÃO
            </span>
            <span className="text-zinc-400 font-mono text-[11px]">//</span>
            <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider">
              BANCADA OPERACIONAL
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {role && <RoleBadge role={role} />}
          <Link
            href="/tenants"
            className="text-xs font-mono text-zinc-600 hover:text-zinc-950 underline"
          >
            Trocar Almoxarifado
          </Link>
        </div>
      </header>

      {/* Faixa Linear de Status */}
      <div className="border-b border-zinc-200 bg-zinc-100/60 px-6 py-2 flex items-center justify-between font-mono text-xs text-zinc-600">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>ALMOXARIFADO ATIVO:</span>
          <span className="font-bold text-zinc-900">{tenantId || "Nenhum"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>ESCALA FIXA: 10³</span>
          <span className="text-zinc-300">|</span>
          <span>LIVRO-RAZÃO ATIVO</span>
        </div>
      </div>

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div className="border border-zinc-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-zinc-900 text-white rounded">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-950 font-sans">
                Bancada Industrial do Almoxarifado
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                Contexto multi-tenant ativo via cabeçalho X-Tenant-ID.
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-700 leading-relaxed">
            Bem-vindo ao terminal de operações de estoque. Aqui você gerencia o catálogo técnico de SKUs,
            executa movimentações físicas de entrada e saída com idempotência estrita (RFC 9474) e audita o extrato contábil perpétuo do livro-razão.
          </p>

          <div className="pt-4 border-t border-zinc-100 flex flex-wrap gap-3">
            <Link href="/workbench">
              <Button variant="solid" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                Acessar Demonstração da Bancada
              </Button>
            </Link>
            <Link href="/tenants">
              <Button variant="outline" size="sm">
                Voltar à Seleção de Almoxarifados
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Rodapé Industrial */}
      <footer className="h-10 border-t border-zinc-200 bg-white px-6 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <span>ESTOQUE & LIVRO-RAZÃO MULTI-TENANT</span>
        <span>SESSÃO AUTENTICADA</span>
      </footer>
    </div>
  );
}
