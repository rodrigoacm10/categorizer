/**
 * Papéis de acesso RBAC no escopo do tenant (tenant_memberships).
 */
export type TenantRole = "OWNER" | "GESTOR" | "ALMOXARIFE" | "AUDITOR";

/**
 * Ações e permissões operacionais do frontend.
 */
export type ActionType =
  | "view_dashboard"
  | "view_products"
  | "create_product"
  | "edit_product"
  | "inactivate_product"
  | "delete_product"
  | "view_movements"
  | "view_ledger"
  | "stock_in"
  | "stock_out"
  | "stock_adjustment"
  | "view_categories"
  | "manage_categories"
  | "view_members"
  | "invite_member"
  | "manage_members"
  | "manage_tenant"
  | "view_audit"
  | "reconcile_inventory";

/**
 * Matriz estrita de permissões por ação e papel.
 * Conforme FRONTEND_SPEC.md Seção 4 e BACKEND_SPEC.md Seção 6.3.
 */
export const RBAC_PERMISSIONS_MATRIX: Record<ActionType, readonly TenantRole[]> = {
  view_dashboard: ["OWNER", "GESTOR", "ALMOXARIFE", "AUDITOR"],
  view_products: ["OWNER", "GESTOR", "ALMOXARIFE", "AUDITOR"],
  create_product: ["OWNER", "GESTOR"],
  edit_product: ["OWNER", "GESTOR"],
  inactivate_product: ["OWNER", "GESTOR"],
  delete_product: ["OWNER", "GESTOR"],
  view_movements: ["OWNER", "GESTOR", "ALMOXARIFE", "AUDITOR"],
  view_ledger: ["OWNER", "GESTOR", "ALMOXARIFE", "AUDITOR"],
  stock_in: ["OWNER", "GESTOR", "ALMOXARIFE"],
  stock_out: ["OWNER", "GESTOR", "ALMOXARIFE"],
  stock_adjustment: ["OWNER", "GESTOR", "ALMOXARIFE", "AUDITOR"],
  view_categories: ["OWNER", "GESTOR"],
  manage_categories: ["OWNER", "GESTOR"],
  view_members: ["OWNER", "GESTOR"],
  invite_member: ["OWNER", "GESTOR"],
  manage_members: ["OWNER"],
  manage_tenant: ["OWNER"],
  view_audit: ["OWNER", "GESTOR", "AUDITOR"],
  reconcile_inventory: ["OWNER", "GESTOR", "AUDITOR"],
};
