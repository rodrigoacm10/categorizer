"use client";

import React, { useState, useEffect, useRef } from "react";
import { Product } from "../types/product.types";
import { productsApi } from "../services/products.api";
import { X, AlertTriangle, FileText, Ban } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { cn } from "@/shared/utils/cn";

export interface DeactivateProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: Product, message: string) => void;
}

/**
 * DeactivateProductModal (FT-12 / Soft-Delete):
 * Modal industrial para desativação de produto com lançamento contábil obrigatório.
 * Regra Inegociável: Nunca realiza exclusão física.
 * Exige justificativa com no mínimo 5 caracteres e registra evento contábil (PRODUCT_DELETED) no Livro-Razão.
 */
export const DeactivateProductModal: React.FC<DeactivateProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError(null);
      setIsLoading(false);

      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedReason = reason.trim();

    if (!trimmedReason || trimmedReason.length < 5) {
      setError("A justificativa é obrigatória e deve conter no mínimo 5 caracteres.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const res = await productsApi.delete(product.id, trimmedReason);
      onSuccess(product, res?.message || "Produto desativado com sucesso.");
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "detail" in err
          ? String((err as { detail: unknown }).detail)
          : "Erro ao inativar o produto no almoxarifado.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-product-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded flex flex-col select-none antialiased">
        {/* Cabeçalho da Bancada */}
        <div className="h-12 px-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-700">
            <Ban className="w-4 h-4 shrink-0" aria-hidden="true" />
            <h3
              id="deactivate-product-modal-title"
              className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900"
            >
              Inativar Produto // Soft-Delete Contábil
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Fechar modal"
            className={cn(
              "p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/60 rounded transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário com Alerta de Domínio */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 border border-rose-200 bg-rose-50 text-rose-800 text-xs rounded"
            >
              {error}
            </div>
          )}

          {/* Dados do Produto */}
          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-zinc-900">{product.name}</span>
              <span className="font-mono text-xs text-zinc-600 font-medium">
                {product.unit}
              </span>
            </div>
            {product.description && (
              <p className="text-[11px] text-zinc-500 truncate">{product.description}</p>
            )}
            <div className="pt-1 text-[11px] font-mono text-zinc-600 flex items-center gap-3">
              <span>
                SALDO ATUAL:{" "}
                <strong className="text-zinc-950">{product.current_quantity}</strong>
              </span>
              <span>|</span>
              <span>
                MÍNIMO:{" "}
                <strong className="text-zinc-950">{product.min_stock ?? "—"}</strong>
              </span>
            </div>
          </div>

          {/* Box de Invariante Contábil do Livro-Razão */}
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Registro de Evento Contábil Permanente</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Esta ação <strong>NÃO</strong> exclui fisicamente o produto do banco de dados. O
              item será marcado como inativo no catálogo e um evento imutável{" "}
              <code className="font-mono font-bold bg-amber-100 px-1 py-0.25 rounded text-amber-900">
                PRODUCT_DELETED
              </code>{" "}
              será gravado no Livro-Razão perpétuo do almoxarifado.
            </p>
          </div>

          {/* Campo Justificativa Obrigatória */}
          <div className="space-y-1">
            <label
              htmlFor="deactivate-reason-input"
              className="block text-xs font-mono uppercase tracking-wider text-zinc-700"
            >
              Justificativa Operacional <span className="text-rose-600">*</span>
            </label>
            <textarea
              ref={textareaRef}
              id="deactivate-reason-input"
              required
              rows={3}
              minLength={5}
              placeholder="Informe o motivo da descontinuação (ex: Descontinuado pelo fabricante, item obsoleto substituído pelo código X, laudo de avaria total...)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              className={cn(
                "w-full p-2.5 text-xs bg-white text-zinc-950 border border-zinc-300 rounded",
                "placeholder:text-zinc-400 transition-colors resize-none",
                "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
                "disabled:bg-zinc-100 disabled:text-zinc-500"
              )}
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
              <span>Mínimo de 5 caracteres</span>
              <span>{reason.trim().length} caracteres</span>
            </div>
          </div>

          {/* Rodapé de Ações */}
          <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isLoading}
              data-testid="confirm-deactivate-product-button"
            >
              Inativar Produto
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

DeactivateProductModal.displayName = "DeactivateProductModal";
