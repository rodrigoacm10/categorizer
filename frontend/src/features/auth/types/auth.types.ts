import { z } from "zod";
import { TenantRole } from "@/shared/types/rbac.types";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface TenantBrief {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: TenantRole;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  tenants: TenantBrief[];
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "E-mail institucional é obrigatório.")
    .email("Informe um endereço de e-mail válido."),
  password: z
    .string()
    .min(1, "Senha de acesso é obrigatória.")
    .min(8, "A senha deve conter no mínimo 8 caracteres."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(1, "Nome completo é obrigatório.")
      .min(2, "O nome deve ter no mínimo 2 caracteres.")
      .max(255, "O nome deve ter no máximo 255 caracteres."),
    email: z
      .string()
      .trim()
      .min(1, "E-mail corporativo é obrigatório.")
      .email("Informe um endereço de e-mail válido."),
    password: z
      .string()
      .min(1, "Senha é obrigatória.")
      .min(8, "A senha deve ter no mínimo 8 caracteres.")
      .regex(/\d/, "A senha deve conter pelo menos um número.")
      .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula."),
    confirm_password: z
      .string()
      .min(1, "Confirmação de senha é obrigatória."),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "As senhas não coincidem.",
    path: ["confirm_password"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
