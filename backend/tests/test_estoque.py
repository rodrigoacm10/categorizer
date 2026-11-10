import pytest

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["scale_factor"] == 1000

def test_categories_and_products_flow(client):
    # 1. Cria Categoria
    cat_res = client.post("/api/categories", json={
        "name": "Ferragens Teste",
        "description": "Itens de metal para fixação",
        "color": "#6366F1"
    })
    assert cat_res.status_code == 201
    category = cat_res.json()
    cat_id = category["id"]

    # 2. Cria Produto com quantidade fracionária (ex: 15.5 kg)
    prod_res = client.post("/api/products", json={
        "name": "Parafuso Sextavado 8mm",
        "description": "Aço carbono",
        "unit": "KG",
        "initial_quantity": 15.5,
        "min_stock": 5.0,
        "category_ids": [cat_id]
    })
    assert prod_res.status_code == 201
    product = prod_res.json()
    prod_id = product["id"]
    
    # Valida escala
    assert product["current_quantity_scaled"] == 15500
    assert float(product["current_quantity"]) == 15.5
    assert product["is_low_stock"] is False
    assert len(product["categories"]) == 1

    # 3. Movimentação de Saída (OUT): Retira 3.250 kg
    mov_out_res = client.post("/api/inventory/movements", json={
        "product_id": prod_id,
        "type": "OUT",
        "quantity": 3.25,
        "reason": "Expedição para produção"
    })
    assert mov_out_res.status_code == 201
    mov_out = mov_out_res.json()
    assert mov_out["quantity_scaled"] == -3250
    assert float(mov_out["balance_after"]) == 12.25

    # 4. Movimentação de Saída Excedente: Tenta retirar 50 kg (deve falhar)
    mov_fail_res = client.post("/api/inventory/movements", json={
        "product_id": prod_id,
        "type": "OUT",
        "quantity": 50.0,
        "reason": "Tentativa de saldo negativo"
    })
    assert mov_fail_res.status_code == 400
    assert "Saldo insuficiente" in mov_fail_res.json()["detail"]

def test_idempotency_protection(client):
    # 1. Cria produto de teste
    prod = client.post("/api/products", json={
        "name": "Cabo de Rede Cat6 Teste",
        "unit": "M",
        "initial_quantity": 100.0
    }).json()
    prod_id = prod["id"]

    idempotency_key = "test-idempotency-key-uuid-12345"
    payload = {
        "product_id": prod_id,
        "type": "IN",
        "quantity": 25.0,
        "reason": "Entrada teste lote 1"
    }

    # Primeira requisição: Deve processar normalmente (MISS)
    res1 = client.post(
        "/api/inventory/movements",
        json=payload,
        headers={"X-Idempotency-Key": idempotency_key}
    )
    assert res1.status_code == 201
    assert res1.headers.get("X-Cache") == "MISS"
    data1 = res1.json()
    assert float(data1["balance_after"]) == 125.0

    # Segunda requisição (duplo clique / retry): Mesma chave, mesmo payload
    # DEVE retornar a mesma resposta sem somar +25 no estoque!
    res2 = client.post(
        "/api/inventory/movements",
        json=payload,
        headers={"X-Idempotency-Key": idempotency_key}
    )
    assert res2.status_code == 201
    assert res2.headers.get("X-Cache") == "HIT"
    data2 = res2.json()
    assert float(data2["balance_after"]) == 125.0  # Permanece 125, NÃO foi para 150!

    # Checa o saldo real do produto no banco para provar que não houve duplicação
    prod_check = client.get(f"/api/products/{prod_id}").json()
    assert float(prod_check["current_quantity"]) == 125.0

    # Terceira requisição: Mesma chave, mas com payload diferente (tentativa de fraude/reuso)
    # DEVE ser rejeitado com 409 CONFLICT!
    payload_tampered = {
        "product_id": prod_id,
        "type": "IN",
        "quantity": 999.0,
        "reason": "Tentativa com valor alterado"
    }
    res3 = client.post(
        "/api/inventory/movements",
        json=payload_tampered,
        headers={"X-Idempotency-Key": idempotency_key}
    )
    assert res3.status_code == 409
    assert "Chave de Idempotência já utilizada" in res3.json()["detail"]

def test_soft_delete_with_ledger_audit(client):
    # 1. Cria produto
    prod = client.post("/api/products", json={
        "name": "Item Para Deletar Teste",
        "unit": "UN",
        "initial_quantity": 42
    }).json()
    prod_id = prod["id"]

    # 2. Deleta o produto
    del_res = client.delete(f"/api/products/{prod_id}?reason=Descontinuado")
    assert del_res.status_code == 200

    # 3. O produto não aparece mais na listagem ativa
    list_active = client.get("/api/products").json()
    assert not any(p["id"] == prod_id for p in list_active)

    # 4. Mas o histórico no Ledger está 100% preservado com o registro de exclusão!
    ledger_res = client.get(f"/api/inventory/products/{prod_id}/ledger")
    assert ledger_res.status_code == 200
    movements = ledger_res.json()
    assert len(movements) >= 2  # Estoque inicial + PRODUCT_DELETED
    assert movements[0]["type"] == "PRODUCT_DELETED"
    assert movements[0]["reason"] == "Descontinuado"
    assert float(movements[0]["balance_after"]) == 42.0
