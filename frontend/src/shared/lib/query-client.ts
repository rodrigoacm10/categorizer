import { QueryClient } from "@tanstack/react-query";
import { ProblemDetailsError } from "../types/rfc7807.types";

/**
 * Cria uma instância do QueryClient configurada para bancada industrial de alta densidade:
 * - 10s staleTime para dados de catálogo
 * - 5 min gcTime para coleta de memória
 * - Retry: 1 para GET (com supressão imediata de erros 4xx / RFC 7807)
 * - Retry: 0 para mutações (evita disparos duplos sem intervenção do operador)
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Desativa retry para qualquer erro HTTP 4xx (cliente, validação ou RFC 7807)
          if (error instanceof ProblemDetailsError) {
            if (error.status >= 400 && error.status < 500) {
              return false;
            }
          }
          if (error && typeof error === "object" && "status" in error) {
            const status = (error as { status: unknown }).status;
            if (typeof status === "number" && status >= 400 && status < 500) {
              return false;
            }
          }
          // No máximo 1 tentativa para falhas de rede ou 5xx
          return failureCount < 1;
        },
      },
      mutations: {
        // Mutações nunca realizam retry automático para prevenir duplicidade de operações físicas
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: sempre cria novo client por requisição
    return createQueryClient();
  } else {
    // Browser: reutiliza instância singleton
    if (!browserQueryClient) {
      browserQueryClient = createQueryClient();
    }
    return browserQueryClient;
  }
}

/**
 * Fábrica padronizada de chaves de query (Query Keys)
 * Todas as entidades de domínio são escopadas estritamente pelo tenant_id ativo.
 */
export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  tenants: {
    list: ["tenants", "list"] as const,
    detail: (id: string) => ["tenants", "detail", id] as const,
    members: (tenantId: string) => ["tenants", tenantId, "members"] as const,
  },
  products: {
    all: (tenantId: string) => ["products", tenantId] as const,
    list: (tenantId: string, filters: Record<string, unknown> = {}) =>
      ["products", tenantId, "list", filters] as const,
    detail: (tenantId: string, id: string) =>
      ["products", tenantId, "detail", id] as const,
    alerts: (tenantId: string) => ["products", tenantId, "alerts"] as const,
  },
  categories: {
    list: (tenantId: string) => ["categories", tenantId] as const,
  },
  inventory: {
    movements: (tenantId: string, filters: Record<string, unknown> = {}) =>
      ["inventory", tenantId, "movements", filters] as const,
    ledgerByProduct: (tenantId: string, productId: string) =>
      ["inventory", tenantId, "ledger", productId] as const,
  },
};
