"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Warehouse, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/components";
import { storage } from "@/shared/lib/storage";
import { TenantList } from "@/features/tenants/components/TenantList";
import { CreateTenantModal } from "@/features/tenants/components/CreateTenantModal";

export default function TenantsPage() {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const token = storage.getToken();
    if (!token) {
      router.push("/login");
    } else {
      setIsCheckingAuth(false);
    }
  }, [router]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 font-mono text-xs text-zinc-500">
        Verificando sessão de operador...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 flex flex-col justify-between">
      {/* TopBar do Seletor de Tenants */}
      <header className="h-12 border-b border-zinc-200 bg-white px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center bg-zinc-900 text-white rounded">
            <Warehouse className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-bold tracking-widest text-zinc-950 uppercase">
              EXTENSÃO
            </span>
            <span className="text-zinc-400 font-mono text-[11px]">//</span>
            <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider">
              MULTI-TENANT SELECTOR
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-700" />
          <span>ISOLAMENTO TOTAL DE DADOS</span>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
          <div className="space-y-1">
            <h1 className="text-base font-bold text-zinc-950 font-sans">
              Seus Almoxarifados & Organizações
            </h1>
            <p className="text-xs text-zinc-500">
              Selecione uma unidade operacional para entrar na bancada ou crie um novo almoxarifado.
            </p>
          </div>

          <Button
            variant="solid"
            size="md"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Criar Novo Almoxarifado
          </Button>
        </div>

        {/* Lista de Almoxarifados */}
        <TenantList onCreateTenantClick={() => setIsCreateOpen(true)} />

        {/* Modal de Criação */}
        <CreateTenantModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />
      </main>

      {/* Rodapé Industrial */}
      <footer className="h-10 border-t border-zinc-200 bg-white px-6 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <span>BANCADA OPERACIONAL DE ALMOXARIFADO</span>
        <span>X-TENANT-ID ISOLATION • NEXT.JS 14</span>
      </footer>
    </div>
  );
}
