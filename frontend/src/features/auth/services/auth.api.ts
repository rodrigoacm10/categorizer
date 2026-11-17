import { api } from "@/shared/lib/api-client";
import {
  AuthToken,
  LoginCredentials,
  RegisterPayload,
  UserProfile,
  UserResponse,
} from "../types/auth.types";

export const authApi = {
  /**
   * Autentica o usuário com credenciais e retorna o access_token JWT.
   */
  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const response = await api.post<AuthToken>("/auth/login", credentials, {
      skipAuth: true,
      skipTenantHeader: true,
    });
    return response.data;
  },

  /**
   * Consulta o perfil do usuário autenticado e seus vínculos com almoxarifados (tenants).
   */
  async getMe(): Promise<UserProfile> {
    return api.get<UserProfile>("/auth/me", {
      skipTenantHeader: true,
    });
  },

  /**
   * Registra uma nova conta de usuário global no sistema.
   */
  async register(payload: RegisterPayload): Promise<UserResponse> {
    const response = await api.post<UserResponse>("/auth/register", payload, {
      skipAuth: true,
      skipTenantHeader: true,
    });
    return response.data;
  },
};
