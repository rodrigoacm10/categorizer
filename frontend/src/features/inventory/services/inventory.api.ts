import { api } from "@/shared/lib/api-client";
import { storage } from "@/shared/lib/storage";
import {
  StockMovement,
  ListMovementsParams,
  PaginatedStockMovements,
  RegisterMovementPayload,
} from "../types/inventory.types";
import { Product } from "@/features/products/types/product.types";

export const inventoryApi = {
  /**
   * Consulta o extrato de movimentações físicas do almoxarifado ativo com paginação e metadados.
   */
  listMovements: async (
    params?: ListMovementsParams
  ): Promise<PaginatedStockMovements> => {
    const query = new URLSearchParams();
    if (params?.product_id) query.set("product_id", params.product_id);
    if (params?.type) query.set("type", params.type);
    if (params?.start_date) query.set("start_date", params.start_date);
    if (params?.end_date) query.set("end_date", params.end_date);
    if (params?.limit !== undefined) query.set("limit", params.limit.toString());
    if (params?.offset !== undefined) query.set("offset", params.offset.toString());

    const qs = query.toString();
    const endpoint = qs ? `/inventory/movements?${qs}` : "/inventory/movements";

    let items: StockMovement[] = [];
    let totalCount = 0;
    let totalPages = 1;

    if (api.request) {
      const res = await api.request<StockMovement[]>(endpoint, { method: "GET" });
      items = res?.data || [];
      const countHeader = res?.headers?.get?.("X-Total-Count");
      const pagesHeader = res?.headers?.get?.("X-Total-Pages");
      totalCount = countHeader ? parseInt(countHeader, 10) : items.length;
      totalPages = pagesHeader
        ? parseInt(pagesHeader, 10)
        : params?.limit
        ? Math.max(1, Math.ceil(totalCount / params.limit))
        : 1;
    } else {
      items = await api.get<StockMovement[]>(endpoint);
      totalCount = items.length;
      totalPages = params?.limit
        ? Math.max(1, Math.ceil(totalCount / params.limit))
        : 1;
    }

    const paginatedList = [...items] as PaginatedStockMovements;
    paginatedList.items = items;
    paginatedList.totalCount = totalCount;
    paginatedList.totalPages = totalPages;

    return paginatedList;
  },

  /**
   * Aciona o download do CSV via GET /api/inventory/movements/export com token de autenticação e cabeçalho X-Tenant-ID.
   */
  exportMovementsCsv: async (
    params?: ListMovementsParams,
    tenantSlug?: string
  ): Promise<{ blob: Blob; filename: string }> => {
    const query = new URLSearchParams();
    if (params?.product_id) query.set("product_id", params.product_id);
    if (params?.type) query.set("type", params.type);
    if (params?.start_date) query.set("start_date", params.start_date);
    if (params?.end_date) query.set("end_date", params.end_date);

    const token = storage.getToken();
    const activeTenantId = storage.getActiveTenantId();

    if (!activeTenantId) {
      throw new Error(
        "Tenant ativo não selecionado. A exportação requer contexto de almoxarifado."
      );
    }

    const headers: Record<string, string> = {
      "X-Tenant-ID": activeTenantId,
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const qs = query.toString();
    const endpoint = qs
      ? `/inventory/movements/export?${qs}`
      : "/inventory/movements/export";

    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== "undefined" ? "/api" : "http://127.0.0.1:8000/api");
    const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${base}${path}`;

    const res = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      throw new Error(
        `Falha ao exportar extrato CSV: ${res.statusText || res.status}`
      );
    }

    let filename = "";
    const disposition = res.headers.get("Content-Disposition");
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename=["']?([^"';]+)["']?/);
      if (match && match[1]) {
        filename = match[1].trim();
      }
    }

    if (!filename) {
      const today = new Date().toISOString().split("T")[0];
      const slug = tenantSlug || activeTenantId;
      filename = `extrato-estoque-${slug}-${today}.csv`;
    }

    const blob = await res.blob();

    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    }

    return { blob, filename };
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
