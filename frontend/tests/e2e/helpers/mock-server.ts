import { Page, Route } from "@playwright/test";
import { MockStateStore } from "./mock-store";

/**
 * MockServer para Playwright E2E
 * Intercepta chamadas de rede da aplicação frontend direcionadas a /api/v1/*
 * e delega para o MockStateStore com respostas HTTP RFC 7807 determinísticas.
 */
export class MockServer {
  public store: MockStateStore;
  private currentUserId: string = "usr_0001";

  constructor(store?: MockStateStore) {
    this.store = store || new MockStateStore();
  }

  public setCurrentUserId(userId: string) {
    this.currentUserId = userId;
  }

  public async setup(page: Page) {
    await page.route("**/api/**", async (route: Route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();
      const headers = request.headers();
      const tenantId = headers["x-tenant-id"];
      const idempotencyKey = headers["idempotency-key"];

      let body: any = null;
      try {
        const postData = request.postData();
        if (postData) {
          body = JSON.parse(postData);
        }
      } catch {
        // ignore JSON parse errors
      }

      // --- 1. AUTH ---
      if (path.endsWith("/auth/register") && method === "POST") {
        try {
          const user = this.store.registerUser(body.full_name, body.email, body.password);
          this.currentUserId = user.id;
          return route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify(user),
          });
        } catch (err: any) {
          return route.fulfill({
            status: err.status || 400,
            contentType: "application/problem+json",
            body: JSON.stringify(err),
          });
        }
      }

      if ((path.endsWith("/auth/token") || path.endsWith("/auth/login")) && method === "POST") {
        try {
          // Endpoint recebe JSON ou FormUrlEncoded
          const email = body?.username || body?.email;
          const password = body?.password;
          const result = this.store.loginUser(email, password);
          this.currentUserId = result.user.id;
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              access_token: result.access_token,
              token_type: "bearer",
              expires_in: 86400,
            }),
          });
        } catch (err: any) {
          return route.fulfill({
            status: err.status || 401,
            contentType: "application/problem+json",
            body: JSON.stringify(err),
          });
        }
      }

      if (path.endsWith("/auth/me") && method === "GET") {
        const user = this.store.getUser(this.currentUserId) || {
          id: this.currentUserId,
          email: "operador@empresa.com",
          full_name: "Operador E2E",
        };
        const tenants = this.store.listTenantsForUser(this.currentUserId);
        const tenantBriefs = tenants.map((t) => {
          const mem = this.store.getMembership(t.id, this.currentUserId);
          return {
            tenant_id: t.id,
            tenant_name: t.name,
            tenant_slug: t.slug,
            role: mem?.role || "OWNER",
          };
        });
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            is_active: true,
            tenants: tenantBriefs,
          }),
        });
      }

      // --- 2. TENANTS ---
      if (path.endsWith("/tenants") && method === "GET") {
        const list = this.store.listTenantsForUser(this.currentUserId);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(list),
        });
      }

      if (path.endsWith("/tenants") && method === "POST") {
        try {
          const tenant = this.store.createTenant(body.name, body.slug, body.description, this.currentUserId);
          return route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify(tenant),
          });
        } catch (err: any) {
          return route.fulfill({
            status: err.status || 400,
            contentType: "application/problem+json",
            body: JSON.stringify(err),
          });
        }
      }

      // Membros do tenant (/tenants/:id/members)
      const membersMatch = path.match(/\/tenants\/([^/]+)\/members$/);
      if (membersMatch && method === "GET") {
        const tId = membersMatch[1];
        const mem = this.store.getMembership(tId, this.currentUserId);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            mem
              ? [mem]
              : [
                  {
                    id: `mem_${tId}_${this.currentUserId}`,
                    tenant_id: tId,
                    user_id: this.currentUserId,
                    role: "OWNER",
                    user: {
                      id: this.currentUserId,
                      email: "operador@empresa.com",
                      full_name: "Operador",
                    },
                  },
                ]
          ),
        });
      }

      // Consulta de tenant por id (/tenants/:id)
      const singleTenantMatch = path.match(/\/tenants\/([^/]+)$/);
      if (singleTenantMatch && method === "GET") {
        const tId = singleTenantMatch[1];
        const tenant = this.store.getTenant(tId);
        if (tenant) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(tenant),
          });
        }
      }

      // Membership do tenant
      const memberMatch = path.match(/\/tenants\/([^/]+)\/members\/me$/);
      if (memberMatch && method === "GET") {
        const tId = memberMatch[1];
        const mem = this.store.getMembership(tId, this.currentUserId);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mem || { role: "OWNER", tenant_id: tId }),
        });
      }

      // --- 3. CATEGORIES ---
      if (path.endsWith("/categories") && method === "GET") {
        const categories = this.store.listCategories(tenantId);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(categories),
        });
      }

      if (path.endsWith("/categories") && method === "POST") {
        const cat = this.store.createCategory(tenantId, body.name, body.description, body.color);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(cat),
        });
      }

      // --- 4. PRODUCTS ---
      if (path.endsWith("/products") && method === "GET") {
        const search = url.searchParams.get("search") || undefined;
        const products = this.store.listProducts(tenantId, search);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(products),
        });
      }

      if (path.endsWith("/products") && method === "POST") {
        const product = this.store.createProduct(
          tenantId,
          body.name,
          body.description,
          body.unit,
          body.min_stock,
          body.category_ids
        );
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(product),
        });
      }

      const productDetailMatch = path.match(/\/products\/([^/]+)$/);
      if (productDetailMatch && method === "GET") {
        const productId = productDetailMatch[1];
        const product = this.store.getProduct(tenantId, productId);
        if (product) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(product),
          });
        }
        return route.fulfill({
          status: 404,
          contentType: "application/problem+json",
          body: JSON.stringify({ status: 404, detail: "Produto não encontrado." }),
        });
      }

      // --- 5. INVENTORY & LEDGER ---
      if (path.endsWith("/inventory/summary") && method === "GET") {
        const products = this.store.listProducts(tenantId);
        const lowStockCount = products.filter(
          (p) => p.min_stock !== null && p.min_stock !== undefined && p.current_quantity <= p.min_stock
        ).length;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            total_products: products.length,
            low_stock_count: lowStockCount,
            total_movements: this.store.listMovements(tenantId).total,
          }),
        });
      }

      if (path.endsWith("/inventory/in") && method === "POST") {
        try {
          const mov = this.store.registerMovement(
            tenantId,
            body.product_id,
            "IN",
            body.quantity,
            body.reason || "",
            this.currentUserId,
            idempotencyKey
          );
          const responseHeaders: Record<string, string> = {};
          if (mov.is_replay) responseHeaders["X-Cache"] = "HIT";

          return route.fulfill({
            status: 201,
            headers: responseHeaders,
            contentType: "application/json",
            body: JSON.stringify(mov),
          });
        } catch (err: any) {
          return route.fulfill({
            status: err.status || 422,
            contentType: "application/problem+json",
            body: JSON.stringify(err),
          });
        }
      }

      if (path.endsWith("/inventory/out") && method === "POST") {
        try {
          const mov = this.store.registerMovement(
            tenantId,
            body.product_id,
            "OUT",
            body.quantity,
            body.reason,
            this.currentUserId,
            idempotencyKey
          );
          const responseHeaders: Record<string, string> = {};
          if (mov.is_replay) responseHeaders["X-Cache"] = "HIT";

          return route.fulfill({
            status: 201,
            headers: responseHeaders,
            contentType: "application/json",
            body: JSON.stringify(mov),
          });
        } catch (err: any) {
          return route.fulfill({
            status: err.status || 422,
            contentType: "application/problem+json",
            body: JSON.stringify(err),
          });
        }
      }

      if (path.endsWith("/inventory/adjustment") && method === "POST") {
        try {
          const mov = this.store.registerMovement(
            tenantId,
            body.product_id,
            "ADJUSTMENT",
            body.quantity,
            body.reason,
            this.currentUserId,
            idempotencyKey
          );
          const responseHeaders: Record<string, string> = {};
          if (mov.is_replay) responseHeaders["X-Cache"] = "HIT";

          return route.fulfill({
            status: 201,
            headers: responseHeaders,
            contentType: "application/json",
            body: JSON.stringify(mov),
          });
        } catch (err: any) {
          return route.fulfill({
            status: err.status || 422,
            contentType: "application/problem+json",
            body: JSON.stringify(err),
          });
        }
      }

      if (path.endsWith("/inventory/movements") && method === "GET") {
        const prodId = url.searchParams.get("product_id") || undefined;
        const movType = url.searchParams.get("type") || undefined;
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);

        const result = this.store.listMovements(tenantId, { product_id: prodId, type: movType, limit, offset });
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(result),
        });
      }

      // Default fallback se não mapeado
      return route.continue();
    });
  }
}
