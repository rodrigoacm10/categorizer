import React from "react";
import { Category } from "../types/category.types";
import { cn } from "@/shared/utils/cn";

export interface CategoryBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  category: Category;
  size?: "xs" | "sm" | "md";
}

/**
 * CategoryBadge (Impeccable Industrial Workbench):
 * Badge plano compacto com divisor de 1px, sem cantos arredondados inflados e sem sombras decorativas.
 */
export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  size = "sm",
  className,
  ...props
}) => {
  const sizeClass =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.25 gap-1 font-mono uppercase tracking-wider"
      : size === "sm"
      ? "text-xs px-2 py-0.5 gap-1.5 font-medium"
      : "text-xs px-2.5 py-1 gap-1.5 font-medium";

  // Cor padrão se vazia
  const color = category.color || "#3B82F6";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border shrink-0 select-none transition-colors leading-none",
        sizeClass,
        className
      )}
      style={{
        backgroundColor: `${color}10`,
        borderColor: `${color}40`,
        color: color,
      }}
      data-testid={`category-badge-${category.id}`}
      {...props}
    >
      <span
        className="w-1.5 h-1.5 rounded-xs shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate max-w-[140px]">{category.name}</span>
    </span>
  );
};

CategoryBadge.displayName = "CategoryBadge";
