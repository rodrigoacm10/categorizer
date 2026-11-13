import React from "react";
import { cn } from "@/shared/utils/cn";

export type StockStatusType = "stock-ok" | "stock-low" | "stock-empty" | "stock-inactive";

export interface StockStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: StockStatusType;
  // Ou inferido diretamente das propriedades do produto
  isLowStock?: boolean;
  isActive?: boolean;
  currentQuantity?: number | string | null;
  minStock?: number | string | null;
  size?: "xs" | "sm" | "md";
  showDot?: boolean;
}

const statusStyles: Record<
  StockStatusType,
  { container: string; dot: string; label: string }
> = {
  "stock-ok": {
    container: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    label: "Em Estoque",
  },
  "stock-low": {
    container: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    label: "Estoque Baixo",
  },
  "stock-empty": {
    container: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-500",
    label: "Zerado",
  },
  "stock-inactive": {
    container: "bg-zinc-100 text-zinc-600 border-zinc-200 font-mono",
    dot: "bg-zinc-400",
    label: "Inativo",
  },
};

export function resolveStockStatus(params: {
  status?: StockStatusType;
  isActive?: boolean;
  isLowStock?: boolean;
  currentQuantity?: number | string | null;
  minStock?: number | string | null;
}): StockStatusType {
  if (params.status) return params.status;
  if (params.isActive === false) return "stock-inactive";

  const qty = Number(params.currentQuantity ?? 0);
  if (qty <= 0) return "stock-empty";

  if (params.isLowStock) return "stock-low";

  const min = params.minStock !== null && params.minStock !== undefined ? Number(params.minStock) : null;
  if (min !== null && !isNaN(min) && qty <= min) {
    return "stock-low";
  }

  return "stock-ok";
}

/**
 * StockStatusBadge (Impeccable Industrial Tokens):
 * Badge semântico de status físico de estoque:
 * - stock-ok (Verde): Saldo saudável acima do mínimo
 * - stock-low (Âmbar): Saldo em alerta de reposição (<= min_stock)
 * - stock-empty (Vermelho): Saldo zerado ou crítico
 * - stock-inactive (Cinza): Item descontinuado / soft-deleted
 */
export const StockStatusBadge: React.FC<StockStatusBadgeProps> = ({
  status: explicitStatus,
  isLowStock,
  isActive = true,
  currentQuantity,
  minStock,
  size = "sm",
  showDot = true,
  className,
  children,
  ...props
}) => {
  const resolvedStatus = resolveStockStatus({
    status: explicitStatus,
    isActive,
    isLowStock,
    currentQuantity,
    minStock,
  });

  const config = statusStyles[resolvedStatus];

  const sizeClass =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.25 font-semibold uppercase tracking-wider"
      : size === "sm"
      ? "text-xs px-2 py-0.5 font-medium"
      : "text-xs px-2.5 py-1 font-semibold";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border select-none shrink-0 transition-colors leading-none",
        config.container,
        sizeClass,
        className
      )}
      data-testid={`stock-badge-${resolvedStatus}`}
      {...props}
    >
      {showDot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-xs shrink-0", config.dot)}
          aria-hidden="true"
        />
      )}
      <span>{children || config.label}</span>
    </span>
  );
};

StockStatusBadge.displayName = "StockStatusBadge";
