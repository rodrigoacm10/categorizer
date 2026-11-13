import { api } from "@/shared/lib/api-client";
import {
  Product,
  CreateProductPayload,
  UpdateProductPayload,
  ProductFiltersState,
} from "../types/product.types";

export interface ListProductsParams extends ProductFiltersState {
  category_ids?: string[];
}

export const productsApi = {
  list: async (params?: ListProductsParams): Promise<Product[]> => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.include_inactive) query.set("include_inactive", "true");
    if (params?.low_stock_only) query.set("low_stock_only", "true");
    if (params?.limit !== undefined) query.set("limit", params.limit.toString());
    if (params?.offset !== undefined) query.set("offset", params.offset.toString());
    if (params?.category_ids && params.category_ids.length > 0) {
      params.category_ids.forEach((id) => query.append("category_id", id));
    } else if (params?.category_id) {
      query.append("category_id", params.category_id);
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
