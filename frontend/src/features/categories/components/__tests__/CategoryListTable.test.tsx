import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CategoryListTable } from "../CategoryListTable";
import { Category } from "../../types/category.types";

describe("CategoryListTable (FT-11)", () => {
  const mockDelete = vi.fn();
  const mockOpenCreate = vi.fn();

  const mockCategories: Category[] = [
    {
      id: "cat-1",
      name: "EPIs",
      description: "Equipamentos de Proteção Individual",
      color: "#2563EB",
      created_at: "2026-11-13T10:00:00Z",
      products_count: 5,
    },
    {
      id: "cat-2",
      name: "Soldagem",
      description: "Eletrodos, máscaras e gases",
      color: "#16A34A",
      created_at: "2026-11-13T10:05:00Z",
      products_count: 12,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o estado de carregamento com skeleton", () => {
    render(
      <CategoryListTable
        categories={[]}
        isLoading={true}
        onDeleteCategory={mockDelete}
      />
    );

    const table = screen.getByRole("table");
    expect(table).toBeDefined();
    expect(screen.queryByText("Nenhuma categoria cadastrada")).toBeNull();
  });

  it("renderiza o estado vazio quando a lista está vazia", () => {
    render(
      <CategoryListTable
        categories={[]}
        isLoading={false}
        onDeleteCategory={mockDelete}
        onOpenCreate={mockOpenCreate}
      />
    );

    expect(screen.getByText("Nenhuma categoria cadastrada")).toBeDefined();
    const createBtn = screen.getByRole("button", { name: /Nova Categoria/i });
    expect(createBtn).toBeDefined();
    fireEvent.click(createBtn);
    expect(mockOpenCreate).toHaveBeenCalledTimes(1);
  });

  it("renderiza a tabela com as categorias e seus dados", () => {
    render(
      <CategoryListTable
        categories={mockCategories}
        isLoading={false}
        onDeleteCategory={mockDelete}
      />
    );

    expect(screen.getByText("EPIs")).toBeDefined();
    expect(screen.getByText("Equipamentos de Proteção Individual")).toBeDefined();
    expect(screen.getByText("Soldagem")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
  });

  it("abre modal de confirmação de exclusão com alerta de desassociação ao clicar em excluir", () => {
    render(
      <CategoryListTable
        categories={mockCategories}
        isLoading={false}
        onDeleteCategory={mockDelete}
      />
    );

    const deleteButtons = screen.getAllByLabelText(/Excluir categoria/i);
    expect(deleteButtons).toHaveLength(2);

    fireEvent.click(deleteButtons[0]);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/Confirmar Exclusão de Categoria/i)).toBeDefined();
    expect(screen.getByText(/Aviso de Desassociação de Produtos/i)).toBeDefined();
    expect(
      screen.getByText(/Os produtos vinculados a esta categoria/i)
    ).toBeDefined();
  });

  it("confirma a exclusão chamando onDeleteCategory", async () => {
    mockDelete.mockResolvedValueOnce(undefined);

    render(
      <CategoryListTable
        categories={mockCategories}
        isLoading={false}
        onDeleteCategory={mockDelete}
      />
    );

    const deleteButtons = screen.getAllByLabelText(/Excluir categoria/i);
    fireEvent.click(deleteButtons[0]);

    const confirmBtn = screen.getByTestId("confirm-delete-category-button");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(mockCategories[0]);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("cancela a exclusão fechando o modal sem chamar onDeleteCategory", () => {
    render(
      <CategoryListTable
        categories={mockCategories}
        isLoading={false}
        onDeleteCategory={mockDelete}
      />
    );

    const deleteButtons = screen.getAllByLabelText(/Excluir categoria/i);
    fireEvent.click(deleteButtons[0]);

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    fireEvent.click(cancelBtn);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("não renderiza coluna ou botões de exclusão quando canDelete é false", () => {
    render(
      <CategoryListTable
        categories={mockCategories}
        isLoading={false}
        canDelete={false}
        onDeleteCategory={mockDelete}
      />
    );

    expect(screen.queryByText("Ações")).toBeNull();
    expect(screen.queryAllByLabelText(/Excluir categoria/i)).toHaveLength(0);
  });
});
