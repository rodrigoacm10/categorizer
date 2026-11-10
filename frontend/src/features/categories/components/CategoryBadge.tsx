import React from "react";
import { Category } from "../types/category.types";

interface Props {
  category: Category;
  size?: "sm" | "md";
}

export const CategoryBadge: React.FC<Props> = ({ category, size = "md" }) => {
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-medium";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-black/10 shadow-sm ${pad}`}
      style={{
        backgroundColor: `${category.color}15`,
        borderColor: `${category.color}40`,
        color: category.color,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color }} />
      {category.name}
    </span>
  );
};
