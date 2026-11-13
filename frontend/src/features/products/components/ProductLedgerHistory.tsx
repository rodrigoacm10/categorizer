"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/features/inventory/services/inventory.api";
import { StockMovement } from "@/features/inventory/types/inventory.types";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { queryKeys } from "@/shared/lib/query-client";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from "@/shared/components/Table";
import { Button } from "@/shared/components/Button";
import { formatQuantity, formatDate } from "@/shared/utils/formatters";
import {
  History,
  Lock,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  Trash2,
  FileText,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface ProductLedgerHistoryProps {
  productId: string;
  productUnit?: string;
}

/**
 * Renderiza o badge semântico de tipo de evento contábil do Livro-Razão.
 */
function MovementTypeBadge({ type }: { type: string }) {
  const normalized = type.toUpperCase();

  switch (normalized) {
    case "IN":
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
          data-testid="movement-type-in"
        >
          <ArrowUpRight className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>ENTRADA (IN)</span>
        </span>
      );
    case "OUT":
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-900 border border-zinc-200"
          data-testid="movement-type-out"
        >
          <ArrowDownRight className="w-3 h-3 text-zinc-600 shrink-0" aria-hidden="true" />
          <span>SAÍDA (OUT)</span>
        </span>
      );
    case "ADJUSTMENT":
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200"
          data-testid="movement-type-adjustment"
        >
          <SlidersHorizontal className="w-3 h-3 text-indigo-600 shrink-0" aria-hidden="true" />
          <span>AJUSTE (Δ)</span>
        </span>
      );
    case "PRODUCT_DELETED":
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 font-mono"
          data-testid="movement-type-deleted"
        >
          <Trash2 className="w-3 h-3 text-zinc-400 shrink-0" aria-hidden="true" />
          <span>INATIVAÇÃO</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 text-zinc-700 border border-zinc-200">
          {type}
        </span>
      );
  }
}

/**
 * Formata o Delta físico com sinal explícito obrigatório (+ ou -) e estilo de bancada.
 */
function renderDelta(movement: StockMovement, unit: string) {
  const type = movement.type.toUpperCase();
  const rawQty = movement.quantity;
  const numQty =
    typeof rawQty === "number"
      ? rawQty
      : typeof rawQty === "string"
      ? parseFloat(rawQty)
      : 0;

  const formattedNum = formatQuantity(Math.abs(numQty));

  if (type === "IN") {
    return (
      <span className="font-mono tabular-nums font-semibold text-emerald-700" data-testid="delta-value">
        +{formattedNum} {unit}
      </span>
    );
  }

  if (type === "OUT") {
    return (
      <span className="font-mono tabular-nums font-semibold text-zinc-950" data-testid="delta-value">
        -{formattedNum} {unit}
      </span>
    );
  }

  if (type === "ADJUSTMENT") {
    const isPositive = numQty > 0;
    const sign = isPositive ? "+" : numQty < 0 ? "-" : "";
    return (
      <span className="font-mono tabular-nums font-semibold text-indigo-700" data-testid="delta-value">
        {sign}
        {formattedNum} {unit}
      </span>
    );
  }

  return (
    <span className="font-mono tabular-nums text-zinc-500" data-testid="delta-value">
      {formattedNum} {unit}
    </span>
  );
}

/**
 * ProductLedgerHistory (FT-14 / Impeccable Workbench):
 * Extrato individual perpétuo e auditável do Livro-Razão para um SKU específico.
 * 100% somente-leitura, cronológico e append-only.
 */
export const ProductLedgerHistory: React.FC<ProductLedgerHistoryProps> = ({
  productId,
  productUnit = "UN",
}) => {
  const { tenantId } = useTenant();

  const {
    data: movements = [],
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.inventory.ledgerByProduct(tenantId || "", productId),
    queryFn: () => inventoryApi.getProductLedger(productId),
    enabled: !!tenantId && !!productId,
  });

  return (
    <div
      className="space-y-4 font-sans select-none"
      data-testid="product-ledger-history"
    >
      {/* Barra de Controle do Extrato */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-50 border border-zinc-200">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-zinc-600" />
          <span className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
            Extrato Perpétuo do Livro-Razão (Append-Only)
          </span>
          <span className="text-[11px] font-mono text-zinc-500 bg-white border border-zinc-200 px-2 py-0.5 rounded">
            {movements.length} registro{movements.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500" title="Livro contábil imutável">
            <Lock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Imutável / Somente-Leitura</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => refetch()}
            isLoading={isRefetching}
            leftIcon={<RefreshCw className={cn("w-3.5 h-3.5", isRefetching && "animate-spin")} />}
            data-testid="refresh-ledger-button"
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Erro de Carregamento */}
      {error && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Erro ao carregar o extrato do produto: {(error as Error).message}</span>
        </div>
      )}

      {/* Tabela de Alta Densidade do Extrato */}
      <div className="border border-zinc-200 bg-white">
        <Table dense>
          <TableHeader sticky={false}>
            <TableRow interactive={false}>
              <TableHead className="w-[170px]">Data / Hora UTC</TableHead>
              <TableHead className="w-[150px]">Tipo de Evento</TableHead>
              <TableHead numeric className="w-[140px]">
                Delta Físico
              </TableHead>
              <TableHead numeric className="w-[150px]">
                Saldo Resultante
              </TableHead>
              <TableHead>Justificativa / Documento</TableHead>
              <TableHead className="w-[200px]">Chave de Idempotência</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx} interactive={false}>
                  <TableCell>
                    <div className="h-3.5 w-28 bg-zinc-200/60 rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 bg-zinc-200/60 rounded animate-pulse" />
                  </TableCell>
                  <TableCell numeric>
                    <div className="h-3.5 w-16 bg-zinc-200/60 rounded animate-pulse ml-auto" />
                  </TableCell>
                  <TableCell numeric>
                    <div className="h-3.5 w-16 bg-zinc-200/60 rounded animate-pulse ml-auto" />
                  </TableCell>
                  <TableCell>
                    <div className="h-3.5 w-40 bg-zinc-200/60 rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-3.5 w-32 bg-zinc-200/60 rounded animate-pulse" />
                  </TableCell>
                </TableRow>
              ))
            ) : movements.length === 0 ? (
              <TableEmpty
                colSpan={6}
                message="Nenhuma movimentação registrada no Livro-Razão"
                description="Os lançamentos de entrada, saída ou ajuste que incidirem sobre este produto aparecerão aqui de forma cronológica e permanente."
              />
            ) : (
              movements.map((movement) => {
                const effectiveUnit = movement.product_unit || productUnit;
                const formattedBalanceAfter = formatQuantity(movement.balance_after);

                return (
                  <TableRow
                    key={movement.id}
                    className="h-9 transition-colors"
                    data-testid={`ledger-row-${movement.id}`}
                  >
                    {/* Data / Hora Formatada */}
                    <TableCell className="font-mono text-xs text-zinc-600 whitespace-nowrap">
                      {formatDate(movement.created_at)}
                    </TableCell>

                    {/* Tipo de Evento (Badge Semântico) */}
                    <TableCell>
                      <MovementTypeBadge type={movement.type} />
                    </TableCell>

                    {/* Delta com Sinal Explícito */}
                    <TableCell numeric className="text-xs">
                      {renderDelta(movement, effectiveUnit)}
                    </TableCell>

                    {/* Saldo Resultante */}
                    <TableCell
                      numeric
                      className="font-mono tabular-nums text-xs font-bold text-zinc-950"
                      data-testid="balance-after-value"
                    >
                      {formattedBalanceAfter} {effectiveUnit}
                    </TableCell>

                    {/* Motivo / Documento */}
                    <TableCell className="text-xs text-zinc-700 max-w-[280px]">
                      {movement.reason ? (
                        <div className="flex items-center gap-1.5 truncate" title={movement.reason}>
                          <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
                          <span className="truncate">{movement.reason}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 font-mono text-[11px]">—</span>
                      )}
                    </TableCell>

                    {/* Chave de Idempotência */}
                    <TableCell className="font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                      {movement.idempotency_key ? (
                        <div
                          className="flex items-center gap-1 max-w-[190px] truncate"
                          title={`Chave de Idempotência: ${movement.idempotency_key}`}
                          data-testid="idempotency-key"
                        >
                          <KeyRound className="w-3 h-3 text-zinc-400 shrink-0" aria-hidden="true" />
                          <span className="truncate">{movement.idempotency_key}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

ProductLedgerHistory.displayName = "ProductLedgerHistory";
