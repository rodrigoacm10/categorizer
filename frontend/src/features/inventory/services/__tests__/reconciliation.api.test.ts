import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconciliationApi } from "../reconciliation.api";
import { api } from "@/shared/lib/api-client";
import { InventoryReconciliationReport } from "../../types/reconciliation.types";

vi.mock("@/shared/lib/api-client", () => ({
  api: {
    get: vi.fn(),
  },
}));

describe("reconciliationApi", () => {
  const tenantId = "t-galpao-central-uuid";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lança erro se tenantId for fornecido vazio", async () => {
    await expect(reconciliationApi.getReconciliationReport("")).rejects.toThrow(
      "Identificador do almoxarifado (tenantId) é obrigatório para reconciliação."
    );
    expect(api.get).not.toHaveBeenCalled();
  });

  it("chama GET /api/inventory/reconciliation passando tenantId e retorna relatório íntegro", async () => {
    const mockReport: InventoryReconciliationReport = {
      tenant_id: tenantId,
      total_products_checked: 42,
      discrepant_products_count: 0,
      is_reconciled: true,
      discrepancies: [],
      generated_at: "2026-11-16T14:30:00Z",
    };

    vi.mocked(api.get).mockResolvedValueOnce(mockReport);

    const result = await reconciliationApi.getReconciliationReport(tenantId);

    expect(api.get).toHaveBeenCalledWith("/api/inventory/reconciliation", {
      tenantId,
    });
    expect(result).toEqual(mockReport);
    expect(result.is_reconciled).toBe(true);
    expect(result.discrepant_products_count).toBe(0);
  });

  it("retorna relatório com discrepâncias quando a equação contábil apontar divergência", async () => {
    const mockReportWithDiscrepancy: InventoryReconciliationReport = {
      tenant_id: tenantId,
      total_products_checked: 10,
      discrepant_products_count: 1,
      is_reconciled: false,
      discrepancies: [
        {
          product_id: "prod-divergente-1",
          product_name: "Cabo de Cobre 10mm",
          current_quantity: 15.0,
          expected_quantity: 12.0,
          difference: 3.0,
          has_discrepancy: true,
        },
      ],
      generated_at: "2026-11-16T14:30:00Z",
    };

    vi.mocked(api.get).mockResolvedValueOnce(mockReportWithDiscrepancy);

    const result = await reconciliationApi.getReconciliationReport(tenantId);

    expect(result.is_reconciled).toBe(false);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].difference).toBe(3.0);
  });

  it("propaga erro de rede ou rejeição RFC 7807 lançada pelo apiClient", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(
      new Error("HTTP 403: tenant-access-denied")
    );

    await expect(reconciliationApi.getReconciliationReport(tenantId)).rejects.toThrow(
      "HTTP 403: tenant-access-denied"
    );
  });
});
