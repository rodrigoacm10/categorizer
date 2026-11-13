import csv
import io
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from app.core.security import create_access_token, get_password_hash
from app.modules.auth.infrastructure.models import UserModel
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel


def test_export_movements_csv_success_and_headers(client, default_tenant, default_user):
    """
    Validar exportação do livro-razão em CSV (GET /api/inventory/movements/export):
    - Retorno com media_type 'text/csv'.
    - Header Content-Disposition com filename='extrato-estoque-{tenant_slug}-{data}.csv'.
    - Colunas esperadas na primeira linha:
      data_hora_utc, id_movimentacao, id_produto, nome_produto, unidade,
      tipo_movimentacao, quantidade_formatada, saldo_resultante_formatado, motivo, operador_email.
    - Valores formatados com escala correta e email do operador autenticado.
    """
    # 1. Cria produto
    p_res = client.post("/api/products", json={
        "name": "Cimento Portland CP-II",
        "unit": "KG",
        "initial_quantity": 0,
    })
    assert p_res.status_code == 201
    p_id = p_res.json()["id"]

    # 2. Registra movimentações
    client.post("/api/inventory/in", json={
        "product_id": p_id,
        "quantity": 50.0,
        "reason": "Carga inicial Fornecedor Votoran",
    }, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    client.post("/api/inventory/out", json={
        "product_id": p_id,
        "quantity": 20.0,
        "reason": "Saída para obra Bloco B",
    }, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    client.post("/api/inventory/adjustment", json={
        "product_id": p_id,
        "quantity": 35.0,
        "reason": "Ajuste após contagem física mensal",
    }, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    # 3. Exporta CSV
    res = client.get("/api/inventory/movements/export")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    expected_filename = f"extrato-estoque-{default_tenant.slug}-{today_str}.csv"
    assert "attachment" in res.headers["content-disposition"]
    assert expected_filename in res.headers["content-disposition"]

    # 4. Valida estrutura do CSV
    csv_text = res.text
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)

    # Header
    expected_headers = [
        "data_hora_utc",
        "id_movimentacao",
        "id_produto",
        "nome_produto",
        "unidade",
        "tipo_movimentacao",
        "quantidade_formatada",
        "saldo_resultante_formatado",
        "motivo",
        "operador_email",
    ]
    assert rows[0] == expected_headers

    # Deve conter 3 movimentações
    data_rows = rows[1:]
    assert len(data_rows) == 3

    # Ordenação decrescente: ADJUSTMENT (35.0), OUT (-20.0), IN (50.0)
    adj_row = data_rows[0]
    assert adj_row[3] == "Cimento Portland CP-II"
    assert adj_row[4] == "KG"
    assert adj_row[5] == "ADJUSTMENT"
    assert adj_row[6] == "5.000"  # Delta = 35 - 30 = +5
    assert adj_row[7] == "35.000"  # Saldo final = 35
    assert adj_row[8] == "Ajuste após contagem física mensal"
    assert adj_row[9] == default_user.email

    out_row = data_rows[1]
    assert out_row[5] == "OUT"
    assert out_row[6] == "-20.000"
    assert out_row[7] == "30.000"
    assert out_row[8] == "Saída para obra Bloco B"
    assert out_row[9] == default_user.email

    in_row = data_rows[2]
    assert in_row[5] == "IN"
    assert in_row[6] == "50.000"
    assert in_row[7] == "50.000"
    assert in_row[8] == "Carga inicial Fornecedor Votoran"
    assert in_row[9] == default_user.email


def test_export_movements_csv_with_filters(client):
    """
    Validar que GET /api/inventory/movements/export respeita os filtros:
    - product_id
    - type
    - start_date e end_date
    """
    p1 = client.post("/api/products", json={"name": "Produto Filtro 1", "unit": "UN", "initial_quantity": 0}).json()
    p2 = client.post("/api/products", json={"name": "Produto Filtro 2", "unit": "UN", "initial_quantity": 0}).json()

    client.post("/api/inventory/in", json={"product_id": p1["id"], "quantity": 10.0, "reason": "P1 In"}, headers={"X-Idempotency-Key": str(uuid.uuid4())})
    client.post("/api/inventory/out", json={"product_id": p1["id"], "quantity": 2.0, "reason": "P1 Out"}, headers={"X-Idempotency-Key": str(uuid.uuid4())})
    client.post("/api/inventory/in", json={"product_id": p2["id"], "quantity": 25.0, "reason": "P2 In"}, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    # Filtro product_id
    res_p1 = client.get(f"/api/inventory/movements/export?product_id={p1['id']}")
    rows_p1 = list(csv.reader(io.StringIO(res_p1.text)))
    assert len(rows_p1) == 3  # Header + 2 rows
    assert all(r[2] == p1["id"] for r in rows_p1[1:])

    # Filtro type = OUT
    res_out = client.get("/api/inventory/movements/export?type=OUT")
    rows_out = list(csv.reader(io.StringIO(res_out.text)))
    assert len(rows_out) == 2  # Header + 1 row
    assert rows_out[1][5] == "OUT"
    assert rows_out[1][2] == p1["id"]

    # Filtro data futura
    future = (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    res_future = client.get(f"/api/inventory/movements/export?start_date={future}")
    rows_future = list(csv.reader(io.StringIO(res_future.text)))
    assert len(rows_future) == 1  # Apenas Header


def test_export_movements_strict_tenant_isolation(client, db_session, default_user):
    """
    Validar que o CSV exportado no Tenant 1 não contém movimentações do Tenant 2.
    """
    # Movimentação no Tenant 1
    p1 = client.post("/api/products", json={"name": "Produto T1 Confidencial", "unit": "UN", "initial_quantity": 0}).json()
    client.post("/api/inventory/in", json={"product_id": p1["id"], "quantity": 100.0, "reason": "T1 Secret"}, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    # Cria Tenant 2
    tenant2 = TenantModel(name="Tenant Isolado 2", slug="tenant-isolado-2", is_active=True)
    db_session.add(tenant2)
    db_session.commit()
    db_session.refresh(tenant2)

    membership2 = TenantMembershipModel(user_id=default_user.id, tenant_id=tenant2.id, role="OWNER")
    db_session.add(membership2)
    db_session.commit()

    token2 = create_access_token({"sub": str(default_user.id), "email": default_user.email})
    headers_t2 = {"Authorization": f"Bearer {token2}", "X-Tenant-ID": str(tenant2.id)}

    # Movimentação no Tenant 2
    p2_res = client.post("/api/products", json={"name": "Produto T2 Privado", "unit": "UN", "initial_quantity": 0}, headers=headers_t2)
    p2 = p2_res.json()
    client.post("/api/inventory/in", json={"product_id": p2["id"], "quantity": 50.0, "reason": "T2 Secret"}, headers={**headers_t2, "X-Idempotency-Key": str(uuid.uuid4())})

    # Exporta Tenant 1
    res_t1 = client.get("/api/inventory/movements/export")
    assert "tenant-isolado-2" not in res_t1.headers["content-disposition"]
    rows_t1 = list(csv.reader(io.StringIO(res_t1.text)))
    assert len(rows_t1) == 2
    assert "Produto T1 Confidencial" in rows_t1[1][3]
    assert "Produto T2 Privado" not in res_t1.text

    # Exporta Tenant 2
    res_t2 = client.get("/api/inventory/movements/export", headers=headers_t2)
    assert "tenant-isolado-2" in res_t2.headers["content-disposition"]
    rows_t2 = list(csv.reader(io.StringIO(res_t2.text)))
    assert len(rows_t2) == 2
    assert "Produto T2 Privado" in rows_t2[1][3]
    assert "Produto T1 Confidencial" not in res_t2.text


def test_export_movements_rbac_authorization(client, db_session, default_tenant):
    """
    Validar controle de acesso (RBAC) ao endpoint GET /api/inventory/movements/export:
    - OWNER, GESTOR, ALMOXARIFE e AUDITOR têm acesso permitido (200).
    - Usuário sem associação ao tenant recebe 403 Forbidden.
    """
    # Cria produto e movimentação
    p = client.post("/api/products", json={"name": "Item RBAC", "unit": "UN", "initial_quantity": 0}).json()
    client.post("/api/inventory/in", json={"product_id": p["id"], "quantity": 10.0, "reason": "Teste RBAC"}, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    roles = ["OWNER", "GESTOR", "ALMOXARIFE", "AUDITOR"]
    for role in roles:
        user = UserModel(
            email=f"user.{role.lower()}@empresa.com",
            password_hash=get_password_hash("Senha123"),
            full_name=f"User {role}",
            is_active=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        membership = TenantMembershipModel(
            user_id=user.id,
            tenant_id=default_tenant.id,
            role=role,
        )
        db_session.add(membership)
        db_session.commit()

        token = create_access_token({"sub": str(user.id), "email": user.email})
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": str(default_tenant.id),
        }

        res = client.get("/api/inventory/movements/export", headers=headers)
        assert res.status_code == 200, f"Papel {role} deveria ter acesso permitido ao export."
        assert "text/csv" in res.headers["content-type"]

    # Usuário sem membership no default_tenant
    intruder = UserModel(
        email="intruder@empresa.com",
        password_hash=get_password_hash("Senha123"),
        full_name="User Sem Tenant",
        is_active=True,
    )
    db_session.add(intruder)
    db_session.commit()
    db_session.refresh(intruder)

    token_intruder = create_access_token({"sub": str(intruder.id), "email": intruder.email})
    headers_intruder = {
        "Authorization": f"Bearer {token_intruder}",
        "X-Tenant-ID": str(default_tenant.id),
    }
    res_intruder = client.get("/api/inventory/movements/export", headers=headers_intruder)
    assert res_intruder.status_code == 403
