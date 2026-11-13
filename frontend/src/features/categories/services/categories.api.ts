import { api } from "@/shared/lib/api-client";
import { Category, CreateCategoryPayload } from "../types/category.types";

export const categoriesApi = {
  list: async (): Promise<Category[]> => {
    return api.get<Category[]>("/categories");
  },

  create: async (payload: CreateCategoryPayload): Promise<Category> => {
    const res = await api.post<Category>("/categories", payload);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete<void>(`/categories/${id}`);
  },
};
