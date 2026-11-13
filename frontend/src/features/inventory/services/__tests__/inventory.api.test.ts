import { describe, it, expect, vi, beforeEach } from "vitest";
import { inventoryApi } from "../inventory.api";
import { api } from "@/shared/lib/api-client";
import { StockMovement } from "../../types/inventory.types";

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
});
