import { api } from "@/shared/lib/api-client";
import {
  TenantMember,
  TenantMembersSummary,
  ListMembersParams,
  ListMembersResponse,
  InviteMemberPayload,
  UpdateMemberRolePayload,
} from "../types/members.types";

export const membersApi = {
  /**
   * Consulta o resumo estatístico consolidado de membros por papel no almoxarifado.
   * Endpoint: GET /api/tenants/{tenant_id}/members/summary
   */
  async getMembersSummary(tenantId: string): Promise<TenantMembersSummary> {
    return api.get<TenantMembersSummary>(`/tenants/${tenantId}/members/summary`);
  },

  /**
   * Lista os membros vinculados ao almoxarifado com suporte a busca textual, filtro de papel e paginação.
   * Endpoint: GET /api/tenants/{tenant_id}/members
   */
  async listMembers(
    tenantId: string,
    params: ListMembersParams = {}
  ): Promise<ListMembersResponse> {
    const query = new URLSearchParams();
    if (params.role) query.set("role", params.role);
    if (params.search?.trim()) query.set("search", params.search.trim());
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.offset !== undefined) query.set("offset", String(params.offset));

    const queryString = query.toString();
    const endpoint = `/tenants/${tenantId}/members${queryString ? `?${queryString}` : ""}`;

    let items: TenantMember[] = [];
    let totalCount = 0;
    let totalPages = 1;

    if (typeof api.request === "function") {
      try {
        const res = await api.request<TenantMember[]>(endpoint, { method: "GET" });
        if (res && res.data) {
          items = res.data;
          const countHeader = res.headers?.get?.("X-Total-Count");
          const pagesHeader = res.headers?.get?.("X-Total-Pages");
          totalCount = countHeader ? parseInt(countHeader, 10) : items.length;
          totalPages = pagesHeader
            ? parseInt(pagesHeader, 10)
            : params.limit
            ? Math.max(1, Math.ceil(totalCount / params.limit))
            : 1;
        } else {
          items = await api.get<TenantMember[]>(endpoint);
          totalCount = items ? items.length : 0;
        }
      } catch (err) {
        items = await api.get<TenantMember[]>(endpoint);
        totalCount = items ? items.length : 0;
      }
    } else {
      items = await api.get<TenantMember[]>(endpoint);
      totalCount = items ? items.length : 0;
    }

    return {
      items,
      totalCount,
      totalPages,
    };
  },

  /**
   * Consulta os detalhes de um membro específico do tenant por ID de usuário.
   * Endpoint: GET /api/tenants/{tenant_id}/members/{user_id}
   */
  async getMemberById(tenantId: string, userId: string): Promise<TenantMember> {
    return api.get<TenantMember>(`/tenants/${tenantId}/members/${userId}`);
  },

  /**
   * Adiciona novo membro ao almoxarifado por email e papel inicial.
   * Endpoint: POST /api/tenants/{tenant_id}/members
   * Requer papel OWNER ou GESTOR.
   */
  async inviteMember(
    tenantId: string,
    payload: InviteMemberPayload
  ): Promise<TenantMember> {
    const response = await api.post<TenantMember>(
      `/tenants/${tenantId}/members`,
      payload
    );
    return response.data;
  },

  /**
   * Atualiza o papel RBAC de um membro no almoxarifado.
   * Endpoint: PUT /api/tenants/{tenant_id}/members/{user_id}
   * Requer papel OWNER.
   */
  async updateMemberRole(
    tenantId: string,
    userId: string,
    payload: UpdateMemberRolePayload
  ): Promise<TenantMember> {
    const response = await api.put<TenantMember>(
      `/tenants/${tenantId}/members/${userId}`,
      payload
    );
    return response.data;
  },

  /**
   * Remove o vínculo de um membro do almoxarifado.
   * Endpoint: DELETE /api/tenants/{tenant_id}/members/{user_id}
   * Requer papel OWNER.
   */
  async removeMember(tenantId: string, userId: string): Promise<void> {
    await api.delete(`/tenants/${tenantId}/members/${userId}`);
  },

  /**
   * Saída voluntária do usuário autenticado do almoxarifado.
   * Endpoint: POST /api/tenants/{tenant_id}/leave
   * Bloqueado no backend com HTTP 422 se for o único OWNER.
   */
  async leaveTenant(tenantId: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      `/tenants/${tenantId}/leave`
    );
    return response.data;
  },
};
