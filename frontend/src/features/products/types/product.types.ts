import { z } from "zod";
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

export const STANDARD_UOMS = [
  { code: "UN", label: "UN - Unidade" },
  { code: "KG", label: "KG - Quilograma" },
  { code: "L", label: "L - Litro" },
  { code: "M", label: "M - Metro Linear" },
  { code: "CX", label: "CX - Caixa" },
  { code: "G", label: "G - Grama" },
  { code: "M2", label: "M² - Metro Quadrado" },
  { code: "M3", label: "M³ - Metro Cúbico" },
] as const;

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "O nome do produto é obrigatório.")
    .min(2, "O nome do produto deve ter no mínimo 2 caracteres.")
    .max(200, "O nome do produto deve ter no máximo 200 caracteres."),
  description: z.string().trim().max(1000, "A descrição deve ter no máximo 1000 caracteres.").optional(),
  unit: z
    .string()
    .trim()
    .min(1, "A unidade de medida (UOM) é obrigatória.")
    .max(10, "A unidade deve ter no máximo 10 caracteres.")
    .transform((val) => val.toUpperCase()),
  min_stock: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        const normalized = val.trim().replace(",", ".");
        const num = Number(normalized);
        return !isNaN(num) && num >= 0;
      },
      { message: "O estoque mínimo deve ser um número maior ou igual a zero." }
    ),
  category_ids: z.array(z.string()).default([]),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export type ProductFormFieldErrors = Partial<
  Record<keyof ProductFormValues | "general", string>
>;
