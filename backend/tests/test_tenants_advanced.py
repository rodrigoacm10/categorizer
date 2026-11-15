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


def test_list_members_paginated_headers(client):
    """Testa listagem paginada com injeção dos headers X-Total-Count, X-Total-Pages e Access-Control-Expose-Headers."""
    tenant = client.post("/api/tenants", json={"name": "Tenant Paginacao", "slug": "tenant-paginacao"}).json()
    tenant_id = tenant["id"]

    # Cadastra mais 4 membros (totalizando 5 membros com o OWNER)
    for i in range(1, 5):
        client.post("/api/auth/register", json={
            "email": f"operador{i}@paginacao.com",
            "password": "SenhaSegura123",
            "full_name": f"Operador {i}",
        })
        client.post(f"/api/tenants/{tenant_id}/members", json={
            "email": f"operador{i}@paginacao.com",
            "role": "ALMOXARIFE",
        })

    # Consulta página 1 com limit=2, offset=0
    res_p1 = client.get(f"/api/tenants/{tenant_id}/members?limit=2&offset=0")
    assert res_p1.status_code == 200
    assert len(res_p1.json()) == 2
    assert res_p1.headers["X-Total-Count"] == "5"
    assert res_p1.headers["X-Total-Pages"] == "3"
    assert "X-Total-Count" in res_p1.headers["Access-Control-Expose-Headers"]
    assert "X-Total-Pages" in res_p1.headers["Access-Control-Expose-Headers"]

    # Consulta página 2 com limit=2, offset=2
    res_p2 = client.get(f"/api/tenants/{tenant_id}/members?limit=2&offset=2")
    assert res_p2.status_code == 200
    assert len(res_p2.json()) == 2
    assert res_p2.headers["X-Total-Count"] == "5"

    # Consulta página 3 com limit=2, offset=4
    res_p3 = client.get(f"/api/tenants/{tenant_id}/members?limit=2&offset=4")
    assert res_p3.status_code == 200
    assert len(res_p3.json()) == 1
    assert res_p3.headers["X-Total-Count"] == "5"


def test_list_members_filter_by_role(client):
    """Testa filtro por papel (role=ALMOXARIFE, role=GESTOR)."""
    tenant = client.post("/api/tenants", json={"name": "Tenant Filtro Role", "slug": "tenant-filtro-role"}).json()
    tenant_id = tenant["id"]

    client.post("/api/auth/register", json={
        "email": "gestor@filtro.com",
        "password": "SenhaSegura123",
        "full_name": "Gestor Filtro",
    })
    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "gestor@filtro.com",
        "role": "GESTOR",
    })

    client.post("/api/auth/register", json={
        "email": "almoxarife@filtro.com",
        "password": "SenhaSegura123",
        "full_name": "Almoxarife Filtro",
    })
    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "almoxarife@filtro.com",
        "role": "ALMOXARIFE",
    })

    # Filtro role=ALMOXARIFE
    res_almox = client.get(f"/api/tenants/{tenant_id}/members?role=ALMOXARIFE")
    assert res_almox.status_code == 200
    members_almox = res_almox.json()
    assert len(members_almox) == 1
    assert members_almox[0]["role"] == "ALMOXARIFE"
    assert members_almox[0]["email"] == "almoxarife@filtro.com"
    assert res_almox.headers["X-Total-Count"] == "1"

    # Filtro role=GESTOR
    res_gestor = client.get(f"/api/tenants/{tenant_id}/members?role=GESTOR")
    assert res_gestor.status_code == 200
    members_gestor = res_gestor.json()
    assert len(members_gestor) == 1
    assert members_gestor[0]["role"] == "GESTOR"
    assert members_gestor[0]["email"] == "gestor@filtro.com"
    assert res_gestor.headers["X-Total-Count"] == "1"

    # Filtro role=AUDITOR (nenhum membro)
    res_auditor = client.get(f"/api/tenants/{tenant_id}/members?role=AUDITOR")
    assert res_auditor.status_code == 200
    assert len(res_auditor.json()) == 0
    assert res_auditor.headers["X-Total-Count"] == "0"
    assert res_auditor.headers["X-Total-Pages"] == "0" or res_auditor.headers["X-Total-Pages"] == "1"


def test_list_members_search_by_name_and_email(client):
    """Testa busca textual por email ou nome (search=...)."""
    tenant = client.post("/api/tenants", json={"name": "Tenant Busca", "slug": "tenant-busca"}).json()
    tenant_id = tenant["id"]

    client.post("/api/auth/register", json={
        "email": "carlos.silva@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Carlos Alberto da Silva",
    })
    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "carlos.silva@empresa.com",
        "role": "ALMOXARIFE",
    })

    client.post("/api/auth/register", json={
        "email": "mariana.oliveira@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Mariana Souza",
    })
    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "mariana.oliveira@empresa.com",
        "role": "AUDITOR",
    })

    # Busca por parte do nome 'alberto'
    res_nome = client.get(f"/api/tenants/{tenant_id}/members?search=alberto")
    assert res_nome.status_code == 200
    results_nome = res_nome.json()
    assert len(results_nome) == 1
    assert results_nome[0]["email"] == "carlos.silva@empresa.com"
    assert res_nome.headers["X-Total-Count"] == "1"

    # Busca por parte do email 'mariana.oliveira'
    res_email = client.get(f"/api/tenants/{tenant_id}/members?search=mariana.oliveira")
    assert res_email.status_code == 200
    results_email = res_email.json()
    assert len(results_email) == 1
    assert results_email[0]["full_name"] == "Mariana Souza"
    assert res_email.headers["X-Total-Count"] == "1"

    # Busca sem correspondência
    res_none = client.get(f"/api/tenants/{tenant_id}/members?search=termo_inexistente_xyz")
    assert res_none.status_code == 200
    assert len(res_none.json()) == 0
    assert res_none.headers["X-Total-Count"] == "0"

