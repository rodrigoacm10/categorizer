import { describe, it, expect, vi, beforeEach } from "vitest";
import { productsApi } from "../products.api";
import { api } from "@/shared/lib/api-client";
import { Product, CreateProductPayload, UpdateProductPayload } from "../../types/product.types";

vi.mock("@/shared/lib/api-client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("productsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProduct: Product = {
    id: "prod-1",
    name: "Eletrodo AWS E7018",
    description: "Consumível de solda",
    unit: "KG",
    current_quantity: 15.5,
    current_quantity_scaled: 15500,
    min_stock: 20,
    min_stock_scaled: 20000,
    is_low_stock: true,
    is_active: true,
    categories: [
      {
        id: "cat-1",
        name: "Soldagem",
        color: "#2563EB",
        created_at: "2026-11-13T10:00:00Z",
      },
    ],
    created_at: "2026-11-13T10:00:00Z",
    updated_at: "2026-11-13T10:00:00Z",
  };

  it("list() sem parâmetros chama GET /products", async () => {
    (api.get as any).mockResolvedValueOnce([mockProduct]);

    const result = await productsApi.list();

    expect(api.get).toHaveBeenCalledWith("/products");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Eletrodo AWS E7018");
  });

  it("list() com query params constrói a query string corretamente", async () => {
    (api.get as any).mockResolvedValueOnce([mockProduct]);

    await productsApi.list({
      search: "eletrodo",
      low_stock_only: true,
      include_inactive: true,
      category_ids: ["cat-1", "cat-2"],
      limit: 25,
      offset: 50,
    });

    const calledUrl = (api.get as any).mock.calls[0][0];
    expect(calledUrl).toContain("/products?");
    expect(calledUrl).toContain("search=eletrodo");
    expect(calledUrl).toContain("low_stock_only=true");
    expect(calledUrl).toContain("include_inactive=true");
    expect(calledUrl).toContain("limit=25");
    expect(calledUrl).toContain("offset=50");
    expect(calledUrl).toContain("category_id=cat-1");
    expect(calledUrl).toContain("category_id=cat-2");
  });

  it("list() com category_id único formata a query string", async () => {
    (api.get as any).mockResolvedValueOnce([mockProduct]);

    await productsApi.list({
      category_id: "cat-single",
    });

    expect(api.get).toHaveBeenCalledWith("/products?category_id=cat-single");
  });

  it("getById() chama GET /products/{id}", async () => {
    (api.get as any).mockResolvedValueOnce(mockProduct);

    const result = await productsApi.getById("prod-1");

    expect(api.get).toHaveBeenCalledWith("/products/prod-1");
    expect(result.id).toBe("prod-1");
  });

  it("create() chama POST /products e retorna o produto criado", async () => {
    const payload: CreateProductPayload = {
      name: "Broca de Aço Rápido 6mm",
      description: "Broca para furação",
      unit: "UN",
      min_stock: 10,
      category_ids: ["cat-1"],
    };

    (api.post as any).mockResolvedValueOnce({
      data: { ...mockProduct, ...payload, id: "prod-2" },
      isCached: false,
      status: 201,
    });

    const result = await productsApi.create(payload);

    expect(api.post).toHaveBeenCalledWith("/products", payload);
    expect(result.id).toBe("prod-2");
  });

  it("update() chama PUT /products/{id} com o payload informado", async () => {
    const payload: UpdateProductPayload = {
      name: "Nome Atualizado",
      min_stock: 30,
    };

    (api.put as any).mockResolvedValueOnce({
      data: { ...mockProduct, ...payload },
      isCached: false,
      status: 200,
    });

    const result = await productsApi.update("prod-1", payload);

    expect(api.put).toHaveBeenCalledWith("/products/prod-1", payload);
    expect(result.name).toBe("Nome Atualizado");
  });

  it("delete() (soft-delete) chama DELETE /products/{id} com reason", async () => {
    (api.delete as any).mockResolvedValueOnce({
      data: { message: "Produto desativado com sucesso" },
      isCached: false,
      status: 200,
    });

    const result = await productsApi.delete("prod-1", "Item descontinuado pelo fabricante");

    expect(api.delete).toHaveBeenCalledWith(
      "/products/prod-1",
      "Item descontinuado pelo fabricante"
    );
    expect(result.message).toBe("Produto desativado com sucesso");
  });
});
