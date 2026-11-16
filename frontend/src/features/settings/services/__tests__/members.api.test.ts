import { describe, it, expect, vi, beforeEach } from "vitest";
import { membersApi } from "../members.api";
import { api } from "@/shared/lib/api-client";
import {
  TenantMember,
  TenantMembersSummary,
  InviteMemberPayload,
  UpdateMemberRolePayload,
} from "../../types/members.types";

vi.mock("@/shared/lib/api-client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
  },
}));

describe("membersApi (FT-19 & FT-20)", () => {
  const tenantId = "t-12345";
  const userId = "u-67890";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getMembersSummary: consulta estatísticas consolidadas de membros com sucesso", async () => {
    const mockSummary: TenantMembersSummary = {
      total_members: 5,
      owners_count: 1,
      gestores_count: 2,
      almoxarifes_count: 1,
      auditores_count: 1,
    };

    vi.mocked(api.get).mockResolvedValueOnce(mockSummary);

    const result = await membersApi.getMembersSummary(tenantId);

    expect(api.get).toHaveBeenCalledWith(`/tenants/${tenantId}/members/summary`);
    expect(result).toEqual(mockSummary);
  });

  it("listMembers: extrai cabeçalhos de paginação X-Total-Count e X-Total-Pages via api.request", async () => {
    const mockMembers: TenantMember[] = [
      {
        user_id: "u-1",
        email: "owner@empresa.com",
        full_name: "Carlos Owner",
        role: "OWNER",
        joined_at: "2026-11-10T10:00:00Z",
      },
    ];

    const headersMap = new Map<string, string>();
    headersMap.set("x-total-count", "25");
    headersMap.set("x-total-pages", "3");

    vi.mocked(api.request).mockResolvedValueOnce({
      data: mockMembers,
      isCached: false,
      status: 200,
      headers: {
        get: (key: string) => headersMap.get(key.toLowerCase()) || null,
      } as unknown as Headers,
    });

    const result = await membersApi.listMembers(tenantId, {
      role: "OWNER",
      search: "carlos",
      limit: 10,
      offset: 0,
    });

    expect(api.request).toHaveBeenCalledWith(
      `/tenants/${tenantId}/members?role=OWNER&search=carlos&limit=10&offset=0`,
      { method: "GET" }
    );
    expect(result.items).toEqual(mockMembers);
    expect(result.totalCount).toBe(25);
    expect(result.totalPages).toBe(3);
  });

  it("listMembers: fallback gracioso se api.request falhar ou headers não estiverem presentes", async () => {
    const mockMembers: TenantMember[] = [
      {
        user_id: "u-2",
        email: "gestor@empresa.com",
        full_name: "Mariana Gestora",
        role: "GESTOR",
        joined_at: "2026-11-12T10:00:00Z",
      },
    ];

    vi.mocked(api.request).mockRejectedValueOnce(new Error("Network glitch"));
    vi.mocked(api.get).mockResolvedValueOnce(mockMembers);

    const result = await membersApi.listMembers(tenantId, {});

    expect(result.items).toEqual(mockMembers);
    expect(result.totalCount).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("getMemberById: consulta membro específico por ID", async () => {
    const mockMember: TenantMember = {
      user_id: userId,
      email: "almoxarife@empresa.com",
      full_name: "Pedro Almoxarife",
      role: "ALMOXARIFE",
      joined_at: "2026-11-14T10:00:00Z",
    };

    vi.mocked(api.get).mockResolvedValueOnce(mockMember);

    const result = await membersApi.getMemberById(tenantId, userId);

    expect(api.get).toHaveBeenCalledWith(`/tenants/${tenantId}/members/${userId}`);
    expect(result).toEqual(mockMember);
  });

  it("inviteMember: envia convite de novo membro com papel especificado", async () => {
    const payload: InviteMemberPayload = {
      email: "novo@empresa.com",
      role: "ALMOXARIFE",
    };

    const mockResponse: TenantMember = {
      user_id: "u-new",
      email: payload.email,
      full_name: "Novo Membro",
      role: payload.role,
      joined_at: "2026-11-16T12:00:00Z",
    };

    vi.mocked(api.post).mockResolvedValueOnce({
      data: mockResponse,
      isCached: false,
      status: 201,
      headers: new Headers(),
    });

    const result = await membersApi.inviteMember(tenantId, payload);

    expect(api.post).toHaveBeenCalledWith(
      `/tenants/${tenantId}/members`,
      payload
    );
    expect(result).toEqual(mockResponse);
  });

  it("updateMemberRole: atualiza papel de um membro existente", async () => {
    const payload: UpdateMemberRolePayload = {
      role: "GESTOR",
    };

    const mockResponse: TenantMember = {
      user_id: userId,
      email: "operador@empresa.com",
      full_name: "Operador Promovido",
      role: "GESTOR",
      joined_at: "2026-11-10T10:00:00Z",
    };

    vi.mocked(api.put).mockResolvedValueOnce({
      data: mockResponse,
      isCached: false,
      status: 200,
      headers: new Headers(),
    });

    const result = await membersApi.updateMemberRole(tenantId, userId, payload);

    expect(api.put).toHaveBeenCalledWith(
      `/tenants/${tenantId}/members/${userId}`,
      payload
    );
    expect(result).toEqual(mockResponse);
  });

  it("removeMember: emite DELETE para desvincular membro", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({
      data: undefined,
      isCached: false,
      status: 200,
      headers: new Headers(),
    });

    await membersApi.removeMember(tenantId, userId);

    expect(api.delete).toHaveBeenCalledWith(`/tenants/${tenantId}/members/${userId}`);
  });

  it("leaveTenant: emite POST para /leave para saída voluntária", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { message: "Você saiu do almoxarifado com sucesso." },
      isCached: false,
      status: 200,
      headers: new Headers(),
    });

    const result = await membersApi.leaveTenant(tenantId);

    expect(api.post).toHaveBeenCalledWith(`/tenants/${tenantId}/leave`);
    expect(result.message).toContain("Você saiu do almoxarifado");
  });
});
