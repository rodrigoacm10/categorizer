import { RequestOptions, ApiResponse } from "../types/api.types";
import { ProblemDetails, ProblemDetailsError } from "../types/rfc7807.types";
import { storage } from "./storage";

export * from "../types/api.types";
export * from "../types/rfc7807.types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/api" : "http://127.0.0.1:8000/api");

let unauthorizedCallback: (() => void) | null = null;

export function setUnauthorizedCallback(callback: (() => void) | null) {
  unauthorizedCallback = callback;
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Identifica se um endpoint exige obrigatoriamente cabeçalho de contexto de tenant.
 * Conforme especificação: /products, /categories, /inventory e /tenants/{id}/* exigem tenant ativo.
 */
export function requiresTenantHeader(endpoint: string): boolean {
  const cleanEndpoint = endpoint.startsWith("/api") ? endpoint.slice(4) : endpoint;
  if (
    cleanEndpoint.startsWith("/products") ||
    cleanEndpoint.startsWith("/categories") ||
    cleanEndpoint.startsWith("/inventory")
  ) {
    return true;
  }
  // Sub-rotas de um tenant específico exigem contexto (/tenants/{id}/...)
  const tenantSubMatch = cleanEndpoint.match(/^\/tenants\/([^/]+)\/(.+)$/);
  if (tenantSubMatch) {
    return true;
  }
  return false;
}

function buildUrl(endpoint: string, params?: Record<string, unknown>): string {
  let fullUrl: string;
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    fullUrl = endpoint;
  } else {
    const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    fullUrl = `${base}${path}`;
  }

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "") {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += (fullUrl.includes("?") ? "&" : "?") + queryString;
    }
  }
  return fullUrl;
}

/**
 * Cliente HTTP unificado com pipeline de interceptors:
 * 1. Auth Interceptor (Bearer token)
 * 2. Tenant Interceptor (X-Tenant-ID)
 * 3. Idempotency Interceptor (UUIDv4 automático para mutações)
 * 4. RFC 7807 Error Parser & Tratamento de 401
 */
export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    idempotencyKey,
    skipIdempotency = false,
    skipTenantHeader = false,
    skipAuth = false,
    tenantId: explicitTenantId,
    params,
    headers = {},
    ...rest
  } = options;

  const reqHeaders = new Headers(headers);

  if (!reqHeaders.has("Content-Type") && !(rest.body instanceof FormData)) {
    reqHeaders.set("Content-Type", "application/json");
  }

  // 1. Auth Interceptor: Injeta Authorization: Bearer <token>
  if (!skipAuth) {
    const token = storage.getToken();
    if (token && !reqHeaders.has("Authorization")) {
      reqHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  // 2. Tenant Interceptor: Injeta X-Tenant-ID se necessário
  if (!skipTenantHeader) {
    const needsTenant = requiresTenantHeader(endpoint) || explicitTenantId;
    if (needsTenant) {
      const activeTenant = explicitTenantId || storage.getActiveTenantId();
      if (!activeTenant) {
        throw new Error(
          "Tenant ativo não selecionado. A rota requer contexto de almoxarifado."
        );
      }
      reqHeaders.set("X-Tenant-ID", activeTenant);
    }
  }

  // 3. Idempotency Interceptor: Injeta X-Idempotency-Key em mutações (POST, PUT, DELETE)
  const method = (rest.method || "GET").toUpperCase();
  let generatedKey: string | undefined;

  if (!skipIdempotency && ["POST", "PUT", "DELETE"].includes(method)) {
    if (!reqHeaders.has("X-Idempotency-Key")) {
      generatedKey = idempotencyKey || generateUUID();
      reqHeaders.set("X-Idempotency-Key", generatedKey);
    } else {
      generatedKey = reqHeaders.get("X-Idempotency-Key") || undefined;
    }
  }

  const url = buildUrl(endpoint, params);

  const res = await fetch(url, {
    ...rest,
    headers: reqHeaders,
  });

  // 4. RFC 7807 Error Parser & Tratamento de 401
  if (!res.ok) {
    let problem: ProblemDetails;
    try {
      const json = await res.json();
      problem = {
        type: json.type || "about:blank",
        title: json.title || res.statusText || "HTTP Error",
        status: json.status || res.status,
        detail: json.detail || json.message || `Erro HTTP ${res.status}`,
        instance: json.instance,
        invalid_params: json.invalid_params,
        ...json,
      };
    } catch {
      let text = "";
      try {
        text = await res.text();
      } catch {
        // ignore
      }
      problem = {
        type: "about:blank",
        title: res.statusText || "HTTP Error",
        status: res.status,
        detail: text || `Erro HTTP ${res.status}`,
      };
    }

    if (res.status === 401) {
      storage.clearAll();
      if (unauthorizedCallback) {
        unauthorizedCallback();
      } else if (typeof window !== "undefined" && window.location) {
        const currentPath = window.location.pathname;
        if (!currentPath.includes("/login")) {
          window.location.href = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
        }
      }
    }

    throw new ProblemDetailsError(problem);
  }

  const isCached = res.headers.get("X-Cache") === "HIT";
  const returnedKey = res.headers.get("X-Idempotency-Key") || generatedKey || undefined;

  let data: T;
  if (res.status === 204) {
    data = undefined as unknown as T;
  } else {
    data = await res.json();
  }

  return {
    data,
    isCached,
    idempotencyKey: returnedKey,
    status: res.status,
  };
}

export const api = {
  request,
  get: <T>(endpoint: string, options: RequestOptions = {}): Promise<T> =>
    request<T>(endpoint, { ...options, method: "GET" }).then((r) => r.data),

  post: <T>(
    endpoint: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(
    endpoint: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(
    endpoint: string,
    optionsOrReason?: RequestOptions | string
  ): Promise<ApiResponse<T>> => {
    let opts: RequestOptions = {};
    let finalEndpoint = endpoint;
    if (typeof optionsOrReason === "string") {
      finalEndpoint = optionsOrReason
        ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}reason=${encodeURIComponent(optionsOrReason)}`
        : endpoint;
    } else if (optionsOrReason) {
      opts = optionsOrReason;
    }
    return request<T>(finalEndpoint, {
      ...opts,
      method: "DELETE",
    });
  },
};
