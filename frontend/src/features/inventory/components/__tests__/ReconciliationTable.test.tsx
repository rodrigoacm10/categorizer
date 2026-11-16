import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ReconciliationTable } from "../ReconciliationTable";
import { ReconciliationBanner } from "../ReconciliationBanner";
import { ReconciliationKPIStrip } from "../ReconciliationKPIStrip";
import { ProductDiscrepancy, InventoryReconciliationReport } from "../../types/reconciliation.types";

describe("Reconciliation UI Components (Impeccable Workbench)", () => {
  const mockDiscrepancies: ProductDiscrepancy[] = [
    {
      product_id: "prod-integro-1",
      product_name: "Cimento CP II 50kg",
      current_quantity: 100.0,
      expected_quantity: 100.0,
      difference: 0.0,
      has_discrepancy: false,
    },
    {
      product_id: "prod-divergente-2",
      product_name: "Tijolo Cerâmico 8 Furos",
      current_quantity: 500.0,
      expected_quantity: 480.0,
      difference: 20.0,
      has_discrepancy: true,
    },
    {
      product_id: "prod-divergente-3",
      product_name: "Areia Lavada Média m³",
      current_quantity: 10.0,
      expected_quantity: 12.5,
      difference: -2.5,
      has_discrepancy: true,
    },
  ];

  describe("ReconciliationTable", () => {
    it("renderiza cabeçalhos escuros e linhas dos produtos auditados", () => {
      render(
        <ReconciliationTable
          discrepancies={mockDiscrepancies}
          totalProductsChecked={3}
        />
      );

      expect(screen.getByTestId("reconciliation-table")).toBeDefined();
      expect(screen.getByText("Cimento CP II 50kg")).toBeDefined();
      expect(screen.getByText("Tijolo Cerâmico 8 Furos")).toBeDefined();
      expect(screen.getByText("Areia Lavada Média m³")).toBeDefined();

      // Verificação de vereditos e deltas
      expect(screen.getByTestId("verdict-ok-prod-integro-1")).toBeDefined();
      expect(screen.getByTestId("verdict-divergent-prod-divergente-2")).toBeDefined();
      expect(screen.getByTestId("discrepancy-diff-prod-divergente-2").textContent).toContain("+20");
      expect(screen.getByTestId("discrepancy-diff-prod-divergente-3").textContent).toContain("-2,5");
    });

    it("filtra produtos por busca textual", () => {
      render(
        <ReconciliationTable
          discrepancies={mockDiscrepancies}
          totalProductsChecked={3}
        />
      );

      const searchInput = screen.getByTestId("reconciliation-search-input");
      fireEvent.change(searchInput, { target: { value: "cimento" } });

      expect(screen.getByText("Cimento CP II 50kg")).toBeDefined();
      expect(screen.queryByText("Tijolo Cerâmico 8 Furos")).toBeNull();
      expect(screen.queryByText("Areia Lavada Média m³")).toBeNull();
    });

    it("filtra apenas divergências ao clicar na pílula 'Apenas Divergentes'", () => {
      render(
        <ReconciliationTable
          discrepancies={mockDiscrepancies}
          totalProductsChecked={3}
        />
      );

      const divergentPill = screen.getByTestId("filter-pill-discrepant");
      fireEvent.click(divergentPill);

      expect(screen.queryByText("Cimento CP II 50kg")).toBeNull();
      expect(screen.getByText("Tijolo Cerâmico 8 Furos")).toBeDefined();
      expect(screen.getByText("Areia Lavada Média m³")).toBeDefined();
    });

    it("exibe estado vazio amigável quando nenhum item atender aos filtros", () => {
      render(
        <ReconciliationTable
          discrepancies={[]}
          totalProductsChecked={10}
        />
      );

      expect(screen.getByTestId("reconciliation-empty-row")).toBeDefined();
      expect(screen.getByText("Nenhuma divergência localizada")).toBeDefined();
    });
  });

  describe("ReconciliationBanner", () => {
    it("renderiza banner de sucesso quando a equação contábil estiver balanceada", () => {
      render(
        <ReconciliationBanner
          isReconciled={true}
          totalProductsChecked={50}
          discrepantCount={0}
        />
      );

      expect(screen.getByTestId("reconciliation-banner-success")).toBeDefined();
      expect(screen.getByText("Equação Contábil Balanceada (Zero Divergência)")).toBeDefined();
      expect(screen.queryByTestId("reconciliation-banner-discrepancy")).toBeNull();
    });

    it("renderiza banner de advertência quando houver divergência detectada", () => {
      render(
        <ReconciliationBanner
          isReconciled={false}
          totalProductsChecked={50}
          discrepantCount={2}
        />
      );

      expect(screen.getByTestId("reconciliation-banner-discrepancy")).toBeDefined();
      expect(screen.getByText("Divergência Contábil Detectada no Estoque")).toBeDefined();
      expect(screen.queryByTestId("reconciliation-banner-success")).toBeNull();
    });
  });

  describe("ReconciliationKPIStrip", () => {
    it("renderiza faixa contínua de KPIs com valores formatados e badges", () => {
      const mockReport: InventoryReconciliationReport = {
        tenant_id: "t-1",
        total_products_checked: 15,
        discrepant_products_count: 0,
        is_reconciled: true,
        discrepancies: [],
        generated_at: "2026-11-16T14:30:00Z",
      };

      render(<ReconciliationKPIStrip report={mockReport} />);

      expect(screen.getByTestId("reconciliation-kpi-strip")).toBeDefined();
      expect(screen.getByTestId("reconciliation-kpi-value-total").textContent).toBe("15");
      expect(screen.getByTestId("reconciliation-kpi-value-discrepancies").textContent).toBe("0");
      expect(screen.getByTestId("reconciliation-kpi-value-integrity").textContent).toBe("Equilibrada");
      expect(screen.getByTestId("reconciliation-kpi-badge-integrity").textContent).toBe("Auditoria OK");
    });
  });
});
