import { api } from "@/shared/lib/api-client";
import { InventoryReconciliationReport } from "../types/reconciliation.types";

/**
 * reconciliationApi:
 * Camada de serviço de integração HTTP com o endpoint de auditoria contábil do inventário:
 * GET /api/inventory/reconciliation
 * Valida formalmente se sum(delta) == current_quantity para todos os produtos do tenant.
 */
export const reconciliationApi = {
  /**
   * Executa auditoria contábil e reconciliação matemática no tenant especificado.
   * Exige permissão de OWNER, GESTOR ou AUDITOR.
   */
  async getReconciliationReport(tenantId: string): Promise<InventoryReconciliationReport> {
    if (!tenantId) {
      throw new Error("Identificador do almoxarifado (tenantId) é obrigatório para reconciliação.");
    }

    return api.get<InventoryReconciliationReport>("/api/inventory/reconciliation", {
      tenantId,
    });
  },
};
