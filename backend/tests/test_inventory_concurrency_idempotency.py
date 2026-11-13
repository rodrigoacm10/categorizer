import concurrent.futures
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.shared.infrastructure.database import get_db
from tests.conftest import TestingSessionLocal
from app.core.security import create_access_token


@pytest.fixture
def concurrent_client(auth_headers):
    """
    Client dedicado para testes de concorrência com sessões isoladas do PostgreSQL.
    """
    def override_get_db_concurrent():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db_concurrent
    with TestClient(app, headers=auth_headers) as c:
        yield c
    app.dependency_overrides.clear()


# =====================================================================
# 1. TESTES DE CONCORRÊNCIA COM IDEMPOTÊNCIA (POST /api/inventory/in)
# =====================================================================


def test_concurrent_stock_in_same_idempotency_key(concurrent_client, auth_headers):
    """
    Testa múltiplas threads disparando requisições simultâneas para POST /api/inventory/in
    com a MESMA chave X-Idempotency-Key e mesmo payload.
    Comprova que:
    - Exatamente 1 registro contábil de entrada é efetuado no banco.
    - As outras requisições recebem status 201 com X-Cache: HIT.
    - O saldo final do produto é incrementado exatamente uma única vez (sem replicação).
    """
    # 1. Cadastra produto com saldo inicial 10.0
    prod_res = concurrent_client.post(
        "/api/products",
        json={
            "name": "Barra de Aço Idempotente Concorrente",
            "unit": "UN",
            "initial_quantity": 10.0,
            "min_stock": 2.0,
        },
    )
    assert prod_res.status_code == 201
    prod_data = prod_res.json()
    prod_id = prod_data["id"]
    assert prod_data["current_quantity_scaled"] == 10000

    # 2. Prepara chave e payload únicos compartilhados entre 10 threads
    shared_idempotency_key = str(uuid.uuid4())
    in_payload = {
        "product_id": prod_id,
        "quantity": 5.0,
        "reason": "Entrada concorrente com mesma chave de idempotencia",
    }

    def execute_stock_in(thread_idx: int):
        thread_client = TestClient(app, headers=auth_headers)
        res = thread_client.post(
            "/api/inventory/in",
            json=in_payload,
            headers={"X-Idempotency-Key": shared_idempotency_key},
        )
        return res.status_code, dict(res.headers), res.json()

    # 3. Disparo simultâneo com 10 threads
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(execute_stock_in, i) for i in range(10)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    # 4. Asserções
    status_codes = [s for s, _, _ in results]
    assert all(code == 201 for code in status_codes), f"Todos devem retornar 201 Created: {status_codes}"

    cache_headers = [h.get("x-cache", h.get("X-Cache")) for _, h, _ in results]
    miss_count = cache_headers.count("MISS")
    hit_count = cache_headers.count("HIT")

    assert miss_count == 1, f"Exatamente 1 requisição deve ter X-Cache: MISS, obtido {miss_count}"
    assert hit_count == 9, f"Exatamente 9 requisições devem ter X-Cache: HIT, obtido {hit_count}"

    # Todas as respostas devem referenciar o mesmo movimento ID
    movement_ids = {body["id"] for _, _, body in results}
    assert len(movement_ids) == 1, f"Todas as requisições devem retornar o mesmo ID de movimentação: {movement_ids}"

    # 5. Verifica se o saldo final foi incrementado apenas UMA vez (10.0 + 5.0 = 15.0)
    final_prod = concurrent_client.get(f"/api/products/{prod_id}").json()
    assert final_prod["current_quantity_scaled"] == 15000, "Saldo escalado deve ser exatamente 15000 (15.0 UN)"
    assert float(final_prod["current_quantity"]) == 15.0

    # 6. Verifica movimentos no Livro-Razão (1 inicial + 1 entrada = 2 registros)
    movs = concurrent_client.get(f"/api/inventory/products/{prod_id}/movements?limit=100").json()
    assert len(movs) == 2, f"Deveriam existir 2 movimentos no Ledger, encontrados {len(movs)}"
    in_movs = [m for m in movs if m["reason"] == "Entrada concorrente com mesma chave de idempotencia"]
    assert len(in_movs) == 1, "Deve existir exatamente 1 movimento gerado pelo lote de requisições"


# =====================================================================
# 2. TESTES DE ESGOTAMENTO CONCORRENTE COM FOR UPDATE (POST /api/inventory/out)
# =====================================================================


def test_concurrent_stock_out_exhaustion_pessimistic_lock(concurrent_client, auth_headers):
    """
    Testa corrida simultânea de POST /api/inventory/out esgotando o estoque.
    Comprova que:
    - O bloqueio pessimista (FOR UPDATE) garante que apenas as transações com saldo
      disponível são aceitas (201 Created).
    - As transações excedentes recebem 422 Unprocessable Entity com type 'insufficient-stock'.
    - O saldo final permanece estritamente em >= 0 (exatamente zero ao fim do esgotamento).
    """
    # 1. Cadastra produto com saldo inicial de 4 unidades
    prod_res = concurrent_client.post(
        "/api/products",
        json={
            "name": "Componente Eletrônico Crítico Concorrente",
            "unit": "UN",
            "initial_quantity": 4.0,
            "min_stock": 1.0,
        },
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # 2. 10 threads tentam retirar 1 unidade cada (total 10 unidades para saldo de 4)
    def attempt_out(thread_idx: int):
        thread_client = TestClient(app, headers=auth_headers)
        res = thread_client.post(
            "/api/inventory/out",
            json={
                "product_id": prod_id,
                "quantity": 1.0,
                "reason": f"Disputa esgotamento thread #{thread_idx}",
            },
            headers={"X-Idempotency-Key": str(uuid.uuid4())},
        )
        return res.status_code, res.json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(attempt_out, i) for i in range(10)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    # 3. Asserções
    status_codes = [s for s, _ in results]
    success_count = status_codes.count(201)
    insufficient_count = status_codes.count(422)

    assert success_count == 4, f"Exatamente 4 requisições devem ter sucesso, obtido {success_count}"
    assert insufficient_count == 6, f"Exatamente 6 requisições devem ser rejeitadas por saldo insuficiente, obtido {insufficient_count}"

    # Valida detalhe dos erros 422 RFC 7807
    rejected_errors = [body for status, body in results if status == 422]
    for err in rejected_errors:
        assert err["type"] == "https://api.estoque.local/errors/insufficient-stock"
        assert err["title"] == "Saldo Insuficiente"
        assert "Saldo insuficiente" in err["detail"]

    # 4. Saldo final estritamente ZERO
    final_prod = concurrent_client.get(f"/api/products/{prod_id}").json()
    assert final_prod["current_quantity_scaled"] == 0
    assert float(final_prod["current_quantity"]) == 0.0

    # 5. Validação no Ledger
    movs = concurrent_client.get(f"/api/inventory/products/{prod_id}/movements?limit=100").json()
    out_movs = [m for m in movs if m["type"] == "OUT"]
    assert len(out_movs) == 4, f"Devem existir exatamente 4 saídas no Ledger, encontrados {len(out_movs)}"


# =====================================================================
# 3. TESTES COMPLETOS DO ENDPOINT GET /api/products/lookup
# =====================================================================


def test_product_lookup_by_valid_uuid(client, default_tenant):
    """
    Testa busca rápida por UUID válido de produto ativo.
    Retorna 200 OK com categorias N:N e quantidades calculadas.
    """
    # 1. Cria categoria
    cat_res = client.post("/api/categories", json={"name": "Tubulações", "color": "#10B981"})
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    # 2. Cria produto vinculado à categoria
    prod_res = client.post(
        "/api/products",
        json={
            "name": "Tubo PVC Esgoto 100mm",
            "description": "Tubo para esgoto predial",
            "unit": "M",
            "initial_quantity": 25.5,
            "min_stock": 5.0,
            "category_ids": [cat_id],
        },
    )
    assert prod_res.status_code == 201
    prod_data = prod_res.json()
    prod_id = prod_data["id"]

    # 3. Busca por UUID
    lookup_res = client.get(f"/api/products/lookup?code={prod_id}")
    assert lookup_res.status_code == 200
    lookup_data = lookup_res.json()

    assert lookup_data["id"] == prod_id
    assert lookup_data["name"] == "Tubo PVC Esgoto 100mm"
    assert lookup_data["unit"] == "M"
    assert lookup_data["current_quantity_scaled"] == 25500
    assert float(lookup_data["current_quantity"]) == 25.5
    assert lookup_data["is_active"] is True
    assert len(lookup_data["categories"]) == 1
    assert lookup_data["categories"][0]["id"] == cat_id
    assert lookup_data["categories"][0]["name"] == "Tubulações"


def test_product_lookup_by_exact_name(client):
    """
    Testa busca por correspondência exata de nome escaneado pelo leitor de código de barras.
    """
    prod_res = client.post(
        "/api/products",
        json={
            "name": "7891234567890",  # Código de barras EAN-13 usado como nome do produto
            "description": "Produto cadastrado com código EAN como nome",
            "unit": "UN",
            "initial_quantity": 50.0,
        },
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # Busca por nome exato (EAN)
    lookup_res = client.get("/api/products/lookup?code=7891234567890")
    assert lookup_res.status_code == 200
    data = lookup_res.json()
    assert data["id"] == prod_id
    assert data["name"] == "7891234567890"


def test_product_lookup_inactive_product_returns_404(client):
    """
    Testa que produto inativado (soft-deleted) NÃO é retornado pelo lookup (retorna 404).
    """
    prod_res = client.post(
        "/api/products",
        json={
            "name": "Produto a ser Desativado",
            "unit": "UN",
            "initial_quantity": 10.0,
        },
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # Inativa produto via DELETE
    del_res = client.delete(f"/api/products/{prod_id}?reason=Descontinuação para teste")
    assert del_res.status_code == 200

    # Busca por UUID -> 404
    lookup_uuid_res = client.get(f"/api/products/lookup?code={prod_id}")
    assert lookup_uuid_res.status_code == 404
    err_uuid = lookup_uuid_res.json()
    assert err_uuid["type"] == "https://api.estoque.local/errors/product-not-found"
    assert err_uuid["title"] == "Produto Não Encontrado"

    # Busca por nome -> 404
    lookup_name_res = client.get("/api/products/lookup?code=Produto a ser Desativado")
    assert lookup_name_res.status_code == 404
    err_name = lookup_name_res.json()
    assert err_name["type"] == "https://api.estoque.local/errors/product-not-found"


def test_product_lookup_nonexistent_code_returns_404(client):
    """
    Testa código inexistente (tanto como UUID aleatório quanto string de texto).
    Retorna 404 RFC 7807.
    """
    random_uuid = str(uuid.uuid4())
    res_uuid = client.get(f"/api/products/lookup?code={random_uuid}")
    assert res_uuid.status_code == 404
    assert res_uuid.json()["type"] == "https://api.estoque.local/errors/product-not-found"

    res_str = client.get("/api/products/lookup?code=CODIGO_INEXISTENTE_XYZ")
    assert res_str.status_code == 404
    assert res_str.json()["type"] == "https://api.estoque.local/errors/product-not-found"


def test_product_lookup_multi_tenant_isolation(client):
    """
    Comprova o isolamento multi-tenant: produto cadastrado no Tenant B
    NUNCA deve ser encontrado em consultas de lookup no Tenant A (retorna 404).
    """
    # 1. Provisiona Tenant A (Alpha)
    u_alpha = client.post("/api/auth/register", json={
        "email": "user.alpha@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "User Alpha",
    }).json()
    token_alpha = create_access_token({"sub": u_alpha["id"], "email": u_alpha["email"]})
    t_alpha = client.post(
        "/api/tenants",
        json={"name": "Tenant Alpha", "slug": "alpha-tenant"},
        headers={"Authorization": f"Bearer {token_alpha}"},
    ).json()
    headers_alpha = {"Authorization": f"Bearer {token_alpha}", "X-Tenant-ID": t_alpha["id"]}

    # 2. Provisiona Tenant B (Beta)
    u_beta = client.post("/api/auth/register", json={
        "email": "user.beta@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "User Beta",
    }).json()
    token_beta = create_access_token({"sub": u_beta["id"], "email": u_beta["email"]})
    t_beta = client.post(
        "/api/tenants",
        json={"name": "Tenant Beta", "slug": "beta-tenant"},
        headers={"Authorization": f"Bearer {token_beta}"},
    ).json()
    headers_beta = {"Authorization": f"Bearer {token_beta}", "X-Tenant-ID": t_beta["id"]}

    # 3. Cria produto exclusivo no Tenant Beta
    prod_beta = client.post(
        "/api/products",
        json={
            "name": "Item Exclusivo Tenant Beta",
            "unit": "UN",
            "initial_quantity": 100.0,
        },
        headers=headers_beta,
    ).json()
    prod_beta_id = prod_beta["id"]

    # 4. Tenant Beta encontra o próprio produto por UUID e por nome
    res_b_uuid = client.get(f"/api/products/lookup?code={prod_beta_id}", headers=headers_beta)
    assert res_b_uuid.status_code == 200
    assert res_b_uuid.json()["id"] == prod_beta_id

    res_b_name = client.get("/api/products/lookup?code=Item Exclusivo Tenant Beta", headers=headers_beta)
    assert res_b_name.status_code == 200
    assert res_b_name.json()["id"] == prod_beta_id

    # 5. Tenant Alpha TENTA buscar o produto do Tenant Beta -> DEVE RECEBER 404
    res_a_uuid = client.get(f"/api/products/lookup?code={prod_beta_id}", headers=headers_alpha)
    assert res_a_uuid.status_code == 404
    assert res_a_uuid.json()["type"] == "https://api.estoque.local/errors/product-not-found"

    res_a_name = client.get("/api/products/lookup?code=Item Exclusivo Tenant Beta", headers=headers_alpha)
    assert res_a_name.status_code == 404
    assert res_a_name.json()["type"] == "https://api.estoque.local/errors/product-not-found"


def test_product_lookup_rbac_roles(client, default_tenant, db_session):
    """
    Garante que os papéis autorizados (OWNER, GESTOR, ALMOXARIFE, AUDITOR) conseguem realizar o lookup.
    """
    from app.modules.auth.infrastructure.models import UserModel
    from app.modules.tenants.infrastructure.models import TenantMembershipModel
    from app.core.security import get_password_hash

    # Cria produto no default_tenant
    prod = client.post("/api/products", json={"name": "Produto RBAC Teste", "unit": "UN", "initial_quantity": 5.0}).json()
    prod_id = prod["id"]

    # Testa papéis GESTOR, ALMOXARIFE, AUDITOR
    for role in ["GESTOR", "ALMOXARIFE", "AUDITOR"]:
        user = UserModel(
            email=f"user.{role.lower()}@empresa.com",
            password_hash=get_password_hash("SenhaSegura123"),
            full_name=f"User {role}",
            is_active=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        membership = TenantMembershipModel(
            user_id=user.id,
            tenant_id=default_tenant.id,
            role=role,
        )
        db_session.add(membership)
        db_session.commit()

        token = create_access_token({"sub": str(user.id), "email": user.email})
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": str(default_tenant.id),
        }

        res = client.get(f"/api/products/lookup?code={prod_id}", headers=headers)
        assert res.status_code == 200, f"Papel {role} deveria ter acesso ao lookup, obtido status {res.status_code}"
