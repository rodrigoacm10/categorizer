"use client";

import React, { useState } from "react";
import {
  Shield,
  Crown,
  Package,
  Eye,
  Trash2,
  Lock,
  UserCheck,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { TenantMember, TenantRole } from "../types/members.types";
import { ConfirmRemoveMemberModal } from "./ConfirmRemoveMemberModal";
import { cn } from "@/shared/utils/cn";

export interface MemberListTableProps {
  members: TenantMember[];
  isLoading?: boolean;
  canManageMembers: boolean; // Somente OWNER
  ownersCount: number;
  currentUserId?: string;
  onRoleChange: (userId: string, newRole: TenantRole) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
}

export const SOLE_OWNER_TOOLTIP_TEXT =
  "Este é o único Proprietário (OWNER) do almoxarifado. Promova outro membro a OWNER antes de alterar este vínculo.";

const ROLE_STYLES: Record<
  TenantRole,
  {
    bg: string;
    text: string;
    border: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  OWNER: {
    bg: "bg-slate-900",
    text: "text-white",
    border: "border-slate-900",
    icon: Crown,
    label: "Proprietário",
  },
  GESTOR: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: Shield,
    label: "Gestor",
  },
  ALMOXARIFE: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: Package,
    label: "Almoxarife",
  },
  AUDITOR: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    icon: Eye,
    label: "Auditor",
  },
};

/**
 * MemberListTable (FT-19 & FT-20 / Impeccable Workbench):
 * Tabela industrial de alta densidade para governança de membros do almoxarifado.
 * Implementa proteção estrita de Sole Owner (FT-20) e controle de acesso RBAC.
 */
export const MemberListTable: React.FC<MemberListTableProps> = ({
  members,
  isLoading = false,
  canManageMembers,
  ownersCount,
  currentUserId,
  onRoleChange,
  onRemoveMember,
}) => {
  const [selectedMemberToRemove, setSelectedMemberToRemove] =
    useState<TenantMember | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRoleSelect = async (member: TenantMember, newRole: TenantRole) => {
    if (member.role === newRole) return;

    // FT-20: Verificação de segurança de Sole Owner no cliente
    const isSoleOwner = member.role === "OWNER" && ownersCount <= 1;
    if (isSoleOwner) {
      setActionError(SOLE_OWNER_TOOLTIP_TEXT);
      return;
    }

    setUpdatingUserId(member.user_id);
    setActionError(null);
    try {
      await onRoleChange(member.user_id, newRole);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError("Falha ao atualizar papel do membro.");
      }
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!selectedMemberToRemove) return;
    try {
      await onRemoveMember(selectedMemberToRemove.user_id);
      setSelectedMemberToRemove(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError("Falha ao remover membro.");
      }
      throw err;
    }
  };

  const formatDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 font-sans">
      {/* Alerta de erro de operação / Sole Owner */}
      {actionError && (
        <div
          role="alert"
          data-testid="sole-owner-error-banner"
          className="p-3 bg-amber-50 border border-amber-300 rounded text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed font-medium"
        >
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">{actionError}</div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-amber-700 hover:text-amber-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabela de Alta Densidade */}
      <div className="w-full bg-white border border-zinc-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table
            data-testid="member-list-table"
            className="w-full text-left border-collapse text-xs"
          >
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider text-[11px] select-none">
                <th scope="col" className="py-2.5 px-4 w-[40%]">
                  Membro
                </th>
                <th scope="col" className="py-2.5 px-4 w-[25%]">
                  Papel no Almoxarifado
                </th>
                <th scope="col" className="py-2.5 px-4 w-[20%]">
                  Data de Ingresso
                </th>
                <th scope="col" className="py-2.5 px-4 text-right w-[15%]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="py-3 px-4">
                      <div className="h-3.5 bg-zinc-200 rounded w-36 mb-1.5" />
                      <div className="h-3 bg-zinc-100 rounded w-48" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-6 bg-zinc-200 rounded w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-3.5 bg-zinc-100 rounded w-20" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-6 bg-zinc-200 rounded w-8 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : members.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    data-testid="empty-members-row"
                    className="py-12 text-center text-zinc-500 font-sans"
                  >
                    <UserCheck className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="font-medium text-zinc-700">
                      Nenhum membro localizado
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Tente ajustar os filtros ou adicione novos colaboradores à equipe.
                    </p>
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const roleConfig = ROLE_STYLES[member.role];
                  const RoleIcon = roleConfig.icon;
                  const isSoleOwner =
                    member.role === "OWNER" && ownersCount <= 1;
                  const isCurrentUser = member.user_id === currentUserId;
                  const isUpdating = updatingUserId === member.user_id;

                  return (
                    <tr
                      key={member.user_id}
                      data-testid={`member-row-${member.user_id}`}
                      className="hover:bg-zinc-50/70 transition-colors"
                    >
                      {/* Membro: Nome e Email */}
                      <td className="py-2.5 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span
                              data-testid={`member-name-${member.user_id}`}
                              className="font-semibold text-zinc-950"
                            >
                              {member.full_name || "Sem Nome Cadastrado"}
                            </span>
                            {isCurrentUser && (
                              <span
                                data-testid={`badge-current-user-${member.user_id}`}
                                className="px-1.5 py-0.5 text-[10px] bg-zinc-100 text-zinc-600 rounded border border-zinc-200 font-sans"
                              >
                                Você
                              </span>
                            )}
                          </div>
                          <span
                            data-testid={`member-email-${member.user_id}`}
                            className="font-mono text-[11px] text-zinc-500 mt-0.5"
                          >
                            {member.email}
                          </span>
                        </div>
                      </td>

                      {/* Papel RBAC: Dropdown para OWNER, Badge para outros papéis */}
                      <td className="py-2.5 px-4">
                        {canManageMembers ? (
                          <div className="flex items-center gap-1.5">
                            <div className="relative inline-flex items-center">
                              <select
                                data-testid={`role-select-${member.user_id}`}
                                value={member.role}
                                disabled={isSoleOwner || isUpdating}
                                onChange={(e) =>
                                  handleRoleSelect(
                                    member,
                                    e.target.value as TenantRole
                                  )
                                }
                                title={
                                  isSoleOwner
                                    ? SOLE_OWNER_TOOLTIP_TEXT
                                    : "Alterar papel RBAC do membro"
                                }
                                className={cn(
                                  "h-7 px-2.5 pr-7 text-xs font-medium rounded border appearance-none cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1",
                                  isSoleOwner
                                    ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed opacity-75"
                                    : "bg-white text-zinc-900 border-zinc-300 hover:border-zinc-400"
                                )}
                              >
                                <option value="OWNER">Proprietário (OWNER)</option>
                                <option value="GESTOR">Gestor (GESTOR)</option>
                                <option value="ALMOXARIFE">Almoxarife (ALMOXARIFE)</option>
                                <option value="AUDITOR">Auditor (AUDITOR)</option>
                              </select>
                              <div className="pointer-events-none absolute right-2 text-zinc-400 text-[10px]">
                                ▼
                              </div>
                            </div>

                            {/* FT-20: Indicador de Titular Único */}
                            {isSoleOwner && (
                              <div
                                data-testid={`sole-owner-badge-${member.user_id}`}
                                title={SOLE_OWNER_TOOLTIP_TEXT}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-medium"
                              >
                                <Lock className="w-3 h-3 text-amber-600" />
                                <span>Único Titular</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Visualização estática para papéis sem manage_members */
                          <span
                            data-testid={`role-badge-${member.user_id}`}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border",
                              roleConfig.bg,
                              roleConfig.text,
                              roleConfig.border
                            )}
                          >
                            <RoleIcon className="w-3 h-3" />
                            <span>{roleConfig.label}</span>
                          </span>
                        )}
                      </td>

                      {/* Data de Ingresso */}
                      <td className="py-2.5 px-4 font-mono tabular-nums text-zinc-600 text-[11px]">
                        {formatDate(member.joined_at)}
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-4 text-right">
                        {canManageMembers ? (
                          <button
                            type="button"
                            data-testid={`remove-member-btn-${member.user_id}`}
                            disabled={isSoleOwner}
                            onClick={() => setSelectedMemberToRemove(member)}
                            title={
                              isSoleOwner
                                ? SOLE_OWNER_TOOLTIP_TEXT
                                : `Remover ${member.full_name}`
                            }
                            aria-label={`Remover membro ${member.full_name}`}
                            className={cn(
                              "p-1.5 rounded transition-colors inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-1",
                              isSoleOwner
                                ? "text-zinc-300 cursor-not-allowed opacity-50"
                                : "text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                            )}
                          >
                            {isSoleOwner ? (
                              <Lock className="w-3.5 h-3.5 text-zinc-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="text-zinc-400 text-[11px] select-none">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação de Remoção de Membro */}
      <ConfirmRemoveMemberModal
        isOpen={selectedMemberToRemove !== null}
        member={selectedMemberToRemove}
        isSoleOwner={
          selectedMemberToRemove?.role === "OWNER" && ownersCount <= 1
        }
        onClose={() => setSelectedMemberToRemove(null)}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
};
