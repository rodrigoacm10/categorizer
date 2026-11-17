import { describe, it, expect, vi, beforeEach } from "vitest";
import { categoriesApi } from "../categories.api";
import { api } from "@/shared/lib/api-client";
import { Category, CreateCategoryPayload } from "../../types/category.types";

vi.mock("@/shared/lib/api-client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("categoriesApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list() deve chamar api.get('/categories') e retornar a lista", async () => {
    const mockCategories: Category[] = [
      {
        id: "cat-1",
        name: "EPIs",
        description: "Equipamentos de Proteção",
        color: "#2563EB",
        created_at: "2026-11-13T10:00:00Z",
      },
      {
        id: "cat-2",
        name: "Soldagem",
        description: "Consumíveis de solda",
        color: "#10B981",
        created_at: "2026-11-13T10:05:00Z",
      },
    ];

    (api.get as any).mockResolvedValueOnce(mockCategories);

    const result = await categoriesApi.list();

    expect(api.get).toHaveBeenCalledWith("/categories");
    expect(result).toEqual(mockCategories);
    expect(result).toHaveLength(2);
  });

  it("create() deve chamar api.post('/categories', payload) e retornar a categoria criada", async () => {
    const payload: CreateCategoryPayload = {
      name: "Químicos",
      description: "Produtos químicos e solventes",
      color: "#F59E0B",
    };

    const createdCategory: Category = {
      id: "cat-3",
      name: "Químicos",
      description: "Produtos químicos e solventes",
      color: "#F59E0B",
      created_at: "2026-11-13T10:10:00Z",
    };

    (api.post as any).mockResolvedValueOnce({
      data: createdCategory,
      isCached: false,
      status: 201,
    });

    const result = await categoriesApi.create(payload);

    expect(api.post).toHaveBeenCalledWith("/categories", payload);
    expect(result).toEqual(createdCategory);
    expect(result.id).toBe("cat-3");
  });

  it("delete() deve chamar api.delete('/categories/{id}') com o ID informado", async () => {
    (api.delete as any).mockResolvedValueOnce({
      data: undefined,
      isCached: false,
      status: 204,
    });

    await categoriesApi.delete("cat-1");

    expect(api.delete).toHaveBeenCalledWith("/categories/cat-1");
  });
});
