import uuid
import pytest
from app.modules.products.infrastructure.models import ProductModel
from app.modules.inventory.infrastructure.models import StockMovementModel
from app.modules.inventory.infrastructure.repositories import StockMovementRepository


def test_audit_flow_operational_lifecycle_and_mathematical_reconciliation(client, db_session):
    """
    RF-03: Teste de Fluxo Completo de Auditoria e Reconciliação Matemática.
    Ciclo de vida operacional integral de um item:
    1. Cadastro do produto 'Resina Epóxi' com min_stock = 5.0 e categorias associadas.
    2. Entrada de 10.0 KG (POST /api/inventory/in).
    3. Saída de 4.0 KG (POST /api/inventory/out).
    4. Ajuste de inventário físico para 8.0 KG (POST /api/inventory/adjustment).
    5. Soft-delete do produto com motivo formal (DELETE /api/products/{id}).
    Asserções de Auditoria Contábil:
    - Consultar extrato completo (GET /api/inventory/movements?product_id={id}).
    - Validar que existem 4 registros no Ledger (IN, OUT, ADJUSTMENT, PRODUCT_DELETED).
    - Validar matematicamente a reconciliação perene: sum(movement.quantity) == Product.current_quantity.
    - Validar que o produto permanece com seus dados preservados e is_active = False.
    """
    # 0. Cria categoria associada
    cat_res = client.post(
        "/api/categories",
        json={"name": "Polímeros e Compósitos", "color": "#10B981", "description": "Categoria de teste químico"},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    # 1. Cadastro do produto 'Resina Epóxi' com min_stock = 5.0 (sem initial_quantity para iniciar com saldo 0)
    prod_create_res = client.post(
        "/api/products",
        json={
            "name": "Resina Epóxi",
            "description": "Resina epóxi bicomponente para laminação",
            "unit": "KG",
            "min_stock": 5.0,
            "category_ids": [cat_id],
        },
    )
    assert prod_create_res.status_code == 201
    prod_data = prod_create_res.json()
    prod_id = prod_data["id"]
    assert prod_data["name"] == "Resina Epóxi"
    assert prod_data["unit"] == "KG"
    assert float(prod_data["min_stock"]) == 5.0
    assert prod_data["min_stock_scaled"] == 5000
    assert prod_data["current_quantity_scaled"] == 0
    assert float(prod_data["current_quantity"]) == 0.0
    assert prod_data["is_active"] is True

    # 2. Entrada de 10.0 KG (POST /api/inventory/in)
    in_key = str(uuid.uuid4())
    res_in = client.post(
        "/api/inventory/in",
        json={
            "product_id": prod_id,
            "quantity": 10.0,
            "reason": "Entrada de lote fornecedor Alfa Química",
        },
        headers={"X-Idempotency-Key": in_key},
    )
    assert res_in.status_code == 201
    in_data = res_in.json()
    assert in_data["type"] == "IN"
    assert in_data["quantity_scaled"] == 10000
    assert float(in_data["quantity"]) == 10.0
    assert in_data["balance_after_scaled"] == 10000
    assert float(in_data["balance_after"]) == 10.0

    # 3. Saída de 4.0 KG (POST /api/inventory/out)
    out_key = str(uuid.uuid4())
    res_out = client.post(
        "/api/inventory/out",
        json={
            "product_id": prod_id,
            "quantity": 4.0,
            "reason": "Saída para manufatura de bancadas",
        },
        headers={"X-Idempotency-Key": out_key},
    )
    assert res_out.status_code == 201
    out_data = res_out.json()
    assert out_data["type"] == "OUT"
    assert out_data["quantity_scaled"] == -4000
    assert float(out_data["quantity"]) == -4.0
    assert out_data["balance_after_scaled"] == 6000
    assert float(out_data["balance_after"]) == 6.0

    # 4. Ajuste de inventário físico para 8.0 KG (POST /api/inventory/adjustment)
    # Saldo anterior = 6.0 KG (6000), Novo saldo = 8.0 KG (8000), Delta esperado = +2.0 KG (+2000)
    adj_key = str(uuid.uuid4())
    res_adj = client.post(
        "/api/inventory/adjustment",
        json={
            "product_id": prod_id,
            "quantity": 8.0,
            "reason": "Auditoria de contagem física periódica",
        },
        headers={"X-Idempotency-Key": adj_key},
    )
    assert res_adj.status_code == 201
    adj_data = res_adj.json()
    assert adj_data["type"] == "ADJUSTMENT"
    assert adj_data["quantity_scaled"] == 2000
    assert float(adj_data["quantity"]) == 2.0
    assert adj_data["balance_after_scaled"] == 8000
    assert float(adj_data["balance_after"]) == 8.0

    # 5. Soft-delete do produto com motivo formal (DELETE /api/products/{id})
    del_key = str(uuid.uuid4())
    res_del = client.delete(
        f"/api/products/{prod_id}?reason=Descontinuação da linha de resinas pelo fabricante",
        headers={"X-Idempotency-Key": del_key},
    )
    assert res_del.status_code == 200
    del_data = res_del.json()
    assert "removido com sucesso" in del_data["message"]
    assert del_data["remaining_quantity_scaled"] == 8000

    # --- ASSERÇÕES DE AUDITORIA CONTÁBIL ---
    # 6. Consultar extrato completo de movimentações via GET /api/inventory/movements?product_id={id}
    movs_res = client.get(f"/api/inventory/movements?product_id={prod_id}&limit=100")
    assert movs_res.status_code == 200
    movements = movs_res.json()

    # Validar que existem exatamente 4 registros no Ledger
    assert len(movements) == 4, f"Deveriam existir 4 registros no Ledger, encontrados {len(movements)}"

    # Validar os 4 tipos registrados
    movement_types = {m["type"] for m in movements}
    assert movement_types == {"IN", "OUT", "ADJUSTMENT", "PRODUCT_DELETED"}, (
        f"Tipos de movimentos incorretos: {movement_types}"
    )

    # Detalhe de cada movimento
    m_in = next(m for m in movements if m["type"] == "IN")
    m_out = next(m for m in movements if m["type"] == "OUT")
    m_adj = next(m for m in movements if m["type"] == "ADJUSTMENT")
    m_del = next(m for m in movements if m["type"] == "PRODUCT_DELETED")

    assert m_in["quantity_scaled"] == 10000
    assert m_in["balance_after_scaled"] == 10000

    assert m_out["quantity_scaled"] == -4000
    assert m_out["balance_after_scaled"] == 6000

    assert m_adj["quantity_scaled"] == 2000
    assert m_adj["balance_after_scaled"] == 8000

    assert m_del["quantity_scaled"] == 0
    assert m_del["balance_after_scaled"] == 8000

    # 7. Validação matemática perene da reconciliação:
    # sum(movement.quantity) == Product.current_quantity
    total_movement_delta_scaled = sum(m["quantity_scaled"] for m in movements)
    assert total_movement_delta_scaled == 8000

    db_session.expire_all()
    db_product = db_session.query(ProductModel).filter(ProductModel.id == prod_id).first()
    assert db_product is not None
    assert total_movement_delta_scaled == db_product.current_quantity
    assert db_product.current_quantity == 8000

    # 8. Validação de preservação dos dados com is_active = False
    assert db_product.is_active is False
    assert db_product.deleted_at is not None
    assert db_product.name == "Resina Epóxi"
    assert db_product.unit == "KG"
    assert db_product.min_stock == 5000
    assert len(db_product.categories) == 1
    assert db_product.categories[0].name == "Polímeros e Compósitos"


def test_audit_flow_idempotency_replay_and_zero_duplicate_ledger(client):
    """
    RF-04: Teste de Replay e Idempotência RFC 9474.
    Reenvia as mesmas requisições do fluxo de auditoria com os mesmos cabeçalhos X-Idempotency-Key.
    - Valida recebimento de X-Cache: HIT.
    - Valida que nenhuma linha duplicada foi criada no Livro-Razão (stock_movements).
    """
    # 1. Criação do produto
    prod_key = str(uuid.uuid4())
    prod_res = client.post(
        "/api/products",
        json={
            "name": "Selante PU40 Idempotente",
            "unit": "UN",
            "initial_quantity": 0.0,
        },
        headers={"X-Idempotency-Key": prod_key},
    )
    assert prod_res.status_code == 201
    assert prod_res.headers.get("X-Cache") == "MISS"
    prod_id = prod_res.json()["id"]

    # 2. Entrada (MISS inicial)
    in_key = str(uuid.uuid4())
    in_payload = {"product_id": prod_id, "quantity": 10.0, "reason": "Entrada inicial"}
    res_in_1 = client.post("/api/inventory/in", json=in_payload, headers={"X-Idempotency-Key": in_key})
    assert res_in_1.status_code == 201
    assert res_in_1.headers.get("X-Cache") == "MISS"
    data_in_1 = res_in_1.json()

    # 3. Saída (MISS inicial)
    out_key = str(uuid.uuid4())
    out_payload = {"product_id": prod_id, "quantity": 3.0, "reason": "Saída obra"}
    res_out_1 = client.post("/api/inventory/out", json=out_payload, headers={"X-Idempotency-Key": out_key})
    assert res_out_1.status_code == 201
    assert res_out_1.headers.get("X-Cache") == "MISS"
    data_out_1 = res_out_1.json()

    # 4. Ajuste (MISS inicial)
    adj_key = str(uuid.uuid4())
    adj_payload = {"product_id": prod_id, "quantity": 12.0, "reason": "Ajuste físico"}
    res_adj_1 = client.post("/api/inventory/adjustment", json=adj_payload, headers={"X-Idempotency-Key": adj_key})
    assert res_adj_1.status_code == 201
    assert res_adj_1.headers.get("X-Cache") == "MISS"
    data_adj_1 = res_adj_1.json()

    # 5. Soft-delete (MISS inicial)
    del_key = str(uuid.uuid4())
    res_del_1 = client.delete(
        f"/api/products/{prod_id}?reason=Item descontinuado",
        headers={"X-Idempotency-Key": del_key},
    )
    assert res_del_1.status_code == 200
    assert res_del_1.headers.get("X-Cache") == "MISS"
    data_del_1 = res_del_1.json()

    # Verifica total no Ledger antes do replay: 4 movimentos
    movs_before = client.get(f"/api/inventory/movements?product_id={prod_id}&limit=100").json()
    assert len(movs_before) == 4

    # --- EXECUÇÃO DO REPLAY COM MESMOS CABEÇALHOS E MESMOS PAYLOADS ---

    # Replay Criação do Produto
    prod_replay = client.post(
        "/api/products",
        json={"name": "Selante PU40 Idempotente", "unit": "UN", "initial_quantity": 0.0},
        headers={"X-Idempotency-Key": prod_key},
    )
    assert prod_replay.status_code == 201
    assert prod_replay.headers.get("X-Cache") == "HIT"
    assert prod_replay.json()["id"] == prod_id

    # Replay Entrada
    res_in_replay = client.post("/api/inventory/in", json=in_payload, headers={"X-Idempotency-Key": in_key})
    assert res_in_replay.status_code == 201
    assert res_in_replay.headers.get("X-Cache") == "HIT"
    assert res_in_replay.json() == data_in_1

    # Replay Saída
    res_out_replay = client.post("/api/inventory/out", json=out_payload, headers={"X-Idempotency-Key": out_key})
    assert res_out_replay.status_code == 201
    assert res_out_replay.headers.get("X-Cache") == "HIT"
    assert res_out_replay.json() == data_out_1

    # Replay Ajuste
    res_adj_replay = client.post("/api/inventory/adjustment", json=adj_payload, headers={"X-Idempotency-Key": adj_key})
    assert res_adj_replay.status_code == 201
    assert res_adj_replay.headers.get("X-Cache") == "HIT"
    assert res_adj_replay.json() == data_adj_1

    # Replay Soft-delete
    res_del_replay = client.delete(
        f"/api/products/{prod_id}?reason=Item descontinuado",
        headers={"X-Idempotency-Key": del_key},
    )
    assert res_del_replay.status_code == 200
    assert res_del_replay.headers.get("X-Cache") == "HIT"
    assert res_del_replay.json() == data_del_1

    # --- VALIDAÇÃO DE ZERO DUPLICAÇÕES NO LEDGER ---
    movs_after = client.get(f"/api/inventory/movements?product_id={prod_id}&limit=100").json()
    assert len(movs_after) == 4, f"O Ledger deve conter estritamente 4 registros após o replay, obtido {len(movs_after)}"
    assert sum(m["quantity_scaled"] for m in movs_after) == 12000


def test_ledger_immutability_blocks_mutation(db_session):
    """
    Garante que StockMovementRepository bloqueia operações de mutação (UPDATE / DELETE)
    em conformidade com o princípio de Ledger Contábil imutável (append-only).
    """
    repo = StockMovementRepository(db_session)

    with pytest.raises(NotImplementedError) as exc_update:
        repo.update()
    assert "UPDATE" in str(exc_update.value)

    with pytest.raises(NotImplementedError) as exc_delete:
        repo.delete()
    assert "DELETE" in str(exc_delete.value)
