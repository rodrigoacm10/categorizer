import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeactivateProductModal } from "../DeactivateProductModal";
import { productsApi } from "../../services/products.api";
import { Product } from "../../types/product.types";

vi.mock("../../services/products.api", () => ({
  productsApi: {
    delete: vi.fn(),
  },
}));

describe("DeactivateProductModal (FT-12)", () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  const mockProduct: Product = {
    id: "prod-101",
    name: "Disco de Corte 4.5 pol",
    description: "Para esmerilhadeira angular",
    unit: "UN",
    current_quantity: "25",
    current_quantity_scaled: 25000,
    min_stock: "10",
    min_stock_scaled: 10000,
    is_low_stock: false,
    is_active: true,
    categories: [],
    created_at: "2026-11-13T10:00:00Z",
    updated_at: "2026-11-13T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza nada se isOpen for false ou product for null", () => {
    const { rerender } = render(
      <DeactivateProductModal
        product={mockProduct}
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(
      <DeactivateProductModal
        product={null}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renderiza modal com aviso de Livro-Razão e dados do produto", () => {
    render(
      <DeactivateProductModal
        product={mockProduct}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Disco de Corte 4.5 pol")).toBeDefined();
    expect(screen.getByText(/Registro de Evento Contábil Permanente/i)).toBeDefined();
    expect(screen.getByText(/PRODUCT_DELETED/i)).toBeDefined();
    expect(screen.getByLabelText(/Justificativa Operacional/i)).toBeDefined();
  });

  it("fecha o modal ao clicar no botão de fechar ou cancelar", () => {
    render(
      <DeactivateProductModal
        product={mockProduct}
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
      <DeactivateProductModal
        product={mockProduct}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("bloqueia a submissão se a justificativa tiver menos de 5 caracteres", () => {
    render(
      <DeactivateProductModal
        product={mockProduct}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const textarea = screen.getByLabelText(/Justificativa Operacional/i);
    fireEvent.change(textarea, { target: { value: "abc" } });

    const submitBtn = screen.getByTestId("confirm-deactivate-product-button");
    fireEvent.click(submitBtn);

    expect(productsApi.delete).not.toHaveBeenCalled();
    expect(
      screen.getByText(/A justificativa é obrigatória e deve conter no mínimo 5 caracteres/i)
    ).toBeDefined();
  });

  it("executa a inativação com sucesso ao enviar justificativa válida", async () => {
    (productsApi.delete as any).mockResolvedValueOnce({
      message: "Produto desativado com sucesso",
    });

    render(
      <DeactivateProductModal
        product={mockProduct}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const textarea = screen.getByLabelText(/Justificativa Operacional/i);
    fireEvent.change(textarea, {
      target: { value: "Lote com defeito de fabricação e descontinuado" },
    });

    const submitBtn = screen.getByTestId("confirm-deactivate-product-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(productsApi.delete).toHaveBeenCalledWith(
        "prod-101",
        "Lote com defeito de fabricação e descontinuado"
      );
      expect(mockOnSuccess).toHaveBeenCalledWith(
        mockProduct,
        "Produto desativado com sucesso"
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("exibe mensagem de erro se a chamada da API falhar", async () => {
    (productsApi.delete as any).mockRejectedValueOnce(
      new Error("Não é possível inativar produto com pendências contábeis.")
    );

    render(
      <DeactivateProductModal
        product={mockProduct}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const textarea = screen.getByLabelText(/Justificativa Operacional/i);
    fireEvent.change(textarea, {
      target: { value: "Descontinuação solicitada" },
    });

    const submitBtn = screen.getByTestId("confirm-deactivate-product-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Não é possível inativar produto com pendências contábeis.")
      ).toBeDefined();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });
});
