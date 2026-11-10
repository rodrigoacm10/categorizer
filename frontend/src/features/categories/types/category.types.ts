export interface Category {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  created_at: string;
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
  color?: string;
}
