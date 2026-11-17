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

  const mockProduct: any = {
    id: "prod-idemp-01",
    name: "Barra Roscada Zincada 1m",
    description: "Barra roscada 1/2 polegada",
    unit: "UN",
    current_quantity: 50.0,
    current_quantity_scaled: 50000,
    min_stock: 10.0,
    is_low_stock: false,
    is_active: true,
    categories: [],
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

  describe("2. Feedback Visual de Replay e Conflito no Formulário de Movimentação (MovementForm)", () => {
    it("exibe badge e mensagem amigável de Replay quando a resposta da mutação indicar is_replay: true", async () => {
      const replayMovement: any = {
        id: "mov-replay-101",
        product_id: "prod-idemp-01",
        movement_type: "IN",
        quantity: 10.0,
        balance_after: 60.0,
        reference_type: "MANUAL",
        idempotency_key: "idem-key-cached",
        created_at: "2026-11-16T12:00:00Z",
        created_by_user_id: "u-1",
        is_replay: true,
      };

      vi.mocked(inventoryApi.registerStockIn).mockResolvedValue(replayMovement);

      render(
        <QueryClientProvider client={queryClient}>
          <MovementForm initialProductId="prod-idemp-01" />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Barra Roscada Zincada 1m")).toBeDefined();
      });

      const qtyInput = screen.getByTestId("movement-quantity-input");
      fireEvent.change(qtyInput, { target: { value: "10" } });

      const submitBtn = screen.getByTestId("submit-movement-button");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId("replay-badge")).toBeDefined();
        expect(
          screen.getByText(/Operação Reexecutada/i)
        ).toBeDefined();
      });
    });

    it("captura e exibe erro RFC 7807 409 Conflict no banner de erro do formulário", async () => {
      const conflictError = new ProblemDetailsError({
        type: "idempotency-conflict",
        title: "Conflito de Idempotência",
        status: 409,
        detail: "Conflito de transação: Chave de requisição reutilizada com dados diferentes.",
      });

      vi.mocked(inventoryApi.registerStockIn).mockRejectedValue(conflictError);

      render(
        <QueryClientProvider client={queryClient}>
          <MovementForm initialProductId="prod-idemp-01" />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Barra Roscada Zincada 1m")).toBeDefined();
      });

      const qtyInput = screen.getByTestId("movement-quantity-input");
      fireEvent.change(qtyInput, { target: { value: "10" } });

      const submitBtn = screen.getByTestId("submit-movement-button");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId("submit-error-alert")).toBeDefined();
        expect(
          screen.getByText("Conflito de transação: Chave de requisição reutilizada com dados diferentes.")
        ).toBeDefined();
      });
    });
  });

  describe("3. Simulação Stateful de Cache RFC 9474 via Mock Handlers (handlers.ts)", () => {
    it("deduplica submissão idêntica com X-Cache: HIT e rejeita payload divergente com 409 Conflict", async () => {
      const { fetchMock, interceptedRequests } = createStatefulIdempotencyFetchMock();
      global.fetch = fetchMock;

      const sharedKey = "idem-stateful-uuid-9999";

      // 1ª chamada: processa normalmente (X-Cache: MISS)
      const firstRes = await api.post<StockMovement>(
        "/inventory/in",
        { product_id: "prod-idemp-01", quantity: 15, reason: "NF 100" },
        { idempotencyKey: sharedKey }
      );
      expect(firstRes.isCached).toBe(false);
      expect(firstRes.data.balance_after).toBe(65);
      expect(interceptedRequests[0].idempotencyKey).toBe(sharedKey);

      // 2ª chamada com MESMA chave e MESMO payload: retorna replay seguro (X-Cache: HIT)
      const replayRes = await api.post<StockMovement>(
        "/inventory/in",
        { product_id: "prod-idemp-01", quantity: 15, reason: "NF 100" },
        { idempotencyKey: sharedKey }
      );
      expect(replayRes.isCached).toBe(true);
      expect(replayRes.data.balance_after).toBe(65);

      // 3ª chamada com MESMA chave e PAYLOAD DIFERENTE: rejeita com 409 ProblemDetailsError
      await expect(
        api.post<StockMovement>(
          "/inventory/in",
          { product_id: "prod-idemp-01", quantity: 99, reason: "Adulterado" },
          { idempotencyKey: sharedKey }
        )
      ).rejects.toThrow(ProblemDetailsError);
    });
  });
});
