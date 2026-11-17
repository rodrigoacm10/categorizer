import uuid
from datetime import datetime, timezone, timedelta
import pytest
from app.core.security import create_access_token
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel


def test_movements_pagination_headers_and_expose(client):
    """
    Validar metadados de paginação em GET /api/inventory/movements:
    - Injeção de Response e cabeçalhos X-Total-Count e X-Total-Pages.
    - Exposição via Access-Control-Expose-Headers.
    """
    # 1. Cria produto base
    p = client.post("/api/products", json={
        "name": "Barra de Aço 10mm",
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

    # 3. Consulta paginada com limit=2
    res_page1 = client.get("/api/inventory/movements?limit=2&offset=0")
    assert res_page1.status_code == 200
    assert len(res_page1.json()) == 2
    assert res_page1.headers["X-Total-Count"] == "5"
    assert res_page1.headers["X-Total-Pages"] == "3"  # ceil(5/2) = 3
    assert "X-Total-Count" in res_page1.headers["Access-Control-Expose-Headers"]
    assert "X-Total-Pages" in res_page1.headers["Access-Control-Expose-Headers"]

    # Última página
    res_page3 = client.get("/api/inventory/movements?limit=2&offset=4")
    assert res_page3.status_code == 200
    assert len(res_page3.json()) == 1
    assert res_page3.headers["X-Total-Count"] == "5"
    assert res_page3.headers["X-Total-Pages"] == "3"


def test_movements_pagination_with_filters(client):
    """
    Validar que X-Total-Count respeita os filtros:
    - product_id
    - type (IN, OUT, ADJUSTMENT)
    - start_date e end_date
    """
    # Cria dois produtos
    p1 = client.post("/api/products", json={"name": "Produto A", "unit": "UN", "initial_quantity": 0}).json()
    p2 = client.post("/api/products", json={"name": "Produto B", "unit": "UN", "initial_quantity": 0}).json()

    # Movimentações em P1: 2 IN e 1 OUT
    client.post("/api/inventory/in", json={"product_id": p1["id"], "quantity": 10.0, "reason": "Entrada 1"}, headers={"X-Idempotency-Key": str(uuid.uuid4())})
    client.post("/api/inventory/in", json={"product_id": p1["id"], "quantity": 5.0, "reason": "Entrada 2"}, headers={"X-Idempotency-Key": str(uuid.uuid4())})
    client.post("/api/inventory/out", json={"product_id": p1["id"], "quantity": 3.0, "reason": "Saída 1"}, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    # Movimentações em P2: 1 IN e 1 ADJUSTMENT
    client.post("/api/inventory/in", json={"product_id": p2["id"], "quantity": 20.0, "reason": "Entrada B"}, headers={"X-Idempotency-Key": str(uuid.uuid4())})
    client.post("/api/inventory/adjustment", json={"product_id": p2["id"], "quantity": 25.0, "reason": "Ajuste B"}, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    # Total geral de movimentações = 5
    res_all = client.get("/api/inventory/movements")
    assert res_all.headers["X-Total-Count"] == "5"

    # Filtro por product_id = p1 -> 3
    res_p1 = client.get(f"/api/inventory/movements?product_id={p1['id']}")
    assert res_p1.headers["X-Total-Count"] == "3"

    # Filtro por product_id = p2 -> 2
    res_p2 = client.get(f"/api/inventory/movements?product_id={p2['id']}")
    assert res_p2.headers["X-Total-Count"] == "2"

    # Filtro por type = IN -> 3 no total (2 de p1, 1 de p2)
    res_type_in = client.get("/api/inventory/movements?type=IN")
    assert res_type_in.headers["X-Total-Count"] == "3"

    # Filtro por type = OUT -> 1
    res_type_out = client.get("/api/inventory/movements?type=OUT")
    assert res_type_out.headers["X-Total-Count"] == "1"

    # Filtro por type = ADJUSTMENT -> 1
    res_type_adj = client.get("/api/inventory/movements?type=ADJUSTMENT")
    assert res_type_adj.headers["X-Total-Count"] == "1"

    # Filtro por data futura (não deve encontrar nada)
    future = (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    res_future = client.get(f"/api/inventory/movements?start_date={future}")
    assert res_future.status_code == 200
    assert res_future.headers["X-Total-Count"] == "0"


def test_movements_pagination_tenant_isolation(client, db_session, default_user):
    """
    Validar que movimentações contábeis de outro tenant não vazam em X-Total-Count de /api/inventory/movements.
    """
    p1 = client.post("/api/products", json={"name": "Produto T1", "unit": "UN", "initial_quantity": 0}).json()
    client.post("/api/inventory/in", json={"product_id": p1["id"], "quantity": 10.0, "reason": "T1"}, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    res_t1 = client.get("/api/inventory/movements")
    assert res_t1.headers["X-Total-Count"] == "1"

    # Cria Tenant 2
    tenant2 = TenantModel(name="Tenant 2 Mov", slug="t2-mov", is_active=True)
    db_session.add(tenant2)
    db_session.commit()
    db_session.refresh(tenant2)

    membership2 = TenantMembershipModel(user_id=default_user.id, tenant_id=tenant2.id, role="OWNER")
    db_session.add(membership2)
    db_session.commit()

    token2 = create_access_token({"sub": str(default_user.id), "email": default_user.email})
    headers_t2 = {"Authorization": f"Bearer {token2}", "X-Tenant-ID": str(tenant2.id)}

    # No Tenant 2, inicialmente 0 movimentos
    res_t2_init = client.get("/api/inventory/movements", headers=headers_t2)
    assert res_t2_init.headers["X-Total-Count"] == "0"

    # Cria produto e movimentações no Tenant 2
    p2_res = client.post("/api/products", json={"name": "Produto T2", "unit": "UN", "initial_quantity": 0}, headers=headers_t2)
    p2_id = p2_res.json()["id"]

    for _ in range(3):
        client.post("/api/inventory/in", json={"product_id": p2_id, "quantity": 5.0, "reason": "T2 IN"}, headers={**headers_t2, "X-Idempotency-Key": str(uuid.uuid4())})

    res_t2_after = client.get("/api/inventory/movements", headers=headers_t2)
    assert res_t2_after.headers["X-Total-Count"] == "3"

    # Tenant 1 permanece com 1
    res_t1_after = client.get("/api/inventory/movements")
    assert res_t1_after.headers["X-Total-Count"] == "1"
