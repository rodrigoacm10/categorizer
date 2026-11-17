"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Barcode,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { inventoryApi } from "../services/inventory.api";
import { MovementType, StockMovement } from "../types/inventory.types";
import { Product } from "@/features/products/types/product.types";
import { useStockSimulation } from "../hooks/useStockSimulation";
import { BalancePreview } from "./BalancePreview";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { generateUUID } from "@/shared/lib/api-client";
import { queryKeys } from "@/shared/lib/query-client";
import { formatScaledQuantity } from "@/shared/utils/scale";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/shared/components/Button";
import { ProblemDetailsError } from "@/shared/types/rfc7807.types";

export interface MovementFormProps {
  initialProductId?: string;
  onSuccess?: (movement: StockMovement) => void;
  className?: string;
}

/**
 * Bancada Operacional de Movimentação Física (FT-15 & FT-16).
 * Interface de alta densidade no modo OPERATE com suporte a leitor USB de código de barras,
 * abas de Entrada, Saída e Ajuste, pré-visualização contábil em tempo real e chave de idempotência RFC 9474.
 */
export function MovementForm({
  initialProductId,
  onSuccess,
  className,
}: MovementFormProps) {
  const searchParams = useSearchParams();
  const queryParamProductId = searchParams?.get("product_id") || initialProductId;

  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { can, role } = useRBAC();

  // Estados de Busca e Leitor de Código de Barras
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Aba Operacional Ativa (IN | OUT | ADJUSTMENT)
  const [activeTab, setActiveTab] = useState<MovementType>("IN");

  // Campos do Formulário
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  // Estados de Submissão e Idempotência
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isReplay, setIsReplay] = useState(false);

  // Referência para refocalização contínua do leitor USB
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Hook de simulação contábil em tempo real (FT-18)
  const simulation = useStockSimulation({
    currentQuantity: selectedProduct?.current_quantity,
    movementType: activeTab,
    quantityInput: quantity,
    targetProduct: selectedProduct,
    unit: selectedProduct?.unit,
  });

  // Carregamento automático via query param ?product_id=...
  useEffect(() => {
    if (queryParamProductId && !selectedProduct) {
      handleLookup(queryParamProductId);
    }
  }, [queryParamProductId]);

  const handleLookup = async (codeToSearch: string) => {
    const trimmed = codeToSearch.trim();
    if (!trimmed) return;

    setIsSearchingProduct(true);
    setSearchError(null);
    setSubmitError(null);
    setSuccessMessage(null);
    setIsReplay(false);

    try {
      const product = await inventoryApi.lookupProduct(trimmed);
      setSelectedProduct(product);
      setBarcodeInput("");
      setQuantity("");
      setReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Produto não encontrado";
      setSearchError(msg);
      setSelectedProduct(null);
    } finally {
      setIsSearchingProduct(false);
    }
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLookup(barcodeInput);
    }
  };

  const handleClearSelectedProduct = () => {
    setSelectedProduct(null);
    setBarcodeInput("");
    setQuantity("");
    setReason("");
    setSearchError(null);
    setSubmitError(null);
    setSuccessMessage(null);
    setIsReplay(false);
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  // Permissões RBAC por aba
  const canStockIn = can("stock_in");
  const canStockOut = can("stock_out");
  const canStockAdjustment = can("stock_adjustment"); // AUDITOR permitido

  const isCurrentTabDisabled =
    (activeTab === "IN" && !canStockIn) ||
    (activeTab === "OUT" && !canStockOut) ||
    (activeTab === "ADJUSTMENT" && !canStockAdjustment);

  // Validação do botão de submissão
  const isSubmitDisabled = (() => {
    if (!selectedProduct || isSubmitting || isCurrentTabDisabled || !simulation.isValid) {
      return true;
    }

    if (activeTab === "OUT") {
      // Bloqueio mandatório no cliente contra saldo negativo
      if (simulation.isNegative) return true;
      if (!reason.trim()) return true;
    }

    if (activeTab === "ADJUSTMENT") {
      // Justificativa obrigatória (mínimo 5 caracteres)
      if (reason.trim().length < 5) return true;
    }

    return false;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled || !selectedProduct) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    setIsReplay(false);

    const idempotencyKey = generateUUID();

    try {
      let movement: StockMovement;

      if (activeTab === "IN") {
        movement = await inventoryApi.registerStockIn(
          {
            product_id: selectedProduct.id,
            quantity: quantity.trim(),
            reason: reason.trim() || undefined,
          },
          idempotencyKey
        );
      } else if (activeTab === "OUT") {
        movement = await inventoryApi.registerStockOut(
          {
            product_id: selectedProduct.id,
            quantity: quantity.trim(),
            reason: reason.trim(),
          },
          idempotencyKey
        );
      } else {
        movement = await inventoryApi.registerStockAdjustment(
          {
            product_id: selectedProduct.id,
            quantity: quantity.trim(),
            reason: reason.trim(),
          },
          idempotencyKey
        );
      }

      // Sinaliza replay se resposta veio do cache de idempotência
      if (movement.is_replay) {
        setIsReplay(true);
      }

      setSuccessMessage(
        `Movimentação física de ${activeTab} registrada com sucesso no Livro-Razão.`
      );

      // Invalida caches do TanStack Query
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.all(tenantId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(tenantId, selectedProduct.id),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventory.movements(tenantId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventory.ledgerByProduct(tenantId, selectedProduct.id),
        });
      }

      // Atualiza saldo local imediatamente com a resposta contábil
      if (movement.balance_after_scaled !== undefined) {
        setSelectedProduct((prev) =>
          prev
            ? {
                ...prev,
                current_quantity: movement.balance_after,
                current_quantity_scaled: movement.balance_after_scaled,
              }
            : null
        );
      }

      // Limpa os campos de quantidade e justificativa
      setQuantity("");
      setReason("");

      if (onSuccess) {
        onSuccess(movement);
      }

      // Refocaliza o cursor no campo de código de barras para o próximo item
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    } catch (err: unknown) {
      if (err instanceof ProblemDetailsError) {
        if (
          err.detail?.toLowerCase().includes("insufficient") ||
          err.type?.includes("insufficient-stock")
        ) {
          setSubmitError(
            "Saldo físico insuficiente no galpão para atender a saída solicitada."
          );
        } else {
          setSubmitError(err.detail || err.title || "Erro ao processar movimentação.");
        }
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Falha na comunicação com o servidor de inventário.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="movement-form-workbench"
      className={cn(
        "border border-zinc-200 bg-white rounded-none sm:rounded-sm shadow-none",
        className
      )}
    >
      {/* 1. SEÇÃO DE LEITURA USB E BUSCA DE PRODUTO */}
      <div className="p-4 sm:p-5 border-b border-zinc-200 bg-zinc-50/60">
        <label
          htmlFor="barcode-search-input"
          className="block text-xs font-semibold text-zinc-700 tracking-wide mb-1.5"
        >
          Leitor de Código de Barras / Busca de Produto
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Barcode className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              ref={barcodeInputRef}
              id="barcode-search-input"
              data-testid="barcode-search-input"
              type="text"
              autoFocus
              disabled={isSearchingProduct}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeKeyDown}
              placeholder="Aponte o leitor USB ou digite o código e pressione Enter..."
              className={cn(
                "w-full h-10 pl-9 pr-3 rounded-none sm:rounded-sm border bg-white text-sm font-mono transition-colors",
                "border-zinc-300 placeholder:text-zinc-400 placeholder:font-sans",
                "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
                searchError && "border-rose-500 focus:border-rose-600 focus:ring-rose-600"
              )}
            />
          </div>
          <Button
            type="button"
            variant="solid"
            size="md"
            isLoading={isSearchingProduct}
            onClick={() => handleLookup(barcodeInput)}
            disabled={!barcodeInput.trim() || isSearchingProduct}
            className="rounded-none sm:rounded-sm shrink-0"
          >
            <Search className="w-4 h-4 mr-1.5" />
            <span>Buscar</span>
          </Button>
        </div>

        {searchError && (
          <p
            data-testid="search-error-message"
            className="mt-2 text-xs font-medium text-rose-600 flex items-center gap-1.5"
          >
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{searchError}</span>
          </p>
        )}
      </div>

      {/* 2. CARD COMPACTO DO PRODUTO SELECIONADO */}
      {selectedProduct ? (
        <div
          data-testid="selected-product-card"
          className="p-4 sm:p-5 border-b border-zinc-200 bg-white"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 bg-zinc-100 text-zinc-700 border border-zinc-200">
                  Unidade: {selectedProduct.unit}
                </span>
                <span className="text-xs text-zinc-500">
                  {selectedProduct.categories?.map((c) => c.name).join(", ") ||
                    "Geral"}
                </span>
              </div>
              <h3 className="text-base font-semibold text-zinc-950 mt-1">
                {selectedProduct.name}
              </h3>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Saldo Físico Atual
                </span>
                <span
                  data-testid="selected-product-balance"
                  className="font-mono tabular-nums text-lg font-bold text-zinc-950"
                >
                  {formatScaledQuantity(
                    selectedProduct.current_quantity_scaled,
                    selectedProduct.unit
                  )}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleClearSelectedProduct}
                className="rounded-none sm:rounded-sm text-zinc-600"
              >
                Trocar Item
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-zinc-50/30 border-b border-zinc-200">
          <Barcode className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-zinc-600">
            Nenhum produto selecionado na bancada.
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Dispare o leitor USB de código de barras ou pesquise o código acima para iniciar a movimentação.
          </p>
        </div>
      )}

      {/* 3. ABAS OPERACIONAIS (IN | OUT | ADJUSTMENT) */}
      <div className="border-b border-zinc-200 bg-zinc-50 flex items-center select-none overflow-x-auto">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "IN"}
          onClick={() => {
            setActiveTab("IN");
            setSubmitError(null);
          }}
          className={cn(
            "h-10 px-4 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors",
            activeTab === "IN"
              ? "border-emerald-600 text-emerald-950 font-bold bg-white"
              : "border-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/60"
          )}
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
          <span>Entrada (+)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "OUT"}
          onClick={() => {
            setActiveTab("OUT");
            setSubmitError(null);
          }}
          className={cn(
            "h-10 px-4 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors",
            activeTab === "OUT"
              ? "border-zinc-950 text-zinc-950 font-bold bg-white"
              : "border-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/60"
          )}
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-700" />
          <span>Saída (-)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ADJUSTMENT"}
          onClick={() => {
            setActiveTab("ADJUSTMENT");
            setSubmitError(null);
          }}
          className={cn(
            "h-10 px-4 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors",
            activeTab === "ADJUSTMENT"
              ? "border-indigo-600 text-indigo-950 font-bold bg-white"
              : "border-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/60"
          )}
        >
          <Sliders className="w-3.5 h-3.5 text-indigo-600" />
          <span>Ajuste Físico (Δ)</span>
        </button>
      </div>

      {/* 4. FORMULÁRIO OPERACIONAL */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
        {/* AVISO DE PERMISSÃO AUDITOR SE DESABILITADO */}
        {isCurrentTabDisabled && (
          <div
            role="alert"
            data-testid="permission-warning-banner"
            className="border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 rounded-none sm:rounded-sm flex items-start gap-2.5"
          >
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Permissão Insuficiente ({role})</span>
              <span>
                {activeTab === "IN"
                  ? "O perfil AUDITOR possui acesso somente-leitura e não tem autorização para registrar entradas físicas."
                  : "O perfil AUDITOR possui acesso somente-leitura e não tem autorização para registrar saídas físicas."}
              </span>
            </div>
          </div>
        )}

        {/* FEEDBACK DE REPLAY / CACHE HIT (IDEMPOTÊNCIA) */}
        {isReplay && (
          <div
            data-testid="replay-badge"
            className="border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 flex items-center gap-2 rounded-none sm:rounded-sm font-mono"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            <span>Operação Reexecutada (Resposta idêntica obtida do cache de idempotência X-Cache: HIT).</span>
          </div>
        )}

        {/* FEEDBACK DE SUCESSO */}
        {successMessage && (
          <div
            role="status"
            data-testid="success-alert"
            className="border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 flex items-center gap-2 rounded-none sm:rounded-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* FEEDBACK DE ERRO RFC 7807 */}
        {submitError && (
          <div
            role="alert"
            data-testid="submit-error-alert"
            className="border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs text-rose-900 flex items-center gap-2 rounded-none sm:rounded-sm"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* CAMPO DE QUANTIDADE */}
        <div>
          <label
            htmlFor="movement-quantity-input"
            className="block text-xs font-semibold text-zinc-700 tracking-wide mb-1.5"
          >
            {activeTab === "IN"
              ? "Quantidade a Entrar (> 0)"
              : activeTab === "OUT"
              ? "Quantidade a Sair (> 0)"
              : "Nova Quantidade Contada no Galpão (≥ 0)"}
            <span className="text-rose-600 ml-1">*</span>
          </label>
          <div className="relative">
            <input
              id="movement-quantity-input"
              data-testid="movement-quantity-input"
              type="text"
              inputMode="decimal"
              disabled={isCurrentTabDisabled || !selectedProduct || isSubmitting}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0,000"
              className={cn(
                "w-full h-10 px-3 text-right font-mono tabular-nums text-base border rounded-none sm:rounded-sm transition-colors",
                "border-zinc-300 bg-white placeholder:text-zinc-400",
                "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
                "disabled:bg-zinc-50 disabled:text-zinc-400 disabled:border-zinc-200 disabled:cursor-not-allowed",
                selectedProduct?.unit ? "pr-14" : ""
              )}
            />
            {selectedProduct?.unit && (
              <span className="absolute right-3 inset-y-0 flex items-center pointer-events-none text-xs font-mono font-medium text-zinc-500">
                {selectedProduct.unit}
              </span>
            )}
          </div>
        </div>

        {/* PRÉ-VISUALIZAÇÃO CONTÁBIL EM TEMPO REAL (FT-18) */}
        {selectedProduct && (
          <BalancePreview
            currentQuantity={selectedProduct.current_quantity}
            movementType={activeTab}
            quantityInput={quantity}
            targetProduct={selectedProduct}
            unit={selectedProduct.unit}
            simulation={simulation}
          />
        )}

        {/* CAMPO DE JUSTIFICATIVA / DOCUMENTO */}
        <div>
          <label
            htmlFor="movement-reason-input"
            className="block text-xs font-semibold text-zinc-700 tracking-wide mb-1.5"
          >
            {activeTab === "IN"
              ? "Justificativa / Documento / Nota Fiscal"
              : activeTab === "OUT"
              ? "Justificativa / Requisição / Ordem de Serviço"
              : "Justificativa Contábil do Ajuste (Mínimo 5 caracteres)"}
            {activeTab !== "IN" && <span className="text-rose-600 ml-1">*</span>}
          </label>
          <input
            id="movement-reason-input"
            data-testid="movement-reason-input"
            type="text"
            disabled={isCurrentTabDisabled || !selectedProduct || isSubmitting}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              activeTab === "IN"
                ? "Ex: Recebimento NF-e 45892 - Fornecedor Soldas Brasil"
                : activeTab === "OUT"
                ? "Ex: Requisição OS-1029 Manutenção Caldeiraria"
                : "Ex: Contagem de inventário físico periódico Galpão B"
            }
            className={cn(
              "w-full h-9 px-3 border rounded-none sm:rounded-sm text-xs transition-colors",
              "border-zinc-300 bg-white placeholder:text-zinc-400",
              "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
              "disabled:bg-zinc-50 disabled:text-zinc-400 disabled:border-zinc-200 disabled:cursor-not-allowed"
            )}
          />
        </div>

        {/* BOTÃO DE CONFIRMAÇÃO DA OPERAÇÃO */}
        <div className="pt-2">
          <Button
            type="submit"
            data-testid="submit-movement-button"
            variant={activeTab === "OUT" ? "danger" : "solid"}
            size="md"
            isLoading={isSubmitting}
            disabled={isSubmitDisabled}
            className="w-full rounded-none sm:rounded-sm font-mono tracking-wider uppercase text-xs h-10"
          >
            {activeTab === "IN" && "Confirmar Entrada (+)"}
            {activeTab === "OUT" && "Confirmar Saída (-)"}
            {activeTab === "ADJUSTMENT" &&
              `Registrar Ajuste (${simulation.formattedDelta})`}
          </Button>
        </div>
      </form>
    </div>
  );
}
