import { api } from "@/shared/lib/api-client";
import { StockMovement, ListMovementsParams } from "../types/inventory.types";

export const inventoryApi = {
  /**
   * Consulta o extrato de movimentações físicas do almoxarifado ativo.
   */
  listMovements: async (params?: ListMovementsParams): Promise<StockMovement[]> => {
    const query = new URLSearchParams();
    if (params?.product_id) query.set("product_id", params.product_id);
    if (params?.type) query.set("type", params.type);
    if (params?.start_date) query.set("start_date", params.start_date);
    if (params?.end_date) query.set("end_date", params.end_date);
    if (params?.limit !== undefined) query.set("limit", params.limit.toString());
    if (params?.offset !== undefined) query.set("offset", params.offset.toString());

    const qs = query.toString();
    const endpoint = qs ? `/inventory/movements?${qs}` : "/inventory/movements";
    return api.get<StockMovement[]>(endpoint);
  },

  /**
   * Consulta o extrato individual perpétuo do Livro-Razão de um produto específico.
   * Conforme FT-14 e backend router: GET /api/inventory/products/{product_id}/ledger
   */
  getProductLedger: async (
    productId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<StockMovement[]> => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set("limit", params.limit.toString());
    if (params?.offset !== undefined) query.set("offset", params.offset.toString());

    const qs = query.toString();
    const endpoint = qs
      ? `/inventory/products/${productId}/ledger?${qs}`
      : `/inventory/products/${productId}/ledger`;
    return api.get<StockMovement[]>(endpoint);
  },
};
