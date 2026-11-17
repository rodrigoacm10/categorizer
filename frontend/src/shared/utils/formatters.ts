import { formatScaledQuantity, formatDeltaQuantity } from "./scale";

export { formatScaledQuantity, formatDeltaQuantity };

/**
 * Formata um valor numérico decimal direto com até 3 casas decimais (padrão pt-BR).
 */
export function formatQuantity(value: number | string | null | undefined, unit: string = ""): string {
  if (value === null || value === undefined) return "0";
  const num = typeof value === "string" ? parseFloat(value.replace(",", ".")) : value;
  if (isNaN(num)) return "0";

  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(num);

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Formata data e hora no padrão brasileiro (DD/MM/AAAA HH:mm:ss).
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/**
 * Formata apenas data no padrão brasileiro (DD/MM/AAAA).
 */
export function formatDateOnly(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
