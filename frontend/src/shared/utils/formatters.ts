export function formatQuantity(value: number | string | null | undefined, unit: string = ""): string {
  if (value === null || value === undefined) return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";

  // Formata com até 3 casas decimais usando padrão brasileiro
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(num);

  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatDate(dateString: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}
