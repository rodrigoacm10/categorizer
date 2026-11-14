import { useMemo } from "react";
import {
  toScaledInt,
  fromScaledInt,
  formatScaledQuantity,
  formatDeltaQuantity,
} from "@/shared/utils/scale";
import { MovementType } from "../types/inventory.types";
import { Product } from "@/features/products/types/product.types";

export interface UseStockSimulationParams {
  currentQuantity?: number | string | null;
  movementType: MovementType | string;
  quantityInput?: number | string | null;
  targetProduct?: Product | null;
  unit?: string;
}

export interface UseStockSimulationReturn {
  projectedBalance: number;
  projectedBalanceRaw: number;
  delta: number;
  deltaRaw: number;
  isNegative: boolean;
  isValid: boolean;
  formattedDelta: string;
  formattedProjectedBalance: string;
  formattedCurrentBalance: string;
}

/**
 * Hook de Simulação de Saldo em Tempo Real (FT-18).
 * Elimina imprecisões IEEE 754 utilizando inteiros escalados (10^3) e
 * projeta o impacto contábil de entradas, saídas e ajustes antes da gravação.
 */
export function useStockSimulation(
  paramsOrCurrentQuantity: UseStockSimulationParams | number | string | null | undefined,
  movementTypeArg?: MovementType | string,
  quantityInputArg?: number | string | null | undefined,
  targetProductArg?: Product | null
): UseStockSimulationReturn {
  // Normalização de parâmetros (suporte a objeto de configuração ou argumentos posicionais)
  const normalizedParams: UseStockSimulationParams = useMemo(() => {
    if (
      typeof paramsOrCurrentQuantity === "object" &&
      paramsOrCurrentQuantity !== null &&
      !("toFixed" in paramsOrCurrentQuantity)
    ) {
      return paramsOrCurrentQuantity as UseStockSimulationParams;
    }
    return {
      currentQuantity:
        typeof paramsOrCurrentQuantity === "number" || typeof paramsOrCurrentQuantity === "string"
          ? paramsOrCurrentQuantity
          : undefined,
      movementType: movementTypeArg || "IN",
      quantityInput: quantityInputArg,
      targetProduct: targetProductArg,
      unit: targetProductArg?.unit,
    };
  }, [paramsOrCurrentQuantity, movementTypeArg, quantityInputArg, targetProductArg]);

  const {
    currentQuantity,
    movementType,
    quantityInput,
    targetProduct,
    unit: explicitUnit,
  } = normalizedParams;

  return useMemo(() => {
    const effectiveUnit = explicitUnit || targetProduct?.unit || "";

    // 1. Converte saldo atual para inteiro escalado
    let currentScaled = 0;
    try {
      if (targetProduct?.current_quantity_scaled !== undefined) {
        currentScaled = targetProduct.current_quantity_scaled;
      } else if (currentQuantity !== undefined && currentQuantity !== null) {
        currentScaled = toScaledInt(currentQuantity);
      }
    } catch {
      currentScaled = 0;
    }

    const formattedCurrentBalance = formatScaledQuantity(currentScaled, effectiveUnit);

    // 2. Valida e converte o input de quantidade
    const isInputEmpty =
      quantityInput === null ||
      quantityInput === undefined ||
      (typeof quantityInput === "string" && quantityInput.trim() === "");

    if (isInputEmpty) {
      return {
        projectedBalance: currentScaled,
        projectedBalanceRaw: fromScaledInt(currentScaled),
        delta: 0,
        deltaRaw: 0,
        isNegative: false,
        isValid: false,
        formattedDelta: formatDeltaQuantity(0, effectiveUnit),
        formattedProjectedBalance: formattedCurrentBalance,
        formattedCurrentBalance,
      };
    }

    let inputScaled: number;
    try {
      inputScaled = toScaledInt(quantityInput);
    } catch {
      return {
        projectedBalance: currentScaled,
        projectedBalanceRaw: fromScaledInt(currentScaled),
        delta: 0,
        deltaRaw: 0,
        isNegative: false,
        isValid: false,
        formattedDelta: "-",
        formattedProjectedBalance: formattedCurrentBalance,
        formattedCurrentBalance,
      };
    }

    let projectedBalance = currentScaled;
    let delta = 0;
    let isValid = false;
    let isNegative = false;

    const normalizedType = (movementType || "IN").toUpperCase();

    if (normalizedType === "IN") {
      projectedBalance = currentScaled + inputScaled;
      delta = inputScaled;
      isValid = inputScaled > 0;
      isNegative = false;
    } else if (normalizedType === "OUT") {
      projectedBalance = currentScaled - inputScaled;
      delta = -inputScaled;
      isValid = inputScaled > 0;
      isNegative = projectedBalance < 0;
    } else if (normalizedType === "ADJUSTMENT") {
      projectedBalance = inputScaled;
      delta = inputScaled - currentScaled;
      isValid = inputScaled >= 0;
      isNegative = false;
    }

    const formattedDelta = formatDeltaQuantity(delta, effectiveUnit);
    const formattedProjectedBalance = formatScaledQuantity(projectedBalance, effectiveUnit);

    return {
      projectedBalance,
      projectedBalanceRaw: fromScaledInt(projectedBalance),
      delta,
      deltaRaw: fromScaledInt(delta),
      isNegative,
      isValid,
      formattedDelta,
      formattedProjectedBalance,
      formattedCurrentBalance,
    };
  }, [currentQuantity, movementType, quantityInput, targetProduct, explicitUnit]);
}
