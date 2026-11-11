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


def test_ledger_immutability_no_delete_no_update(db_session, default_tenant):
    """
    5. RF-02 / Teste Obrigatório 5:
    Garantir que o repositório não expõe métodos mutatórios (update/delete disparam exceção)
    e que a tabela stock_movements é estritamente append-only.
    """
    repo = StockMovementRepository(db_session)

    with pytest.raises(NotImplementedError) as exc_update:
        repo.update()
    assert "UPDATE" in str(exc_update.value)

    with pytest.raises(NotImplementedError) as exc_delete:
        repo.delete()
    assert "DELETE" in str(exc_delete.value)


def test_ledger_mathematical_reconciliation(client):
    """
    6. RF-02 / Teste Obrigatório 6:
    Reconciliação Matemática: Para qualquer sequência de movimentações contábeis,
    a soma de todos os deltas (sum(quantity_i)) deve ser rigorosamente igual a Product.current_quantity.
    """
    prod = client.post("/api/products", json={
        "name": "Cabo Flexível 2.5mm",
        "unit": "M",
        "initial_quantity": 0.0,
    }).json()
    prod_id = prod["id"]

    # Sequência diversa de operações
    client.post("/api/inventory/in", json={"product_id": prod_id, "quantity": 100.0, "reason": "Lote 1"})
    client.post("/api/inventory/out", json={"product_id": prod_id, "quantity": 35.5, "reason": "Instalação"})
    client.post("/api/inventory/in", json={"product_id": prod_id, "quantity": 50.25, "reason": "Lote 2"})
    client.post("/api/inventory/adjustment", json={"product_id": prod_id, "quantity": 80.0, "reason": "Ajuste balanço"})
    client.post("/api/inventory/out", json={"product_id": prod_id, "quantity": 12.0, "reason": "Venda"})
    client.post("/api/inventory/in", json={"product_id": prod_id, "quantity": 5.75, "reason": "Devolução"})

    # Saldo final esperado: 80.0 - 12.0 + 5.75 = 73.75
    prod_final = client.get(f"/api/products/{prod_id}").json()
    expected_balance_scaled = 73750
    assert prod_final["current_quantity_scaled"] == expected_balance_scaled
    assert float(prod_final["current_quantity"]) == 73.75

    # Consulta todos os movimentos gravados no Ledger
    movs = client.get(f"/api/inventory/products/{prod_id}/movements?limit=100").json()
    sum_deltas_scaled = sum(m["quantity_scaled"] for m in movs)

    # Reconciliação contábil exata
    assert sum_deltas_scaled == expected_balance_scaled
    assert sum_deltas_scaled == prod_final["current_quantity_scaled"]


def test_pessimistic_lock_concurrency(db_session, default_tenant):
    """
    7. Concorrência Pessimista (SELECT ... FOR UPDATE):
    Simula duas transações concorrentes disputando a mesma linha de produto.
    Com o bloqueio pessimista, a segunda transação aguarda a primeira e percebe
    o saldo decrementado, evitando race conditions e saldo negativo.
    """
    # 1. Cria produto diretamente no banco com 10 unidades
    from app.modules.products.infrastructure.models import ProductModel
    prod = ProductModel(
        name="Item Concorrente Lock",
        unit="UN",
        current_quantity=to_scaled_int(10),
        tenant_id=default_tenant.id,
    )
    db_session.add(prod)
    db_session.commit()
    db_session.refresh(prod)
    prod_id = prod.id

    results = []
    errors = []

    def withdraw_task(thread_id: int):
        thread_session = TestingSessionLocal()
        uow = InventoryUnitOfWork(thread_session)
        use_case = RegisterStockOutUseCase(uow)
        try:
            res = use_case.execute(
                tenant_id=default_tenant.id,
                product_id=prod_id,
                quantity=6,  # Tenta retirar 6 unidades (saldo inicial é 10)
                reason=f"Saída concorrente thread {thread_id}",
            )
            results.append((thread_id, res))
        except InsufficientStockError as e:
            errors.append((thread_id, e))
        finally:
            thread_session.close()

    t1 = threading.Thread(target=withdraw_task, args=(1,))
    t2 = threading.Thread(target=withdraw_task, args=(2,))

    t1.start()
    t2.start()

    t1.join()
    t2.join()

    # Com 10 unidades iniciais e duas tentativas de retirar 6:
    # Exatamente UMA thread deve obter sucesso (restando 4 unidades)
    # E a outra thread DEVE falhar com InsufficientStockError!
    assert len(results) == 1, f"Apenas uma retirada deveria ter sucesso: {results}"
    assert len(errors) == 1, f"Uma retirada deveria falhar por saldo insuficiente: {errors}"

    # Valida saldo no banco: 10 - 6 = 4 unidades (4000 escalado)
    db_session.expire_all()
    updated_prod = db_session.query(ProductModel).filter(ProductModel.id == prod_id).first()
    assert updated_prod.current_quantity == 4000


def test_idempotency_protection_on_ledger(client):
    """
    8. Idempotência estrita no Ledger (RFC 9474):
    Garante que retransmissões com a mesma X-Idempotency-Key retornem Cache HIT
    sem duplicar movimentos no banco de dados.
    """
    prod = client.post("/api/products", json={
        "name": "Cimento Idempotente",
        "unit": "SC",
        "initial_quantity": 50.0,
    }).json()
    prod_id = prod["id"]

    idempotency_key = f"idem-ledger-{uuid.uuid4()}"
    payload = {
        "product_id": prod_id,
        "quantity": 20.0,
        "reason": "Carga inicial idempotente",
    }

    # 1. Primeira chamada: MISS
    res1 = client.post(
        "/api/inventory/in",
        json=payload,
        headers={"X-Idempotency-Key": idempotency_key},
    )
    assert res1.status_code == 201
    assert res1.headers.get("X-Cache") == "MISS"
    assert float(res1.json()["balance_after"]) == 70.0

    # 2. Segunda chamada (replay idêntico): HIT
    res2 = client.post(
        "/api/inventory/in",
        json=payload,
        headers={"X-Idempotency-Key": idempotency_key},
    )
    assert res2.status_code == 201
    assert res2.headers.get("X-Cache") == "HIT"
    assert float(res2.json()["balance_after"]) == 70.0  # Saldo permanece 70.0

    # Confirma que há exatamente 1 lançamento correspondente à carga inicial idempotente
    movs = client.get(f"/api/inventory/products/{prod_id}/movements").json()
    idem_movs = [m for m in movs if m["reason"] == "Carga inicial idempotente"]
    assert len(idem_movs) == 1
    # Total de movimentos IN: 1 de criação do produto + 1 da chamada idempotente (não houve duplicação)
    in_movs = [m for m in movs if m["type"] == "IN"]
    assert len(in_movs) == 2

    # 3. Terceira chamada: Mesma chave com payload alterado -> 409 CONFLICT
    payload_tampered = {
        "product_id": prod_id,
        "quantity": 99.0,
        "reason": "Tentativa de alteração",
    }
    res3 = client.post(
        "/api/inventory/in",
        json=payload_tampered,
        headers={"X-Idempotency-Key": idempotency_key},
    )
    assert res3.status_code == 409
    assert "Chave de Idempotência já utilizada" in res3.json()["detail"]


def test_multi_tenant_isolation_ledger(client):
    """
    9. Isolamento Multi-Tenant Estrito:
    Tenant A não pode consultar nem movimentar estoque de produto pertencente ao Tenant B.
    """
    # 1. Tenant A
    t_a = client.post("/api/tenants", json={"name": "Tenant Alfa", "slug": "tenant-alfa"}).json()
    t_a_id = t_a["id"]
    p_a = client.post("/api/products", json={"name": "Produto Alfa", "unit": "UN", "initial_quantity": 10}, headers={"X-Tenant-ID": t_a_id}).json()
    p_a_id = p_a["id"]

    # 2. Tenant B
    t_b = client.post("/api/tenants", json={"name": "Tenant Beta", "slug": "tenant-beta"}).json()
    t_b_id = t_b["id"]

    # Tenant B tenta dar entrada em produto do Tenant A -> 404
    res_cross_in = client.post(
        "/api/inventory/in",
        json={"product_id": p_a_id, "quantity": 5},
        headers={"X-Tenant-ID": t_b_id},
    )
    assert res_cross_in.status_code == 404

    # Tenant B tenta consultar movimentações do produto do Tenant A -> 404
    res_cross_movs = client.get(
        f"/api/inventory/products/{p_a_id}/movements",
        headers={"X-Tenant-ID": t_b_id},
    )
    assert res_cross_movs.status_code == 404


def test_domain_validation_and_exceptions(client):
    """
    10. Validações de Domínio e Exceções:
    - Quantidade <= 0 para IN e OUT
    - Quantidade < 0 para ADJUSTMENT
    - Motivo vazio para ADJUSTMENT
    - Movimentar produto inativo
    - Produto inexistente
    """
    prod = client.post("/api/products", json={"name": "Produto Regras", "unit": "UN", "initial_quantity": 10}).json()
    prod_id = prod["id"]

    # Quantidade zero para entrada
    res_zero_in = client.post("/api/inventory/in", json={"product_id": prod_id, "quantity": 0})
    assert res_zero_in.status_code == 400
    assert "maior que zero" in res_zero_in.json()["detail"]

    # Quantidade negativa para saída
    res_neg_out = client.post("/api/inventory/out", json={"product_id": prod_id, "quantity": -5})
    assert res_neg_out.status_code == 400

    # Quantidade negativa para ajuste
    res_neg_adj = client.post("/api/inventory/adjustment", json={"product_id": prod_id, "quantity": -1, "reason": "Teste"})
    assert res_neg_adj.status_code == 400

    # Motivo em branco para ajuste
    res_empty_reason = client.post("/api/inventory/adjustment", json={"product_id": prod_id, "quantity": 5, "reason": "   "})
    assert res_empty_reason.status_code == 400

    # Produto inexistente
    fake_id = str(uuid.uuid4())
    res_not_found = client.post("/api/inventory/in", json={"product_id": fake_id, "quantity": 5})
    assert res_not_found.status_code == 404

    # Inativa produto e tenta movimentar
    client.delete(f"/api/products/{prod_id}?reason=Inativado para teste")
    res_inactive = client.post("/api/inventory/in", json={"product_id": prod_id, "quantity": 5})
    assert res_inactive.status_code == 400
    assert "inativo/removido" in res_inactive.json()["detail"]


