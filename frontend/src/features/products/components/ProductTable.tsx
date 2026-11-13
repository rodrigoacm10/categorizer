"use client";

import React from "react";
import Link from "next/link";
import { Product } from "../types/product.types";
import { CategoryBadge } from "@/features/categories/components/CategoryBadge";
import { StockStatusBadge } from "./StockStatusBadge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty,
} from "@/shared/components/Table";
import { formatScaledQuantity } from "@/shared/utils/scale";
import { Button } from "@/shared/components/Button";
import { FileText, ArrowLeftRight, Ban, Plus } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface ProductTableProps {
  products: Product[];
  isLoading?: boolean;
  canDeactivate?: boolean;
  onDeactivateProduct?: (product: Product) => void;
  onOpenCreate?: () => void;
}

/**
 * ProductTable (FT-12 / Impeccable Workbench):
 * Tabela de altíssima densidade para o catálogo físico:
 * - Cabeçalho sticky fixo
 * - Linhas com altura enxuta de 36px (h-9)
 * - Números e saldos alinhados à direita em font-mono tabular-nums
 * - Badges semânticos de status (stock-ok, stock-low, stock-empty, stock-inactive)
 * - Controles de ação com RBAC (inativação oculta para operadores e auditores)
 */
export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  isLoading = false,
  canDeactivate = true,
  onDeactivateProduct,
  onOpenCreate,
}) => {
  const formatQuantity = (product: Product): string => {
    if (product.formatted_quantity) return product.formatted_quantity;
    if (product.current_quantity_scaled !== undefined) {
      return formatScaledQuantity(product.current_quantity_scaled, product.unit);
    }
    const val = Number(product.current_quantity ?? 0);
    return `${val.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${product.unit}`;
  };

  const formatMinStock = (product: Product): string => {
    if (product.min_stock === null || product.min_stock === undefined) return "—";
    if (product.min_stock_scaled !== undefined && product.min_stock_scaled !== null) {
      return formatScaledQuantity(product.min_stock_scaled, product.unit);
    }
    const val = Number(product.min_stock);
    return `${val.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${product.unit}`;
  };

  return (
    <div className="w-full overflow-hidden border border-zinc-200 rounded bg-white">
      <Table dense className="border-0">
        <TableHeader sticky>
          <tr className="h-9">
            <TableHead className="w-[280px]">Produto / Especificação</TableHead>
            <TableHead className="w-[180px]">Categorias</TableHead>
            <TableHead className="w-[70px] text-center font-mono">UOM</TableHead>
            <TableHead className="w-[130px]" numeric>
              Saldo Atual
            </TableHead>
            <TableHead className="w-[130px]" numeric>
              Estoque Mínimo
            </TableHead>
            <TableHead className="w-[130px] text-center">Status</TableHead>
            <TableHead className="w-[110px] text-right">Ações</TableHead>
          </tr>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            // Skeleton de Carregamento de Alta Densidade (linhas de 36px)
            Array.from({ length: 6 }).map((_, idx) => (
              <TableRow key={`skeleton-prod-${idx}`} interactive={false} className="h-9">
                <TableCell>
                  <div className="h-3.5 w-44 bg-zinc-200/60 rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-3.5 w-24 bg-zinc-200/60 rounded animate-pulse" />
                </TableCell>
                <TableCell align="center">
                  <div className="h-3.5 w-8 bg-zinc-200/60 rounded animate-pulse mx-auto" />
                </TableCell>
                <TableCell numeric>
                  <div className="h-3.5 w-16 bg-zinc-200/60 rounded animate-pulse ml-auto" />
                </TableCell>
                <TableCell numeric>
                  <div className="h-3.5 w-16 bg-zinc-200/60 rounded animate-pulse ml-auto" />
                </TableCell>
                <TableCell align="center">
                  <div className="h-3.5 w-20 bg-zinc-200/60 rounded animate-pulse mx-auto" />
                </TableCell>
                <TableCell align="right">
                  <div className="h-5 w-14 bg-zinc-200/60 rounded animate-pulse ml-auto" />
                </TableCell>
              </TableRow>
            ))
          ) : products.length === 0 ? (
            <TableEmpty
              colSpan={7}
              message="Nenhum produto cadastrado no catálogo"
              description="Cadastre novos produtos físicos no almoxarifado para iniciar a gestão contábil de estoque."
              action={
                onOpenCreate && (
                  <Button
                    type="button"
                    variant="solid"
                    size="xs"
                    onClick={onOpenCreate}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Novo Produto
                  </Button>
                )
              }
            />
          ) : (
            products.map((product) => {
              const hasCategories = product.categories && product.categories.length > 0;
              const isInactive = !product.is_active;

              return (
                <TableRow
                  key={product.id}
                  className={cn("h-9 transition-colors", isInactive && "bg-zinc-50/50 opacity-75")}
                  data-testid={`product-row-${product.id}`}
                >
                  {/* Nome e Descrição Técnica */}
                  <TableCell className="py-1">
                    <div className="flex flex-col">
                      <Link
                        href={`/products/${product.id}`}
                        className="font-medium text-xs text-zinc-950 hover:text-blue-600 truncate block max-w-[260px] focus:outline-none focus:underline"
                        title={product.name}
                      >
                        {product.name}
                      </Link>
                      {product.description && (
                        <span
                          className="text-[10px] text-zinc-500 truncate max-w-[260px]"
                          title={product.description}
                        >
                          {product.description}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Categorias N:N */}
                  <TableCell className="py-1">
                    {hasCategories ? (
                      <div className="flex flex-wrap items-center gap-1 max-w-[170px] overflow-hidden">
                        {product.categories.slice(0, 2).map((cat) => (
                          <CategoryBadge key={cat.id} category={cat} size="xs" />
                        ))}
                        {product.categories.length > 2 && (
                          <span
                            className="text-[10px] font-mono text-zinc-500 bg-zinc-100 border border-zinc-200 rounded px-1"
                            title={product.categories
                              .slice(2)
                              .map((c) => c.name)
                              .join(", ")}
                          >
                            +{product.categories.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-400 font-mono text-[11px]">—</span>
                    )}
                  </TableCell>

                  {/* Unidade de Medida */}
                  <TableCell align="center" className="py-1 font-mono text-xs text-zinc-700">
                    {product.unit}
                  </TableCell>

                  {/* Saldo Físico Atual */}
                  <TableCell
                    numeric
                    className="py-1 font-mono tabular-nums text-xs font-semibold text-zinc-950"
                  >
                    {formatQuantity(product)}
                  </TableCell>

                  {/* Ponto Mínimo de Reposição */}
                  <TableCell
                    numeric
                    className="py-1 font-mono tabular-nums text-xs text-zinc-600"
                  >
                    {formatMinStock(product)}
                  </TableCell>

                  {/* Badge Semântico de Status */}
                  <TableCell align="center" className="py-1">
                    <StockStatusBadge
                      isActive={product.is_active}
                      isLowStock={product.is_low_stock}
                      currentQuantity={product.current_quantity}
                      minStock={product.min_stock}
                      size="xs"
                    />
                  </TableCell>

                  {/* Ações da Bancada */}
                  <TableCell align="right" className="py-1">
                    <div className="flex items-center justify-end gap-1">
                      {/* Ficha do Produto */}
                      <Link
                        href={`/products/${product.id}`}
                        title="Ver Ficha e Histórico do Ledger"
                        aria-label={`Ver Ficha e Histórico de ${product.name}`}
                        className={cn(
                          "p-1 rounded text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Link>

                      {/* Movimentar Saldo */}
                      <Link
                        href={`/inventory/move?product_id=${product.id}`}
                        title="Registrar Movimentação Física"
                        aria-label={`Registrar Movimentação Física para ${product.name}`}
                        className={cn(
                          "p-1 rounded text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950"
                        )}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </Link>

                      {/* Inativação (Soft-Delete) - Oculta para ALMOXARIFE e AUDITOR */}
                      {canDeactivate && product.is_active && onDeactivateProduct && (
                        <button
                          type="button"
                          onClick={() => onDeactivateProduct(product)}
                          title="Inativar produto (Soft-Delete)"
                          aria-label={`Inativar produto ${product.name}`}
                          className={cn(
                            "p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500"
                          )}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

ProductTable.displayName = "ProductTable";
