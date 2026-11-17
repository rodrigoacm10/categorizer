"use client";

import React, { useState } from "react";
import { Category } from "../types/category.types";
import { CategoryBadge } from "./CategoryBadge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty,
} from "@/shared/components/Table";
import { Button } from "@/shared/components/Button";
import { Trash2, AlertTriangle, X, Tag } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface CategoryListTableProps {
  categories: Category[];
  isLoading?: boolean;
  canDelete?: boolean;
  onDeleteCategory: (category: Category) => Promise<void>;
  onOpenCreate?: () => void;
}

/**
 * CategoryListTable (FT-11 / Impeccable Workbench):
 * Tabela de alta densidade para listagem e exclusão de categorias N:N.
 * Inclui modal de confirmação com aviso explícito de que os produtos vinculados
 * não serão excluídos nem sofrerão alteração de saldo contábil.
 */
export const CategoryListTable: React.FC<CategoryListTableProps> = ({
  categories,
  isLoading = false,
  canDelete = true,
  onDeleteCategory,
  onOpenCreate,
}) => {
  const [selectedForDelete, setSelectedForDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!selectedForDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);
      await onDeleteCategory(selectedForDelete);
      setSelectedForDelete(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "detail" in err
          ? String((err as { detail: unknown }).detail)
          : "Erro ao excluir categoria do almoxarifado.";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Tabela de Alta Densidade */}
      <Table dense>
        <TableHeader>
          <tr>
            <TableHead className="w-[200px]">Etiqueta / Nome</TableHead>
            <TableHead>Descrição Operacional</TableHead>
            <TableHead className="w-[120px]" numeric>
              Itens Vinculados
            </TableHead>
            <TableHead className="w-[120px] font-mono">Data Cadastro</TableHead>
            {canDelete && <TableHead className="w-[90px] text-right">Ações</TableHead>}
          </tr>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            // Skeleton de Carregamento de Alta Densidade (4 linhas)
            Array.from({ length: 4 }).map((_, idx) => (
              <TableRow key={`skeleton-${idx}`} interactive={false}>
                <TableCell>
                  <div className="h-4 w-32 bg-zinc-200/60 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-56 bg-zinc-200/60 rounded animate-pulse" />
                </TableCell>
                <TableCell numeric>
                  <div className="h-4 w-8 bg-zinc-200/60 rounded animate-pulse ml-auto" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-20 bg-zinc-200/60 rounded animate-pulse" />
                </TableCell>
                {canDelete && (
                  <TableCell align="right">
                    <div className="h-6 w-6 bg-zinc-200/60 rounded animate-pulse ml-auto" />
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : categories.length === 0 ? (
            <TableEmpty
              colSpan={canDelete ? 5 : 4}
              message="Nenhuma categoria cadastrada"
              description="Crie categorias para organizar e filtrar o catálogo físico de produtos deste almoxarifado."
              action={
                onOpenCreate && (
                  <Button
                    type="button"
                    variant="solid"
                    size="xs"
                    onClick={onOpenCreate}
                    leftIcon={<Tag className="w-3.5 h-3.5" />}
                  >
                    Nova Categoria
                  </Button>
                )
              }
            />
          ) : (
            categories.map((category) => (
              <TableRow key={category.id}>
                {/* Etiqueta / Nome com Badge Industrial */}
                <TableCell className="font-medium">
                  <CategoryBadge category={category} size="sm" />
                </TableCell>

                {/* Descrição Operacional */}
                <TableCell className="text-zinc-600">
                  {category.description ? (
                    <span className="truncate block max-w-md" title={category.description}>
                      {category.description}
                    </span>
                  ) : (
                    <span className="text-zinc-400 font-mono text-[11px]">—</span>
                  )}
                </TableCell>

                {/* Quantidade de Produtos */}
                <TableCell numeric className="font-mono text-zinc-800">
                  {category.products_count !== undefined ? category.products_count : "—"}
                </TableCell>

                {/* Data de Cadastro */}
                <TableCell className="font-mono text-[11px] text-zinc-500">
                  {formatDate(category.created_at)}
                </TableCell>

                {/* Ação de Exclusão */}
                {canDelete && (
                  <TableCell align="right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedForDelete(category);
                        setDeleteError(null);
                      }}
                      title={`Excluir categoria ${category.name}`}
                      aria-label={`Excluir categoria ${category.name}`}
                      className={cn(
                        "p-1.5 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Modal de Confirmação de Exclusão (Workbench Style) */}
      {selectedForDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-category-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded flex flex-col select-none antialiased">
            {/* Cabeçalho */}
            <div className="h-11 px-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <h3
                  id="confirm-delete-category-title"
                  className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900"
                >
                  Confirmar Exclusão de Categoria
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedForDelete(null)}
                disabled={isDeleting}
                aria-label="Fechar confirmação"
                className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/60 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo com Alerta Mandatório */}
            <div className="p-4 space-y-3">
              {deleteError && (
                <div
                  role="alert"
                  className="p-3 border border-rose-200 bg-rose-50 text-rose-800 text-xs rounded"
                >
                  {deleteError}
                </div>
              )}

              <p className="text-xs text-zinc-700">
                Tem certeza de que deseja remover a categoria{" "}
                <strong className="text-zinc-950 font-semibold font-mono">
                  &quot;{selectedForDelete.name}&quot;
                </strong>
                ?
              </p>

              {/* Box de Invariante de Domínio */}
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Aviso de Desassociação de Produtos</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Os produtos vinculados a esta categoria <strong>NÃO</strong> serão apagados do
                  sistema nem sofrerão qualquer alteração em seus saldos de estoque. Apenas a
                  etiqueta de categoria será desvinculada.
                </p>
              </div>
            </div>

            {/* Ações */}
            <div className="px-4 py-3 border-t border-zinc-200 bg-zinc-50/50 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedForDelete(null)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isDeleting}
                onClick={handleConfirmDelete}
                data-testid="confirm-delete-category-button"
              >
                Excluir Categoria
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

CategoryListTable.displayName = "CategoryListTable";
