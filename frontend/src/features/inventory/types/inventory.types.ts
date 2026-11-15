export type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "PRODUCT_DELETED";

export interface StockMovement {
  id: string;
  product_id: string;
  product_name?: string | null;
  product_unit?: string | null;
  type: MovementType | string;
  quantity: number | string;
  quantity_scaled: number;
  balance_after: number | string;
  balance_after_scaled: number;
  reason?: string | null;
  idempotency_key?: string | null;
  created_at: string;
  is_replay?: boolean;
}

export interface ListMovementsParams {
  product_id?: string;
  type?: MovementType | string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedStockMovements extends Array<StockMovement> {
  items: StockMovement[];
  totalCount: number;
  totalPages: number;
}

export interface RegisterMovementPayload {
  product_id: string;
  quantity: number | string;
  reason?: string;
}
