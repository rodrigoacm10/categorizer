"use client";

import React from "react";
import Link from "next/link";
import { Product } from "../types/product.types";
import { CategoryBadge } from "@/features/categories/components/CategoryBadge";
import { StockStatusBadge } from "./StockStatusBadge";
import { formatQuantity } from "@/shared/utils/formatters";
import { Button } from "@/shared/components/Button";
import { ArrowLeft, ArrowRightLeft, Boxes, Hash, AlertOctagon } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface ProductDetailHeaderProps {
  product: Product;
}

/**
 * ProductDetailHeader (FT-14 / Impeccable Workbench):
 * Cabeçalho unificado da ficha do produto com destaque tipográfico do saldo contábil atual.
 * Apresenta nome, badges de categorias N:N, identificador SKU/UUID, badge semântico e saldo físico em 24px monoespaçado.
 */
export const ProductDetailHeader: React.FC<ProductDetailHeaderProps> = ({
  product,
}) => {
  const isInactive = !product.is_active;

  const formattedBalance =
    typeof product.current_quantity === "number" || typeof product.current_quantity === "string"
      ? formatQuantity(product.current_quantity)
      : "0";

  const formattedMinStock =
    product.min_stock !== null && product.min_stock !== undefined
      ? formatQuantity(product.min_stock)
      : "—";

  return (
    <header
      className="border-b border-zinc-200 bg-white p-4 sm:p-6 font-sans select-none"
      data-testid="product-detail-header"
    >
      {/* Barra de Navegação Rápida Superior */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-4">
        <Link href="/products">
          <Button
            variant="ghost"
            size="xs"
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            data-testid="back-to-catalog-link"
          >
            Voltar ao Catálogo
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          {product.is_active ? (
            <Link href={`/inventory/move?product_id=${product.id}`}>
              <Button
                variant="outline"
                size="xs"
                leftIcon={<ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />}
                data-testid="new-movement-button"
              >
                Nova Movimentação
              </Button>
            </Link>
          ) : (
            <span className="text-[11px] font-mono text-zinc-400 border border-zinc-200 px-2 py-0.5 rounded bg-zinc-50">
              Item Descontinuado (Movimentações Bloqueadas)
            </span>
          )}
        </div>
      </div>

      {/* Conteúdo Principal do Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Lado Esquerdo: Identificação do Item */}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="text-lg sm:text-xl font-bold text-zinc-950 tracking-tight truncate max-w-xl"
              title={product.name}
              data-testid="product-detail-name"
            >
              {product.name}
            </h1>

            {/* Badge Semântico de Status de Estoque */}
            <StockStatusBadge
              isActive={product.is_active}
              isLowStock={product.is_low_stock}
              currentQuantity={product.current_quantity}
              minStock={product.min_stock}
              size="sm"
            />

            {isInactive && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                <AlertOctagon className="w-3 h-3" />
                Desativado
              </span>
            )}
          </div>

          {/* SKU / Identificador UUID e Unidade */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 font-mono">
            <div className="flex items-center gap-1" title="Identificador Único do Produto">
              <Hash className="w-3.5 h-3.5 text-zinc-400" />
              <span data-testid="product-detail-id">{product.id}</span>
            </div>
            <span className="text-zinc-300">•</span>
            <div>
              UOM: <span className="font-semibold text-zinc-700">{product.unit}</span>
            </div>
          </div>

          {/* Descrição Técnica */}
          {product.description && (
            <p
              className="text-xs text-zinc-600 line-clamp-2 max-w-2xl leading-relaxed"
              data-testid="product-detail-description"
            >
              {product.description}
            </p>
          )}

          {/* Categorias Vinculadas */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1" data-testid="product-detail-categories">
            {product.categories && product.categories.length > 0 ? (
              product.categories.map((cat) => (
                <CategoryBadge key={cat.id} category={cat} size="sm" />
              ))
            ) : (
              <span className="text-[11px] text-zinc-400 italic">Sem categorias vinculadas</span>
            )}
          </div>
        </div>

        {/* Lado Direito: Destaque Tipográfico do Saldo Contábil */}
        <div
          className={cn(
            "p-3.5 border rounded-none sm:min-w-[220px] shrink-0 text-right md:text-right flex flex-col justify-between shadow-xs",
            isInactive
              ? "bg-zinc-50 border-zinc-200"
              : product.is_low_stock
              ? "bg-amber-50/70 border-amber-200"
              : "bg-zinc-50/70 border-zinc-200"
          )}
          data-testid="current-balance-panel"
        >
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
            Saldo Físico Atual
          </span>

          <div className="my-1">
            <span
              className={cn(
                "text-2xl font-mono tabular-nums font-bold tracking-tight",
                isInactive
                  ? "text-zinc-500"
                  : product.is_low_stock
                  ? "text-amber-900"
                  : "text-zinc-950"
              )}
              data-testid="current-balance-value"
            >
              {formattedBalance}
            </span>
            <span className="ml-1.5 text-xs font-mono font-medium text-zinc-600 uppercase">
              {product.unit}
            </span>
          </div>

          <div className="text-[11px] font-mono text-zinc-500 border-t border-zinc-200/80 pt-1 mt-1">
            <span>Ponto Mínimo: </span>
            <span className="font-semibold text-zinc-700 tabular-nums">
              {formattedMinStock} {product.unit}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

ProductDetailHeader.displayName = "ProductDetailHeader";
