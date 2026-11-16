import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, request } from "@/shared/lib/api-client";
import { storage } from "@/shared/lib/storage";
import { ProblemDetailsError } from "@/shared/types/rfc7807.types";
import { MovementForm } from "@/features/inventory/components/MovementForm";
import { inventoryApi } from "@/features/inventory/services/inventory.api";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Product } from "@/features/products/types/product.types";
import { StockMovement } from "@/features/inventory/types/inventory.types";
import { createStatefulIdempotencyFetchMock } from "../mocks/handlers";

vi.mock("@/features/tenants/hooks/useTenant");
vi.mock("@/shared/hooks/useRBAC");
vi.mock("@/features/inventory/services/inventory.api");

describe("FT-21: Suíte de Integração de Idempotência, Replay (X-Cache: HIT) e Detecção de Conflito 409", () => {
  const originalFetch = global.fetch;
  let queryClient: QueryClient;

  const mockProduct: Product = {
    id: "prod-idemp-01",
    tenant_id: "tenant-idemp-01",
    sku: "SKU-IDEMP-01",
    name: "Barra Roscada Zincada 1m",
    description: "Barra roscada 1/2 polegada",
    unit: "UN",
    current_quantity: 50.0,
    min_stock: 10.0,
    is_active: true,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    storage.clearAll();
    storage.setToken("mock-jwt-token");
    storage.setActiveTenantId("tenant-idemp-01");

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(useTenant).mockReturnValue({
      tenantId: "tenant-idemp-01",
      role: "OWNER",
      isLoading: false,
      setTenant: vi.fn(),
      clearTenant: vi.fn(),
    });

    vi.mocked(useRBAC).mockReturnValue({
      role: "OWNER",
      can: () => true,
      hasRole: () => true,
      isOwner: () => true,
      isGestor: () => false,
      isAlmoxarife: () => false,
      isAuditor: () => false,
    });

    vi.mocked(inventoryApi.lookupProduct).mockResolvedValue(mockProduct);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("1. Interceptor de Idempotência na Camada de Rede (api-client)", () => {
    it("injeta automaticamente cabeçalho X-Idempotency-Key com formato UUIDv4 em requisições POST", async () => {
      let interceptedHeaders: Headers | undefined;

      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        interceptedHeaders = new Headers(options.headers);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const res = await api.post("/api/inventory/in", { quantity: 10 });

      expect(res.data).toEqual({ success: true });
      expect(interceptedHeaders?.has("X-Idempotency-Key")).toBe(true);

      const generatedKey = interceptedHeaders?.get("X-Idempotency-Key");
      expect(generatedKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("preserva a chave idempotente customizada passada explicitamente nas opções", async () => {
      let interceptedHeaders: Headers | undefined;
      const customKey = "custom-idempotency-key-uuid-1234";

      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        interceptedHeaders = new Headers(options.headers);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      await api.post("/api/inventory/in", { quantity: 10 }, { idempotencyKey: customKey });

      expect(interceptedHeaders?.get("X-Idempotency-Key")).toBe(customKey);
    });

    it("captura cabeçalho de resposta X-Cache: HIT e retorna isCached: true", async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify({ movement_id: "mov-cached-1", quantity: 10 }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Cache": "HIT",
            "X-Idempotency-Key": "key-already-seen-1",
          },
        });
      });

      const res = await request<{ movement_id: string }>("/api/inventory/in", {
        method: "POST",
        body: JSON.stringify({ quantity: 10 }),
      });

      expect(res.isCached).toBe(true);
      expect(res.idempotencyKey).toBe("key-already-seen-1");
      expect(res.data.movement_id).toBe("mov-cached-1");
    });

    it("lança ProblemDetailsError com status 409 quando o backend reportar idempotency-conflict", async () => {
      const conflictPayload = {
        type: "https://estoque.empresa.com/errors/idempotency-conflict",
        title: "Idempotency Conflict",
        status: 409,
        detail: "A chave de idempotência fornecida já foi processada com outro payload.",
        instance: "/api/inventory/in",
      };

      global.fetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify(conflictPayload), {
          status: 409,
          headers: { "Content-Type": "application/problem+json" },
        });
      });

      await expect(
        request("/api/inventory/in", {
          method: "POST",
          body: JSON.stringify({ quantity: 20 }),
        })
      ).rejects.toThrow(ProblemDetailsError);

      try {
        await request("/api/inventory/in", {
          method: "POST",
          body: JSON.stringify({ quantity: 20 }),
        });
      } catch (err: unknown) {
        const problemErr = err as ProblemDetailsError;
        expect(problemErr.status).toBe(409);
        expect(problemErr.problem.detail).toContain("já foi processada com outro payload");
      }
    });
  });
});
