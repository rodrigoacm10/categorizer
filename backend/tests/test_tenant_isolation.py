import uuid
import pytest
from app.core.security import create_access_token


@pytest.fixture
def two_tenants_setup(client):
    """
    Fixture auxiliar que provisiona dois tenants distintos e isolados (Alpha e Beta)
    com seus respectivos usuários proprietários (OWNER) e cabeçalhos de autenticação completos.
    """
    # 1. Tenant Alpha
    u_alpha_res = client.post("/api/auth/register", json={
        "email": "owner.alpha@empresa-alpha.com",
        "password": "SenhaSegura123",
        "full_name": "Proprietário Alpha",
    }).json()
    u_alpha_id = u_alpha_res["id"]
    token_alpha = create_access_token({"sub": u_alpha_id, "email": u_alpha_res["email"]})

    tenant_alpha_res = client.post(
        "/api/tenants",
        json={"name": "Organização Alpha", "slug": "org-alpha", "description": "Tenant Alpha para testes"},
        headers={"Authorization": f"Bearer {token_alpha}"},
    ).json()
    tenant_alpha_id = tenant_alpha_res["id"]

    headers_alpha = {
        "Authorization": f"Bearer {token_alpha}",
        "X-Tenant-ID": tenant_alpha_id,
    }

    # 2. Tenant Beta
    u_beta_res = client.post("/api/auth/register", json={
        "email": "owner.beta@empresa-beta.com",
        "password": "SenhaSegura123",
        "full_name": "Proprietário Beta",
    }).json()
    u_beta_id = u_beta_res["id"]
    token_beta = create_access_token({"sub": u_beta_id, "email": u_beta_res["email"]})

    tenant_beta_res = client.post(
        "/api/tenants",
        json={"name": "Organização Beta", "slug": "org-beta", "description": "Tenant Beta para testes"},
        headers={"Authorization": f"Bearer {token_beta}"},
    ).json()
    tenant_beta_id = tenant_beta_res["id"]

    headers_beta = {
        "Authorization": f"Bearer {token_beta}",
        "X-Tenant-ID": tenant_beta_id,
    }

    return {
        "alpha": {
            "tenant_id": tenant_alpha_id,
            "user_id": u_alpha_id,
            "token": token_alpha,
            "headers": headers_alpha,
        },
        "beta": {
            "tenant_id": tenant_beta_id,
            "user_id": u_beta_id,
            "token": token_beta,
            "headers": headers_beta,
        },
    }


def test_tenant_catalog_zero_data_leakage(client, two_tenants_setup):
    """
    RF-05 / Requisito 1:
    Cadastrar produtos e categorias específicos em cada tenant.
    Executar consultas e listagens no Tenant Alpha e validar que 0% dos dados
    do Tenant Beta são retornados ou visíveis (e vice-versa).
    """
    alpha = two_tenants_setup["alpha"]
    beta = two_tenants_setup["beta"]

    # 1. Cria Categorias em Alpha
    cat_alpha_1 = client.post("/api/categories", json={"name": "Madeiras Alpha", "color": "#F59E0B"}, headers=alpha["headers"]).json()
    cat_alpha_2 = client.post("/api/categories", json={"name": "Tintas Alpha", "color": "#3B82F6"}, headers=alpha["headers"]).json()

    # 2. Cria Categorias em Beta
    cat_beta_1 = client.post("/api/categories", json={"name": "Aços Beta", "color": "#6B7280"}, headers=beta["headers"]).json()
    cat_beta_2 = client.post("/api/categories", json={"name": "Tubulações Beta", "color": "#10B981"}, headers=beta["headers"]).json()

    # 3. Cria Produtos em Alpha
    prod_alpha_1 = client.post("/api/products", json={
        "name": "Tábua Pinus Alpha",
        "unit": "M",
        "initial_quantity": 25.0,
        "category_ids": [cat_alpha_1["id"]],
    }, headers=alpha["headers"]).json()

    prod_alpha_2 = client.post("/api/products", json={
        "name": "Esmalte Sintético Alpha",
        "unit": "L",
        "initial_quantity": 50.0,
        "category_ids": [cat_alpha_2["id"]],
    }, headers=alpha["headers"]).json()

    # 4. Cria Produtos em Beta
    prod_beta_1 = client.post("/api/products", json={
        "name": "Viga I Beta",
        "unit": "M",
        "initial_quantity": 10.0,
        "category_ids": [cat_beta_1["id"]],
    }, headers=beta["headers"]).json()

    prod_beta_2 = client.post("/api/products", json={
        "name": "Tubo PVC Beta",
        "unit": "UN",
        "initial_quantity": 80.0,
        "category_ids": [cat_beta_2["id"]],
    }, headers=beta["headers"]).json()

    # --- VALIDAÇÃO DE ZERO VAZAMENTO (ALPHA) ---
    list_cats_alpha = client.get("/api/categories", headers=alpha["headers"]).json()
    cat_ids_alpha = {c["id"] for c in list_cats_alpha}
    assert cat_alpha_1["id"] in cat_ids_alpha
    assert cat_alpha_2["id"] in cat_ids_alpha
    assert cat_beta_1["id"] not in cat_ids_alpha, "Vazamento: Categoria de Beta visível em Alpha!"
    assert cat_beta_2["id"] not in cat_ids_alpha, "Vazamento: Categoria de Beta visível em Alpha!"
    assert len(list_cats_alpha) == 2

    list_prods_alpha = client.get("/api/products", headers=alpha["headers"]).json()
    prod_ids_alpha = {p["id"] for p in list_prods_alpha}
    assert prod_alpha_1["id"] in prod_ids_alpha
    assert prod_alpha_2["id"] in prod_ids_alpha
    assert prod_beta_1["id"] not in prod_ids_alpha, "Vazamento: Produto de Beta visível em Alpha!"
    assert prod_beta_2["id"] not in prod_ids_alpha, "Vazamento: Produto de Beta visível em Alpha!"
    assert len(list_prods_alpha) == 2

    # --- VALIDAÇÃO DE ZERO VAZAMENTO (BETA) ---
    list_cats_beta = client.get("/api/categories", headers=beta["headers"]).json()
    cat_ids_beta = {c["id"] for c in list_cats_beta}
    assert cat_beta_1["id"] in cat_ids_beta
    assert cat_beta_2["id"] in cat_ids_beta
    assert cat_alpha_1["id"] not in cat_ids_beta, "Vazamento: Categoria de Alpha visível em Beta!"
    assert cat_alpha_2["id"] not in cat_ids_beta, "Vazamento: Categoria de Alpha visível em Beta!"
    assert len(list_cats_beta) == 2

    list_prods_beta = client.get("/api/products", headers=beta["headers"]).json()
    prod_ids_beta = {p["id"] for p in list_prods_beta}
    assert prod_beta_1["id"] in prod_ids_beta
    assert prod_beta_2["id"] in prod_ids_beta
    assert prod_alpha_1["id"] not in prod_ids_beta, "Vazamento: Produto de Alpha visível em Beta!"
    assert prod_alpha_2["id"] not in prod_ids_beta, "Vazamento: Produto de Alpha visível em Beta!"
    assert len(list_prods_beta) == 2


def test_cross_tenant_resource_operations_rejected(client, two_tenants_setup):
    """
    RF-05 / Requisito 2:
    Tentativas de operações cruzadas de consulta, alteração ou exclusão
    de recursos pertencentes ao Tenant Beta por um cliente autenticado no Tenant Alpha
    devem ser terminantemente rejeitadas com HTTP 404 Not Found (ou 403 Forbidden).
    """
    alpha = two_tenants_setup["alpha"]
    beta = two_tenants_setup["beta"]

    # Produto criado exclusivamente no Tenant Beta
    prod_beta = client.post("/api/products", json={
        "name": "Item Confidencial Beta",
        "unit": "UN",
        "initial_quantity": 100.0,
    }, headers=beta["headers"]).json()
    prod_beta_id = prod_beta["id"]

    # 1. Usuário Alpha tenta obter produto do Tenant Beta diretamente por ID -> 404
    get_res = client.get(f"/api/products/{prod_beta_id}", headers=alpha["headers"])
    assert get_res.status_code == 404
    assert get_res.json()["type"] == "https://api.estoque.local/errors/product-not-found"

    # 2. Usuário Alpha tenta alterar produto do Tenant Beta -> 404
    put_res = client.put(
        f"/api/products/{prod_beta_id}",
        json={"name": "Nome Alterado por Alpha", "unit": "UN"},
        headers=alpha["headers"],
    )
    assert put_res.status_code == 404

    # 3. Usuário Alpha tenta excluir (soft-delete) produto do Tenant Beta -> 404
    del_res = client.delete(
        f"/api/products/{prod_beta_id}?reason=Ataque de exclusao cruzada",
        headers=alpha["headers"],
    )
    assert del_res.status_code == 404

    # 4. Confirma que produto em Beta permanece intacto com seu saldo original
    check_beta = client.get(f"/api/products/{prod_beta_id}", headers=beta["headers"]).json()
    assert check_beta["is_active"] is True
    assert check_beta["name"] == "Item Confidencial Beta"
    assert float(check_beta["current_quantity"]) == 100.0


def test_cross_tenant_inventory_movement_rejection(client, two_tenants_setup):
    """
    RF-05 / Requisito 3:
    Tentar movimentar estoque de produto do Tenant Beta informando
    credenciais / cabeçalho X-Tenant-ID do Tenant Alpha.
    Deve ser rejeitado com HTTP 404 Not Found ou 403 Forbidden.
    O saldo do produto de Beta e seu Livro-Razão devem permanecer rigorosamente intactos.
    """
    alpha = two_tenants_setup["alpha"]
    beta = two_tenants_setup["beta"]

    prod_beta = client.post("/api/products", json={
        "name": "Cimento CP II Beta",
        "unit": "SC",
        "initial_quantity": 40.0,
    }, headers=beta["headers"]).json()
    prod_beta_id = prod_beta["id"]

    # 1. Alpha tenta dar ENTRADA (IN) em produto de Beta com header de Alpha
    res_in = client.post(
        "/api/inventory/in",
        json={"product_id": prod_beta_id, "quantity": 10.0, "reason": "Entrada não autorizada"},
        headers=alpha["headers"],
    )
    assert res_in.status_code in (403, 404), f"Esperado 404/403, obtido {res_in.status_code}"

    # 2. Alpha tenta dar SAÍDA (OUT) em produto de Beta com header de Alpha
    res_out = client.post(
        "/api/inventory/out",
        json={"product_id": prod_beta_id, "quantity": 5.0, "reason": "Saída fraudulenta"},
        headers=alpha["headers"],
    )
    assert res_out.status_code in (403, 404), f"Esperado 404/403, obtido {res_out.status_code}"

    # 3. Alpha tenta dar AJUSTE em produto de Beta com header de Alpha
    res_adj = client.post(
        "/api/inventory/adjustment",
        json={"product_id": prod_beta_id, "quantity": 10.0, "reason": "Ajuste adulterado"},
        headers=alpha["headers"],
    )
    assert res_adj.status_code in (403, 404), f"Esperado 404/403, obtido {res_adj.status_code}"

    # 4. Confirmação estrita: Saldo de Beta inalterado (40.0 SC / 40000)
    check_beta = client.get(f"/api/products/{prod_beta_id}", headers=beta["headers"]).json()
    assert float(check_beta["current_quantity"]) == 40.0
    assert check_beta["current_quantity_scaled"] == 40000

    # 5. Confirmação estrita: Ledger de Beta possui apenas 1 registro (estoque inicial de cadastro)
    movs_beta = client.get(f"/api/inventory/products/{prod_beta_id}/movements", headers=beta["headers"]).json()
    assert len(movs_beta) == 1
    assert movs_beta[0]["type"] == "IN"
    assert movs_beta[0]["quantity_scaled"] == 40000


def test_idempotency_keys_isolation_between_tenants_no_collision(client, two_tenants_setup):
    """
    RF-05 / Requisito 4:
    Validar que chaves de idempotência iguais entre Tenant Alpha e Beta não colidem.
    Cada tenant possui seu próprio espaço de nomes de idempotência.
    """
    alpha = two_tenants_setup["alpha"]
    beta = two_tenants_setup["beta"]

    shared_idempotency_key = str(uuid.uuid4())

    # 1. Tenant Alpha envia requisição com a chave compartilhada
    res_alpha = client.post(
        "/api/products",
        json={"name": "Parafuso Inox Alpha", "unit": "UN", "initial_quantity": 15.0},
        headers={**alpha["headers"], "X-Idempotency-Key": shared_idempotency_key},
    )
    assert res_alpha.status_code == 201
    assert res_alpha.headers.get("X-Cache") == "MISS"
    prod_alpha_data = res_alpha.json()
    prod_alpha_id = prod_alpha_data["id"]

    # 2. Tenant Beta envia requisição com a EXATA MESMA chave de idempotência
    # Não deve colidir nem retornar o cache do Tenant Alpha!
    res_beta = client.post(
        "/api/products",
        json={"name": "Parafuso Carbono Beta", "unit": "UN", "initial_quantity": 30.0},
        headers={**beta["headers"], "X-Idempotency-Key": shared_idempotency_key},
    )
    assert res_beta.status_code == 201
    assert res_beta.headers.get("X-Cache") == "MISS"
    prod_beta_data = res_beta.json()
    prod_beta_id = prod_beta_data["id"]

    # Validar que são produtos totalmente distintos com IDs diferentes
    assert prod_alpha_id != prod_beta_id
    assert prod_alpha_data["name"] == "Parafuso Inox Alpha"
    assert prod_beta_data["name"] == "Parafuso Carbono Beta"

    # 3. Replay no Tenant Alpha retorna cache HIT de Alpha
    replay_alpha = client.post(
        "/api/products",
        json={"name": "Parafuso Inox Alpha", "unit": "UN", "initial_quantity": 15.0},
        headers={**alpha["headers"], "X-Idempotency-Key": shared_idempotency_key},
    )
    assert replay_alpha.status_code == 201
    assert replay_alpha.headers.get("X-Cache") == "HIT"
    assert replay_alpha.json()["id"] == prod_alpha_id

    # 4. Replay no Tenant Beta retorna cache HIT de Beta
    replay_beta = client.post(
        "/api/products",
        json={"name": "Parafuso Carbono Beta", "unit": "UN", "initial_quantity": 30.0},
        headers={**beta["headers"], "X-Idempotency-Key": shared_idempotency_key},
    )
    assert replay_beta.status_code == 201
    assert replay_beta.headers.get("X-Cache") == "HIT"
    assert replay_beta.json()["id"] == prod_beta_id


def test_cross_tenant_token_tampering_rejected_with_403(client, two_tenants_setup):
    """
    RF-05 / Requisito 5:
    Valida que um usuário do Tenant Alpha tentando apresentar o cabeçalho X-Tenant-ID
    do Tenant Beta recebe 403 Forbidden por violação de vínculo de tenant.
    """
    alpha = two_tenants_setup["alpha"]
    beta = two_tenants_setup["beta"]

    # Usuário Alpha com X-Tenant-ID de Beta
    tampered_headers = {
        "Authorization": f"Bearer {alpha['token']}",
        "X-Tenant-ID": beta["tenant_id"],
    }

    res = client.get("/api/products", headers=tampered_headers)
    assert res.status_code == 403
    err = res.json()
    assert err["type"] == "https://api.estoque.local/errors/tenant-access-denied"
    assert "não possui vínculo ativo" in err["detail"]
