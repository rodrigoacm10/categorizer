/**
 * Utilitário de Escala Fixa (10^3) e Conversão de Precisão.
 * Elimina imprecisões de ponto flutuante IEEE 754 no cálculo de estoques e saldos.
 */

export const SCALE_FACTOR = 1000;

/**
 * Converte valor numérico real ou string (com vírgula ou ponto) para inteiro escalado (x1000).
 * Ex: "2,5" -> 2500; 0.125 -> 125; null/undefined/"" -> 0.
 * Lança erro se o formato for inválido.
 */
export function toScaledInt(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return 0;
    }
    const normalized = trimmed.replace(",", ".");
    const num = Number(normalized);
    if (isNaN(num)) {
      throw new Error(`Valor numérico inválido: ${value}`);
    }
    return Math.round(num * SCALE_FACTOR);
  }

  if (typeof value === "number") {
    if (isNaN(value)) {
      throw new Error(`Valor numérico inválido: ${value}`);
    }
    return Math.round(value * SCALE_FACTOR);
  }

  throw new Error(`Tipo de valor inválido: ${typeof value}`);
}

/**
 * Converte um inteiro escalado (x1000) de volta para número decimal.
 * Ex: 2500 -> 2.5; 125 -> 0.125; null/undefined -> 0.
 */
export function fromScaledInt(scaledValue: number | null | undefined): number {
  if (scaledValue === null || scaledValue === undefined) {
    return 0;
  }
  return scaledValue / SCALE_FACTOR;
}

/**
 * Formata quantidade escalada para padrão brasileiro (pt-BR) com até 3 casas decimais e sufixo de unidade.
 * Ex: formatScaledQuantity(2500, "KG") -> "2,5 KG"
 */
export function formatScaledQuantity(scaledValue: number | null | undefined, unit: string = ""): string {
  const decimal = fromScaledInt(scaledValue);
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(decimal);

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Formata quantidade escalada com exibição de sinal explícito (+ ou -).
 * Ex: formatDeltaQuantity(2500, "KG") -> "+2,5 KG"
 * Ex: formatDeltaQuantity(-1000, "UN") -> "-1 UN"
 */
export function formatDeltaQuantity(scaledValue: number | null | undefined, unit: string = ""): string {
  if (scaledValue === null || scaledValue === undefined || scaledValue === 0) {
    return formatScaledQuantity(0, unit);
  }

  const formatted = formatScaledQuantity(scaledValue, unit);
  if (scaledValue > 0) {
    return `+${formatted}`;
  }

  return formatted;
}
