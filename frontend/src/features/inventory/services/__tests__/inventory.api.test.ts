import { describe, it, expect, vi, beforeEach } from "vitest";
import { inventoryApi } from "../inventory.api";
import { api } from "@/shared/lib/api-client";
import { StockMovement } from "../../types/inventory.types";
import { Product } from "@/features/products/types/product.types";

vi.mock("@/shared/lib/api-client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("inventoryApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockMovement: StockMovement = {
    id: "mov-1",
    product_id: "prod-1",
    product_name: "Eletrodo AWS E7018",
    product_unit: "KG",
    type: "IN",
    quantity: 10,
    quantity_scaled: 10000,
    balance_after: 10,
    balance_after_scaled: 10000,
    reason: "Recebimento NF 1042",
    idempotency_key: "idem-1234",
    created_at: "2026-11-13T10:00:00Z",
  };

  const mockProduct: Product = {
    id: "prod-1",
    name: "Eletrodo AWS E7018",
    unit: "KG",
    current_quantity: 10,
    current_quantity_scaled: 10000,
    is_low_stock: false,
    is_active: true,
    categories: [],
    created_at: "2026-11-13T10:00:00Z",
    updated_at: "2026-11-13T10:00:00Z",
  };

  it("listMovements() sem parâmetros chama GET /inventory/movements", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([mockMovement]);

    const result = await inventoryApi.listMovements();

    expect(api.get).toHaveBeenCalledWith("/inventory/movements");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("mov-1");
  });

  it("listMovements() com filtros constrói query string", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([mockMovement]);

    await inventoryApi.listMovements({
      product_id: "prod-1",
      type: "IN",
      start_date: "2026-11-01",
      end_date: "2026-11-13",
      limit: 50,
      offset: 0,
    });

    const calledUrl = vi.mocked(api.get).mock.calls[0][0];
    expect(calledUrl).toContain("/inventory/movements?");
    expect(calledUrl).toContain("product_id=prod-1");
    expect(calledUrl).toContain("type=IN");
    expect(calledUrl).toContain("start_date=2026-11-01");
    expect(calledUrl).toContain("end_date=2026-11-13");
    expect(calledUrl).toContain("limit=50");
    expect(calledUrl).toContain("offset=0");
  });

  it("getProductLedger() sem parâmetros chama GET /inventory/products/{id}/ledger", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([mockMovement]);

    const result = await inventoryApi.getProductLedger("prod-1");

    expect(api.get).toHaveBeenCalledWith("/inventory/products/prod-1/ledger");
    expect(result).toHaveLength(1);
    expect(result[0].product_id).toBe("prod-1");
  });

  it("getProductLedger() com limit e offset anexa query params", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([mockMovement]);

    await inventoryApi.getProductLedger("prod-1", { limit: 20, offset: 40 });

    expect(api.get).toHaveBeenCalledWith(
      "/inventory/products/prod-1/ledger?limit=20&offset=40"
    );
  });

  it("registerStockIn() envia POST /inventory/in com idempotencyKey e retorna movement com is_replay", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: mockMovement,
      isCached: false,
      status: 201,
    });

    const payload = { product_id: "prod-1", quantity: 15, reason: "NF 99" };
    const res = await inventoryApi.registerStockIn(payload, "key-in-123");

    expect(api.post).toHaveBeenCalledWith(
      "/inventory/in",
      payload,
      { idempotencyKey: "key-in-123" }
    );
    expect(res.id).toBe("mov-1");
    expect(res.is_replay).toBe(false);
  });

  it("registerStockOut() envia POST /inventory/out e sinaliza replay quando isCached for true", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { ...mockMovement, type: "OUT" },
      isCached: true,
      status: 201,
    });

    const payload = { product_id: "prod-1", quantity: 5, reason: "OS 44" };
    const res = await inventoryApi.registerStockOut(payload, "key-out-123");

    expect(api.post).toHaveBeenCalledWith(
      "/inventory/out",
      payload,
      { idempotencyKey: "key-out-123" }
    );
    expect(res.type).toBe("OUT");
    expect(res.is_replay).toBe(true);
  });

  it("registerStockAdjustment() envia POST /inventory/adjustment", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { ...mockMovement, type: "ADJUSTMENT" },
      isCached: false,
      status: 201,
    });

    const payload = { product_id: "prod-1", quantity: 20, reason: "Inventário físico" };
    const res = await inventoryApi.registerStockAdjustment(payload);

    expect(api.post).toHaveBeenCalledWith(
      "/inventory/adjustment",
      payload,
      {}
    );
    expect(res.type).toBe("ADJUSTMENT");
    expect(res.is_replay).toBe(false);
  });

  it("lookupProduct() chama GET /products/lookup com código codificado", async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockProduct);

    const product = await inventoryApi.lookupProduct("789123456");

    expect(api.get).toHaveBeenCalledWith("/products/lookup?code=789123456");
    expect(product.id).toBe("prod-1");
  });

  it("lookupProduct() faz fallback gracioso para /products?search=... se lookup falhar", async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error("404 Not Found"))
      .mockResolvedValueOnce([mockProduct]);

    const product = await inventoryApi.lookupProduct("Eletrodo");

    expect(api.get).toHaveBeenNthCalledWith(1, "/products/lookup?code=Eletrodo");
    expect(api.get).toHaveBeenNthCalledWith(2, "/products?search=Eletrodo");
    expect(product.id).toBe("prod-1");
  });

  it("lookupProduct() lança erro amigável se nenhum produto for encontrado", async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error("404 Not Found"))
      .mockResolvedValueOnce([]);

    await expect(inventoryApi.lookupProduct("CODIGO_INEXISTENTE")).rejects.toThrow(
      'Produto não encontrado com o código "CODIGO_INEXISTENTE".'
    );
  });

  it("lookupProduct() rejeita código em branco", async () => {
    await expect(inventoryApi.lookupProduct("   ")).rejects.toThrow(
      "Código do produto não pode ser vazio."
    );
  });
});
