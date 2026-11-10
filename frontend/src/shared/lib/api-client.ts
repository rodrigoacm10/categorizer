export interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  skipIdempotency?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  isCached: boolean;
  idempotencyKey?: string;
}

const API_BASE_URL = typeof window !== "undefined" ? "/api" : "http://127.0.0.1:8000/api";

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { idempotencyKey, skipIdempotency, headers = {}, ...rest } = options;

  const reqHeaders = new Headers(headers);
  reqHeaders.set("Content-Type", "application/json");

  // Injeção automática da chave de idempotência para mutações (POST, PUT, DELETE)
  const method = (options.method || "GET").toUpperCase();
  if (!skipIdempotency && ["POST", "PUT", "DELETE"].includes(method)) {
    const key = idempotencyKey || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `fe-${Date.now()}`);
    reqHeaders.set("X-Idempotency-Key", key);
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: reqHeaders,
  });

  const isCached = res.headers.get("X-Cache") === "HIT";
  const returnedKey = res.headers.get("X-Idempotency-Key") || undefined;

  if (!res.ok) {
    let errorDetail = `Erro HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      // fallback
    }
    throw new Error(errorDetail);
  }

  const data = await res.json();
  return {
    data,
    isCached,
    idempotencyKey: returnedKey,
  };
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }).then((r) => r.data),
  post: <T>(endpoint: string, body: any, idempotencyKey?: string) =>
    request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      idempotencyKey,
    }),
  put: <T>(endpoint: string, body: any) =>
    request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: <T>(endpoint: string, reason?: string) =>
    request<T>(reason ? `${endpoint}?reason=${encodeURIComponent(reason)}` : endpoint, {
      method: "DELETE",
    }),
};
