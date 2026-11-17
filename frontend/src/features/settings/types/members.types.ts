import { TenantRole } from "@/shared/types/rbac.types";

export type { TenantRole };

export interface TenantMember {
  user_id: string;
  email: string;
  full_name: string;
  role: TenantRole;
  joined_at: string;
}

export interface TenantMembersSummary {
  total_members: number;
  owners_count: number;
  gestores_count: number;
  almoxarifes_count: number;
  auditores_count: number;
}

export interface ListMembersParams {
  role?: TenantRole;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListMembersResponse {
  items: TenantMember[];
  totalCount: number;
  totalPages: number;
}

export interface InviteMemberPayload {
  email: string;
  role: TenantRole;
}

export interface UpdateMemberRolePayload {
  role: TenantRole;
}
