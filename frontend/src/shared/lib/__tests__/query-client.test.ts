import { describe, it, expect } from "vitest";
import { createQueryClient, queryKeys } from "../query-client";
import { ProblemDetailsError } from "../../types/rfc7807.types";

describe("query-client", () => {
  it("configura staleTime de 10 segundos e gcTime de 5 minutos", () => {
    const client = createQueryClient();
    const defaultQueries = client.getDefaultOptions().queries;
    expect(defaultQueries?.staleTime).toBe(10 * 1000);
    expect(defaultQueries?.gcTime).toBe(5 * 60 * 1000);
    expect(defaultQueries?.refetchOnWindowFocus).toBe(false);
  });

  it("desativa retry (retry: 0) para mutações", () => {
    const client = createQueryClient();
    const defaultMutations = client.getDefaultOptions().mutations;
    expect(defaultMutations?.retry).toBe(0);
  });

  it("não realiza retry para erros 4xx de cliente", () => {
    const client = createQueryClient();
    const retryFn = client.getDefaultOptions().queries?.retry;
    expect(typeof retryFn).toBe("function");

    if (typeof retryFn === "function") {
      const error400 = { status: 400, message: "Bad Request" };
      const error403 = { status: 403, message: "Forbidden" };
      const error404 = { status: 404, message: "Not Found" };
      const error422 = { status: 422, message: "Unprocessable Entity" };

      expect(retryFn(0, error400 as unknown as Error)).toBe(false);
      expect(retryFn(0, error403 as unknown as Error)).toBe(false);
      expect(retryFn(0, error404 as unknown as Error)).toBe(false);
      expect(retryFn(0, error422 as unknown as Error)).toBe(false);
    }
  });

  it("não realiza retry para ProblemDetailsError com status 4xx", () => {
    const client = createQueryClient();
    const retryFn = client.getDefaultOptions().queries?.retry;

    if (typeof retryFn === "function") {
      const problemError = new ProblemDetailsError({
        type: "about:blank",
        title: "Forbidden",
        status: 403,
        detail: "Sem permissão",
      });

      expect(retryFn(0, problemError)).toBe(false);
    }
  });

  it("permite até 1 retry para erro 500 ou de rede", () => {
    const client = createQueryClient();
    const retryFn = client.getDefaultOptions().queries?.retry;

    if (typeof retryFn === "function") {
      const serverError = { status: 500, message: "Internal Server Error" };
      expect(retryFn(0, serverError as unknown as Error)).toBe(true);
      expect(retryFn(1, serverError as unknown as Error)).toBe(false);

      const networkError = new Error("Network failed");
      expect(retryFn(0, networkError)).toBe(true);
      expect(retryFn(1, networkError)).toBe(false);
    }
  });

  describe("queryKeys factory", () => {
    it("inclui tenant_id ativo como primeiro argumento de escopo para produtos, categorias e inventário", () => {
      const tenantId = "uuid-tenant-abc";

      expect(queryKeys.products.all(tenantId)).toEqual(["products", "uuid-tenant-abc"]);
      expect(queryKeys.products.detail(tenantId, "p-1")).toEqual(["products", "uuid-tenant-abc", "detail", "p-1"]);
      expect(queryKeys.products.alerts(tenantId)).toEqual(["products", "uuid-tenant-abc", "alerts"]);

      expect(queryKeys.categories.list(tenantId)).toEqual(["categories", "uuid-tenant-abc"]);

      expect(queryKeys.inventory.movements(tenantId, { limit: 10 })).toEqual([
        "inventory",
        "uuid-tenant-abc",
        "movements",
        { limit: 10 },
      ]);
      expect(queryKeys.inventory.ledgerByProduct(tenantId, "p-1")).toEqual([
        "inventory",
        "uuid-tenant-abc",
        "ledger",
        "p-1",
      ]);
    });
  });
});
