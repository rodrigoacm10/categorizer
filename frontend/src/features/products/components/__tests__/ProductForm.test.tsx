import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductForm } from "../ProductForm";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { productsApi } from "../../services/products.api";
import { categoriesApi } from "@/features/categories/services/categories.api";
import { Product } from "../../types/product.types";
import { Category } from "@/features/categories/types/category.types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("../../services/products.api", () => ({
  productsApi: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/features/categories/services/categories.api", () => ({
  categoriesApi: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("ProductForm (FT-13 / FT-14)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const mockCategories: Category[] = [
    {
      id: "cat-1",
      name: "Consumíveis",
      color: "#2563EB",
      created_at: "2026-11-13T10:00:00Z",
    },
    {
      id: "cat-2",
      name: "EPI",
      color: "#16A34A",
      created_at: "2026-11-13T10:00:00Z",
    },
  ];

  const mockProduct: Product = {
    id: "prod-100",
    name: "Disco de Corte 4.5 polegadas",
    description: "Abrasivo para esmerilhadeira",
    unit: "UN",
    current_quantity: 45,
    current_quantity_scaled: 45000,
    min_stock: 10,
    min_stock_scaled: 10000,
    is_low_stock: false,
    is_active: true,
    categories: [mockCategories[0]],
    created_at: "2026-11-13T10:00:00Z",
    updated_at: "2026-11-13T10:00:00Z",
  };

  const renderForm = (props: React.ComponentProps<typeof ProductForm> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId="tenant-test-123" initialRole="OWNER">
          <ProductForm {...props} />
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  it("renderiza o formulário de cadastro com o banner mandatório de saldo zero contábil", async () => {
    vi.mocked(categoriesApi.list).mockResolvedValueOnce(mockCategories);

    renderForm();

    // Banner de alerta contábil industrial obrigatório
    const banner = screen.getByTestId("zero-stock-banner");
    expect(banner).toBeDefined();
    expect(
      screen.getByText(
        /Aviso Contábil \/\/ Novos produtos iniciam obrigatoriamente com saldo físico ZERO \(0.000\)/i
      )
    ).toBeDefined();

    // Invariante Crítica: Proibição de qualquer campo de saldo físico inicial
    expect(screen.queryByLabelText(/saldo inicial/i)).toBeNull();
    expect(screen.queryByLabelText(/quantidade inicial/i)).toBeNull();
    expect(screen.queryByTestId("initial-quantity-input")).toBeNull();

    // Campos cadastrais normais
    expect(screen.getByTestId("product-name-input")).toBeDefined();
    expect(screen.getByTestId("product-description-input")).toBeDefined();
    expect(screen.getByTestId("product-unit-input")).toBeDefined();
    expect(screen.getByTestId("product-min-stock-input")).toBeDefined();
    expect(screen.getByTestId("submit-product-button")).toBeDefined();
  });

  it("impede o envio e exibe erros de validação para nome menor que 2 caracteres ou estoque mínimo negativo", async () => {
    vi.mocked(categoriesApi.list).mockResolvedValueOnce(mockCategories);

    renderForm();

    const nameInput = screen.getByTestId("product-name-input");
    const minStockInput = screen.getByTestId("product-min-stock-input");
    const submitBtn = screen.getByTestId("submit-product-button");

    // Digita nome inválido (1 caractere) e estoque mínimo negativo
    fireEvent.change(nameInput, { target: { value: "A" } });
    fireEvent.change(minStockInput, { target: { value: "-10" } });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText("O nome do produto deve ter no mínimo 2 caracteres.")
    ).toBeDefined();
    expect(
      screen.getByText("O estoque mínimo deve ser um número maior ou igual a zero.")
    ).toBeDefined();

    expect(productsApi.create).not.toHaveBeenCalled();
  });

  it("cria o produto com sucesso e redireciona para /products", async () => {
    vi.mocked(categoriesApi.list).mockResolvedValueOnce(mockCategories);
    vi.mocked(productsApi.create).mockResolvedValueOnce({
      ...mockProduct,
      id: "new-prod-1",
      name: "Broca HSS 8mm",
      unit: "UN",
      min_stock: 5,
    });

    renderForm();

    await waitFor(() => {
      expect(screen.getByText("Consumíveis")).toBeDefined();
    });

    fireEvent.change(screen.getByTestId("product-name-input"), {
      target: { value: "Broca HSS 8mm" },
    });
    fireEvent.change(screen.getByTestId("product-description-input"), {
      target: { value: "Broca para furação de metal" },
    });
    fireEvent.change(screen.getByTestId("product-unit-input"), {
      target: { value: "un" }, // minúsculo para testar transformação em uppercase
    });
    fireEvent.change(screen.getByTestId("product-min-stock-input"), {
      target: { value: "5,0" },
    });

    // Seleciona a categoria 'Consumíveis'
    fireEvent.click(screen.getByTestId("toggle-category-cat-1"));

    fireEvent.click(screen.getByTestId("submit-product-button"));

    await waitFor(() => {
      expect(productsApi.create).toHaveBeenCalledWith({
        name: "Broca HSS 8mm",
        description: "Broca para furação de metal",
        unit: "UN",
        min_stock: 5,
        category_ids: ["cat-1"],
      });
      expect(mockPush).toHaveBeenCalledWith("/products");
    });
  });

  it("permite invocar onSuccess customizado se fornecido", async () => {
    vi.mocked(categoriesApi.list).mockResolvedValueOnce(mockCategories);
    const mockOnSuccess = vi.fn();
    const createdProduct = { ...mockProduct, id: "created-prod" };
    vi.mocked(productsApi.create).mockResolvedValueOnce(createdProduct);

    renderForm({ onSuccess: mockOnSuccess });

    fireEvent.change(screen.getByTestId("product-name-input"), {
      target: { value: "Fita Isolante 3M" },
    });
    fireEvent.click(screen.getByTestId("submit-product-button"));

    await waitFor(() => {
      expect(productsApi.create).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalledWith(createdProduct);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("renderiza em modo edição sem o banner de saldo zero e submete via productsApi.update", async () => {
    vi.mocked(categoriesApi.list).mockResolvedValueOnce(mockCategories);
    vi.mocked(productsApi.update).mockResolvedValueOnce({
      ...mockProduct,
      name: "Disco de Corte 4.5 pol Atualizado",
    });

    renderForm({ initialData: mockProduct, mode: "edit" });

    // Não deve conter o banner de saldo zero de novo produto
    expect(screen.queryByTestId("zero-stock-banner")).toBeNull();

    // Campos devem estar preenchidos com os dados iniciais
    const nameInput = screen.getByTestId("product-name-input") as HTMLInputElement;
    expect(nameInput.value).toBe("Disco de Corte 4.5 polegadas");

    fireEvent.change(nameInput, {
      target: { value: "Disco de Corte 4.5 pol Atualizado" },
    });
    fireEvent.click(screen.getByTestId("submit-product-button"));

    await waitFor(() => {
      expect(productsApi.update).toHaveBeenCalledWith("prod-100", {
        name: "Disco de Corte 4.5 pol Atualizado",
        description: "Abrasivo para esmerilhadeira",
        unit: "UN",
        min_stock: 10,
        category_ids: ["cat-1"],
      });
    });
  });

  it("renderiza em modo somente-leitura com campos desabilitados e oculta botão de salvar", async () => {
    vi.mocked(categoriesApi.list).mockResolvedValueOnce(mockCategories);

    renderForm({ initialData: mockProduct, readOnly: true });

    expect(screen.getByTestId("product-name-input")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("product-description-input")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("product-unit-input")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("product-min-stock-input")).toHaveProperty("disabled", true);

    // Botão de salvar não deve existir
    expect(screen.queryByTestId("submit-product-button")).toBeNull();
    // Botão de criar nova categoria não deve existir
    expect(screen.queryByTestId("open-inline-category-modal")).toBeNull();

    // Botão Voltar ao Catálogo deve estar visível
    const backBtn = screen.getByTestId("cancel-button");
    expect(backBtn.textContent).toContain("Voltar ao Catálogo");
  });

  it("trata erro da API e exibe banner de erro geral", async () => {
    vi.mocked(categoriesApi.list).mockResolvedValueOnce(mockCategories);
    vi.mocked(productsApi.create).mockRejectedValueOnce(
      new Error("Nome de produto já cadastrado neste almoxarifado.")
    );

    renderForm();

    fireEvent.change(screen.getByTestId("product-name-input"), {
      target: { value: "Produto Duplicado" },
    });
    fireEvent.click(screen.getByTestId("submit-product-button"));

    await waitFor(() => {
      expect(screen.getByTestId("form-general-error")).toBeDefined();
      expect(
        screen.getByText("Nome de produto já cadastrado neste almoxarifado.")
      ).toBeDefined();
    });
  });

  it("permite selecionar categoria através do select dropdown", async () => {
    vi.mocked(categoriesApi.list).mockResolvedValue(mockCategories);

    renderForm();

    // Aguarda as categorias serem carregadas no select
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "+ EPI" })).toBeDefined();
    });

    const select = screen.getByTestId("product-category-select") as HTMLSelectElement;

    // Seleciona a categoria 'cat-2' (EPI) pelo select
    fireEvent.change(select, { target: { value: "cat-2" } });

    // A categoria EPI deve aparecer nas categorias vinculadas
    expect(await screen.findByTestId("category-badge-cat-2")).toBeDefined();
    expect(screen.getByTestId("remove-category-cat-2")).toBeDefined();

    // Remove a categoria clicando no botão X
    fireEvent.click(screen.getByTestId("remove-category-cat-2"));
    expect(screen.queryByTestId("category-badge-cat-2")).toBeNull();
  });

  it("abre modal inline para criar nova categoria, cadastra com sucesso e associa ao produto sem submeter o formulário pai", async () => {
    vi.mocked(categoriesApi.list).mockResolvedValue(mockCategories);
    const newCategory: Category = {
      id: "cat-999",
      name: "Químicos Perigosos",
      color: "#DC2626",
      created_at: "2026-11-18T10:00:00Z",
    };
    vi.mocked(categoriesApi.create).mockResolvedValueOnce(newCategory);

    renderForm();

    // Abre o modal de nova categoria
    const openModalBtn = screen.getByTestId("open-inline-category-modal");
    fireEvent.click(openModalBtn);

    // Modal deve estar visível
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByTestId("category-modal-submit-button")).toBeDefined();

    // Preenche o nome da nova categoria no modal
    const nameInput = screen.getByLabelText(/Nome da Categoria/i);
    fireEvent.change(nameInput, { target: { value: "Químicos Perigosos" } });

    // Clica no botão Salvar Categoria dentro do modal
    const saveCategoryBtn = screen.getByTestId("category-modal-submit-button");
    fireEvent.click(saveCategoryBtn);

    await waitFor(() => {
      expect(categoriesApi.create).toHaveBeenCalledWith({
        name: "Químicos Perigosos",
        description: undefined,
        color: "#2563EB",
      });
    });

    // O formulário de produto NÃO deve ter sido submetido (productsApi.create não chamado)
    expect(productsApi.create).not.toHaveBeenCalled();

    // A nova categoria deve estar vinculada e renderizada como badge
    expect(await screen.findByTestId("category-badge-cat-999")).toBeDefined();
  });
});
