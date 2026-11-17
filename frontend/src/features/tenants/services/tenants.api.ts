import { api } from "@/shared/lib/api-client";
import { authApi } from "@/features/auth/services/auth.api";
import { TenantRole } from "@/shared/types/rbac.types";
import {
  Tenant,
  TenantWithRole,
  CreateTenantPayload,
  TenantMember,
} from "../types/tenant.types";

export const tenantsApi = {
  /**
   * Lista todos os almoxarifados aos quais o usuário logado possui vínculo.
   */
  async listTenants(): Promise<Tenant[]> {
    return api.get<Tenant[]>("/tenants", {
      skipTenantHeader: true,
    });
  },

  /**
   * Consulta os dados detalhados de um almoxarifado por ID.
   */
  async getTenant(id: string): Promise<Tenant> {
    return api.get<Tenant>(`/tenants/${id}`, {
      skipTenantHeader: true,
    });
  },

  /**
   * Cria novo almoxarifado (tenant) e associa o usuário criador como OWNER de forma atômica.
   */
  async createTenant(payload: CreateTenantPayload): Promise<Tenant> {
    const response = await api.post<Tenant>("/tenants", payload, {
      skipTenantHeader: true,
    });
    return response.data;
  },

  /**
   * Lista os membros vinculados a um almoxarifado específico.
   */
  async listMembers(tenantId: string): Promise<TenantMember[]> {
    return api.get<TenantMember[]>(`/tenants/${tenantId}/members`, {
      skipTenantHeader: true,
    });
  },

  /**
   * Lista os almoxarifados do usuário enriquecidos com o respectivo papel (OWNER, GESTOR, etc.)
   * combinando GET /api/tenants com GET /api/auth/me.
   */
  async listTenantsWithRoles(): Promise<TenantWithRole[]> {
    const [tenants, profile] = await Promise.all([
      this.listTenants(),
      authApi.getMe().catch(() => null),
    ]);

    const roleMap = new Map<string, TenantRole>();
    if (profile?.tenants) {
      for (const t of profile.tenants) {
        roleMap.set(t.tenant_id, t.role);
      }
    }

    return tenants.map((tenant) => ({
      ...tenant,
      role: roleMap.get(tenant.id) || "ALMOXARIFE",
    }));
  },
};
