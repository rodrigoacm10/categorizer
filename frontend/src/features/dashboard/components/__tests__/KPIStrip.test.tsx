import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KPIStrip } from "../KPIStrip";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { dashboardApi } from "../../services/dashboard.api";

vi.mock("../../services/dashboard.api", () => ({
  dashboardApi: {
    getSummary: vi.fn(),
  },
}));

describe("KPIStrip (FT-09)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId="tenant-test-123" initialRole="OWNER">
          {ui}
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  it("renderiza as 4 métricas operacionais com valores formatados via props", () => {
    const summary = {
      totalProducts: 1250,
      lowStockCount: 14,
      zeroStockCount: 3,
      movementsTodayCount: 89,
    };

    renderWithProviders(<KPIStrip summary={summary} />);

    // Rótulos das 4 métricas
    expect(screen.getByText(/ITENS NO CATÁLOGO/i)).toBeDefined();
    expect(screen.getByText(/ALERTA ESTOQUE BAIXO/i)).toBeDefined();
    expect(screen.getByText(/ESTOQUE ZERADO/i)).toBeDefined();
    expect(screen.getByText(/MOVIMENTAÇÕES HOJE/i)).toBeDefined();

    // Valores formatados em pt-BR
    expect(screen.getByTestId("kpi-value-catalog-total").textContent).toBe("1.250");
    expect(screen.getByTestId("kpi-value-low-stock-alert").textContent).toBe("14");
    expect(screen.getByTestId("kpi-value-zero-stock-alert").textContent).toBe("3");
    expect(screen.getByTestId("kpi-value-movements-24h").textContent).toBe("89");

    // Badges de alerta e crítico
    expect(screen.getByText("Alerta")).toBeDefined();
    expect(screen.getByText("Crítico")).toBeDefined();
  });

  it("renderiza valores zerados (0) sem crash e sem badges de perigo ativo", () => {
    const summary = {
      totalProducts: 0,
      lowStockCount: 0,
      zeroStockCount: 0,
      movementsTodayCount: 0,
    };

    renderWithProviders(<KPIStrip summary={summary} />);

    expect(screen.getByTestId("kpi-value-catalog-total").textContent).toBe("0");
    expect(screen.getByTestId("kpi-value-low-stock-alert").textContent).toBe("0");
    expect(screen.getByTestId("kpi-value-zero-stock-alert").textContent).toBe("0");
    expect(screen.getByTestId("kpi-value-movements-24h").textContent).toBe("0");

    // Não deve exibir badge "Crítico" ou "Alerta" se o estoque zerado for 0
    expect(screen.queryByText("Crítico")).toBeNull();
    expect(screen.queryByText("Alerta")).toBeNull();
  });

  it("exibe estado de carregamento com skeletons discretos", () => {
    renderWithProviders(<KPIStrip isLoading={true} />);

    const skeleton = screen.getByTestId("kpi-strip-skeleton");
    expect(skeleton).toBeDefined();
    expect(skeleton.getAttribute("aria-busy")).toBe("true");
  });

  it("exibe estado de erro e permite acionar retry", () => {
    const mockRetry = vi.fn();
    renderWithProviders(<KPIStrip isError={true} onRetry={mockRetry} />);

    expect(
      screen.getByText(/Falha ao carregar indicadores de estoque do almoxarifado/i)
    ).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: /Tentar novamente/i });
    fireEvent.click(retryBtn);

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it("consome dados reativamente da API quando não fornecido via props", async () => {
    (dashboardApi.getSummary as any).mockResolvedValueOnce({
      totalProducts: 45,
      lowStockCount: 2,
      zeroStockCount: 1,
      movementsTodayCount: 10,
    });

    renderWithProviders(<KPIStrip />);

    // Inicialmente mostra skeleton enquanto busca
    expect(screen.getByTestId("kpi-strip-skeleton")).toBeDefined();

    // Após resolução da query
    await waitFor(() => {
      expect(screen.getByTestId("kpi-value-catalog-total").textContent).toBe("45");
      expect(screen.getByTestId("kpi-value-low-stock-alert").textContent).toBe("2");
      expect(screen.getByTestId("kpi-value-zero-stock-alert").textContent).toBe("1");
      expect(screen.getByTestId("kpi-value-movements-24h").textContent).toBe("10");
    });
  });
});
