"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, UserPlus, AlertCircle, Shield, Crown, Package, Eye } from "lucide-react";
import { membersApi } from "../services/members.api";
import { TenantMember, TenantRole } from "../types/members.types";
import { Button } from "@/shared/components/Button";
import { ProblemDetailsError } from "@/shared/lib/api-client";
import { cn } from "@/shared/utils/cn";

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (member: TenantMember) => void;
  tenantId: string;
}

const ROLE_DESCRIPTIONS: {
  role: TenantRole;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    role: "ALMOXARIFE",
    label: "Almoxarife",
    icon: Package,
    description: "Operador de campo: registra entradas (IN) e saídas (OUT) físicas.",
  },
  {
    role: "GESTOR",
    label: "Gestor",
    icon: Shield,
    description: "Gestão operacional: cadastra produtos, categorias e convida membros.",
  },
  {
    role: "AUDITOR",
    label: "Auditor",
    icon: Eye,
    description: "Controle e conformidade: executa ajustes físicos e audita o livro-razão.",
  },
  {
    role: "OWNER",
    label: "Proprietário (Owner)",
    icon: Crown,
    description: "Governança plena: acesso irrestrito, troca de papéis e exclusão de membros.",
  },
];

/**
 * InviteMemberModal (FT-19 / Impeccable Workbench):
 * Modal industrial de convite e vinculação de membro ao almoxarifado ativo.
 * Conectado ao endpoint POST /api/tenants/{tenant_id}/members.
 */
export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
}) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TenantRole>("ALMOXARIFE");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setRole("ALMOXARIFE");
      setErrorMessage(null);
      setTimeout(() => emailInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !tenantId) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const newMember = await membersApi.inviteMember(tenantId, {
        email: email.trim().toLowerCase(),
        role,
      });
      onSuccess(newMember);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ProblemDetailsError) {
        setErrorMessage(
          err.problem.detail ||
            err.problem.title ||
            "Não foi possível adicionar o membro ao almoxarifado."
        );
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Erro inesperado de rede ao adicionar membro.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-member-modal-title"
      data-testid="invite-member-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-white border border-zinc-200 rounded shadow-lg overflow-hidden flex flex-col font-sans"
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-zinc-900" />
            <h2
              id="invite-member-modal-title"
              className="text-sm font-semibold text-zinc-950"
            >
              Adicionar Membro à Equipe
            </h2>
          </div>
          <button
            type="button"
            data-testid="close-invite-modal"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-950 rounded p-1"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs">
          {errorMessage && (
            <div
              role="alert"
              data-testid="invite-member-error-banner"
              className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Campo de Email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="member-email"
              className="font-medium text-zinc-800"
            >
              E-mail do Usuário <span className="text-rose-600">*</span>
            </label>
            <input
              id="member-email"
              ref={emailInputRef}
              type="email"
              data-testid="member-email-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: operador@empresa.com"
              className="h-8 px-3 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950"
            />
            <span className="text-[11px] text-zinc-500">
              O usuário deve estar previamente cadastrado na plataforma para ser associado.
            </span>
          </div>

          {/* Seletor de Papel RBAC */}
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-zinc-800">
              Papel Funcional (RBAC) <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {ROLE_DESCRIPTIONS.map((item) => {
                const Icon = item.icon;
                const isSelected = role === item.role;
                return (
                  <label
                    key={item.role}
                    data-testid={`role-option-${item.role}`}
                    className={cn(
                      "flex items-start gap-3 p-2.5 rounded border cursor-pointer transition-colors select-none",
                      isSelected
                        ? "bg-zinc-50 border-zinc-900 ring-1 ring-zinc-900"
                        : "bg-white border-zinc-200 hover:bg-zinc-50/70"
                    )}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={item.role}
                      checked={isSelected}
                      onChange={() => setRole(item.role)}
                      className="mt-0.5 text-zinc-950 focus:ring-zinc-950"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 font-semibold text-zinc-950">
                        <Icon className="w-3.5 h-3.5 text-zinc-600" />
                        <span>{item.label}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-600 font-normal leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Rodapé e Ações */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              data-testid="cancel-invite-button"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="sm"
              isLoading={isLoading}
              data-testid="submit-invite-button"
            >
              Convidar Membro
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
