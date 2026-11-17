import { describe, it, expect, vi, beforeEach } from "vitest";
import { tenantsApi } from "../tenants.api";
import { api } from "@/shared/lib/api-client";
import { authApi } from "@/features/auth/services/auth.api";

vi.mock("@/shared/lib/api-client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/features/auth/services/auth.api", () => ({
  authApi: {
    getMe: vi.fn(),
  },
}));

describe("tenantsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listTenants chama GET /tenants", async () => {
    (api.get as any).mockResolvedValueOnce([
      { id: "t-1", name: "Tenant 1", slug: "t-1", is_active: true },
    ]);

    const result = await tenantsApi.listTenants();
    expect(api.get).toHaveBeenCalledWith("/tenants", {
      skipTenantHeader: true,
    });
    expect(result).toHaveLength(1);
  });

  it("createTenant chama POST /tenants e retorna o tenant criado", async () => {
    (api.post as any).mockResolvedValueOnce({
      data: {
        id: "t-new",
        name: "Novo Tenant",
        slug: "novo-tenant",
        is_active: true,
      },
      status: 201,
    });

    const result = await tenantsApi.createTenant({
      name: "Novo Tenant",
      slug: "novo-tenant",
    });

    expect(api.post).toHaveBeenCalledWith(
      "/tenants",
      { name: "Novo Tenant", slug: "novo-tenant" },
      { skipTenantHeader: true }
    );
    expect(result.id).toBe("t-new");
  });

  it("getTenant chama GET /tenants/{id}", async () => {
    (api.get as any).mockResolvedValueOnce({
      id: "t-1",
      name: "Tenant 1",
      slug: "t-1",
      is_active: true,
    });

    const result = await tenantsApi.getTenant("t-1");
    expect(api.get).toHaveBeenCalledWith("/tenants/t-1", {
      skipTenantHeader: true,
    });
    expect(result.id).toBe("t-1");
  });

  it("listMembers chama GET /tenants/{id}/members", async () => {
    (api.get as any).mockResolvedValueOnce([
      {
        user_id: "u-1",
        email: "u1@empresa.com",
        full_name: "User 1",
        role: "OWNER",
        joined_at: "2026-11-11T00:00:00Z",
      },
    ]);

    const result = await tenantsApi.listMembers("t-1");
    expect(api.get).toHaveBeenCalledWith("/tenants/t-1/members", {
      skipTenantHeader: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("OWNER");
  });

  it("listTenantsWithRoles mescla papéis a partir de GET /auth/me", async () => {
    (api.get as any).mockResolvedValueOnce([
      { id: "t-1", name: "Tenant 1", slug: "t-1", is_active: true },
      { id: "t-2", name: "Tenant 2", slug: "t-2", is_active: true },
    ]);

    (authApi.getMe as any).mockResolvedValueOnce({
      id: "u-1",
      email: "u@e.com",
      full_name: "User",
      is_active: true,
      tenants: [
        { tenant_id: "t-1", tenant_name: "Tenant 1", tenant_slug: "t-1", role: "OWNER" },
        { tenant_id: "t-2", tenant_name: "Tenant 2", tenant_slug: "t-2", role: "GESTOR" },
      ],
    });

    const result = await tenantsApi.listTenantsWithRoles();
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("OWNER");
    expect(result[1].role).toBe("GESTOR");
  });
});
