import { Category } from "@/features/categories/types/category.types";

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  unit: string;
  current_quantity: number | string;
  current_quantity_scaled: number;
  min_stock?: number | string | null;
  min_stock_scaled?: number | null;
  is_low_stock: boolean;
  is_active: boolean;
  categories: Category[];
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  name: string;
  description?: string;
  unit?: string;
  initial_quantity?: number | string;
  min_stock?: number | string;
  category_ids?: string[];
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  unit?: string;
  min_stock?: number | string;
  category_ids?: string[];
}
