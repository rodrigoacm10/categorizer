"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, ShieldAlert, RefreshCw, CheckCircle2 } from "lucide-react";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { membersApi } from "@/features/settings/services/members.api";
import {
  TenantMember,
  TenantMembersSummary,
  TenantRole,
} from "@/features/settings/types/members.types";
import { MemberKPIStrip } from "@/features/settings/components/MemberKPIStrip";
import { MemberFilters } from "@/features/settings/components/MemberFilters";
import { MemberListTable } from "@/features/settings/components/MemberListTable";
import { InviteMemberModal } from "@/features/settings/components/InviteMemberModal";
import { Button } from "@/shared/components/Button";

/**
 * MembersSettingsPage (FT-19 & FT-20 / Impeccable Workbench):
 * Página de governança de equipe e papéis do almoxarifado em /settings/members.
 * Acesso concedido a OWNER e GESTOR (view_members). Alteração e exclusão exclusivas para OWNER (manage_members).
 */
export default function MembersSettingsPage() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { can } = useRBAC();

  const [summary, setSummary] = useState<TenantMembersSummary | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<TenantRole | undefined>(undefined);

  // Modais
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);

  const canView = can("view_members");
  const canInvite = can("invite_member");
  const canManage = can("manage_members");

  const loadSummary = useCallback(async () => {
    if (!tenantId || !canView) return;
    try {
      const summaryData = await membersApi.getMembersSummary(tenantId);
      setSummary(summaryData);
    } catch (_err: unknown) {
      // Ignora erro no resumo caso a chamada falhe isoladamente
    }
  }, [tenantId, canView]);

  const loadMembers = useCallback(
    async (isManualRefresh = false) => {
      if (!tenantId || !canView) return;

      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const listData = await membersApi.listMembers(tenantId, {
          search: search.trim() || undefined,
          role: selectedRole,
          limit: 100,
          offset: 0,
        });

        setMembers(listData.items);
        setTotalCount(listData.totalCount);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Falha ao carregar lista de membros do almoxarifado.");
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [tenantId, canView, search, selectedRole]
  );

  const loadData = useCallback(
    async (isManualRefresh = false) => {
      await Promise.all([loadSummary(), loadMembers(isManualRefresh)]);
    },
    [loadSummary, loadMembers]
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRoleChange = async (userId: string, newRole: TenantRole) => {
    if (!tenantId) return;
    await membersApi.updateMemberRole(tenantId, userId, { role: newRole });
    setFeedbackMessage("Papel do membro atualizado com sucesso.");
    await loadData(true);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!tenantId) return;
    await membersApi.removeMember(tenantId, userId);
    setFeedbackMessage("Membro removido do almoxarifado.");
    await loadData(true);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleInviteSuccess = async (_newMember: TenantMember) => {
    setFeedbackMessage("Novo membro adicionado com sucesso à equipe.");
    await loadData(true);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // RBAC Barrier: Apenas OWNER e GESTOR têm permissão de visualizar membros
  if (!canView) {
    return (
      <div
        data-testid="members-access-denied"
        className="w-full max-w-7xl mx-auto p-6 font-sans text-xs"
      >
        <div className="bg-white border border-zinc-200 rounded p-8 text-center flex flex-col items-center justify-center">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-full mb-3 text-amber-700">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-base font-semibold text-zinc-950 mb-1">
            Acesso Restrito à Governança
          </h2>
          <p className="text-zinc-600 max-w-md leading-relaxed mb-4">
            A gestão de equipe e concessão de papéis é restrita aos papéis de{" "}
            <strong className="text-zinc-900">Proprietário (OWNER)</strong> e{" "}
            <strong className="text-zinc-900">Gestor (GESTOR)</strong>. Seu papel atual no
            almoxarifado não possui a permissão <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded">view_members</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="members-settings-page"
      className="w-full max-w-7xl mx-auto p-4 sm:p-6 flex flex-col gap-5 font-sans text-xs"
    >
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-900 shrink-0" />
            <h1 className="text-lg font-bold text-zinc-950 tracking-tight">
              Gestão de Equipe e Membros
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Governança de acessos, papéis RBAC e segurança de titularidade do almoxarifado
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            data-testid="refresh-members-button"
          >
            Atualizar
          </Button>

          {canInvite && (
            <Button
              type="button"
              variant="solid"
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              data-testid="invite-member-button"
            >
              Convidar Membro
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Banner de Sucesso */}
      {feedbackMessage && (
        <div
          role="status"
          data-testid="feedback-success-banner"
          className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs flex items-center justify-between font-medium"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Erro de Carga Geral */}
      {error && (
        <div
          role="alert"
          data-testid="members-page-error-banner"
          className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-center justify-between font-medium"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-700 hover:text-rose-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Faixa Contínua de KPIs de Membros */}
      <MemberKPIStrip summary={summary} isLoading={isLoading} />

      {/* Barra de Filtros Reativos */}
      <MemberFilters
        search={search}
        onSearchChange={setSearch}
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        onReset={() => {
          setSearch("");
          setSelectedRole(undefined);
        }}
        totalFiltered={totalCount}
      />

      {/* Tabela de Membros com Proteção de Sole Owner */}
      <MemberListTable
        members={members}
        isLoading={isLoading}
        canManageMembers={canManage}
        ownersCount={summary?.owners_count ?? 1}
        currentUserId={user?.id}
        onRoleChange={handleRoleChange}
        onRemoveMember={handleRemoveMember}
      />

      {/* Modal de Convite de Membro */}
      {tenantId && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          tenantId={tenantId}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  );
}
