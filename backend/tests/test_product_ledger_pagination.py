import uuid
import pytest
from app.core.security import create_access_token
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel


def test_product_ledger_pagination_headers_and_expose(client):
    """
    Validar metadados de paginação em GET /api/inventory/products/{product_id}/ledger
    e no alias GET /api/inventory/products/{product_id}/movements:
    - Injeção de Response e cabeçalhos X-Total-Count e X-Total-Pages.
    - Exposição via Access-Control-Expose-Headers.
    - Fatiamento com limit e offset.
    """
    # 1. Cria produto base
    p = client.post("/api/products", json={
        "name": "Parafuso Sextavado M8",
        "unit": "UN",
        "initial_quantity": 0,
    }).json()
    p_id = p["id"]

    # 2. Registra 5 movimentações
    for i in range(5):
        in_res = client.post("/api/inventory/in", json={
            "product_id": p_id,
            "quantity": 10.0,
            "reason": f"Lote {i+1}",
        }, headers={"X-Idempotency-Key": str(uuid.uuid4())})
        assert in_res.status_code == 201

    # 3. Consulta /ledger paginada com limit=2, offset=0
    res_page1 = client.get(f"/api/inventory/products/{p_id}/ledger?limit=2&offset=0")
    assert res_page1.status_code == 200
    assert len(res_page1.json()) == 2
    assert res_page1.headers["X-Total-Count"] == "5"
    assert res_page1.headers["X-Total-Pages"] == "3"  # ceil(5/2) = 3
    assert "X-Total-Count" in res_page1.headers["Access-Control-Expose-Headers"]
    assert "X-Total-Pages" in res_page1.headers["Access-Control-Expose-Headers"]

    # 4. Consulta segunda página: limit=2, offset=2
    res_page2 = client.get(f"/api/inventory/products/{p_id}/ledger?limit=2&offset=2")
    assert res_page2.status_code == 200
    assert len(res_page2.json()) == 2
    assert res_page2.headers["X-Total-Count"] == "5"
    assert res_page2.headers["X-Total-Pages"] == "3"

    # 5. Consulta última página: limit=2, offset=4
    res_page3 = client.get(f"/api/inventory/products/{p_id}/ledger?limit=2&offset=4")
    assert res_page3.status_code == 200
    assert len(res_page3.json()) == 1
    assert res_page3.headers["X-Total-Count"] == "5"
    assert res_page3.headers["X-Total-Pages"] == "3"

    # 6. Valida alias /movements
    res_alias = client.get(f"/api/inventory/products/{p_id}/movements?limit=2&offset=0")
    assert res_alias.status_code == 200
    assert len(res_alias.json()) == 2
    assert res_alias.headers["X-Total-Count"] == "5"
    assert res_alias.headers["X-Total-Pages"] == "3"
    assert "X-Total-Count" in res_alias.headers["Access-Control-Expose-Headers"]
    assert "X-Total-Pages" in res_alias.headers["Access-Control-Expose-Headers"]


def test_product_ledger_not_found(client):
    """
    Validar que produto inexistente retorna HTTP 404 Not Found.
    """
    fake_id = str(uuid.uuid4())
    res = client.get(f"/api/inventory/products/{fake_id}/ledger")
    assert res.status_code == 404
    assert "não encontrado" in res.json().get("detail", "").lower()


def test_product_ledger_tenant_isolation(client, db_session, default_user):
    """
    Garantir isolamento estrito multi-tenant:
    - Tenant A cria produto e movimentações.
    - Tenant B não consegue acessar o ledger do produto do Tenant A (HTTP 404).
    """
    # Tenant A (default_tenant) cria produto com 3 entradas
    p_a = client.post("/api/products", json={
        "name": "Chapa de Inox",
        "unit": "M2",
        "initial_quantity": 0,
    }).json()
    p_a_id = p_a["id"]

    for i in range(3):
        client.post("/api/inventory/in", json={
            "product_id": p_a_id,
            "quantity": 5.0,
            "reason": f"Entrada Tenant A #{i+1}",
        }, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    # Cria Tenant B e vincula o usuário como OWNER
    tenant_b = TenantModel(
        name="Tenant B Almoxarifado",
        slug="tenant-b-almox",
        description="Segundo tenant para validação de isolamento",
        is_active=True,
    )
    db_session.add(tenant_b)
    db_session.commit()
    db_session.refresh(tenant_b)

    membership_b = TenantMembershipModel(
        user_id=default_user.id,
        tenant_id=tenant_b.id,
        role="OWNER",
    )
    db_session.add(membership_b)
    db_session.commit()

    token_b = create_access_token({"sub": str(default_user.id), "email": default_user.email})
    headers_b = {
        "Authorization": f"Bearer {token_b}",
        "X-Tenant-ID": str(tenant_b.id),
    }

    # Tenant B tenta consultar o ledger do produto do Tenant A
    res_leak = client.get(f"/api/inventory/products/{p_a_id}/ledger", headers=headers_b)
    assert res_leak.status_code == 404
    assert "não encontrado" in res_leak.json().get("detail", "").lower()


def test_product_ledger_soft_deleted_product(client):
    """
    Validar que produto soft-deleted preserva histórico e permite paginação do ledger.
    """
    p = client.post("/api/products", json={
        "name": "Cabo de Cobre 4mm",
        "unit": "M",
        "initial_quantity": 100.0,
    }).json()
    p_id = p["id"]

    # Adiciona saída
    client.post("/api/inventory/out", json={
        "product_id": p_id,
        "quantity": 20.0,
        "reason": "Saída de obra",
    }, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    # Soft delete do produto (gera evento PRODUCT_DELETED)
    del_res = client.delete(f"/api/products/{p_id}")
    assert del_res.status_code == 200

    # Consulta ledger do produto inativo
    res_ledger = client.get(f"/api/inventory/products/{p_id}/ledger")
    assert res_ledger.status_code == 200
    # Inicial (IN) + Saída (OUT) + Remoção (PRODUCT_DELETED) = 3 movimentações
    assert res_ledger.headers["X-Total-Count"] == "3"
    assert res_ledger.headers["X-Total-Pages"] == "1"
    assert len(res_ledger.json()) == 3
