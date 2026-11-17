import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ReconciliationPage from "../page";
import { reconciliationApi } from "@/features/inventory/services/reconciliation.api";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { InventoryReconciliationReport } from "@/features/inventory/types/reconciliation.types";

vi.mock("@/features/tenants/hooks/useTenant");
vi.mock("@/shared/hooks/useRBAC");
vi.mock("@/features/inventory/services/reconciliation.api");

describe("ReconciliationPage (/inventory/reconciliation)", () => {
  const tenantId = "t-central-123";

  const mockReportSuccess: InventoryReconciliationReport = {
    tenant_id: tenantId,
    total_products_checked: 25,
    discrepant_products_count: 0,
    is_reconciled: true,
    discrepancies: [],
    generated_at: "2026-11-16T14:40:00Z",
  };

  const mockReportDiscrepant: InventoryReconciliationReport = {
    tenant_id: tenantId,
    total_products_checked: 10,
    discrepant_products_count: 1,
    is_reconciled: false,
    discrepancies: [
      {
        product_id: "prod-1",
        product_name: "Argamassa AC-III 20kg",
        current_quantity: 40.0,
        expected_quantity: 35.0,
        difference: 5.0,
        has_discrepancy: true,
      },
    ],
    generated_at: "2026-11-16T14:40:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTenant).mockReturnValue({
      tenantId,
      role: "AUDITOR",
      isLoading: false,
      setTenant: vi.fn(),
      clearTenant: vi.fn(),
    });

    vi.mocked(useRBAC).mockReturnValue({
      role: "AUDITOR",
      can: (action: string) => {
        if (action === "view_audit") return true;
        if (action === "reconcile_inventory") return true;
        return false;
      },
      hasRole: () => true,
      isOwner: () => false,
      isGestor: () => false,
      isAlmoxarife: () => false,
      isAuditor: () => true,
    });

    vi.mocked(reconciliationApi.getReconciliationReport).mockResolvedValue(mockReportSuccess);
  });

  it("bloqueia acesso com tela informativa se o usuário não possuir permissão view_audit (ex: ALMOXARIFE)", () => {
    vi.mocked(useRBAC).mockReturnValue({
      role: "ALMOXARIFE",
      can: () => false,
      hasRole: () => false,
      isOwner: () => false,
      isGestor: () => false,
      isAlmoxarife: () => true,
      isAuditor: () => false,
    });

    render(<ReconciliationPage />);

    expect(screen.getByTestId("reconciliation-access-denied")).toBeDefined();
    expect(screen.getByText("Acesso Restrito à Auditoria Contábil")).toBeDefined();
    expect(reconciliationApi.getReconciliationReport).not.toHaveBeenCalled();
  });

  it("carrega automaticamente a reconciliação e exibe KPIs e banner de integridade para AUDITOR", async () => {
    render(<ReconciliationPage />);

    expect(screen.getByTestId("reconciliation-page")).toBeDefined();
    expect(screen.getByText("Auditoria e Reconciliação Contábil")).toBeDefined();

    await waitFor(() => {
      expect(reconciliationApi.getReconciliationReport).toHaveBeenCalledWith(tenantId);
    });

    // KPI Strip
    expect(screen.getByTestId("reconciliation-kpi-value-total").textContent).toBe("25");
    expect(screen.getByTestId("reconciliation-kpi-value-discrepancies").textContent).toBe("0");

    // Banner de sucesso
    expect(screen.getByTestId("reconciliation-banner-success")).toBeDefined();
    expect(screen.getByText("Equação Contábil Balanceada (Zero Divergência)")).toBeDefined();
  });

  it("renderiza discrepâncias e banner de alerta quando a auditoria apontar inconsistências", async () => {
    vi.mocked(reconciliationApi.getReconciliationReport).mockResolvedValue(mockReportDiscrepant);

    render(<ReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId("reconciliation-banner-discrepancy")).toBeDefined();
    });

    expect(screen.getByText("Divergência Contábil Detectada no Estoque")).toBeDefined();
    expect(screen.getByText("Argamassa AC-III 20kg")).toBeDefined();
    expect(screen.getByTestId("discrepancy-diff-prod-1").textContent).toContain("+5");
  });

  it("permite reexecutar auditoria manual ao clicar no botão 'Executar Auditoria'", async () => {
    render(<ReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId("run-reconciliation-button")).toBeDefined();
    });

    const runBtn = screen.getByTestId("run-reconciliation-button");
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(reconciliationApi.getReconciliationReport).toHaveBeenCalledTimes(2);
    });
  });

  it("exibe banner de erro quando a chamada da API falhar", async () => {
    vi.mocked(reconciliationApi.getReconciliationReport).mockRejectedValue(
      new Error("Erro interno no banco de dados")
    );

    render(<ReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId("reconciliation-error-banner")).toBeDefined();
    });

    expect(screen.getByText("Erro interno no banco de dados")).toBeDefined();
  });
});
