import concurrent.futures
import uuid
import pytest
from app.modules.products.infrastructure.models import ProductModel
from app.modules.inventory.infrastructure.models import StockMovementModel
from app.modules.inventory.infrastructure.unit_of_work import InventoryUnitOfWork
from app.modules.inventory.application.use_cases import RegisterStockOutUseCase
from app.modules.inventory.domain.exceptions import InsufficientStockError
from app.shared.utils.scale import to_scaled_int
from tests.conftest import TestingSessionLocal
from app.main import app
from app.shared.infrastructure.database import get_db
from fastapi.testclient import TestClient


@pytest.fixture
def concurrent_client(auth_headers):
    """
    Client dedicado para testes de concorrência onde cada requisição
    recebe uma sessão/conexão isolada do pool PostgreSQL.
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


def test_concurrent_stock_out_race_condition(concurrent_client, auth_headers):
    """
    RF-02: Teste de Carga e Concorrência (Race Conditions).
    Cenário de Teste de Ruptura Concorrente:
    1. Cadastrar um produto com saldo inicial de 5 unidades (current_quantity = 5000).
    2. Utilizar concurrent.futures.ThreadPoolExecutor com 10 threads concorrentes.
    3. Cada thread tenta registrar simultaneamente uma saída de 1 unidade (quantity = 1000)
       para o mesmo produto, cada qual com sua própria chave X-Idempotency-Key.
    4. Asserções Obrigatórias:
       - Exatamente 5 requisições devem obter sucesso (HTTP 201 Created).
       - Exatamente 5 requisições devem ser rejeitadas por saldo insuficiente (HTTP 422 Unprocessable Entity).
       - O saldo final do produto deve ser exatamente 0 (nunca negativo).
       - O Livro-Razão (stock_movements) deve conter exatamente 5 registros de saída de -1000.
    """
    # 1. Cadastra produto com saldo inicial de 5 unidades (5000 escalado)
    prod_res = concurrent_client.post(
        "/api/products",
        json={
            "name": "Viga Metálica W200 Concorrente",
            "description": "Item de alto valor submetido a teste concorrente agressivo",
            "unit": "UN",
            "initial_quantity": 5.0,
            "min_stock": 1.0,
        },
    )
    assert prod_res.status_code == 201
    prod_data = prod_res.json()
    prod_id = prod_data["id"]
    assert prod_data["current_quantity_scaled"] == 5000
    assert float(prod_data["current_quantity"]) == 5.0

    # 2 e 3. Disputa concorrente de 10 threads por 1 unidade cada
    def attempt_withdrawal(thread_idx: int):
        idempotency_key = str(uuid.uuid4())
        thread_client = TestClient(app, headers=auth_headers)
        res = thread_client.post(
            "/api/inventory/out",
            json={
                "product_id": prod_id,
                "quantity": 1.0,
                "reason": f"Disputa concorrente thread #{thread_idx}",
            },
            headers={"X-Idempotency-Key": idempotency_key},
        )
        return res.status_code, res.json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(attempt_withdrawal, i) for i in range(10)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    # 4. Asserções de Resultado
    status_codes = [status for status, _ in results]
    success_count = status_codes.count(201)
    rejected_count = status_codes.count(422)

    assert success_count == 5, (
        f"Exatamente 5 requisições devem retornar 201 Created, obtido {success_count}. "
        f"Status coletados: {sorted(status_codes)}"
    )
    assert rejected_count == 5, (
        f"Exatamente 5 requisições devem retornar 422 Unprocessable Entity, obtido {rejected_count}. "
        f"Status coletados: {sorted(status_codes)}"
    )

    # 4.1 Validação de saldo final estritamente igual a ZERO (nunca negativo)
    prod_final_res = concurrent_client.get(f"/api/products/{prod_id}")
    assert prod_final_res.status_code == 200
    prod_final = prod_final_res.json()
    assert prod_final["current_quantity_scaled"] == 0, "O saldo escalado deve ser exatamente 0"
    assert float(prod_final["current_quantity"]) == 0.0, "O saldo decimal deve ser exatamente 0.0"

    # 4.2 Validação do Livro-Razão (Ledger imutável)
    movs_res = concurrent_client.get(f"/api/inventory/products/{prod_id}/movements?limit=100")
    assert movs_res.status_code == 200
    movs = movs_res.json()

    # Total de registros: 1 IN inicial + 5 OUTs confirmados = 6 registros
    assert len(movs) == 6, f"Deveriam existir 6 movimentos no Ledger, encontrados {len(movs)}"

    out_movements = [m for m in movs if m["type"] == "OUT"]
    assert len(out_movements) == 5, f"Devem existir exatamente 5 registros de OUT, encontrados {len(out_movements)}"

    for out_m in out_movements:
        assert out_m["quantity_scaled"] == -1000
        assert float(out_m["quantity"]) == -1.0

    in_movements = [m for m in movs if m["type"] == "IN"]
    assert len(in_movements) == 1
    assert in_movements[0]["quantity_scaled"] == 5000

    # Reconciliação Contábil perene
    sum_deltas = sum(m["quantity_scaled"] for m in movs)
    assert sum_deltas == 0
    assert sum_deltas == prod_final["current_quantity_scaled"]


def test_concurrent_stock_out_at_zero_balance_never_goes_negative(concurrent_client, auth_headers):
    """
    Garante que 10 threads disparadas contra um produto com saldo ZERO
    são 100% rejeitadas com 422 e nenhum registro de OUT é gerado.
    """
    prod_res = concurrent_client.post(
        "/api/products",
        json={
            "name": "Parafuso Esgotado Concorrente",
            "unit": "UN",
            "initial_quantity": 0.0,
        },
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    def attempt_empty_withdrawal(idx: int):
        thread_client = TestClient(app, headers=auth_headers)
        res = thread_client.post(
            "/api/inventory/out",
            json={
                "product_id": prod_id,
                "quantity": 1.0,
                "reason": f"Tentativa em estoque zerado {idx}",
            },
            headers={"X-Idempotency-Key": str(uuid.uuid4())},
        )
        return res.status_code

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        statuses = list(executor.map(attempt_empty_withdrawal, range(10)))

    assert all(status == 422 for status in statuses)

    prod_check = concurrent_client.get(f"/api/products/{prod_id}").json()
    assert prod_check["current_quantity_scaled"] == 0

    movs = concurrent_client.get(f"/api/inventory/products/{prod_id}/movements").json()
    assert len([m for m in movs if m["type"] == "OUT"]) == 0


def test_concurrent_uow_pessimistic_lock_multi_threaded(default_tenant):
    """
    Validação direta do bloqueio pessimista (SELECT ... FOR UPDATE) no InventoryUnitOfWork
    com 10 threads concorrentes disputando 5 retiradas de 1 unidade em produto com saldo 5.
    """
    session = TestingSessionLocal()
    prod = ProductModel(
        name="Cabo Cobre UOW Concorrente",
        unit="M",
        current_quantity=to_scaled_int(5),  # 5000
        tenant_id=default_tenant.id,
    )
    session.add(prod)
    session.commit()
    session.refresh(prod)
    prod_id = prod.id
    session.close()

    successes = []
    errors = []

    def thread_worker(worker_id: int):
        worker_session = TestingSessionLocal()
        uow = InventoryUnitOfWork(worker_session)
        use_case = RegisterStockOutUseCase(uow)
        try:
            res = use_case.execute(
                tenant_id=default_tenant.id,
                product_id=prod_id,
                quantity=1.0,  # 1 unidade = 1000 escalado
                reason=f"UOW concurrency thread {worker_id}",
            )
            successes.append((worker_id, res))
        except InsufficientStockError as e:
            errors.append((worker_id, e))
        finally:
            worker_session.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(thread_worker, i) for i in range(10)]
        concurrent.futures.wait(futures)

    assert len(successes) == 5, f"Esperado 5 sucessos, obtido {len(successes)}"
    assert len(errors) == 5, f"Esperado 5 erros de saldo insuficiente, obtido {len(errors)}"

    # Confirma saldo final zero no banco
    verify_session = TestingSessionLocal()
    updated_product = verify_session.query(ProductModel).filter(ProductModel.id == prod_id).first()
    assert updated_product.current_quantity == 0
    verify_session.close()
