import { api } from "@/shared/lib/api-client";
import { Product, CreateProductPayload, UpdateProductPayload } from "../types/product.types";

export const productsApi = {
  list: async (params?: { category_ids?: string[]; search?: string; include_inactive?: boolean }): Promise<Product[]> => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.include_inactive) query.set("include_inactive", "true");
    if (params?.category_ids) {
      params.category_ids.forEach((id) => query.append("category_id", id));
    }

    const qs = query.toString();
    const endpoint = qs ? `/products?${qs}` : "/products";
    return api.get<Product[]>(endpoint);
  },

  getById: async (id: string): Promise<Product> => {
    return api.get<Product>(`/products/${id}`);
  },

  create: async (payload: CreateProductPayload): Promise<Product> => {
    const res = await api.post<Product>("/products", payload);
    return res.data;
  },

  update: async (id: string, payload: UpdateProductPayload): Promise<Product> => {
    const res = await api.put<Product>(`/products/${id}`, payload);
    return res.data;
  },

  delete: async (id: string, reason?: string): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`/products/${id}`, reason);
    return res.data;
  },
};
