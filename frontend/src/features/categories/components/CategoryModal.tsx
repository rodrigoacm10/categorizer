"use client";

import React, { useState, useEffect, useRef } from "react";
import { categoriesApi } from "../services/categories.api";
import { Category } from "../types/category.types";
import { X, Tag, AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { cn } from "@/shared/utils/cn";

export interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (category: Category) => void;
}

export const INDUSTRIAL_PALETTE = [
  { label: "Azul Industrial", color: "#2563EB" },
  { label: "Aço / Grafite", color: "#475569" },
  { label: "Verde Esmeralda", color: "#16A34A" },
  { label: "Âmbar Operacional", color: "#D97706" },
  { label: "Índigo Técnico", color: "#6366F1" },
  { label: "Zinco Neutro", color: "#52525B" },
  { label: "Ciano", color: "#0891B2" },
  { label: "Rubro Alerta", color: "#DC2626" },
];

/**
 * CategoryModal (FT-11 / Impeccable Workbench):
 * Modal industrial para criação de categoria no escopo do tenant ativo.
 * Painel plano com bordas retas de 1px, acessibilidade completa por teclado (Tab e Escape).
 */
export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(INDUSTRIAL_PALETTE[0].color);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Foco automático e listener de tecla Escape
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setColor(INDUSTRIAL_PALETTE[0].color);
      setError(null);
      setIsLoading(false);

      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("O nome da categoria é obrigatório.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const created = await categoriesApi.create({
        name: trimmedName,
        description: description.trim() || undefined,
        color,
      });

      onSuccess(created);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "detail" in err
          ? String((err as { detail: unknown }).detail)
          : "Erro ao criar categoria no almoxarifado.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div
        ref={modalRef}
        className={cn(
          "w-full max-w-lg bg-white border border-zinc-200 rounded",
          "flex flex-col select-none antialiased"
        )}
      >
        {/* Cabeçalho da Bancada */}
        <div className="h-12 px-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-zinc-900" aria-hidden="true" />
            <h3
              id="category-modal-title"
              className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900"
            >
              Nova Categoria // Catálogo N:N
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className={cn(
              "p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/60 rounded transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 border border-rose-200 bg-rose-50 text-rose-800 text-xs rounded flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Campo: Nome da Categoria */}
          <div className="space-y-1">
            <label
              htmlFor="category-name-input"
              className="block text-xs font-mono uppercase tracking-wider text-zinc-700"
            >
              Nome da Categoria <span className="text-rose-600">*</span>
            </label>
            <input
              ref={nameInputRef}
              id="category-name-input"
              type="text"
              required
              maxLength={100}
              placeholder="Ex: EPIs, Soldagem, Rolamentos, Químicos..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              className={cn(
                "w-full h-9 px-3 text-xs bg-white text-zinc-950 border border-zinc-300 rounded",
                "placeholder:text-zinc-400 transition-colors",
                "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
                "disabled:bg-zinc-100 disabled:text-zinc-500"
              )}
            />
          </div>

          {/* Campo: Descrição */}
          <div className="space-y-1">
            <label
              htmlFor="category-description-input"
              className="block text-xs font-mono uppercase tracking-wider text-zinc-700"
            >
              Descrição Técnica (Opcional)
            </label>
            <textarea
              id="category-description-input"
              rows={2}
              maxLength={255}
              placeholder="Finalidade de agrupamento operacional ou normas aplicáveis..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              className={cn(
                "w-full p-2.5 text-xs bg-white text-zinc-950 border border-zinc-300 rounded",
                "placeholder:text-zinc-400 transition-colors resize-none",
                "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
                "disabled:bg-zinc-100 disabled:text-zinc-500"
              )}
            />
          </div>

          {/* Seletor: Paleta Industrial */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-700">
              Paleta Industrial de Identificação
            </label>
            <div
              role="radiogroup"
              aria-label="Cores industriais"
              className="grid grid-cols-4 sm:grid-cols-8 gap-2"
            >
              {INDUSTRIAL_PALETTE.map((p) => {
                const isSelected = color === p.color;
                return (
                  <button
                    key={p.color}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    title={p.label}
                    onClick={() => setColor(p.color)}
                    disabled={isLoading}
                    className={cn(
                      "h-8 flex items-center justify-center rounded border transition-all",
                      isSelected
                        ? "border-zinc-950 ring-2 ring-zinc-950 ring-offset-1"
                        : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
                    )}
                  >
                    <span
                      className="w-4 h-4 rounded-xs"
                      style={{ backgroundColor: p.color }}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-mono text-zinc-500">Preview:</span>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium"
                style={{
                  backgroundColor: `${color}15`,
                  borderColor: `${color}40`,
                  color: color,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-xs" style={{ backgroundColor: color }} />
                {name.trim() || "Nova Categoria"}
              </span>
            </div>
          </div>

          {/* Barra de Ações do Rodapé */}
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
              variant="solid"
              size="sm"
              isLoading={isLoading}
              data-testid="category-modal-submit-button"
            >
              Salvar Categoria
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

CategoryModal.displayName = "CategoryModal";
