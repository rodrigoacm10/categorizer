import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  request,
  api,
  setUnauthorizedCallback,
  requiresTenantHeader,
  ProblemDetailsError,
} from "../api-client";
import { storage } from "../storage";

describe("api-client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    storage.clearAll();
    setUnauthorizedCallback(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("requiresTenantHeader", () => {
    it("identifica rotas sob /products, /categories, /inventory como dependentes de tenant", () => {
      expect(requiresTenantHeader("/products")).toBe(true);
      expect(requiresTenantHeader("/api/products/123")).toBe(true);
      expect(requiresTenantHeader("/categories")).toBe(true);
      expect(requiresTenantHeader("/api/inventory/move")).toBe(true);
    });

    it("identifica sub-rotas de um tenant como dependentes de tenant", () => {
      expect(requiresTenantHeader("/tenants/t-123/members")).toBe(true);
      expect(requiresTenantHeader("/api/tenants/t-123/settings")).toBe(true);
    });

    it("não exige tenant para rotas globais", () => {
      expect(requiresTenantHeader("/auth/login")).toBe(false);
      expect(requiresTenantHeader("/api/auth/me")).toBe(false);
      expect(requiresTenantHeader("/tenants")).toBe(false);
      expect(requiresTenantHeader("/api/tenants")).toBe(false);
    });
  });

  describe("Auth Interceptor", () => {
    it("injeta Authorization: Bearer <token> se token estiver presente no storage", async () => {
      storage.setToken("valid-jwt-token");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      await request("/test");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer valid-jwt-token");
    });

    it("não injeta Authorization quando skipAuth for true", async () => {
      storage.setToken("valid-jwt-token");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      await request("/test", { skipAuth: true });

      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("Authorization")).toBeNull();
    });
  });

  describe("Tenant Interceptor", () => {
    it("injeta X-Tenant-ID em rotas de domínio quando tenant está ativo", async () => {
      storage.setActiveTenantId("tenant-uuid-123");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await request("/products");

      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("X-Tenant-ID")).toBe("tenant-uuid-123");
    });

    it("lança erro preventivo antes do envio se a rota exigir tenant e nenhum estiver definido", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await expect(request("/products")).rejects.toThrow(
        "Tenant ativo não selecionado. A rota requer contexto de almoxarifado."
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("permite fornecer tenantId explicitamente nas opções", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ data: [] }),
      });
      global.fetch = mockFetch;

      await request("/products", { tenantId: "explicit-tenant-id" });

      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("X-Tenant-ID")).toBe("explicit-tenant-id");
    });
  });

  describe("Idempotency Interceptor", () => {
    it("gera automaticamente UUIDv4 para requisições POST sem chave explícita", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ id: "item-1" }),
      });
      global.fetch = mockFetch;

      const res = await request("/items", { method: "POST", body: JSON.stringify({ name: "Teste" }) });

      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;
      const key = headers.get("X-Idempotency-Key");
      expect(key).toBeDefined();
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(res.idempotencyKey).toBe(key);
    });

    it("preserva chave de idempotência explícita", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ id: "item-1" }),
      });
      global.fetch = mockFetch;

      const res = await request("/items", {
        method: "PUT",
        idempotencyKey: "custom-idempotency-key-123",
      });

      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("X-Idempotency-Key")).toBe("custom-idempotency-key-123");
      expect(res.idempotencyKey).toBe("custom-idempotency-key-123");
    });

    it("não injeta X-Idempotency-Key para métodos GET", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ items: [] }),
      });
      global.fetch = mockFetch;

      await request("/items", { method: "GET" });

      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("X-Idempotency-Key")).toBeNull();
    });

    it("captura cabeçalho X-Cache: HIT e retorna isCached: true", async () => {
      const resHeaders = new Headers();
      resHeaders.set("X-Cache", "HIT");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: resHeaders,
        json: async () => ({ result: "cached" }),
      });
      global.fetch = mockFetch;

      const res = await request("/items", { method: "POST" });
      expect(res.isCached).toBe(true);
    });
  });

  describe("RFC 7807 Error Parser e 401", () => {
    it("converte corpo RFC 7807 em ProblemDetailsError com type, title, status e detail", async () => {
      const problemPayload = {
        type: "https://estoque.internal/errors/insufficient-permissions",
        title: "Acesso Negado",
        status: 403,
        detail: "Seu perfil de acesso não permite executar esta operação.",
        invalid_params: [{ name: "role", reason: "ALMOXARIFE não pode criar produtos" }],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        headers: new Headers({ "Content-Type": "application/problem+json" }),
        json: async () => problemPayload,
      });
      global.fetch = mockFetch;

      try {
        await request("/products/new", {
          skipTenantHeader: true,
          method: "POST",
        });
        expect.unreachable("Deveria ter lançado ProblemDetailsError");
      } catch (err) {
        expect(err).toBeInstanceOf(ProblemDetailsError);
        const pErr = err as ProblemDetailsError;
        expect(pErr.status).toBe(403);
        expect(pErr.type).toBe("https://estoque.internal/errors/insufficient-permissions");
        expect(pErr.title).toBe("Acesso Negado");
        expect(pErr.detail).toBe("Seu perfil de acesso não permite executar esta operação.");
        expect(pErr.invalidParams).toHaveLength(1);
      }
    });

    it("trata erro 401 limpando credenciais e acionando callback de logout", async () => {
      storage.setToken("expired-token");
      storage.setActiveTenantId("tenant-1");

      const unauthorizedSpy = vi.fn();
      setUnauthorizedCallback(unauthorizedSpy);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers(),
        json: async () => ({ detail: "Token expired" }),
      });
      global.fetch = mockFetch;

      await expect(request("/auth/me")).rejects.toThrow(ProblemDetailsError);

      expect(storage.getToken()).toBeNull();
      expect(storage.getActiveTenantId()).toBeNull();
      expect(unauthorizedSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("api helper convenience methods", () => {
    it("api.get retorna data diretamente", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ hello: "world" }),
      });
      global.fetch = mockFetch;

      const data = await api.get<{ hello: string }>("/test");
      expect(data).toEqual({ hello: "world" });
    });

    it("api.post executa POST com body serializado em JSON", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => ({ id: "created-id" }),
      });
      global.fetch = mockFetch;

      const res = await api.post("/test", { foo: "bar" });
      expect(res.data).toEqual({ id: "created-id" });
      expect(res.status).toBe(201);
      const [, init] = mockFetch.mock.calls[0];
      expect(init.body).toBe(JSON.stringify({ foo: "bar" }));
    });
  });
});
