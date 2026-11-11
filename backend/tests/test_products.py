import pytest
from datetime import datetime, timezone
from uuid import uuid4

from app.modules.products.domain.entities import Product as ProductEntity, Category as CategoryEntity
from app.modules.products.application.dtos import (
    ProductCreateDTO,
    ProductUpdateDTO,
    format_quantity_with_unit,
)


# -------------------------------------------------------------
# 1. TESTES DE DOMÍNIO PURO E FORMATADORES
# -------------------------------------------------------------


def test_product_domain_entity_methods():
    tenant_id = uuid4()
    # Cria produto com min_stock de 5000 (5.0 UN) e estoque atual 10000 (10.0 UN)
    p = ProductEntity(
        name=" Parafuso Inox ",
        tenant_id=tenant_id,
        unit="kg",
        current_quantity=10000,
        min_stock=5000,
    )
    # Testa normalizações
    assert p.name == "Parafuso Inox"
    assert p.unit == "KG"
    assert p.is_active is True
    assert p.deleted_at is None

    # Estoque acima do mínimo
    assert p.is_low_stock() is False

    # Estoque exatamente igual ao mínimo
    p.current_quantity = 5000
    assert p.is_low_stock() is True

    # Estoque abaixo do mínimo
    p.current_quantity = 2500
    assert p.is_low_stock() is True

    # Sem min_stock definido
    p.min_stock = None
    assert p.is_low_stock() is False

    # Deativação (Soft-Delete)
    p.deactivate(reason="Descontinuado pelo fabricante")
    assert p.is_active is False
    assert p.deleted_at is not None


def test_category_domain_entity():
    tenant_id = uuid4()
    cat = CategoryEntity(name="Fixadores", tenant_id=tenant_id)
    assert cat.name == "Fixadores"
    assert cat.tenant_id == tenant_id
    assert cat.color == "#3B82F6"
    assert isinstance(cat.created_at, datetime)


def test_format_quantity_with_unit_edge_cases():
    assert format_quantity_with_unit(15750, "M") == "15,750 M"
    assert format_quantity_with_unit(2500, "KG") == "2,500 KG"
    assert format_quantity_with_unit(0, "UN") == "0,000 UN"
    assert format_quantity_with_unit(-3250, "L") == "-3,250 L"
    assert format_quantity_with_unit(1250000, "m") == "1.250,000 M"


def test_dtos_validation_and_properties():
    # Validação de nome obrigatório
    with pytest.raises(ValueError):
        ProductCreateDTO(name="   ", unit="UN")

    # Conversão de escala
    dto = ProductCreateDTO(
        name="Produto Teste",
        unit="litros",
        initial_quantity=2.75,
        min_stock=1.5,
    )
    assert dto.unit == "LITROS"
    assert dto.initial_quantity_raw == 2750
    assert dto.min_stock_raw == 1500

    # DTO de Update
    up_dto = ProductUpdateDTO(name=" Novo Nome ", unit="un", min_stock=10.0)
    assert up_dto.name == "Novo Nome"
    assert up_dto.unit == "UN"
    assert up_dto.min_stock_raw == 10000

    empty_up = ProductUpdateDTO()
    assert empty_up.min_stock_raw is None
    assert empty_up.category_ids is None

    # Validação de nome em branco no update
    with pytest.raises(ValueError):
        ProductUpdateDTO(name="   ")

    # DTO com unit vazia e category_ids None
    dto_empty_unit = ProductCreateDTO(name="Prod Empty Unit", unit="", category_ids=None, initial_quantity=None)
    assert dto_empty_unit.unit == "UN"
    assert dto_empty_unit.category_ids == []
    assert dto_empty_unit.initial_quantity_raw == 0


# -------------------------------------------------------------
# 2. TESTES MANDATÓRIOS DO PRD
# -------------------------------------------------------------


def test_create_product_with_multiple_categories(client, db_session, default_tenant):
    """
    Validar persistência do produto e dos registros vinculados na tabela product_categories (N:N).
    """
    from app.modules.products.infrastructure.models import product_categories

    # 1. Cria 2 categorias
    cat1_res = client.post("/api/categories", json={"name": "Inflamáveis", "color": "#EF4444"})
    assert cat1_res.status_code == 201
    cat1_id = cat1_res.json()["id"]

    cat2_res = client.post("/api/categories", json={"name": "Matéria-Prima", "color": "#10B981"})
    assert cat2_res.status_code == 201
    cat2_id = cat2_res.json()["id"]

    # 2. Cria produto vinculado às duas categorias
    prod_res = client.post("/api/products", json={
        "name": "Solvente Industrial 5L",
        "description": "Químico volátil para limpeza pesada",
        "unit": "L",
        "initial_quantity": 50.0,
        "min_stock": 10.0,
        "category_ids": [cat1_id, cat2_id]
    })
    assert prod_res.status_code == 201
    prod_data = prod_res.json()
    prod_id = prod_data["id"]

    assert len(prod_data["categories"]) == 2
    cat_names = {c["name"] for c in prod_data["categories"]}
    assert cat_names == {"Inflamáveis", "Matéria-Prima"}

    # 3. Consulta direta no banco na tabela relacional product_categories
    rel_count = db_session.query(product_categories).filter(
        product_categories.c.product_id == prod_id
    ).count()
    assert rel_count == 2


def test_scale_conversion_and_formatting(client):
    """
    Validar que entrada decimal 15.75 é armazenada como 15750 e formatada como '15,750 M'.
    """
    res = client.post("/api/products", json={
        "name": "Cabo de Cobre Nu 50mm",
        "unit": "m",
        "initial_quantity": 15.75,
        "min_stock": 5.0
    })
    assert res.status_code == 201
    data = res.json()

    assert data["current_quantity_raw"] == 15750
    assert data["current_quantity_scaled"] == 15750
    assert float(data["current_quantity"]) == 15.75
    assert data["unit"] == "M"
    assert data["formatted_quantity"] == "15,750 M"


def test_is_low_stock_calculation(client):
    """
    Testar produtos com estoque acima, exatamente igual e abaixo do min_stock.
    """
    # 1. Estoque acima do mínimo: qty = 10.0, min = 5.0
    p1 = client.post("/api/products", json={
        "name": "Item Acima Minimo",
        "unit": "UN",
        "initial_quantity": 10.0,
        "min_stock": 5.0
    }).json()
    assert p1["is_low_stock"] is False

    # 2. Estoque exatamente igual ao mínimo: qty = 5.0, min = 5.0
    p2 = client.post("/api/products", json={
        "name": "Item Igual Minimo",
        "unit": "UN",
        "initial_quantity": 5.0,
        "min_stock": 5.0
    }).json()
    assert p2["is_low_stock"] is True

    # 3. Estoque abaixo do mínimo: qty = 2.0, min = 5.0
    p3 = client.post("/api/products", json={
        "name": "Item Abaixo Minimo",
        "unit": "UN",
        "initial_quantity": 2.0,
        "min_stock": 5.0
    }).json()
    assert p3["is_low_stock"] is True


def test_filter_low_stock_only(client):
    """
    Validar que a listagem com low_stock_only=True retorna apenas itens críticos.
    """
    client.post("/api/products", json={
        "name": "Estoque Alto",
        "unit": "UN",
        "initial_quantity": 100.0,
        "min_stock": 10.0
    })
    client.post("/api/products", json={
        "name": "Estoque Critico 1",
        "unit": "UN",
        "initial_quantity": 5.0,
        "min_stock": 10.0
    })
    client.post("/api/products", json={
        "name": "Estoque Critico 2",
        "unit": "UN",
        "initial_quantity": 10.0,
        "min_stock": 10.0
    })

    # Listagem normal: retorna todos
    all_res = client.get("/api/products")
    assert all_res.status_code == 200
    all_prods = all_res.json()
    assert len(all_prods) >= 3

    # Listagem apenas com estoque baixo
    low_res = client.get("/api/products?low_stock_only=true")
    assert low_res.status_code == 200
    low_prods = low_res.json()
    assert len(low_prods) == 2
    names = {p["name"] for p in low_prods}
    assert names == {"Estoque Critico 1", "Estoque Critico 2"}


def test_update_product_preserves_quantity(client):
    """
    Validar que alteração de dados cadastrais não sobrescreve o saldo do produto.
    """
    created = client.post("/api/products", json={
        "name": "Valvula Esfera 1/2",
        "description": "Latão forjado",
        "unit": "UN",
        "initial_quantity": 42.0,
        "min_stock": 10.0
    }).json()
    prod_id = created["id"]
    assert created["current_quantity_raw"] == 42000

    # Realiza Update cadastral
    update_res = client.put(f"/api/products/{prod_id}", json={
        "name": "Valvula Esfera 1/2 Inox 316",
        "description": "Atualizado para inox",
        "unit": "un",
        "min_stock": 15.0
    })
    assert update_res.status_code == 200
    updated = update_res.json()

    assert updated["name"] == "Valvula Esfera 1/2 Inox 316"
    assert updated["unit"] == "UN"
    assert updated["min_stock"] == 15.0
    # O saldo físico original DEVE permanecer intacto (42.0 / 42000)
    assert updated["current_quantity_raw"] == 42000
    assert float(updated["current_quantity"]) == 42.0


def test_soft_delete_product_records_ledger_event(client):
    """
    Validar que inativação marca is_active=False, esconde o produto da listagem padrão
    e gera o evento PRODUCT_DELETED no Ledger.
    """
    created = client.post("/api/products", json={
        "name": "Chapa de Aço para Descarte",
        "unit": "M2",
        "initial_quantity": 25.0
    }).json()
    prod_id = created["id"]

    # Deleta com justificativa
    del_res = client.delete(f"/api/products/{prod_id}?reason=Item Obsoleto")
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert "removido com sucesso" in del_data["message"]
    assert del_data["remaining_quantity_scaled"] == 25000

    # Listagem ativa não retorna o produto
    list_active = client.get("/api/products").json()
    assert not any(p["id"] == prod_id for p in list_active)

    # Listagem incluindo inativos retorna o produto com is_active = False
    list_all = client.get("/api/products?include_inactive=true").json()
    matched = [p for p in list_all if p["id"] == prod_id]
    assert len(matched) == 1
    assert matched[0]["is_active"] is False

    # Verifica o evento contábil gerado no Ledger
    ledger_res = client.get(f"/api/inventory/products/{prod_id}/ledger")
    assert ledger_res.status_code == 200
    movements = ledger_res.json()
    deleted_event = next(m for m in movements if m["type"] == "PRODUCT_DELETED")
    assert deleted_event["reason"] == "Item Obsoleto"
    assert deleted_event["quantity_scaled"] == 0
    assert float(deleted_event["balance_after"]) == 25.0


# -------------------------------------------------------------
# 3. TESTES DE FILTROS, PAGINAÇÃO E ISOLAMENTO MULTI-TENANT
# -------------------------------------------------------------


def test_list_products_search_and_pagination(client):
    # Cria múltiplos produtos
    client.post("/api/products", json={"name": "Abraçadeira Nylon 100mm", "description": "Fixação de cabos", "unit": "UN"})
    client.post("/api/products", json={"name": "Abraçadeira Inox 200mm", "description": "Fixação pesada", "unit": "UN"})
    client.post("/api/products", json={"name": "Parafuso Brocante", "description": "Auto perfurante", "unit": "UN"})

    # Busca textual case-insensitive por nome
    res_search1 = client.get("/api/products?search=abraçadeira")
    assert res_search1.status_code == 200
    assert len(res_search1.json()) == 2

    # Busca textual por descrição
    res_search2 = client.get("/api/products?search=perfurante")
    assert res_search2.status_code == 200
    assert len(res_search2.json()) == 1
    assert res_search2.json()[0]["name"] == "Parafuso Brocante"

    # Paginação
    res_paged1 = client.get("/api/products?limit=2&offset=0")
    assert res_paged1.status_code == 200
    assert len(res_paged1.json()) == 2

    res_paged2 = client.get("/api/products?limit=2&offset=2")
    assert res_paged2.status_code == 200
    assert len(res_paged2.json()) >= 1


def test_list_products_filter_by_category(client):
    cat_res = client.post("/api/categories", json={"name": "Categoria Exclusiva A"})
    cat_id = cat_res.json()["id"]

    client.post("/api/products", json={"name": "Produto Na Categoria", "unit": "UN", "category_ids": [cat_id]})
    client.post("/api/products", json={"name": "Produto Fora da Categoria", "unit": "UN"})

    filter_res = client.get(f"/api/products?category_id={cat_id}")
    assert filter_res.status_code == 200
    items = filter_res.json()
    assert len(items) == 1
    assert items[0]["name"] == "Produto Na Categoria"


def test_products_and_categories_multi_tenant_isolation(client, db_session, default_tenant):
    """
    Garante que produtos e categorias do Tenant A são 100% invisíveis e inacessíveis para o Tenant B.
    """
    from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel
    from app.modules.auth.infrastructure.models import UserModel
    from app.core.security import get_password_hash, create_access_token

    # Cria Tenant B e usuário membro com role OWNER
    tenant_b = TenantModel(name="Tenant B", slug="tenant-b", is_active=True)
    db_session.add(tenant_b)
    db_session.commit()

    user_b = UserModel(email="user.b@empresa.com", password_hash=get_password_hash("Senha123"), full_name="User B")
    db_session.add(user_b)
    db_session.commit()

    db_session.add(TenantMembershipModel(user_id=user_b.id, tenant_id=tenant_b.id, role="OWNER"))
    db_session.commit()

    token_b = create_access_token({"sub": str(user_b.id), "email": user_b.email})
    headers_b = {"Authorization": f"Bearer {token_b}", "X-Tenant-ID": str(tenant_b.id)}

    # 1. Tenant A cria categoria e produto
    cat_a = client.post("/api/categories", json={"name": "Ferramentas A"}).json()
    prod_a = client.post("/api/products", json={
        "name": "Martelo A",
        "unit": "UN",
        "category_ids": [cat_a["id"]]
    }).json()

    # 2. Tenant B não vê a categoria de A
    cats_b = client.get("/api/categories", headers=headers_b).json()
    assert not any(c["id"] == cat_a["id"] for c in cats_b)

    # 3. Tenant B não vê o produto de A
    prods_b = client.get("/api/products", headers=headers_b).json()
    assert not any(p["id"] == prod_a["id"] for p in prods_b)

    # 4. Tenant B tentando acessar produto de A diretamente via GET recebe 404
    get_cross = client.get(f"/api/products/{prod_a['id']}", headers=headers_b)
    assert get_cross.status_code == 404

    # 5. Tenant B tentando atualizar produto de A recebe 404
    put_cross = client.put(f"/api/products/{prod_a['id']}", json={"name": "Hack"}, headers=headers_b)
    assert put_cross.status_code == 404

    # 6. Tenant B tentando deletar produto de A recebe 404
    del_cross = client.delete(f"/api/products/{prod_a['id']}", headers=headers_b)
    assert del_cross.status_code == 404

    # 7. Tenant B tentando associar produto à categoria de A recebe 404
    link_cross = client.post("/api/products", json={
        "name": "Produto Tentativa Cross",
        "unit": "UN",
        "category_ids": [cat_a["id"]]
    }, headers=headers_b)
    assert link_cross.status_code in (400, 404)


def test_category_delete_endpoint_and_product_disassociation(client, db_session):
    # 1. Cria categoria e produto associado
    cat = client.post("/api/categories", json={"name": "Categoria Para Deletar"}).json()
    cat_id = cat["id"]

    prod = client.post("/api/products", json={
        "name": "Produto com Categoria a Deletar",
        "unit": "UN",
        "category_ids": [cat_id]
    }).json()
    prod_id = prod["id"]
    assert len(prod["categories"]) == 1

    # 2. Deleta categoria via DELETE /api/categories/{id}
    del_cat_res = client.delete(f"/api/categories/{cat_id}")
    assert del_cat_res.status_code == 204

    # 3. Categoria não existe mais
    cats = client.get("/api/categories").json()
    assert not any(c["id"] == cat_id for c in cats)

    # 4. Produto continua existindo, mas sem a categoria vinculada
    prod_check = client.get(f"/api/products/{prod_id}").json()
    assert prod_check["name"] == "Produto com Categoria a Deletar"
    assert len(prod_check["categories"]) == 0


# -------------------------------------------------------------
# 4. TESTES DE TRATAMENTO DE ERROS E REPOSITÓRIOS DIRETOS
# -------------------------------------------------------------


def test_duplicate_category_and_product_names_validation(client):
    # Categoria duplicada com chaves de idempotência distintas
    c1 = client.post(
        "/api/categories",
        json={"name": "Categoria Unica"},
        headers={"X-Idempotency-Key": str(uuid4())},
    )
    assert c1.status_code == 201

    c2 = client.post(
        "/api/categories",
        json={"name": "Categoria Unica", "description": "Tentativa com payload diferente"},
        headers={"X-Idempotency-Key": str(uuid4())},
    )
    assert c2.status_code in (400, 409)

    # Produto duplicado com chaves de idempotência distintas
    p1 = client.post(
        "/api/products",
        json={"name": "Produto Unico", "unit": "UN"},
        headers={"X-Idempotency-Key": str(uuid4())},
    )
    assert p1.status_code == 201

    p2 = client.post(
        "/api/products",
        json={"name": "Produto Unico", "unit": "UN", "description": "Diferente"},
        headers={"X-Idempotency-Key": str(uuid4())},
    )
    assert p2.status_code in (400, 409)

    # Update para nome já existente em outro produto
    p3 = client.post(
        "/api/products",
        json={"name": "Produto Secundario", "unit": "UN"},
        headers={"X-Idempotency-Key": str(uuid4())},
    ).json()
    p3_update = client.put(
        f"/api/products/{p3['id']}",
        json={"name": "Produto Unico"},
        headers={"X-Idempotency-Key": str(uuid4())},
    )
    assert p3_update.status_code in (400, 409)

    # Update com categorias inexistentes
    fake_cat_id = str(uuid4())
    p3_cat_update = client.put(
        f"/api/products/{p3['id']}",
        json={"category_ids": [fake_cat_id]},
        headers={"X-Idempotency-Key": str(uuid4())},
    )
    assert p3_cat_update.status_code == 404

    # Delete de categoria inexistente
    del_fake_cat = client.delete(f"/api/categories/{fake_cat_id}")
    assert del_fake_cat.status_code == 404


def test_get_and_update_product_not_found(client):
    fake_uuid = str(uuid4())
    res_get = client.get(f"/api/products/{fake_uuid}")
    assert res_get.status_code == 404

    res_put = client.put(f"/api/products/{fake_uuid}", json={"name": "Inexistente"})
    assert res_put.status_code == 404

    res_del = client.delete(f"/api/products/{fake_uuid}")
    assert res_del.status_code == 404


def test_soft_delete_already_deleted_product(client):
    prod = client.post(
        "/api/products",
        json={"name": "Item Duplo Delete", "unit": "UN"},
        headers={"X-Idempotency-Key": str(uuid4())},
    ).json()
    prod_id = prod["id"]

    del1 = client.delete(
        f"/api/products/{prod_id}",
        headers={"X-Idempotency-Key": str(uuid4())},
    )
    assert del1.status_code == 200

    del2 = client.delete(
        f"/api/products/{prod_id}",
        headers={"X-Idempotency-Key": str(uuid4())},
    )
    assert del2.status_code == 200
    assert "já se encontra removido" in del2.json()["message"]


def test_repositories_direct_methods(db_session, default_tenant):
    from app.modules.products.infrastructure.repositories import (
        SQLAlchemyCategoryRepository,
        SQLAlchemyProductRepository,
    )
    from app.modules.products.infrastructure.models import ProductModel, CategoryModel

    t_id = default_tenant.id
    cat_repo = SQLAlchemyCategoryRepository(db_session)
    prod_repo = SQLAlchemyProductRepository(db_session)

    # Cria categorias
    c1 = CategoryModel(tenant_id=t_id, name="Cat Repo 1")
    c2 = CategoryModel(tenant_id=t_id, name="Cat Repo 2")
    cat_repo.create(c1)
    cat_repo.create(c2)
    db_session.commit()

    assert cat_repo.get_by_name("Cat Repo 1", t_id) is not None
    assert len(cat_repo.get_by_ids([c1.id, c2.id], t_id)) == 2
    assert len(cat_repo.list(t_id)) >= 2

    # Cria produto
    prod = ProductModel(
        tenant_id=t_id,
        name="Prod Repo Teste",
        unit="KG",
        current_quantity=5000,
        min_stock=2000,
        categories=[c1, c2],
    )
    prod_repo.create(prod)
    db_session.commit()

    fetched = prod_repo.get_by_id(prod.id, t_id)
    assert fetched is not None
    assert len(fetched.categories) == 2

    # Atualiza produto
    fetched.name = "Prod Repo Modificado"
    prod_repo.update(fetched)
    db_session.commit()

    updated_fetch = prod_repo.get_by_name("Prod Repo Modificado", t_id)
    assert updated_fetch is not None
    assert updated_fetch.id == prod.id
