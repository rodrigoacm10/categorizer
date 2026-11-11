import pytest
from app.core.security import verify_password, decode_access_token
from app.modules.auth.infrastructure.models import UserModel


def test_user_registration_success(client, db_session):
    """Registro de novo usuário com hash verificado via verify()."""
    payload = {
        "email": "carlos.silva@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Carlos Eduardo Silva",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "carlos.silva@empresa.com"
    assert data["full_name"] == "Carlos Eduardo Silva"
    assert data["is_active"] is True
    assert "password" not in data
    assert "password_hash" not in data

    # Verifica hash no banco
    user = db_session.query(UserModel).filter(UserModel.email == "carlos.silva@empresa.com").first()
    assert user is not None
    assert verify_password("SenhaSegura123", user.password_hash) is True
    assert verify_password("SenhaErrada123", user.password_hash) is False


def test_user_registration_duplicate_email(client):
    """Rejeição de email repetido com status HTTP 409 (RFC 7807)."""
    payload = {
        "email": "duplicado@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Primeiro Usuario",
    }
    res1 = client.post("/api/auth/register", json=payload)
    assert res1.status_code == 201

    # Segunda tentativa com o mesmo email (case-insensitive)
    payload_dup = {
        "email": "DUPLICADO@empresa.com",
        "password": "OutraSenhaSegura999",
        "full_name": "Segundo Usuario",
    }
    res2 = client.post("/api/auth/register", json=payload_dup)
    assert res2.status_code == 409
    err = res2.json()
    assert err["type"] == "https://api.estoque.local/errors/email-already-exists"
    assert err["title"] == "Email Já Cadastrado"
    assert "já cadastrado" in err["detail"].lower()


def test_user_registration_password_complexity(client):
    """Rejeição de senhas que não atendem aos critérios de complexidade."""
    # Menos de 8 caracteres
    res1 = client.post("/api/auth/register", json={
        "email": "fraco1@empresa.com",
        "password": "Abc1",
        "full_name": "Nome Valido",
    })
    assert res1.status_code == 422

    # Sem número
    res2 = client.post("/api/auth/register", json={
        "email": "fraco2@empresa.com",
        "password": "SenhaSemNumero",
        "full_name": "Nome Valido",
    })
    assert res2.status_code == 422

    # Sem letra maiúscula
    res3 = client.post("/api/auth/register", json={
        "email": "fraco3@empresa.com",
        "password": "senhasemmaiuscula123",
        "full_name": "Nome Valido",
    })
    assert res3.status_code == 422


def test_login_success_and_jwt_claims(client):
    """Login com credenciais válidas e validação dos claims JWT."""
    # 1. Registra usuário
    client.post("/api/auth/register", json={
        "email": "login.test@empresa.com",
        "password": "SenhaForte123",
        "full_name": "Login Test User",
    })

    # 2. Login via JSON
    res = client.post("/api/auth/login", json={
        "email": "login.test@empresa.com",
        "password": "SenhaForte123",
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 3600

    # 3. Decodifica e valida os claims
    token = data["access_token"]
    payload = decode_access_token(token)
    assert payload["email"] == "login.test@empresa.com"
    assert "sub" in payload
    assert payload["type"] == "access"
    assert payload["exp"] > payload["iat"]


def test_login_form_oauth2(client):
    """Suporte a login via formulário padrão OAuth2 (username e password)."""
    client.post("/api/auth/register", json={
        "email": "oauth.form@empresa.com",
        "password": "SenhaForte123",
        "full_name": "OAuth User",
    })

    res = client.post(
        "/api/auth/login",
        data={"username": "oauth.form@empresa.com", "password": "SenhaForte123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_login_invalid_password(client):
    """Rejeição de senha errada com status HTTP 401 e payload RFC 7807."""
    client.post("/api/auth/register", json={
        "email": "senha.errada@empresa.com",
        "password": "SenhaCorreta123",
        "full_name": "Nome",
    })

    res = client.post("/api/auth/login", json={
        "email": "senha.errada@empresa.com",
        "password": "SenhaIncorreta999",
    })
    assert res.status_code == 401
    err = res.json()
    assert err["type"] == "https://api.estoque.local/errors/invalid-credentials"
    assert "Credenciais inválidas" in err["detail"]


def test_login_nonexistent_user(client):
    """Rejeição de usuário inexistente com 401 genérico."""
    res = client.post("/api/auth/login", json={
        "email": "naoexiste@empresa.com",
        "password": "QualquerSenha123",
    })
    assert res.status_code == 401
    assert "Credenciais inválidas" in res.json()["detail"]


def test_login_inactive_user(client, db_session):
    """Rejeição de usuário inativo."""
    res_reg = client.post("/api/auth/register", json={
        "email": "inativo@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "Usuario Inativo",
    })
    user_id = res_reg.json()["id"]

    # Inativa o usuário no banco
    user = db_session.query(UserModel).filter(UserModel.id == user_id).first()
    user.is_active = False
    db_session.commit()

    res = client.post("/api/auth/login", json={
        "email": "inativo@empresa.com",
        "password": "SenhaSegura123",
    })
    assert res.status_code == 401


def test_auth_me_endpoint(client, default_user, default_tenant):
    """Consulta de /api/auth/me retornando dados do usuário e seus tenants."""
    res = client.get("/api/auth/me")
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == default_user.email
    assert data["full_name"] == default_user.full_name
    assert len(data["tenants"]) >= 1
    tenant_info = data["tenants"][0]
    assert tenant_info["tenant_id"] == str(default_tenant.id)
    assert tenant_info["tenant_name"] == default_tenant.name
    assert tenant_info["role"] == "OWNER"


def test_auth_me_unauthorized_without_token(client):
    """Rejeição de acesso a /api/auth/me sem token JWT."""
    res = client.get("/api/auth/me", headers={"Authorization": ""})
    assert res.status_code in (401, 403)


def test_security_utils_edge_cases():
    """Valida funções de segurança para casos de borda e tokens corrompidos/expirados."""
    from datetime import timedelta
    from app.core.security import create_access_token, decode_access_token, verify_password
    from app.shared.domain.exceptions import TokenExpiredError, InvalidTokenError

    # 1. create_access_token com timedelta customizado
    token = create_access_token({"sub": "user-uuid"}, expires_delta=timedelta(minutes=5))
    payload = decode_access_token(token)
    assert payload["sub"] == "user-uuid"

    # 2. Token expirado
    token_expired = create_access_token({"sub": "user-uuid"}, expires_delta=timedelta(seconds=-10))
    with pytest.raises(TokenExpiredError):
        decode_access_token(token_expired)

    # 3. Token com assinatura corrompida
    with pytest.raises(InvalidTokenError):
        decode_access_token("token.invalido.corrompido")

    # 4. verify_password com hash malformado
    assert verify_password("Senha123", "hash_invalido_sem_bcrypt") is False


def test_auth_token_without_sub_or_invalid_uuid(client):
    """Rejeita tokens sem claim sub ou com formato inválido."""
    from app.core.security import create_access_token

    token_no_sub = create_access_token({"email": "sem.sub@empresa.com"})
    res1 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_no_sub}"})
    assert res1.status_code == 401

    token_bad_uuid = create_access_token({"sub": "nao-eh-uuid", "email": "bad@empresa.com"})
    res2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_bad_uuid}"})
    assert res2.status_code == 401
