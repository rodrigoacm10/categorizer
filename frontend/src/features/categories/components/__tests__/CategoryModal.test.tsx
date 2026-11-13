import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CategoryModal } from "../CategoryModal";
import { categoriesApi } from "../../services/categories.api";
import { Category } from "../../types/category.types";

vi.mock("../../services/categories.api", () => ({
  categoriesApi: {
    create: vi.fn(),
  },
}));

describe("CategoryModal (FT-11)", () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza nada quando isOpen é false", () => {
    render(
      <CategoryModal
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renderiza o formulário industrial quando isOpen é true", () => {
    render(
      <CategoryModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/Nova Categoria \/\/ Catálogo N:N/i)).toBeDefined();
    expect(screen.getByLabelText(/Nome da Categoria/i)).toBeDefined();
    expect(screen.getByLabelText(/Descrição Técnica/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Salvar Categoria/i })).toBeDefined();
  });

  it("fecha o modal ao clicar no botão de fechar (X) ou cancelar", () => {
    render(
      <CategoryModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const closeBtn = screen.getByRole("button", { name: "Fechar modal" });
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    fireEvent.click(cancelBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  it("fecha o modal ao pressionar a tecla Escape", () => {
    render(
      <CategoryModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("impede submissão e exibe erro se o nome estiver em branco", async () => {
    render(
      <CategoryModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const submitBtn = screen.getByTestId("category-modal-submit-button");
    fireEvent.click(submitBtn);

    expect(categoriesApi.create).not.toHaveBeenCalled();
  });

  it("submete com sucesso chamando categoriesApi.create e disparando onSuccess", async () => {
    const createdCat: Category = {
      id: "cat-new",
      name: "Rolamentos",
      description: "Rolamentos industriais blindados",
      color: "#2563EB",
      created_at: "2026-11-13T10:00:00Z",
    };

    (categoriesApi.create as any).mockResolvedValueOnce(createdCat);

    render(
      <CategoryModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const nameInput = screen.getByLabelText(/Nome da Categoria/i);
    const descInput = screen.getByLabelText(/Descrição Técnica/i);

    fireEvent.change(nameInput, { target: { value: "Rolamentos" } });
    fireEvent.change(descInput, {
      target: { value: "Rolamentos industriais blindados" },
    });

    const submitBtn = screen.getByTestId("category-modal-submit-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(categoriesApi.create).toHaveBeenCalledWith({
        name: "Rolamentos",
        description: "Rolamentos industriais blindados",
        color: "#2563EB",
      });
      expect(mockOnSuccess).toHaveBeenCalledWith(createdCat);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("exibe alerta visual de erro se a chamada da API falhar", async () => {
    (categoriesApi.create as any).mockRejectedValueOnce(
      new Error("Categoria com este nome já existe no almoxarifado.")
    );

    render(
      <CategoryModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const nameInput = screen.getByLabelText(/Nome da Categoria/i);
    fireEvent.change(nameInput, { target: { value: "EPIs" } });

    const submitBtn = screen.getByTestId("category-modal-submit-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Categoria com este nome já existe no almoxarifado.")
      ).toBeDefined();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });
});
