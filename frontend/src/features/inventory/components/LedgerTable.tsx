"use client";

import React, { useState } from "react";
import { StockMovement } from "../types/inventory.types";
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
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  Trash2,
  FileText,
  KeyRound,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface LedgerTableProps {
  movements: StockMovement[];
  isLoading?: boolean;
  totalCount?: number;
  limit?: number;
  offset?: number;
  onPageChange?: (newOffset: number) => void;
  onLimitChange?: (newLimit: number) => void;
  className?: string;
}

/**
 * Renderiza o badge semântico de tipo de evento contábil do Livro-Razão (Modo OPERATE):
 * - IN: verde (bg-emerald-50 text-emerald-800 border-emerald-200)
 * - OUT: neutro (bg-zinc-100 text-zinc-900 border-zinc-200)
 * - ADJUSTMENT: anil/azul (bg-indigo-50 text-indigo-800 border-indigo-200)
 * - PRODUCT_DELETED: rose/vermelho (bg-rose-50 text-rose-800 border-rose-200)
 */
function MovementTypeBadge({ type }: { type: string }) {
  const normalized = (type || "").toUpperCase();

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
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200"
          data-testid="movement-type-deleted"
        >
          <Trash2 className="w-3 h-3 text-rose-600 shrink-0" aria-hidden="true" />
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
 * Formata o Delta contábil com sinal explícito obrigatório (+ ou -) e estilo de bancada tabular-nums.
 */
function renderDelta(movement: StockMovement, unit: string) {
  const type = (movement.type || "").toUpperCase();
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

  if (type === "PRODUCT_DELETED") {
    return (
      <span className="font-mono tabular-nums font-semibold text-rose-700" data-testid="delta-value">
        -{formattedNum} {unit}
      </span>
    );
  }

  return (
    <span className="font-mono tabular-nums text-zinc-600" data-testid="delta-value">
      {formattedNum} {unit}
    </span>
  );
}

/**
 * Componente compacto para exibição e cópia da chave de idempotência RFC 9474.
 */
function IdempotencyKeyCell({ idempotencyKey }: { idempotencyKey?: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!idempotencyKey) {
    return <span className="text-zinc-400 font-mono text-[11px]">—</span>;
  }

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(idempotencyKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 max-w-[190px]"
      title={`Chave de Idempotência: ${idempotencyKey}`}
      data-testid="idempotency-key"
    >
      <KeyRound className="w-3 h-3 text-zinc-400 shrink-0" aria-hidden="true" />
      <span className="truncate">{idempotencyKey}</span>
      <button
        type="button"
        onClick={handleCopy}
        title="Copiar chave de idempotência"
        aria-label={`Copiar chave de idempotência ${idempotencyKey}`}
        className="p-0.5 text-zinc-400 hover:text-zinc-900 rounded transition-colors focus:outline-none"
      >
        {copied ? (
          <Check className="w-3 h-3 text-emerald-600" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}

/**
 * LedgerTable (FT-17 / Impeccable Workbench):
 * Tabela do Livro-Razão Contábil Geral no modo OPERATE de altíssima densidade:
 * - 100% somente-leitura (ZERO botões de exclusão ou edição)
 * - 7 colunas contábeis auditáveis
 * - Sinal explícito obrigatório (+/-) e font-mono tabular-nums
 * - Paginação compacta no rodapé com botões de navegação e seletor de limite
 */
export const LedgerTable: React.FC<LedgerTableProps> = ({
  movements,
  isLoading = false,
  totalCount = movements.length,
  limit = 25,
  offset = 0,
  onPageChange,
  onLimitChange,
  className,
}) => {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const hasPrevious = offset > 0;
  const hasNext = offset + limit < totalCount;

  const startRecord = totalCount === 0 ? 0 : offset + 1;
  const endRecord = Math.min(offset + limit, totalCount);

  return (
    <div className={cn("w-full space-y-2 select-none", className)} data-testid="ledger-table-container">
      {/* Tabela de Alta Densidade */}
      <div className="w-full overflow-hidden border border-zinc-200 rounded bg-white">
        <Table dense className="border-0">
          <TableHeader sticky={false}>
            <TableRow interactive={false} className="h-9">
              <TableHead className="w-[170px]">Data / Hora UTC</TableHead>
              <TableHead className="w-[230px]">Produto</TableHead>
              <TableHead className="w-[160px]">Tipo de Evento</TableHead>
              <TableHead numeric className="w-[140px]">
                Quantidade / Delta
              </TableHead>
              <TableHead numeric className="w-[140px]">
                Saldo Resultante
              </TableHead>
              <TableHead>Motivo / Justificativa</TableHead>
              <TableHead className="w-[190px]">Chave de Idempotência</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              // Skeleton industrial de alta densidade (36px por linha)
              Array.from({ length: 6 }).map((_, idx) => (
                <TableRow key={`skeleton-ledger-${idx}`} interactive={false} className="h-9">
                  <TableCell>
                    <div className="h-3.5 w-28 bg-zinc-200/60 rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-3.5 w-36 bg-zinc-200/60 rounded animate-pulse" />
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
                    <div className="h-3.5 w-28 bg-zinc-200/60 rounded animate-pulse" />
                  </TableCell>
                </TableRow>
              ))
            ) : movements.length === 0 ? (
              <TableEmpty
                colSpan={7}
                message="Nenhuma movimentação registrada no Livro-Razão"
                description="O extrato contábil perpétuo exibirá aqui todos os lançamentos imutáveis registrados no almoxarifado."
              />
            ) : (
              movements.map((movement) => {
                const effectiveUnit = movement.product_unit || "UN";
                const productName = movement.product_name || "Produto não identificado";
                const formattedBalance = formatQuantity(movement.balance_after);

                return (
                  <TableRow
                    key={movement.id}
                    className="h-9 transition-colors"
                    data-testid={`ledger-row-${movement.id}`}
                  >
                    {/* 1. Data/Hora UTC formatada */}
                    <TableCell className="font-mono text-xs text-zinc-600 whitespace-nowrap">
                      {formatDate(movement.created_at)}
                    </TableCell>

                    {/* 2. Produto (nome + unidade) */}
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        <span
                          className="font-medium text-zinc-950 truncate max-w-[210px]"
                          title={productName}
                          data-testid="product-name"
                        >
                          {productName}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {effectiveUnit}
                        </span>
                      </div>
                    </TableCell>

                    {/* 3. Tipo de Evento (Badge Semântico) */}
                    <TableCell>
                      <MovementTypeBadge type={movement.type} />
                    </TableCell>

                    {/* 4. Quantidade / Delta com sinal explícito */}
                    <TableCell numeric className="text-xs">
                      {renderDelta(movement, effectiveUnit)}
                    </TableCell>

                    {/* 5. Saldo Pós-Movimentação */}
                    <TableCell
                      numeric
                      className="font-mono tabular-nums text-xs font-bold text-zinc-950"
                      data-testid="balance-after-value"
                    >
                      {formattedBalance} {effectiveUnit}
                    </TableCell>

                    {/* 6. Motivo / Justificativa */}
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

                    {/* 7. Chave de Idempotência */}
                    <TableCell className="whitespace-nowrap">
                      <IdempotencyKeyCell idempotencyKey={movement.idempotency_key} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação Compacta no Rodapé */}
      <div
        className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-600 font-mono"
        data-testid="ledger-pagination"
      >
        {/* Contador de Registros */}
        <div className="flex items-center gap-2" data-testid="record-counter">
          <span>
            Exibindo{" "}
            <span className="text-zinc-950 font-semibold">
              {startRecord}-{endRecord}
            </span>{" "}
            de <span className="text-zinc-950 font-semibold">{totalCount}</span> lançamentos
          </span>
        </div>

        {/* Controles de Navegação e Limite */}
        <div className="flex items-center gap-3">
          {/* Seletor de Limite */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500">Linhas:</span>
            <label htmlFor="ledger-limit-select" className="sr-only">
              Linhas por página
            </label>
            <select
              id="ledger-limit-select"
              value={limit}
              onChange={(e) => onLimitChange?.(Number(e.target.value))}
              aria-label="Linhas por página"
              className={cn(
                "h-7 px-2 bg-white border border-zinc-300 text-zinc-900 rounded text-xs font-mono",
                "focus:outline-none focus:border-zinc-950 cursor-pointer"
              )}
              data-testid="limit-select"
            >
              <option value={25}>25 / pág</option>
              <option value={50}>50 / pág</option>
              <option value={100}>100 / pág</option>
            </select>
          </div>

          <div className="h-3.5 w-px bg-zinc-300" aria-hidden="true" />

          {/* Indicador de Páginas e Botões */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 mr-1" data-testid="page-indicator">
              Página {currentPage} de {totalPages}
            </span>

            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onPageChange?.(Math.max(0, offset - limit))}
              disabled={!hasPrevious || isLoading}
              aria-label="Página Anterior"
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              data-testid="prev-page-button"
            >
              Anterior
            </Button>

            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onPageChange?.(offset + limit)}
              disabled={!hasNext || isLoading}
              aria-label="Próxima Página"
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              data-testid="next-page-button"
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

LedgerTable.displayName = "LedgerTable";
