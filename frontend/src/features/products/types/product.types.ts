import { Category } from "@/features/categories/types/category.types";

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  unit: string;
  current_quantity: number | string;
  current_quantity_raw?: number;
  current_quantity_scaled: number;
  formatted_quantity?: string;
  min_stock?: number | string | null;
  min_stock_raw?: number | null;
  min_stock_scaled?: number | null;
  is_low_stock: boolean;
  is_active: boolean;
  categories: Category[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreateProductPayload {
  name: string;
  description?: string;
  unit?: string;
  min_stock?: number | string | null;
  category_ids?: string[];
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  unit?: string;
  min_stock?: number | string | null;
  category_ids?: string[];
}

export interface ProductFiltersState {
  search?: string;
  category_id?: string;
  low_stock_only?: boolean;
  include_inactive?: boolean;
  limit?: number;
  offset?: number;
}
