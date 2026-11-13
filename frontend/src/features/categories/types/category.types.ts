export interface Category {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  created_at: string;
  products_count?: number;
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
  color?: string;
}
