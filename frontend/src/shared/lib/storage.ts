/**
 * Camada de persistência segura com suporte simultâneo a localStorage e cookies.
 * Permite que o estado de autenticação e tenant ativo seja lido tanto no cliente quanto
 * hidratado no servidor (Next.js Server Components e Middlewares).
 */

export const STORAGE_KEYS = {
  TOKEN: "session_token",
  ACTIVE_TENANT_ID: "active_tenant_id",
  ACTIVE_TENANT_ROLE: "active_tenant_role",
} as const;

export const cookieStorage = {
  get(name: string): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  },

  set(name: string, value: string, days = 7): void {
    if (typeof document === "undefined") return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
  },

  remove(name: string): void {
    if (typeof document === "undefined") return;
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  },
};

export const localStorageAdapter = {
  get(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },

  remove(key: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

/**
 * Storage unificado que sincroniza localStorage e cookies.
 */
export const storage = {
  get(key: string): string | null {
    return localStorageAdapter.get(key) || cookieStorage.get(key);
  },

  set(key: string, value: string, days = 7): void {
    localStorageAdapter.set(key, value);
    cookieStorage.set(key, value, days);
  },

  remove(key: string): void {
    localStorageAdapter.remove(key);
    cookieStorage.remove(key);
  },

  // Helpers específicos de domínio
  getToken(): string | null {
    return this.get(STORAGE_KEYS.TOKEN);
  },

  setToken(token: string): void {
    this.set(STORAGE_KEYS.TOKEN, token);
  },

  removeToken(): void {
    this.remove(STORAGE_KEYS.TOKEN);
  },

  getActiveTenantId(): string | null {
    return this.get(STORAGE_KEYS.ACTIVE_TENANT_ID);
  },

  setActiveTenantId(tenantId: string): void {
    this.set(STORAGE_KEYS.ACTIVE_TENANT_ID, tenantId);
  },

  removeActiveTenantId(): void {
    this.remove(STORAGE_KEYS.ACTIVE_TENANT_ID);
  },

  getActiveTenantRole(): string | null {
    return this.get(STORAGE_KEYS.ACTIVE_TENANT_ROLE);
  },

  setActiveTenantRole(role: string): void {
    this.set(STORAGE_KEYS.ACTIVE_TENANT_ROLE, role);
  },

  removeActiveTenantRole(): void {
    this.remove(STORAGE_KEYS.ACTIVE_TENANT_ROLE);
  },

  clearAll(): void {
    this.removeToken();
    this.removeActiveTenantId();
    this.removeActiveTenantRole();
  },
};
