import uuid
import pytest
from app.core.security import create_access_token
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel


def test_category_products_count_lifecycle(client):
    """
    Validar que CategoryResponseDTO expõe products_count:
    1. Categorias recém-criadas possuem products_count == 0.
    2. Ao associar produtos ativos, products_count reflete a contagem correta.
    3. Produtos desativados (soft-delete) são excluídos da contagem ativa.
    """
    # 1. Cria 2 categorias
    cat1_res = client.post("/api/categories", json={"name": "Eletrônicos", "color": "#3B82F6"})
    assert cat1_res.status_code == 201
    cat1_id = cat1_res.json()["id"]

    cat2_res = client.post("/api/categories", json={"name": "Cabos e Conectores", "color": "#10B981"})
    assert cat2_res.status_code == 201
    cat2_id = cat2_res.json()["id"]

    # Verifica contagem inicial
    cats = client.get("/api/categories").json()
    cat_map = {c["id"]: c["products_count"] for c in cats}
    assert cat_map[cat1_id] == 0
    assert cat_map[cat2_id] == 0

    # 2. Cria produto P1 em cat1
    p1 = client.post("/api/products", json={
        "name": "Multímetro Digital",
        "unit": "UN",
        "initial_quantity": 5,
        "category_ids": [cat1_id],
    }).json()

    # Cria produto P2 em cat2
    p2 = client.post("/api/products", json={
        "name": "Cabo HDMI 2.0",
        "unit": "UN",
        "initial_quantity": 20,
        "category_ids": [cat2_id],
    }).json()

    # Cria produto P3 em cat1 E cat2 (N:N)
    p3 = client.post("/api/products", json={
        "name": "Adaptador USB-C",
        "unit": "UN",
        "initial_quantity": 10,
        "category_ids": [cat1_id, cat2_id],
    }).json()

    cats_after = client.get("/api/categories").json()
    cat_map_after = {c["id"]: c["products_count"] for c in cats_after}
    # cat1 tem P1 e P3 -> 2
    assert cat_map_after[cat1_id] == 2
    # cat2 tem P2 e P3 -> 2
    assert cat_map_after[cat2_id] == 2

    # 3. Soft-delete de P1 (da cat1)
    del_res = client.delete(f"/api/products/{p1['id']}?reason=Defeituoso")
    assert del_res.status_code == 200

    cats_after_del = client.get("/api/categories").json()
    cat_map_del = {c["id"]: c["products_count"] for c in cats_after_del}
    # cat1 agora deve ter apenas 1 produto ativo (P3)
    assert cat_map_del[cat1_id] == 1
    # cat2 continua com 2 (P2 e P3)
    assert cat_map_del[cat2_id] == 2


def test_products_list_pagination_metadata_headers(client):
    """
    Validar metadados de totalização e paginação em GET /api/products:
    - X-Total-Count com a contagem total de produtos que casam com os filtros no tenant.
    - X-Total-Pages calculado a partir de limit.
    - Exposição via Access-Control-Expose-Headers.
    """
    # Cria 7 produtos
    for i in range(7):
        res = client.post("/api/products", json={
            "name": f"Item Paginado {i+1:02d}",
            "unit": "UN",
            "initial_quantity": 10,
        })
        assert res.status_code == 201

    # Requisita primeira página com limit=3
    page1 = client.get("/api/products?limit=3&offset=0")
    assert page1.status_code == 200
    assert len(page1.json()) == 3
    assert page1.headers["X-Total-Count"] == "7"
    assert page1.headers["X-Total-Pages"] == "3"  # ceil(7 / 3) = 3
    assert "X-Total-Count" in page1.headers["Access-Control-Expose-Headers"]
    assert "X-Total-Pages" in page1.headers["Access-Control-Expose-Headers"]

    # Requisita última página com limit=3, offset=6
    page3 = client.get("/api/products?limit=3&offset=6")
    assert page3.status_code == 200
    assert len(page3.json()) == 1
    assert page3.headers["X-Total-Count"] == "7"
    assert page3.headers["X-Total-Pages"] == "3"


def test_products_list_pagination_with_all_filters(client):
    """
    Validar que o cabeçalho X-Total-Count em /api/products respeita todos os filtros:
    - search
    - low_stock_only
    - category_id
    - include_inactive
    """
    # 1. Cria categoria
    cat = client.post("/api/categories", json={"name": "Fixadores", "color": "#F59E0B"}).json()
    cat_id = cat["id"]

    # 2. Cria produtos com características distintas
    p_critico = client.post("/api/products", json={
        "name": "Parafuso Sextavado M8",
        "description": "Fixador em aço carbono",
        "unit": "UN",
        "initial_quantity": 2,
        "min_stock": 5,
        "category_ids": [cat_id],
    }).json()

    p_normal = client.post("/api/products", json={
        "name": "Parafuso Phillips M4",
        "description": "Fixador pequeno",
        "unit": "UN",
        "initial_quantity": 100,
        "min_stock": 10,
        "category_ids": [cat_id],
    }).json()

    p_outro = client.post("/api/products", json={
        "name": "Porca Sextavada M8",
        "description": "Acessório para parafuso",
        "unit": "UN",
        "initial_quantity": 50,
        "min_stock": 5,
    }).json()

    # Inativa p_outro
    client.delete(f"/api/products/{p_outro['id']}?reason=Descontinuado")

    # Filtro search='Parafuso' -> deve contar p_critico e p_normal (2 ativos)
    res_search = client.get("/api/products?search=Parafuso&limit=1")
    assert res_search.headers["X-Total-Count"] == "2"
    assert res_search.headers["X-Total-Pages"] == "2"

    # Filtro low_stock_only=true -> apenas p_critico (1)
    res_low = client.get("/api/products?low_stock_only=true")
    assert res_low.headers["X-Total-Count"] == "1"
    assert res_low.headers["X-Total-Pages"] == "1"

    # Filtro category_id -> p_critico e p_normal (2)
    res_cat = client.get(f"/api/products?category_id={cat_id}")
    assert res_cat.headers["X-Total-Count"] == "2"

    # Filtro include_inactive=true -> p_critico, p_normal e p_outro (3)
    res_inactive = client.get("/api/products?include_inactive=true")
    assert res_inactive.headers["X-Total-Count"] == "3"


def test_products_pagination_strict_tenant_isolation(client, db_session, default_user):
    """
    Validar que produtos cadastrados em outro tenant não vazam em X-Total-Count ou na listagem.
    """
    # 1. Cria produto no default_tenant
    client.post("/api/products", json={
        "name": "Produto Tenant 1",
        "unit": "UN",
        "initial_quantity": 10,
    })

    res_t1 = client.get("/api/products")
    assert res_t1.headers["X-Total-Count"] == "1"

    # 2. Cria segundo tenant e associa o usuário a ele
    tenant2 = TenantModel(
        name="Tenant Isolado",
        slug="isolado",
        description="Tenant 2",
        is_active=True,
    )
    db_session.add(tenant2)
    db_session.commit()
    db_session.refresh(tenant2)

    membership2 = TenantMembershipModel(
        user_id=default_user.id,
        tenant_id=tenant2.id,
        role="OWNER",
    )
    db_session.add(membership2)
    db_session.commit()

    token2 = create_access_token({"sub": str(default_user.id), "email": default_user.email})
    headers_t2 = {
        "Authorization": f"Bearer {token2}",
        "X-Tenant-ID": str(tenant2.id),
    }

    # No Tenant 2, inicialmente X-Total-Count é 0
    res_t2_init = client.get("/api/products", headers=headers_t2)
    assert res_t2_init.headers["X-Total-Count"] == "0"
    assert len(res_t2_init.json()) == 0

    # Cria 3 produtos no Tenant 2
    for j in range(3):
        client.post("/api/products", json={
            "name": f"Produto T2 {j}",
            "unit": "UN",
            "initial_quantity": 5,
        }, headers=headers_t2)

    res_t2_after = client.get("/api/products", headers=headers_t2)
    assert res_t2_after.headers["X-Total-Count"] == "3"

    # Tenant 1 permanece inalterado com contagem 1
    res_t1_after = client.get("/api/products")
    assert res_t1_after.headers["X-Total-Count"] == "1"
