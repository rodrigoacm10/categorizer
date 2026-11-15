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


def test_get_tenant_member_by_id_success_and_errors(client):
    """Testa consulta de membro específico por user_id e casos de erro (404 e 403)."""
    tenant = client.post("/api/tenants", json={"name": "Tenant Consulta Membro", "slug": "tenant-consulta-membro"}).json()
    tenant_id = tenant["id"]

    reg_user = client.post("/api/auth/register", json={
        "email": "membro.especifico@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Membro Especifico",
    }).json()
    user_id = reg_user["id"]

    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "membro.especifico@empresa.com",
        "role": "ALMOXARIFE",
    })

    # Consulta com sucesso
    res = client.get(f"/api/tenants/{tenant_id}/members/{user_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] == user_id
    assert data["email"] == "membro.especifico@empresa.com"
    assert data["full_name"] == "Membro Especifico"
    assert data["role"] == "ALMOXARIFE"
    assert "joined_at" in data

    # Consulta ID inexistente -> 404
    fake_id = str(uuid4())
    res_404 = client.get(f"/api/tenants/{tenant_id}/members/{fake_id}")
    assert res_404.status_code == 404
    assert "Membro não encontrado" in res_404.json()["detail"]

    # Consulta por usuário não membro -> 403
    reg_intruso = client.post("/api/auth/register", json={
        "email": "intruso.consulta@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Intruso Consulta",
    }).json()
    token_intruso = create_access_token({"sub": reg_intruso["id"], "email": reg_intruso["email"]})
    res_403 = client.get(
        f"/api/tenants/{tenant_id}/members/{user_id}",
        headers={"Authorization": f"Bearer {token_intruso}"},
    )
    assert res_403.status_code == 403
    assert res_403.json()["type"] == "https://api.estoque.local/errors/tenant-access-denied"


def test_leave_tenant_regular_member_success(client):
    """Testa saída voluntária de membro regular do tenant com sucesso."""
    tenant = client.post("/api/tenants", json={"name": "Tenant Saida Regular", "slug": "tenant-saida-reg"}).json()
    tenant_id = tenant["id"]

    reg_membro = client.post("/api/auth/register", json={
        "email": "saida.voluntaria@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Membro Que Vai Sair",
    }).json()
    membro_id = reg_membro["id"]

    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "saida.voluntaria@empresa.com",
        "role": "ALMOXARIFE",
    })

    # Membro se autentica e chama leave
    token_membro = create_access_token({"sub": membro_id, "email": reg_membro["email"]})
    res_leave = client.post(
        f"/api/tenants/{tenant_id}/leave",
        headers={"Authorization": f"Bearer {token_membro}"},
    )
    assert res_leave.status_code == 200
    assert "sucesso" in res_leave.json()["message"]

    # Membro agora não possui mais acesso ao tenant -> 403
    res_check = client.get(
        f"/api/tenants/{tenant_id}/members",
        headers={"Authorization": f"Bearer {token_membro}"},
    )
    assert res_check.status_code == 403


def test_leave_tenant_sole_owner_blocked(client):
    """Testa bloqueio estrito de saída voluntária do único OWNER remanescente (422 RFC 7807)."""
    tenant = client.post("/api/tenants", json={"name": "Tenant Sole Owner", "slug": "tenant-sole-owner"}).json()
    tenant_id = tenant["id"]

    # Default user é o único OWNER deste tenant
    res_leave = client.post(f"/api/tenants/{tenant_id}/leave")
    assert res_leave.status_code == 422
    err = res_leave.json()
    assert err["type"] == "https://api.estoque.local/errors/sole-owner-removal"
    assert "único OWNER" in err["detail"]


def test_leave_tenant_owner_when_multiple_owners_exist(client):
    """Testa saída de um OWNER com sucesso quando existe outro OWNER."""
    tenant = client.post("/api/tenants", json={"name": "Tenant Multi Owner", "slug": "tenant-multi-owner"}).json()
    tenant_id = tenant["id"]

    # Cadastra e adiciona segundo usuário como OWNER
    reg_owner2 = client.post("/api/auth/register", json={
        "email": "segundo.owner@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Segundo Owner",
    }).json()
    owner2_id = reg_owner2["id"]

    # Owner inicial adiciona segundo usuário inicialmente como Almoxarife e promove para OWNER
    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "segundo.owner@empresa.com",
        "role": "ALMOXARIFE",
    })
    client.put(f"/api/tenants/{tenant_id}/members/{owner2_id}", json={
        "role": "OWNER",
    })

    # Agora existem 2 OWNERS. O segundo OWNER chama leave
    token_owner2 = create_access_token({"sub": owner2_id, "email": reg_owner2["email"]})
    res_leave = client.post(
        f"/api/tenants/{tenant_id}/leave",
        headers={"Authorization": f"Bearer {token_owner2}"},
    )
    assert res_leave.status_code == 200
    assert "sucesso" in res_leave.json()["message"]

    # O owner inicial continua com acesso e summary mostra 1 owner
    res_summary = client.get(f"/api/tenants/{tenant_id}/members/summary")
    assert res_summary.status_code == 200
    assert res_summary.json()["owners_count"] == 1
    assert res_summary.json()["total_members"] == 1


