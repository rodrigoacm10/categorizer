/**
 * DTO com o detalhe de divergência matemática contábil de um produto específico.
 * Mapeia o contrato de backend `ProductDiscrepancyDto`.
 */
export interface ProductDiscrepancy {
  product_id: string;
  product_name: string;
  current_quantity: number;
  expected_quantity: number;
  difference: number;
  has_discrepancy: boolean;
}

/**
 * DTO com o relatório consolidado de auditoria e reconciliação matemática contábil.
 * Mapeia o contrato de backend `InventoryReconciliationReportDto`.
 */
export interface InventoryReconciliationReport {
  tenant_id: string;
  total_products_checked: number;
  discrepant_products_count: number;
  is_reconciled: boolean;
  discrepancies: ProductDiscrepancy[];
  generated_at: string;
}

/**
 * Filtro de exibição na bancada de reconciliação.
 */
export type ReconciliationFilterMode = "all" | "discrepant_only";
