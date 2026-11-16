/**
 * Mock State Store para Testes E2E (FT-23)
 * Emula o comportamento transacional do FastAPI + PostgreSQL com integridade referencial,
 * isolamento estrito por tenant, invariantes contábeis de escala 10^3 e RFC 9474.
 */

export interface MockUser {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
}

export interface MockTenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  owner_id: string;
  created_at: string;
}

export interface MockTenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: "OWNER" | "GESTOR" | "ALMOXARIFE" | "AUDITOR";
  user: {
    id: string;
    email: string;
    full_name: string;
  };
}

export interface MockCategory {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
}

export interface MockProduct {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  unit: string;
  min_stock?: number | null;
  min_stock_scaled?: number | null;
  current_quantity: number;
  current_quantity_scaled: number;
  is_active: boolean;
  categories: MockCategory[];
  created_at: string;
  updated_at: string;
}

export interface MockMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  quantity_scaled: number;
  previous_quantity: number;
  previous_quantity_scaled: number;
  new_quantity: number;
  new_quantity_scaled: number;
  reason: string;
  operator_id: string;
  created_at: string;
  idempotency_key?: string;
  is_replay?: boolean;
}

export class MockStateStore {
  private users: Map<string, MockUser> = new Map();
  private tenants: Map<string, MockTenant> = new Map();
  private memberships: MockTenantMember[] = [];
  private categories: Map<string, MockCategory> = new Map();
  private products: Map<string, MockProduct> = new Map();
  private movements: MockMovement[] = [];
  private idempotencyCache: Map<string, { status: number; body: any; headers: Record<string, string> }> = new Map();

  private userCounter = 1;
  private tenantCounter = 1;
  private categoryCounter = 1;
  private productCounter = 1;
  private movementCounter = 1;

  constructor() {
    this.reset();
  }

  public reset() {
    this.users.clear();
    this.tenants.clear();
    this.memberships = [];
    this.categories.clear();
    this.products.clear();
    this.movements = [];
    this.idempotencyCache.clear();
    this.userCounter = 1;
    this.tenantCounter = 1;
    this.categoryCounter = 1;
    this.productCounter = 1;
    this.movementCounter = 1;
  }

  // --- Auth & Users ---
  public registerUser(full_name: string, email: string, password: string): MockUser {
    const normalizedEmail = email.toLowerCase().trim();
    for (const u of Array.from(this.users.values())) {
      if (u.email === normalizedEmail) {
        throw { status: 409, type: "email-already-exists", detail: "Este e-mail já está cadastrado no sistema." };
      }
    }

    const user: MockUser = {
      id: `usr_${String(this.userCounter++).padStart(4, "0")}`,
      full_name,
      email: normalizedEmail,
      password_hash: `hash_${password}`,
    };
    this.users.set(user.id, user);
    return user;
  }

  public loginUser(email: string, password: string): { user: MockUser; access_token: string } {
    const normalizedEmail = email.toLowerCase().trim();
    for (const u of Array.from(this.users.values())) {
      if (u.email === normalizedEmail && u.password_hash === `hash_${password}`) {
        return {
          user: u,
          access_token: `mock_jwt_token_${u.id}`,
        };
      }
    }
    throw { status: 401, type: "invalid-credentials", detail: "E-mail ou senha incorretos." };
  }

  public getUser(id: string): MockUser | undefined {
    return this.users.get(id);
  }

  // --- Tenants ---
  public createTenant(name: string, slug: string, description: string | undefined, userId: string): MockTenant {
    const normalizedSlug = slug.toLowerCase().trim();
    for (const t of Array.from(this.tenants.values())) {
      if (t.slug === normalizedSlug) {
        throw { status: 409, type: "slug-already-exists", detail: "Slug já cadastrado no sistema." };
      }
    }

    const user = this.users.get(userId);
    const tenant: MockTenant = {
      id: `tnt_${String(this.tenantCounter++).padStart(4, "0")}`,
      name,
      slug: normalizedSlug,
      description,
      owner_id: userId,
      created_at: new Date().toISOString(),
    };
    this.tenants.set(tenant.id, tenant);

    // Cria associação como OWNER
    this.memberships.push({
      id: `mem_${tenant.id}_${userId}`,
      tenant_id: tenant.id,
      user_id: userId,
      role: "OWNER",
      user: {
        id: userId,
        email: user?.email || "operador@empresa.com",
        full_name: user?.full_name || "Operador",
      },
    });

    return tenant;
  }

  public listTenantsForUser(userId: string): MockTenant[] {
    const tenantIds = this.memberships
      .filter((m) => m.user_id === userId)
      .map((m) => m.tenant_id);
    return Array.from(this.tenants.values()).filter((t) => tenantIds.includes(t.id));
  }

  public getTenant(id: string): MockTenant | undefined {
    return this.tenants.get(id);
  }

  public getMembership(tenantId: string, userId: string): MockTenantMember | undefined {
    return this.memberships.find((m) => m.tenant_id === tenantId && m.user_id === userId);
  }

  // --- Categories ---
  public createCategory(tenantId: string, name: string, description?: string, color?: string): MockCategory {
    const category: MockCategory = {
      id: `cat_${String(this.categoryCounter++).padStart(4, "0")}`,
      tenant_id: tenantId,
      name,
      description,
      color: color || "#2563EB",
      created_at: new Date().toISOString(),
    };
    this.categories.set(category.id, category);
    return category;
  }

  public listCategories(tenantId: string): MockCategory[] {
    return Array.from(this.categories.values()).filter((c) => c.tenant_id === tenantId);
  }

  // --- Products ---
  public createProduct(
    tenantId: string,
    name: string,
    description: string | undefined,
    unit: string,
    min_stock: number | null | undefined,
    category_ids: string[] = []
  ): MockProduct {
    const linkedCategories = category_ids
      .map((cid) => this.categories.get(cid))
      .filter((c): c is MockCategory => c !== undefined && c.tenant_id === tenantId);

    const minStockScaled = min_stock !== null && min_stock !== undefined ? Math.round(min_stock * 1000) : null;

    const product: MockProduct = {
      id: `prd_${String(this.productCounter++).padStart(4, "0")}`,
      tenant_id: tenantId,
      name,
      description,
      unit: unit.toUpperCase(),
      min_stock: min_stock ?? null,
      min_stock_scaled: minStockScaled,
      current_quantity: 0,
      current_quantity_scaled: 0, // Mandatório ZERO na criação
      is_active: true,
      categories: linkedCategories,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.products.set(product.id, product);
    return product;
  }

  public getProduct(tenantId: string, productId: string): MockProduct | undefined {
    const product = this.products.get(productId);
    if (product && product.tenant_id === tenantId) return product;
    return undefined;
  }

  public listProducts(tenantId: string, search?: string): MockProduct[] {
    let list = Array.from(this.products.values()).filter((p) => p.tenant_id === tenantId);
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }
    return list;
  }

  // --- Movements & Ledger (FT-15, FT-16, FT-18, FT-21) ---
  public registerMovement(
    tenantId: string,
    productId: string,
    type: "IN" | "OUT" | "ADJUSTMENT",
    quantityInput: number | string,
    reason: string,
    operatorId: string,
    idempotencyKey?: string
  ): MockMovement {
    // 1. Verificação de Idempotência RFC 9474
    if (idempotencyKey) {
      const cacheKey = `${tenantId}:${idempotencyKey}`;
      const cached = this.idempotencyCache.get(cacheKey);
      if (cached) {
        return { ...cached.body, is_replay: true };
      }
    }

    const product = this.getProduct(tenantId, productId);
    if (!product) {
      throw { status: 404, type: "product-not-found", detail: "Produto não encontrado no almoxarifado." };
    }

    const numericInput = typeof quantityInput === "string" ? parseFloat(quantityInput.replace(",", ".")) : quantityInput;
    if (isNaN(numericInput) || numericInput < 0) {
      throw { status: 422, type: "invalid-quantity", detail: "Quantidade inválida para movimentação física." };
    }

    const previousScaled = product.current_quantity_scaled;
    const previousFloat = product.current_quantity;

    let deltaScaled = 0;
    let newScaled = 0;

    if (type === "IN") {
      if (numericInput <= 0) {
        throw { status: 422, type: "invalid-quantity", detail: "Entradas devem ser estritamente positivas." };
      }
      deltaScaled = Math.round(numericInput * 1000);
      newScaled = previousScaled + deltaScaled;
    } else if (type === "OUT") {
      if (numericInput <= 0) {
        throw { status: 422, type: "invalid-quantity", detail: "Saídas devem ser estritamente positivas." };
      }
      deltaScaled = -Math.round(numericInput * 1000);
      newScaled = previousScaled + deltaScaled;

      // Invariante Contábil: Proibição estrita de saldo negativo
      if (newScaled < 0) {
        throw {
          status: 422,
          type: "insufficient-stock",
          detail: "Operação bloqueada: A quantidade solicitada excede o saldo físico disponível.",
        };
      }
    } else if (type === "ADJUSTMENT") {
      // Ajuste define o novo saldo absoluto
      newScaled = Math.round(numericInput * 1000);
      deltaScaled = newScaled - previousScaled;
    }

    // Atualiza saldo físico do produto
    product.current_quantity_scaled = newScaled;
    product.current_quantity = newScaled / 1000;
    product.updated_at = new Date().toISOString();

    const movement: MockMovement = {
      id: `mov_${String(this.movementCounter++).padStart(5, "0")}`,
      tenant_id: tenantId,
      product_id: productId,
      type,
      quantity: Math.abs(deltaScaled) / 1000,
      quantity_scaled: Math.abs(deltaScaled),
      previous_quantity: previousFloat,
      previous_quantity_scaled: previousScaled,
      new_quantity: newScaled / 1000,
      new_quantity_scaled: newScaled,
      reason,
      operator_id: operatorId,
      created_at: new Date().toISOString(),
      idempotency_key: idempotencyKey,
      is_replay: false,
    };

    this.movements.unshift(movement); // Mais recentes primeiro

    if (idempotencyKey) {
      const cacheKey = `${tenantId}:${idempotencyKey}`;
      this.idempotencyCache.set(cacheKey, {
        status: 201,
        body: movement,
        headers: { "X-Cache": "HIT", "Idempotency-Key": idempotencyKey },
      });
    }

    return movement;
  }

  public listMovements(
    tenantId: string,
    params: { product_id?: string; type?: string; limit?: number; offset?: number } = {}
  ): { items: MockMovement[]; total: number; limit: number; offset: number } {
    let list = this.movements.filter((m) => m.tenant_id === tenantId);

    if (params.product_id) {
      list = list.filter((m) => m.product_id === params.product_id);
    }
    if (params.type) {
      list = list.filter((m) => m.type === params.type);
    }

    const total = list.length;
    const offset = params.offset || 0;
    const limit = params.limit || 50;
    const paginated = list.slice(offset, offset + limit);

    return {
      items: paginated,
      total,
      limit,
      offset,
    };
  }
}
