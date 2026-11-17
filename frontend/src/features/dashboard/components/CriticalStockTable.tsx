"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownToLine,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from "@/shared/components/Table";
import { Badge } from "@/shared/components/Badge";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { productsApi } from "@/features/products/services/products.api";
import { Product } from "@/features/products/types/product.types";
import { TenantRole } from "@/shared/types/rbac.types";
import { formatScaledQuantity } from "@/shared/utils/scale";
import { cn } from "@/shared/utils/cn";

export interface CriticalStockTableProps {
  items?: Product[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  roleOverride?: TenantRole | null;
  className?: string;
}

export const CriticalStockTable: React.FC<CriticalStockTableProps> = ({
  items: propItems,
  isLoading: propIsLoading,
  isError: propIsError,
  onRetry: propOnRetry,
  roleOverride,
  className,
}) => {
  const { tenantId } = useTenant();
  const { can } = useRBAC(roleOverride);
  const canStockIn = can("stock_in");

  const query = useQuery<Product[]>({
    queryKey: ["products", "critical-stock", tenantId],
    queryFn: () => productsApi.list({ low_stock_only: true }),
    enabled: Boolean(tenantId) && propItems === undefined,
    staleTime: 10 * 1000,
  });

  const isLoading =
    propIsLoading !== undefined
      ? propIsLoading
      : propItems !== undefined
      ? false
      : query.isLoading;

  const isError =
    propIsError !== undefined
      ? propIsError
      : propItems !== undefined
      ? false
      : query.isError;
  const items = propItems !== undefined ? propItems : query.data || [];
  const handleRetry = propOnRetry || (() => query.refetch());

  return (
    <div className={cn("border border-zinc-200 bg-white flex flex-col", className)}>
      {/* Cabeçalho da Seção de Alertas Críticos */}
      <div className="h-10 px-4 border-b border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />
          <h2 className="text-xs font-mono font-semibold tracking-wider text-zinc-950 uppercase">
            Alertas Críticos de Reposição
          </h2>
          <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
            // Itens com saldo igual ou abaixo do estoque mínimo
          </span>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span
              data-testid="critical-items-count"
              className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200"
            >
              {items.length} {items.length === 1 ? "item crítico" : "itens críticos"}
            </span>
          )}
        </div>
      </div>

      {/* Conteúdo da Tabela */}
      {isError ? (
        <div className="p-6 text-center space-y-3 font-mono text-xs">
          <p className="text-rose-700">
            Falha ao carregar a lista de produtos com estoque crítico.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-sans transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tentar novamente</span>
          </button>
        </div>
      ) : (
        <Table dense>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="w-16 text-center">Unidade</TableHead>
              <TableHead numeric className="w-28 text-right">
                Saldo Atual
              </TableHead>
              <TableHead numeric className="w-28 text-right">
                Estoque Mínimo
              </TableHead>
              <TableHead className="w-32 text-center">Status</TableHead>
              <TableHead className="w-28 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              // Skeletons de Alta Densidade
              [1, 2, 3].map((i) => (
                <TableRow key={i} interactive={false}>
                  <TableCell>
                    <div className="h-4 w-44 bg-zinc-200/80 rounded animate-pulse" />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="h-4 w-8 bg-zinc-200/80 rounded animate-pulse mx-auto" />
                  </TableCell>
                  <TableCell numeric>
                    <div className="h-4 w-14 bg-zinc-200/80 rounded animate-pulse ml-auto" />
                  </TableCell>
                  <TableCell numeric>
                    <div className="h-4 w-14 bg-zinc-200/80 rounded animate-pulse ml-auto" />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="h-4 w-20 bg-zinc-200/80 rounded animate-pulse mx-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-6 w-16 bg-zinc-200/80 rounded animate-pulse ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableEmpty
                colSpan={6}
                message="Nenhum item com estoque crítico"
                description="Todos os saldos físicos estão rigorosamente em conformidade com o estoque mínimo cadastrado."
              />
            ) : (
              items.map((product) => {
                const isZeroStock =
                  product.current_quantity_scaled === 0 ||
                  Number(product.current_quantity) === 0;

                const formattedCurrent =
                  typeof product.current_quantity_scaled === "number"
                    ? formatScaledQuantity(product.current_quantity_scaled)
                    : String(product.current_quantity);

                const formattedMin =
                  product.min_stock_scaled !== null &&
                  product.min_stock_scaled !== undefined
                    ? formatScaledQuantity(product.min_stock_scaled)
                    : product.min_stock !== null && product.min_stock !== undefined
                    ? String(product.min_stock)
                    : "-";

                return (
                  <TableRow
                    key={product.id}
                    data-testid={`critical-product-row-${product.id}`}
                    className={isZeroStock ? "bg-rose-50/20" : undefined}
                  >
                    {/* Produto e Categorias */}
                    <TableCell>
                      <div className="flex flex-col">
                        <Link
                          href={`/products/${product.id}`}
                          className="font-medium text-zinc-950 hover:underline hover:text-blue-600 transition-colors"
                        >
                          {product.name}
                        </Link>
                        {product.description && (
                          <span className="text-[11px] text-zinc-500 truncate max-w-sm">
                            {product.description}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Unidade */}
                    <TableCell className="text-center font-mono text-xs text-zinc-600">
                      {product.unit}
                    </TableCell>

                    {/* Saldo Atual */}
                    <TableCell
                      numeric
                      className={cn(
                        "font-mono font-bold tabular-nums text-xs",
                        isZeroStock ? "text-rose-700" : "text-amber-700"
                      )}
                    >
                      {formattedCurrent}
                    </TableCell>

                    {/* Estoque Mínimo */}
                    <TableCell numeric className="font-mono text-zinc-600 tabular-nums text-xs">
                      {formattedMin}
                    </TableCell>

                    {/* Status (Badge Crítico ou Zerado) */}
                    <TableCell className="text-center">
                      {isZeroStock ? (
                        <Badge
                          variant="out-of-stock"
                          size="sm"
                          showDot={true}
                          aria-label="Status: Zerado"
                        >
                          Zerado
                        </Badge>
                      ) : (
                        <Badge
                          variant="low-stock"
                          size="sm"
                          showDot={true}
                          aria-label="Status: Estoque Baixo"
                        >
                          Estoque Baixo
                        </Badge>
                      )}
                    </TableCell>

                    {/* Ação Rápida de Entrada (Repor) */}
                    <TableCell className="text-right">
                      {canStockIn ? (
                        <Link
                          href={`/inventory/move?mode=IN&product_id=${product.id}`}
                          aria-label={`Repor ${product.name}`}
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors",
                            "bg-zinc-900 text-white hover:bg-zinc-800 shadow-2xs",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                          )}
                        >
                          <ArrowDownToLine className="w-3 h-3 text-emerald-400" />
                          <span>Repor</span>
                        </Link>
                      ) : (
                        <span
                          title="Papel AUDITOR não tem permissão para repor estoque"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed opacity-60"
                        >
                          <ArrowDownToLine className="w-3 h-3 text-zinc-400" />
                          <span>Repor</span>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

CriticalStockTable.displayName = "CriticalStockTable";
