import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InventoryMovePage from "../page";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("InventoryMovePage (/inventory/move)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId="t-test-123" initialRole="ALMOXARIFE">
          <InventoryMovePage />
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  it("renderiza o cabeçalho industrial com links para Dashboard e Extrato", () => {
    renderPage();

    expect(screen.getByText("Bancada de Movimentações")).toBeDefined();
    expect(screen.getByText("Bancada de Movimentação Física")).toBeDefined();

    const viewLedgerBtn = screen.getByTestId("view-ledger-button");
    expect(viewLedgerBtn).toBeDefined();
    expect(viewLedgerBtn.closest("a")?.getAttribute("href")).toBe("/inventory/movements");

    const backDashboardBtn = screen.getByTestId("back-to-dashboard-button");
    expect(backDashboardBtn).toBeDefined();
    expect(backDashboardBtn.closest("a")?.getAttribute("href")).toBe("/dashboard");
  });

  it("integra o MovementForm com input de leitor de código de barras e abas", () => {
    renderPage();

    expect(screen.getByTestId("movement-form-workbench")).toBeDefined();
    expect(screen.getByTestId("barcode-search-input")).toBeDefined();
    expect(screen.getByRole("tab", { name: /Entrada \(\+\)/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Saída \(-\)/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Ajuste Físico/i })).toBeDefined();
  });
});
