import { z } from "zod";
import { TenantRole } from "@/shared/types/rbac.types";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface TenantWithRole extends Tenant {
  role?: TenantRole;
}

export interface CreateTenantPayload {
  name: string;
  slug?: string;
  description?: string;
}

export interface TenantMember {
  user_id: string;
  email: string;
  full_name: string;
  role: TenantRole;
  joined_at: string;
}

export const createTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome do almoxarifado deve ter no mínimo 2 caracteres.")
    .max(255, "O nome do almoxarifado deve ter no máximo 255 caracteres."),
  slug: z
    .string()
    .trim()
    .min(2, "O slug identificador deve ter no mínimo 2 caracteres.")
    .max(100, "O slug identificador deve ter no máximo 100 caracteres.")
    .regex(/^[a-z0-9-]+$/, "O slug deve conter apenas letras minúsculas sem acento, números e hífens."),
  description: z
    .string()
    .trim()
    .max(500, "A descrição não pode exceder 500 caracteres.")
    .optional(),
});

export type CreateTenantFormValues = z.infer<typeof createTenantSchema>;

/**
 * Converte texto livre em slug kebab-case alfanumérico para almoxarifados.
 */
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove caracteres especiais
    .replace(/[\s_]+/g, "-") // substitui espaços e underscores por hífen
    .replace(/-+/g, "-") // colapsa múltiplos hífens
    .replace(/^-+|-+$/g, ""); // remove hífens nas extremidades
}
