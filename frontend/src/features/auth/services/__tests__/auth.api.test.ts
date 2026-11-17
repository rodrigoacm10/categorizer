import { describe, it, expect, vi, beforeEach } from "vitest";
import { authApi } from "../auth.api";
import { api } from "@/shared/lib/api-client";

vi.mock("@/shared/lib/api-client", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chama POST /auth/login com credenciais e skipAuth", async () => {
    (api.post as any).mockResolvedValueOnce({
      data: {
        access_token: "token-123",
        token_type: "bearer",
        expires_in: 3600,
      },
      status: 200,
    });

    const result = await authApi.login({
      email: "test@empresa.com",
      password: "Senha12345",
    });

    expect(api.post).toHaveBeenCalledWith(
      "/auth/login",
      { email: "test@empresa.com", password: "Senha12345" },
      { skipAuth: true, skipTenantHeader: true }
    );
    expect(result.access_token).toBe("token-123");
  });

  it("chama GET /auth/me para obter perfil e tenants", async () => {
    (api.get as any).mockResolvedValueOnce({
      id: "u-1",
      email: "test@empresa.com",
      full_name: "Test User",
      is_active: true,
      tenants: [],
    });

    const result = await authApi.getMe();
    expect(api.get).toHaveBeenCalledWith("/auth/me", {
      skipTenantHeader: true,
    });
    expect(result.full_name).toBe("Test User");
  });

  it("chama POST /auth/register para cadastrar novo usuário", async () => {
    (api.post as any).mockResolvedValueOnce({
      data: {
        id: "u-new",
        email: "novo@empresa.com",
        full_name: "Novo",
        is_active: true,
        created_at: "2026-11-11T12:00:00Z",
      },
      status: 201,
    });

    const result = await authApi.register({
      email: "novo@empresa.com",
      password: "SenhaForte123",
      full_name: "Novo",
    });

    expect(api.post).toHaveBeenCalledWith(
      "/auth/register",
      {
        email: "novo@empresa.com",
        password: "SenhaForte123",
        full_name: "Novo",
      },
      { skipAuth: true, skipTenantHeader: true }
    );
    expect(result.id).toBe("u-new");
  });
});
