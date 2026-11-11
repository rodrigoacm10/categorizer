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
