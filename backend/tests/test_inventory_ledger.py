import threading
import uuid
from decimal import Decimal
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token
from app.modules.inventory.domain.enums import MovementType
from app.modules.inventory.domain.exceptions import (
    InsufficientStockError,
    InvalidMovementError,
)
from app.modules.inventory.domain.entities import StockMovement
from app.modules.inventory.infrastructure.models import StockMovementModel
from app.modules.inventory.infrastructure.repositories import StockMovementRepository
from app.modules.inventory.infrastructure.unit_of_work import InventoryUnitOfWork
from app.modules.inventory.application.use_cases import (
    RegisterStockInUseCase,
    RegisterStockOutUseCase,
    RegisterStockAdjustmentUseCase,
    ListStockMovementsUseCase,
    GetProductBalanceUseCase,
)
from app.shared.utils.scale import to_scaled_int, from_scaled_int
from tests.conftest import TEST_DATABASE_URL, TestingSessionLocal


def test_stock_in_increases_balance_and_appends_ledger(client):
    """
    1. RF-04 / Teste Obrigatório 1:
    Validar incremento de saldo e inserção de registro IN com delta positivo (+quantity).
    """
    prod = client.post("/api/products", json={
        "name": "Cimento CP II 50kg",
        "unit": "SC",
        "initial_quantity": 10.0,
    }).json()
    prod_id = prod["id"]

    res_in = client.post("/api/inventory/in", json={
        "product_id": prod_id,
        "quantity": 5.0,
        "reason": "Entrada de novo lote",
    })
    assert res_in.status_code == 201
    data = res_in.json()
    assert data["type"] == "IN"
    assert data["quantity_scaled"] == 5000
    assert float(data["quantity"]) == 5.0
    assert data["balance_after_scaled"] == 15000
    assert float(data["balance_after"]) == 15.0
    assert data["reason"] == "Entrada de novo lote"

    # Confirma saldo no produto
    prod_updated = client.get(f"/api/products/{prod_id}").json()
    assert float(prod_updated["current_quantity"]) == 15.0
    assert prod_updated["current_quantity_scaled"] == 15000

    # Confirma histórico no Ledger
    movs = client.get(f"/api/inventory/products/{prod_id}/movements").json()
    assert len(movs) >= 2  # Estoque inicial + Entrada
    assert movs[0]["type"] == "IN"
    assert movs[0]["quantity_scaled"] == 5000
    assert movs[0]["balance_after_scaled"] == 15000


def test_stock_out_decreases_balance_and_appends_ledger(client):
    """
    2. RF-04 / Teste Obrigatório 2:
    Validar decremento de saldo e inserção de registro OUT com delta negativo (-quantity).
    """
    prod = client.post("/api/products", json={
        "name": "Tubo PVC 100mm",
        "unit": "M",
        "initial_quantity": 25.0,
    }).json()
    prod_id = prod["id"]

    res_out = client.post("/api/inventory/out", json={
        "product_id": prod_id,
        "quantity": 7.5,
        "reason": "Saída para obra A",
    })
    assert res_out.status_code == 201
    data = res_out.json()
    assert data["type"] == "OUT"
    assert data["quantity_scaled"] == -7500
    assert float(data["quantity"]) == -7.5
    assert data["balance_after_scaled"] == 17500
    assert float(data["balance_after"]) == 17.5
    assert data["reason"] == "Saída para obra A"

    # Confirma saldo no produto
    prod_updated = client.get(f"/api/products/{prod_id}").json()
    assert float(prod_updated["current_quantity"]) == 17.5


def test_stock_out_insufficient_stock_rejection(client):
    """
    3. RF-04 / Teste Obrigatório 3:
    Tentar dar saída em quantidade maior do que o saldo atual.
    Validar lançamento de InsufficientStockError, resposta HTTP 422 e saldo inalterado.
    """
    prod = client.post("/api/products", json={
        "name": "Argamassa ACIII",
        "unit": "SC",
        "initial_quantity": 4.0,
    }).json()
    prod_id = prod["id"]

    res_fail = client.post("/api/inventory/out", json={
        "product_id": prod_id,
        "quantity": 10.0,
        "reason": "Tentativa de saída excedente",
    })
    assert res_fail.status_code == 422
    err = res_fail.json()
    assert err["type"] == "https://api.estoque.local/errors/insufficient-stock"
    assert err["title"] == "Saldo Insuficiente"
    assert "Saldo insuficiente" in err["detail"]

    # Valida que o saldo físico permaneceu estritamente inalterado
    prod_check = client.get(f"/api/products/{prod_id}").json()
    assert float(prod_check["current_quantity"]) == 4.0
    assert prod_check["current_quantity_scaled"] == 4000

    # Valida que nenhuma saída foi gravada no ledger
    movs = client.get(f"/api/inventory/products/{prod_id}/movements").json()
    assert not any(m["type"] == "OUT" for m in movs)


def test_stock_adjustment_positive_and_negative_delta(client):
    """
    4. RF-04 / Teste Obrigatório 4:
    Testar ajuste aumentando o saldo (delta positivo) e ajuste reduzindo o saldo (delta negativo).
    """
    prod = client.post("/api/products", json={
        "name": "Parafuso Inox 6x50",
        "unit": "CX",
        "initial_quantity": 20.0,
    }).json()
    prod_id = prod["id"]

    # 1. Ajuste Positivo: Contagem apurou 28 CX (+8 delta)
    res_adj_pos = client.post("/api/inventory/adjustment", json={
        "product_id": prod_id,
        "quantity": 28.0,
        "reason": "Inventário rotativo: caixas adicionais encontradas",
    })
    assert res_adj_pos.status_code == 201
    adj_pos = res_adj_pos.json()
    assert adj_pos["type"] == "ADJUSTMENT"
    assert adj_pos["quantity_scaled"] == 8000
    assert float(adj_pos["quantity"]) == 8.0
    assert adj_pos["balance_after_scaled"] == 28000
    assert float(adj_pos["balance_after"]) == 28.0

    # 2. Ajuste Negativo: Contagem apurou 15 CX (-13 delta)
    res_adj_neg = client.post("/api/inventory/adjustment", json={
        "product_id": prod_id,
        "quantity": 15.0,
        "reason": "Inventário rotativo: caixas danificadas descartadas",
    })
    assert res_adj_neg.status_code == 201
    adj_neg = res_adj_neg.json()
    assert adj_neg["type"] == "ADJUSTMENT"
    assert adj_neg["quantity_scaled"] == -13000
    assert float(adj_neg["quantity"]) == -13.0
    assert adj_neg["balance_after_scaled"] == 15000
    assert float(adj_neg["balance_after"]) == 15.0

    # Confirma saldo final no produto
    prod_check = client.get(f"/api/products/{prod_id}").json()
    assert float(prod_check["current_quantity"]) == 15.0


