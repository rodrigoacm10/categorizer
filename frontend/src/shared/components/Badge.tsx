import React from "react";
import { cn } from "../utils/cn";

export type BadgeVariant =
  | "in-stock"
  | "low-stock"
  | "out-of-stock"
  | "inactive"
  | "info"
  | "ledger-in"
  | "ledger-out"
  | "ledger-adjust";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  showDot?: boolean;
  dotColor?: string;
}

const variantStyles: Record<
  BadgeVariant,
  { container: string; dot: string; defaultLabel?: string }
> = {
  "in-stock": {
    container: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    dot: "bg-emerald-500",
  },
  "low-stock": {
    container: "bg-amber-50 text-amber-800 border-amber-200/80",
    dot: "bg-amber-500",
  },
  "out-of-stock": {
    container: "bg-rose-50 text-rose-800 border-rose-200/80",
    dot: "bg-rose-500",
  },
  inactive: {
    container: "bg-zinc-100 text-zinc-600 border-zinc-200",
    dot: "bg-zinc-400",
  },
  info: {
    container: "bg-blue-50 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
  },
  "ledger-in": {
    container: "bg-emerald-50 text-emerald-800 border-emerald-200 font-mono",
    dot: "bg-emerald-600",
  },
  "ledger-out": {
    container: "bg-zinc-100 text-zinc-900 border-zinc-200 font-mono",
    dot: "bg-zinc-600",
  },
  "ledger-adjust": {
    container: "bg-indigo-50 text-indigo-800 border-indigo-200 font-mono",
    dot: "bg-indigo-600",
  },
};

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "info",
  size = "md",
  showDot = false,
  dotColor,
  children,
  ...props
}) => {
  const current = variantStyles[variant];

  const sizeClass =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5 font-semibold tracking-wider uppercase rounded"
      : "text-xs px-2.5 py-1 font-medium rounded-full";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border leading-none shrink-0 transition-colors select-none",
        current.container,
        sizeClass,
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            dotColor || current.dot
          )}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
};
