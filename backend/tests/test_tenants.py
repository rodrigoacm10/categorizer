import pytest
from app.modules.tenants.infrastructure.models import TenantMembershipModel
from app.core.security import create_access_token


def test_tenant_creation_assigns_owner(client, db_session, default_user):
    """Criação de tenant assegurando atomicamente que o criador é inserido como OWNER."""
    res = client.post("/api/tenants", json={
        "name": "Almoxarifado Central Matriz",
        "slug": "matriz-central",
        "description": "Depósito principal de matérias-primas",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Almoxarifado Central Matriz"
    assert data["slug"] == "matriz-central"
    assert data["is_active"] is True
    tenant_id = data["id"]

    # Valida no banco a membership de OWNER
    membership = (
        db_session.query(TenantMembershipModel)
        .filter(
            TenantMembershipModel.tenant_id == tenant_id,
            TenantMembershipModel.user_id == default_user.id,
        )
        .first()
    )
    assert membership is not None
    assert membership.role == "OWNER"


def test_tenant_creation_auto_slug(client):
    """Geração automática de slug kebab-case a partir do nome."""
    res = client.post("/api/tenants", json={
        "name": "Filial Sul - Depósito Logístico!",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["slug"] == "filial-sul-deposito-logistico"


def test_tenant_creation_duplicate_slug(client):
    """Rejeição de slug repetido com status HTTP 409 (RFC 7807)."""
    client.post("/api/tenants", json={
        "name": "Primeiro Tenant",
        "slug": "slug-repetido",
    })

    res = client.post("/api/tenants", json={
        "name": "Segundo Tenant",
        "slug": "slug-repetido",
    })
    assert res.status_code == 409
    err = res.json()
    assert err["type"] == "https://api.estoque.local/errors/tenant-slug-already-exists"
    assert "Slug 'slug-repetido' já está em uso" in err["detail"]


def test_list_user_tenants(client):
    """Lista apenas tenants vinculados ao usuário logado."""
    client.post("/api/tenants", json={"name": "Tenant Alfa", "slug": "tenant-alfa"})
    client.post("/api/tenants", json={"name": "Tenant Beta", "slug": "tenant-beta"})

    res = client.get("/api/tenants")
    assert res.status_code == 200
    tenants = res.json()
    slugs = [t["slug"] for t in tenants]
    assert "tenant-alfa" in slugs
    assert "tenant-beta" in slugs


def test_tenant_members_management_lifecycle(client):
    """Ciclo completo de gerenciamento de membros de um tenant."""
    # 1. Cria dois novos usuários
    reg_user2 = client.post("/api/auth/register", json={
        "email": "membro.operador@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Operador Membro",
    }).json()
    user2_id = reg_user2["id"]

    reg_user3 = client.post("/api/auth/register", json={
        "email": "membro.gestor@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Gestor Membro",
    }).json()
    user3_id = reg_user3["id"]

    # 2. Cria tenant (usuário logado vira OWNER)
    tenant = client.post("/api/tenants", json={
        "name": "Tenant Para Membros",
        "slug": "tenant-membros",
    }).json()
    tenant_id = tenant["id"]

    # 3. Listar membros inicial (deve conter apenas o criador OWNER)
    res_list = client.get(f"/api/tenants/{tenant_id}/members")
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1

    # 4. Adicionar membro inexistente -> 404
    res_not_found = client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "naoexiste@empresa.com",
        "role": "ALMOXARIFE",
    })
    assert res_not_found.status_code == 404
    assert "não encontrado" in res_not_found.json()["detail"]

    # 5. Adicionar usuário 2 como ALMOXARIFE
    res_add = client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "membro.operador@empresa.com",
        "role": "ALMOXARIFE",
    })
    assert res_add.status_code == 201
    member_data = res_add.json()
    assert member_data["user_id"] == user2_id
    assert member_data["role"] == "ALMOXARIFE"

    # 6. Adicionar mesmo usuário novamente -> 409
    res_dup = client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "membro.operador@empresa.com",
        "role": "ALMOXARIFE",
    })
    assert res_dup.status_code == 409
    assert res_dup.json()["type"] == "https://api.estoque.local/errors/member-already-exists"

    # 7. Adiciona usuário 3 como GESTOR
    client.post(f"/api/tenants/{tenant_id}/members", json={
        "email": "membro.gestor@empresa.com",
        "role": "GESTOR",
    })

    # 8. Teste GESTOR tentando convidar OWNER -> deve falhar com 403
    token_gestor = create_access_token({"sub": user3_id, "email": "membro.gestor@empresa.com"})
    res_gestor_invite_owner = client.post(
        f"/api/tenants/{tenant_id}/members",
        json={"email": "outro@empresa.com", "role": "OWNER"},
        headers={"Authorization": f"Bearer {token_gestor}"},
    )
    assert res_gestor_invite_owner.status_code == 403

    # 9. Alterar papel de usuário 2 de ALMOXARIFE para AUDITOR
    res_put = client.put(f"/api/tenants/{tenant_id}/members/{user2_id}", json={
        "role": "AUDITOR",
    })
    assert res_put.status_code == 200
    assert res_put.json()["role"] == "AUDITOR"

    # 10. Remover usuário 2 do tenant
    res_del = client.delete(f"/api/tenants/{tenant_id}/members/{user2_id}")
    assert res_del.status_code == 200

    # 11. Proteção: Tentar remover o único OWNER -> 422
    me = client.get("/api/auth/me").json()
    owner_id = me["id"]
    res_del_owner = client.delete(f"/api/tenants/{tenant_id}/members/{owner_id}")
    assert res_del_owner.status_code == 422
    assert res_del_owner.json()["type"] == "https://api.estoque.local/errors/sole-owner-removal"

    # 12. Proteção: Tentar rebaixar o único OWNER -> 422
    res_demote_owner = client.put(f"/api/tenants/{tenant_id}/members/{owner_id}", json={
        "role": "ALMOXARIFE",
    })
    assert res_demote_owner.status_code == 422


def test_get_tenant_by_id_endpoint(client):
    """Consulta de tenant por ID para membro e não membro."""
    tenant = client.post("/api/tenants", json={"name": "Tenant Detalhes", "slug": "tenant-detalhes"}).json()
    t_id = tenant["id"]

    # Membro consulta com sucesso
    res = client.get(f"/api/tenants/{t_id}")
    assert res.status_code == 200
    assert res.json()["name"] == "Tenant Detalhes"

    # Outro usuário não membro tenta consultar -> 403
    reg_outro = client.post("/api/auth/register", json={
        "email": "outro.usuario@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Outro Usuario",
    }).json()
    token_outro = create_access_token({"sub": reg_outro["id"], "email": reg_outro["email"]})
    res_outro = client.get(f"/api/tenants/{t_id}", headers={"Authorization": f"Bearer {token_outro}"})
    assert res_outro.status_code == 403
