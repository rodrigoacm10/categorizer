"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { TenantMember } from "../types/members.types";
import { Button } from "@/shared/components/Button";

export interface ConfirmRemoveMemberModalProps {
  isOpen: boolean;
  member: TenantMember | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSoleOwner?: boolean;
}

/**
 * ConfirmRemoveMemberModal (FT-19 & FT-20 / Impeccable Workbench):
 * Modal de confirmação para remoção de vínculo de membro do almoxarifado.
 * Impede estritamente a remoção caso o alvo seja o único OWNER.
 */
export const ConfirmRemoveMemberModal: React.FC<ConfirmRemoveMemberModalProps> = ({
  isOpen,
  member,
  onClose,
  onConfirm,
  isSoleOwner = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsLoading(false);
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

  if (!isOpen || !member) return null;

  const handleConfirm = async () => {
    if (isSoleOwner) return;
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro inesperado ao remover membro.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-remove-modal-title"
      data-testid="confirm-remove-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs"
    >
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded shadow-lg overflow-hidden flex flex-col font-sans text-xs">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50/50">
          <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <h2 id="confirm-remove-modal-title">Desvincular Membro</h2>
          </div>
          <button
            type="button"
            data-testid="close-remove-modal"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 focus:outline-none rounded p-1"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {isSoleOwner ? (
            <div
              data-testid="sole-owner-block-alert"
              className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 leading-relaxed font-medium"
            >
              <strong>Ação Bloqueada:</strong> Este é o único Proprietário (OWNER) do
              almoxarifado. Promova outro membro a OWNER antes de remover este vínculo.
            </div>
          ) : (
            <p className="text-zinc-700 leading-relaxed">
              Tem certeza que deseja remover o vínculo de{" "}
              <strong className="text-zinc-950">{member.full_name}</strong> (
              <span className="font-mono">{member.email}</span>) deste almoxarifado?
              O usuário perderá o acesso a todos os registros de catálogo e estoque.
            </p>
          )}

          {error && (
            <div
              data-testid="remove-member-error"
              className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 font-medium"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              data-testid="cancel-remove-button"
            >
              Cancelar
            </Button>
            {!isSoleOwner && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleConfirm}
                isLoading={isLoading}
                data-testid="confirm-remove-button"
              >
                Remover Membro
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
