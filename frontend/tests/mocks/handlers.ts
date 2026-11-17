import { vi } from "vitest";
import { Product } from "@/features/products/types/product.types";
import { Category } from "@/features/categories/types/category.types";
import { StockMovement } from "@/features/inventory/types/inventory.types";
import { InventoryReconciliationReport } from "@/features/inventory/types/reconciliation.types";
import { TenantMember, TenantMembersSummary } from "@/features/settings/types/members.types";
import { ProblemDetails } from "@/shared/types/rfc7807.types";

/**
 * Handlers e Fixtures de Mock de Rede (FT-21 / FT-22).
 * Simula respostas determinísticas da API FastAPI para testes de integração de:
 * - Idempotência RFC 9474 (X-Idempotency-Key, Replay X-Cache: HIT e 409 Conflict)
 * - Matriz RBAC (OWNER, GESTOR, ALMOXARIFE, AUDITOR)
 * - Reconciliação Contábil (/api/inventory/reconciliation)
 */

export const MOCK_TENANT_ID = "tenant-idemp-01";
export const MOCK_JWT_TOKEN = "mock-jwt-token-homologation";

export const mockProductFixture: Product = {
  id: "prod-idemp-01",
  name: "Barra Roscada Zincada 1m",
  description: "Barra roscada 1/2 polegada",
  unit: "UN",
  current_quantity: 50.0,
  current_quantity_scaled: 50000,
  min_stock: 10.0,
  min_stock_scaled: 10000,
  is_low_stock: false,
  is_active: true,
  categories: [
    {
      id: "cat-fixadores-01",
      name: "Fixadores Industriais",
      color: "#2563EB",
      created_at: "2026-11-01T10:00:00Z",
    },
  ],
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-01T10:00:00Z",
};

export const mockCategoriesFixture: Category[] = [
  {
    id: "cat-fixadores-01",
    name: "Fixadores Industriais",
    description: "Parafusos, porcas, arruelas e barras roscadas",
    color: "#2563EB",
    created_at: "2026-11-01T10:00:00Z",
  },
  {
    id: "cat-epi-02",
    name: "EPIs e Segurança",
    description: "Equipamentos de proteção individual",
    color: "#16A34A",
    created_at: "2026-11-01T10:00:00Z",
  },
];

export const mockMembersFixture: TenantMember[] = [
  {
    user_id: "user-owner-01",
    email: "owner@almoxarifado.com",
    full_name: "Roberto Titular",
    role: "OWNER",
    joined_at: "2026-11-01T08:00:00Z",
  },
  {
    user_id: "user-gestor-02",
    email: "gestor@almoxarifado.com",
    full_name: "Fernanda Gestora",
    role: "GESTOR",
    joined_at: "2026-11-02T09:00:00Z",
  },
  {
    user_id: "user-almox-03",
    email: "operador@almoxarifado.com",
    full_name: "Carlos Almoxarife",
    role: "ALMOXARIFE",
    joined_at: "2026-11-03T10:00:00Z",
  },
  {
    user_id: "user-auditor-04",
    email: "auditor@almoxarifado.com",
    full_name: "Marina Auditora",
    role: "AUDITOR",
    joined_at: "2026-11-04T11:00:00Z",
  },
];

export const mockMembersSummaryFixture: TenantMembersSummary = {
  total_members: 4,
  owners_count: 1,
  gestores_count: 1,
  almoxarifes_count: 1,
  auditores_count: 1,
};

export const mockReconciliationBalancedFixture: InventoryReconciliationReport = {
  tenant_id: MOCK_TENANT_ID,
  total_products_checked: 25,
  discrepant_products_count: 0,
  is_reconciled: true,
  discrepancies: [],
  generated_at: "2026-11-16T14:00:00Z",
};

export interface InterceptedMutationRequest {
  url: string;
  method: string;
  headers: Headers;
  idempotencyKey: string | null;
  tenantId: string | null;
  authorization: string | null;
  body: unknown;
}

/**
 * Cria um interceptador de fetch com suporte a cache de idempotência RFC 9474:
 * - Primeira chamada com uma X-Idempotency-Key retorna 200/201 sem X-Cache: HIT.
 * - Segunda chamada com a MESMA X-Idempotency-Key e MESMO payload retorna X-Cache: HIT.
 * - Segunda chamada com a MESMA X-Idempotency-Key e DIFERENTE payload retorna 409 Conflict (RFC 7807).
 */
export function createStatefulIdempotencyFetchMock() {
  const idempotencyStore = new Map<
    string,
    { payloadRaw: string; responseBody: StockMovement }
  >();
  const interceptedRequests: InterceptedMutationRequest[] = [];

  const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method || "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const idempotencyKey = headers.get("X-Idempotency-Key");
    const tenantId = headers.get("X-Tenant-ID");
    const authorization = headers.get("Authorization");
    const payloadRaw = typeof init?.body === "string" ? init.body : "";
    const parsedBody = payloadRaw ? JSON.parse(payloadRaw) : null;

    interceptedRequests.push({
      url,
      method,
      headers,
      idempotencyKey,
      tenantId,
      authorization,
      body: parsedBody,
    });

    if (method === "POST" && idempotencyKey) {
      const existing = idempotencyStore.get(idempotencyKey);
      if (existing) {
        if (existing.payloadRaw !== payloadRaw) {
          const conflictProblem: ProblemDetails = {
            type: "https://estoque.empresa.com/errors/idempotency-conflict",
            title: "Conflito de Idempotência",
            status: 409,
            detail:
              "Conflito de transação: Chave de requisição reutilizada com dados diferentes.",
            instance: url,
          };
          return new Response(JSON.stringify(conflictProblem), {
            status: 409,
            headers: {
              "Content-Type": "application/problem+json",
              "X-Idempotency-Key": idempotencyKey,
            },
          });
        }

        return new Response(JSON.stringify(existing.responseBody), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Cache": "HIT",
            "X-Idempotency-Key": idempotencyKey,
          },
        });
      }

      const qty = Number(parsedBody?.quantity ?? 10);
      const responseBody: StockMovement = {
        id: "mov-idemp-201",
        product_id: parsedBody?.product_id || mockProductFixture.id,
        type: "IN",
        quantity: qty,
        quantity_scaled: Math.round(qty * 1000),
        balance_after: 50 + qty,
        balance_after_scaled: Math.round((50 + qty) * 1000),
        reason: parsedBody?.reason || "Entrada de teste",
        idempotency_key: idempotencyKey,
        created_at: "2026-11-16T14:00:00Z",
      };

      idempotencyStore.set(idempotencyKey, {
        payloadRaw,
        responseBody,
      });

      return new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "X-Cache": "MISS",
          "X-Idempotency-Key": idempotencyKey,
        },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  return {
    fetchMock,
    interceptedRequests,
    idempotencyStore,
  };
}
