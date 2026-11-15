import pytest
from uuid import uuid4
from app.core.security import create_access_token


def test_tenant_members_summary_success(client):
    """Testa sumário de membros com contagem correta por papel."""
    # 1. Cria um novo tenant (o default_user logado vira OWNER)
    tenant_res = client.post("/api/tenants", json={
        "name": "Almoxarifado de Peças e Peças",
        "slug": "almox-pecas",
    })
    assert tenant_res.status_code == 201
    tenant_id = tenant_res.json()["id"]

    # 2. Cria e adiciona membros com diferentes papéis
    # 1 GESTOR
    u_gestor = client.post("/api/auth/register", json={
        "email": "gestor.pecas@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Gestor de Peças",
    }).json()
    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "gestor.pecas@empresa.com",
        "role": "GESTOR",
    })

    # 2 ALMOXARIFES
    u_almox1 = client.post("/api/auth/register", json={
        "email": "almox1.pecas@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Almoxarife Um",
    }).json()
    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "almox1.pecas@empresa.com",
        "role": "ALMOXARIFE",
    })

    u_almox2 = client.post("/api/auth/register", json={
        "email": "almox2.pecas@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Almoxarife Dois",
    }).json()
    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "almox2.pecas@empresa.com",
        "role": "ALMOXARIFE",
    })

    # 1 AUDITOR
    u_auditor = client.post("/api/auth/register", json={
        "email": "auditor.pecas@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Auditor Fiscal",
    }).json()
    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "auditor.pecas@empresa.com",
        "role": "AUDITOR",
    })

    # 3. Consulta summary
    res_summary = client.get(f"/api/tenants/{tenant_id}/members/summary")
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert summary["total_members"] == 5
    assert summary["owners_count"] == 1
    assert summary["gestores_count"] == 1
    assert summary["almoxarifes_count"] == 2
    assert summary["auditores_count"] == 1


def test_tenant_members_summary_access_denied_for_non_member(client):
    """Testa bloqueio 403 ao tentar ver o sumário sem ser membro do tenant."""
    tenant_res = client.post("/api/tenants", json={
        "name": "Tenant Restrito",
        "slug": "tenant-restrito",
    })
    tenant_id = tenant_res.json()["id"]

    # Cria outro usuário não membro
    outro_user = client.post("/api/auth/register", json={
        "email": "intruso@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Usuario Intruso",
    }).json()
    token_intruso = create_access_token({"sub": outro_user["id"], "email": outro_user["email"]})

    res = client.get(
        f"/api/tenants/{tenant_id}/members/summary",
        headers={"Authorization": f"Bearer {token_intruso}"},
    )
    assert res.status_code == 403
    assert res.json()["type"] == "https://api.estoque.local/errors/tenant-access-denied"
