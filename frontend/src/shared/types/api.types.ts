export interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  skipIdempotency?: boolean;
  skipTenantHeader?: boolean;
  skipAuth?: boolean;
  tenantId?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
}

export interface ApiResponse<T> {
  data: T;
  isCached: boolean;
  idempotencyKey?: string;
  status: number;
  headers?: Headers;
}
