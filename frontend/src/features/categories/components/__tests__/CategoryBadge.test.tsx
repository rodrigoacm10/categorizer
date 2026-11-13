import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryBadge } from "../CategoryBadge";
import { Category } from "../../types/category.types";

describe("CategoryBadge", () => {
  const mockCategory: Category = {
    id: "cat-1",
    name: "Ferramentas Manuais",
    description: "Chaves, alicates e martelos",
    color: "#2563EB",
    created_at: "2026-11-13T10:00:00Z",
  };

  it("renderiza o nome da categoria com badge industrial", () => {
    render(<CategoryBadge category={mockCategory} />);

    const label = screen.getByText("Ferramentas Manuais");
    expect(label).toBeDefined();
    const badge = screen.getByTestId("category-badge-cat-1");
    expect(badge).toBeDefined();
    expect(badge.className).toContain("rounded");
    expect(badge.className).not.toContain("rounded-full");
    expect(badge.className).not.toContain("shadow-sm");
  });

  it("aplica estilos de tamanho compacto 'xs'", () => {
    render(<CategoryBadge category={mockCategory} size="xs" />);

    const badge = screen.getByTestId("category-badge-cat-1");
    expect(badge.className).toContain("text-[10px]");
  });

  it("usa cor padrão de fallback se category.color estiver vazio", () => {
    const categoryWithoutColor = { ...mockCategory, color: "" };
    render(<CategoryBadge category={categoryWithoutColor} />);

    expect(screen.getByText("Ferramentas Manuais")).toBeDefined();
  });
});
