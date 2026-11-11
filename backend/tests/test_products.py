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
