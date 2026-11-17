"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Warehouse,
  ArrowRight,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button, RoleBadge } from "@/shared/components";
import { useTenant } from "../hooks/useTenant";
import { tenantsApi } from "../services/tenants.api";
import { TenantWithRole } from "../types/tenant.types";

export interface TenantListProps {
  onCreateTenantClick: () => void;
  onSelectTenant?: (tenant: TenantWithRole) => void;
}

export function TenantList({
  onCreateTenantClick,
  onSelectTenant,
}: TenantListProps) {
  const router = useRouter();
  const { tenantId: activeTenantId, setTenant } = useTenant();

  const {
    data: tenants = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => tenantsApi.listTenantsWithRoles(),
  });

  const handleSelect = (tenant: TenantWithRole) => {
    setTenant(tenant.id, tenant.role);
    onSelectTenant?.(tenant);
    router.push("/dashboard");
  };

  if (isLoading) {
    return (
      <div className="space-y-3 font-sans">
        <div className="h-4 w-48 bg-zinc-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="border border-zinc-200 bg-white p-5 space-y-3 animate-pulse"
            >
              <div className="flex justify-between items-center">
                <div className="h-5 w-40 bg-zinc-200 rounded" />
                <div className="h-5 w-16 bg-zinc-200 rounded" />
              </div>
              <div className="h-3 w-28 bg-zinc-100 rounded" />
              <div className="h-4 w-full bg-zinc-100 rounded" />
              <div className="pt-2 border-t border-zinc-100 flex justify-end">
                <div className="h-8 w-32 bg-zinc-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="border border-rose-200 bg-rose-50 p-6 text-center space-y-3 font-sans"
      >
        <AlertTriangle className="h-6 w-6 text-rose-600 mx-auto" />
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-950">
            Falha ao Carregar Almoxarifados
          </h3>
          <p className="text-xs text-rose-700 mt-1">
            {error instanceof Error ? error.message : "Erro desconhecido ao consultar API."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="border border-zinc-200 bg-white p-10 text-center space-y-4 font-sans">
        <div className="flex h-12 w-12 items-center justify-center bg-zinc-100 border border-zinc-200 text-zinc-600 mx-auto rounded">
          <Warehouse className="h-6 w-6" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h3 className="text-xs font-mono font-bold tracking-widest text-zinc-950 uppercase">
            Nenhum almoxarifado vinculado à sua conta
          </h3>
          <p className="text-xs text-zinc-500">
            Crie sua primeira unidade de estoque para começar a operar a bancada e o livro-razão imutável.
          </p>
        </div>
        <div>
          <Button
            variant="solid"
            size="md"
            onClick={onCreateTenantClick}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Criar Primeiro Almoxarifado
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tenants.map((tenant) => {
          const isActive = activeTenantId === tenant.id;

          return (
            <div
              key={tenant.id}
              className={`border bg-white p-5 transition-all flex flex-col justify-between ${
                isActive
                  ? "border-zinc-950 ring-1 ring-zinc-950"
                  : "border-zinc-200 hover:border-zinc-400"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-950 font-sans">
                        {tenant.name}
                      </h3>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold uppercase">
                          <CheckCircle2 className="h-3 w-3" />
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-zinc-500">
                      /{tenant.slug}
                    </p>
                  </div>

                  <RoleBadge role={tenant.role || "ALMOXARIFE"} />
                </div>

                {tenant.description ? (
                  <p className="text-xs text-zinc-600 line-clamp-2 pt-1">
                    {tenant.description}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400 italic pt-1">
                    Sem descrição operacional cadastrada.
                  </p>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between">
                <span className="font-mono text-[11px] text-zinc-400">
                  Criado em: {new Date(tenant.created_at).toLocaleDateString("pt-BR")}
                </span>

                <Button
                  variant={isActive ? "secondary" : "solid"}
                  size="sm"
                  onClick={() => handleSelect(tenant)}
                  rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  {isActive ? "Continuar na Bancada" : "Acessar Bancada"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
