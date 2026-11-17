"use client";

import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { dashboardApi, DashboardSummary } from "../services/dashboard.api";

export function useDashboardSummary() {
  const { tenantId } = useTenant();

  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary", tenantId],
    queryFn: () => dashboardApi.getSummary(tenantId || undefined),
    enabled: Boolean(tenantId),
    staleTime: 10 * 1000,
  });
}
