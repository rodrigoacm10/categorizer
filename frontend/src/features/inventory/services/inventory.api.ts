import { api } from "@/shared/lib/api-client";
import { StockMovement, ListMovementsParams, RegisterMovementPayload } from "../types/inventory.types";
import { Product } from "@/features/products/types/product.types";

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

  /**
   * Registra entrada física de estoque (IN) com chave de idempotência.
   */
  registerStockIn: async (
    data: RegisterMovementPayload,
    idempotencyKey?: string
  ): Promise<StockMovement> => {
    const res = await api.post<StockMovement>(
      "/inventory/in",
      data,
      idempotencyKey ? { idempotencyKey } : {}
    );
    return {
      ...res.data,
      is_replay: res.isCached,
    };
  },

  /**
   * Registra saída física de estoque (OUT) com chave de idempotência.
   */
  registerStockOut: async (
    data: RegisterMovementPayload,
    idempotencyKey?: string
  ): Promise<StockMovement> => {
    const res = await api.post<StockMovement>(
      "/inventory/out",
      data,
      idempotencyKey ? { idempotencyKey } : {}
    );
    return {
      ...res.data,
      is_replay: res.isCached,
    };
  },

  /**
   * Registra ajuste de inventário (ADJUSTMENT) com chave de idempotência.
   */
  registerStockAdjustment: async (
    data: { product_id: string; quantity: number | string; reason: string },
    idempotencyKey?: string
  ): Promise<StockMovement> => {
    const res = await api.post<StockMovement>(
      "/inventory/adjustment",
      data,
      idempotencyKey ? { idempotencyKey } : {}
    );
    return {
      ...res.data,
      is_replay: res.isCached,
    };
  },

  /**
   * Busca produto por código de barras, SKU ou ID.
   * Dispara GET /products/lookup?code=... com fallback para busca /products?search=...
   */
  lookupProduct: async (code: string): Promise<Product> => {
    const cleanCode = code.trim();
    if (!cleanCode) {
      throw new Error("Código do produto não pode ser vazio.");
    }

    try {
      return await api.get<Product>(`/products/lookup?code=${encodeURIComponent(cleanCode)}`);
    } catch {
      try {
        const results = await api.get<Product[]>(`/products?search=${encodeURIComponent(cleanCode)}`);
        if (results && results.length > 0) {
          const exact = results.find(
            (p) =>
              p.id.toLowerCase() === cleanCode.toLowerCase() ||
              p.name.toLowerCase() === cleanCode.toLowerCase()
          );
          return exact || results[0];
        }

        if (/^[0-9a-fA-F-]{4,}$/.test(cleanCode)) {
          return await api.get<Product>(`/products/${cleanCode}`);
        }
      } catch {
        // falhou busca de fallback
      }

      throw new Error(`Produto não encontrado com o código "${cleanCode}".`);
    }
  },
};
