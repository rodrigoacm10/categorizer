import { api } from "@/shared/lib/api-client";
import { productsApi } from "@/features/products/services/products.api";
import { inventoryApi } from "@/features/inventory/services/inventory.api";
import { StockMovement } from "@/features/inventory/types/inventory.types";

export interface DashboardSummary {
  totalProducts: number;
  lowStockCount: number;
  zeroStockCount: number;
  movementsTodayCount: number;
}

export const dashboardApi = {
  /**
   * Obtém o resumo de KPIs do almoxarifado ativo.
   * Consome /api/inventory/summary ou calcula reativamente
   * a partir do catálogo de produtos e extrato das últimas 24h.
   */
  async getSummary(tenantId?: string): Promise<DashboardSummary> {
    try {
      const summary = await api.get<DashboardSummary>("/inventory/summary");
      if (
        summary &&
        typeof summary.totalProducts === "number" &&
        typeof summary.lowStockCount === "number" &&
        typeof summary.zeroStockCount === "number" &&
        typeof summary.movementsTodayCount === "number"
      ) {
        return summary;
      }
    } catch {
      // Fallback para cálculo reativo a partir das rotas ativas
    }

    const [products, movements] = await Promise.all([
      productsApi.list({ include_inactive: false }).catch(() => []),
      inventoryApi.listMovements({ limit: 500 }).catch(() => [] as StockMovement[]),
    ]);

    const totalProducts = products.length;
    const lowStockCount = products.filter((p) => Boolean(p.is_low_stock)).length;
    const zeroStockCount = products.filter((p) => {
      const scaled = p.current_quantity_scaled;
      if (typeof scaled === "number") return scaled === 0;
      return Number(p.current_quantity) === 0;
    }).length;

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const movementsTodayCount = movements.filter((m) => {
      try {
        const time = new Date(m.created_at).getTime();
        return !isNaN(time) && time >= twentyFourHoursAgo;
      } catch {
        return false;
      }
    }).length;

    return {
      totalProducts,
      lowStockCount,
      zeroStockCount,
      movementsTodayCount,
    };
  },
};
