import pytest
import uuid
from app.core.security import create_access_token


def test_missing_tenant_header(client):
    """Rejeição de requisição em endpoint protegido sem o cabeçalho X-Tenant-ID."""
    res = client.get("/api/products", headers={"X-Tenant-ID": ""})
    assert res.status_code == 400
    err = res.json()
    assert err["type"] == "https://api.estoque.local/errors/missing-tenant-header"
    assert "Cabeçalho X-Tenant-ID ausente" in err["detail"]


def test_invalid_uuid_tenant_header(client):
    """Rejeição de cabeçalho X-Tenant-ID que não seja um UUID válido."""
    res = client.get("/api/products", headers={"X-Tenant-ID": "nao-eh-um-uuid"})
    assert res.status_code == 400
    assert "Esperado UUID válido" in res.json()["detail"]


def test_nonexistent_tenant_header(client):
    """Rejeição de cabeçalho X-Tenant-ID para tenant inexistente (404)."""
    fake_id = str(uuid.uuid4())
    res = client.get("/api/products", headers={"X-Tenant-ID": fake_id})
    assert res.status_code == 404
    err = res.json()
    assert err["type"] == "https://api.estoque.local/errors/tenant-not-found"


def test_cross_tenant_access_denied(client):
    """
    Isolamento de Acesso:
    Usuário 1 (membro apenas do Tenant A) tenta acessar Tenant B com header X-Tenant-ID: <Tenant B>.
    Deve ser rejeitado com 403 Forbidden (tenant-access-denied).
    """
    # 1. Cria Usuário 1 e Tenant A
    u1_reg = client.post("/api/auth/register", json={
        "email": "user1.alfa@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Usuario Um",
    }).json()
    u1_token = create_access_token({"sub": u1_reg["id"], "email": u1_reg["email"]})
    tenant_a = client.post(
        "/api/tenants",
        json={"name": "Tenant A Alfa", "slug": "tenant-a-alfa"},
        headers={"Authorization": f"Bearer {u1_token}"},
    ).json()

    # 2. Cria Usuário 2 e Tenant B
    u2_reg = client.post("/api/auth/register", json={
        "email": "user2.beta@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Usuario Dois",
    }).json()
    u2_token = create_access_token({"sub": u2_reg["id"], "email": u2_reg["email"]})
    tenant_b = client.post(
        "/api/tenants",
        json={"name": "Tenant B Beta", "slug": "tenant-b-beta"},
        headers={"Authorization": f"Bearer {u2_token}"},
    ).json()

    # 3. Usuário 1 tenta acessar endpoint de produtos apontando para Tenant B
    res = client.get(
        "/api/products",
        headers={
            "Authorization": f"Bearer {u1_token}",
            "X-Tenant-ID": tenant_b["id"],
        },
    )
    assert res.status_code == 403
    err = res.json()
    assert err["type"] == "https://api.estoque.local/errors/tenant-access-denied"
    assert "não possui vínculo ativo" in err["detail"]


def test_rbac_role_enforcement(client):
    """
    Validação da Matriz RBAC:
    - ALMOXARIFE não pode criar produtos (apenas OWNER e GESTOR).
    - GESTOR pode criar produtos.
    - AUDITOR não pode realizar entrada de estoque.
    - AUDITOR pode realizar ajuste de inventário e consultar histórico.
    """
    # Cria novo tenant
    tenant = client.post("/api/tenants", json={"name": "Tenant RBAC", "slug": "tenant-rbac"}).json()
    t_id = tenant["id"]

    # Cria almoxarife, gestor e auditor
    u_almox = client.post("/api/auth/register", json={"email": "almox@rbac.com", "password": "SenhaSegura123", "full_name": "Almox"}).json()
    u_gestor = client.post("/api/auth/register", json={"email": "gestor@rbac.com", "password": "SenhaSegura123", "full_name": "Gestor"}).json()
    u_audit = client.post("/api/auth/register", json={"email": "audit@rbac.com", "password": "SenhaSegura123", "full_name": "Auditor"}).json()

    # Adiciona aos membros com seus respectivos papéis
    client.post(f"/api/tenants/{t_id}/members", json={"email": "almox@rbac.com", "role": "ALMOXARIFE"})
    client.post(f"/api/tenants/{t_id}/members", json={"email": "gestor@rbac.com", "role": "GESTOR"})
    client.post(f"/api/tenants/{t_id}/members", json={"email": "audit@rbac.com", "role": "AUDITOR"})

    token_almox = create_access_token({"sub": u_almox["id"], "email": u_almox["email"]})
    token_gestor = create_access_token({"sub": u_gestor["id"], "email": u_gestor["email"]})
    token_audit = create_access_token({"sub": u_audit["id"], "email": u_audit["email"]})

    # 1. Almoxarife tenta criar produto -> Rejeitado 403
    res_almox_prod = client.post(
        "/api/products",
        json={"name": "Produto Almox Tentativa", "unit": "UN", "initial_quantity": 10},
        headers={"Authorization": f"Bearer {token_almox}", "X-Tenant-ID": t_id},
    )
    assert res_almox_prod.status_code == 403
    assert res_almox_prod.json()["type"] == "https://api.estoque.local/errors/insufficient-permissions"

    # 2. Gestor tenta criar produto -> Autorizado 201
    res_gestor_prod = client.post(
        "/api/products",
        json={"name": "Produto Criado por Gestor", "unit": "UN", "initial_quantity": 50},
        headers={"Authorization": f"Bearer {token_gestor}", "X-Tenant-ID": t_id},
    )
    assert res_gestor_prod.status_code == 201
    prod_id = res_gestor_prod.json()["id"]

    # 3. Auditor tenta registrar ENTRADA -> Rejeitado 403
    res_audit_in = client.post(
        "/api/inventory/movements",
        json={"product_id": prod_id, "type": "IN", "quantity": 10},
        headers={"Authorization": f"Bearer {token_audit}", "X-Tenant-ID": t_id},
    )
    assert res_audit_in.status_code == 403

    # 4. Auditor pode realizar AJUSTE -> Autorizado 201
    res_audit_adj = client.post(
        "/api/inventory/movements",
        json={"product_id": prod_id, "type": "ADJUSTMENT", "quantity": 40, "reason": "Auditoria física anual"},
        headers={"Authorization": f"Bearer {token_audit}", "X-Tenant-ID": t_id},
    )
    assert res_audit_adj.status_code == 201

    # 5. Auditor pode consultar movimentações -> 200
    res_audit_movs = client.get(
        "/api/inventory/movements",
        headers={"Authorization": f"Bearer {token_audit}", "X-Tenant-ID": t_id},
    )
    assert res_audit_movs.status_code == 200


def test_data_isolation_between_tenants(client):
    """
    Isolamento Lógico Absoluto de Dados:
    - Produto X cadastrado no Tenant A.
    - Produto Y cadastrado no Tenant B.
    - Consulta em Tenant A retorna APENAS Produto X.
    - Consulta direta ao Produto Y com header de Tenant A retorna 404.
    """
    # 1. Tenant A
    t_a = client.post("/api/tenants", json={"name": "Tenant A Data", "slug": "tenant-a-data"}).json()
    t_a_id = t_a["id"]

    # 2. Tenant B
    t_b = client.post("/api/tenants", json={"name": "Tenant B Data", "slug": "tenant-b-data"}).json()
    t_b_id = t_b["id"]

    # Cadastra Produto X no Tenant A
    prod_x = client.post(
        "/api/products",
        json={"name": "Produto Exclusivo Tenant A", "unit": "UN", "initial_quantity": 100},
        headers={"X-Tenant-ID": t_a_id},
    ).json()
    prod_x_id = prod_x["id"]

    # Cadastra Produto Y no Tenant B
    prod_y = client.post(
        "/api/products",
        json={"name": "Produto Exclusivo Tenant B", "unit": "UN", "initial_quantity": 200},
        headers={"X-Tenant-ID": t_b_id},
    ).json()
    prod_y_id = prod_y["id"]

    # Listagem no Tenant A deve conter APENAS Produto X
    list_a = client.get("/api/products", headers={"X-Tenant-ID": t_a_id}).json()
    ids_a = [p["id"] for p in list_a]
    assert prod_x_id in ids_a
    assert prod_y_id not in ids_a

    # Listagem no Tenant B deve conter APENAS Produto Y
    list_b = client.get("/api/products", headers={"X-Tenant-ID": t_b_id}).json()
    ids_b = [p["id"] for p in list_b]
    assert prod_y_id in ids_b
    assert prod_x_id not in ids_b

    # Tentar buscar Produto Y usando contexto do Tenant A -> 404
    res_cross = client.get(f"/api/products/{prod_y_id}", headers={"X-Tenant-ID": t_a_id})
    assert res_cross.status_code == 404


def test_idempotency_scoped_by_tenant(client):
    """
    Isolamento de Idempotência:
    Dois tenants utilizam a MESMA chave de idempotência 'K1'.
    Ambos processam suas requisições com sucesso e de forma independente.
    """
    # 1. Tenants A e B
    t_a_id = client.post("/api/tenants", json={"name": "Tenant A Idemp", "slug": "tenant-a-idemp"}).json()["id"]
    t_b_id = client.post("/api/tenants", json={"name": "Tenant B Idemp", "slug": "tenant-b-idemp"}).json()["id"]

    prod_a = client.post("/api/products", json={"name": "Prod A", "unit": "UN", "initial_quantity": 10}, headers={"X-Tenant-ID": t_a_id}).json()
    prod_b = client.post("/api/products", json={"name": "Prod B", "unit": "UN", "initial_quantity": 10}, headers={"X-Tenant-ID": t_b_id}).json()

    shared_key = "idemp-key-compartilhada-entre-tenants"

    # Requisição no Tenant A com a chave shared_key
    res_a1 = client.post(
        "/api/inventory/movements",
        json={"product_id": prod_a["id"], "type": "IN", "quantity": 5},
        headers={"X-Tenant-ID": t_a_id, "X-Idempotency-Key": shared_key},
    )
    assert res_a1.status_code == 201
    assert res_a1.headers.get("X-Cache") == "MISS"
    assert float(res_a1.json()["balance_after"]) == 15.0

    # Requisição no Tenant B com a MESMA chave shared_key -> DEVE ser processada com sucesso (MISS no Tenant B)
    res_b1 = client.post(
        "/api/inventory/movements",
        json={"product_id": prod_b["id"], "type": "IN", "quantity": 20},
        headers={"X-Tenant-ID": t_b_id, "X-Idempotency-Key": shared_key},
    )
    assert res_b1.status_code == 201
    assert res_b1.headers.get("X-Cache") == "MISS"
    assert float(res_b1.json()["balance_after"]) == 30.0

    # Reenvio no Tenant A com a mesma chave -> Cache HIT no Tenant A (retorna 15.0)
    res_a2 = client.post(
        "/api/inventory/movements",
        json={"product_id": prod_a["id"], "type": "IN", "quantity": 5},
        headers={"X-Tenant-ID": t_a_id, "X-Idempotency-Key": shared_key},
    )
    assert res_a2.status_code == 201
    assert res_a2.headers.get("X-Cache") == "HIT"
    assert float(res_a2.json()["balance_after"]) == 15.0


def test_inventory_dedicated_endpoints(client):
    """Testa endpoints dedicados /api/inventory/in, /out e /adjustment."""
    prod = client.post("/api/products", json={"name": "Prod Dedicado", "unit": "UN", "initial_quantity": 50}).json()
    prod_id = prod["id"]

    # Entrada via /in
    res_in = client.post("/api/inventory/in", json={"product_id": prod_id, "quantity": 25, "type": "IN"})
    assert res_in.status_code == 201
    assert float(res_in.json()["balance_after"]) == 75.0

    # Saída via /out
    res_out = client.post("/api/inventory/out", json={"product_id": prod_id, "quantity": 15, "type": "OUT"})
    assert res_out.status_code == 201
    assert float(res_out.json()["balance_after"]) == 60.0

    # Ajuste via /adjustment
    res_adj = client.post("/api/inventory/adjustment", json={"product_id": prod_id, "quantity": 100, "type": "ADJUSTMENT"})
    assert res_adj.status_code == 201
    assert float(res_adj.json()["balance_after"]) == 100.0
