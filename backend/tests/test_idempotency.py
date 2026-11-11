import json
import uuid
import pytest
from app.core.security import create_access_token
from app.modules.idempotency.domain.enums import IdempotencyStatus
from app.modules.idempotency.domain.entities import IdempotencyRecord
from app.modules.idempotency.infrastructure.models import IdempotencyRecordModel
from app.modules.idempotency.infrastructure.repositories import SqlAlchemyIdempotencyRepository
from app.modules.idempotency.interfaces.hasher import canonical_json, compute_request_hash
from app.modules.idempotency.interfaces.guard import IdempotencyGuard, check_or_start_idempotency


def test_hasher_canonical_json_invariance():
    """Garante que variações cosméticas e inversão de chaves gerem o mesmo digest SHA-256."""
    payload1 = {"z": 100, "a": "primeiro", "m": [3, 2, 1], "sub": {"y": True, "x": False}}
    payload2 = {"a": "primeiro", "sub": {"x": False, "y": True}, "m": [3, 2, 1], "z": 100}

    canon1 = canonical_json(payload1)
    canon2 = canonical_json(payload2)
    assert canon1 == canon2

    hash1 = compute_request_hash("POST", "/api/products", payload1)
    hash2 = compute_request_hash("POST", "/api/products", payload2)
    assert hash1 == hash2
    assert len(hash1) == 64

    # String formatada com quebras de linha e espaços vs compacta
    json_str1 = '{\n  "b": 2,\n  "a": 1\n}'
    json_str2 = '{"a":1,"b":2}'
    assert canonical_json(json_str1) == canonical_json(json_str2)
    assert compute_request_hash("POST", "/test", json_str1) == compute_request_hash("POST", "/test", json_str2)

    # Variações em métodos ou caminhos devem gerar hashes distintos
    hash_put = compute_request_hash("PUT", "/api/products", payload1)
    hash_other_path = compute_request_hash("POST", "/api/other", payload1)
    assert hash1 != hash_put
    assert hash1 != hash_other_path

    # Assinatura legada
    hash_legacy = compute_request_hash("/api/products", payload1)
    assert hash_legacy == hash1

    # Casos limites
    assert canonical_json(None) == ""
    assert canonical_json("") == ""
    assert canonical_json(b'{"k": "v"}') == '{"k":"v"}'
    assert canonical_json(b"plain-bytes") == "plain-bytes"
    assert canonical_json("not-a-json") == "not-a-json"


def test_idempotency_replay_hit(client, db_session):
    """
    Dois envios idênticos com mesma chave:
    1º retorna 201 com X-Cache: MISS.
    2º retorna 201 com X-Cache: HIT sem criar registros adicionais.
    """
    idempotency_key = str(uuid.uuid4())
    payload = {
        "name": "Parafuso Idempotente Aço Inox",
        "description": "Item para teste de replay HIT",
        "unit": "UN",
        "initial_quantity": 50.0,
        "min_stock": 10.0,
    }

    # 1ª Requisição (MISS)
    res1 = client.post(
        "/api/products",
        json=payload,
        headers={"X-Idempotency-Key": idempotency_key},
    )
    assert res1.status_code == 201
    assert res1.headers.get("X-Cache") == "MISS"
    assert res1.headers.get("X-Idempotency-Key") == idempotency_key
    data1 = res1.json()
    prod_id = data1["id"]

    # 2ª Requisição (HIT com Replay)
    res2 = client.post(
        "/api/products",
        json=payload,
        headers={"X-Idempotency-Key": idempotency_key},
    )
    assert res2.status_code == 201
    assert res2.headers.get("X-Cache") == "HIT"
    assert res2.headers.get("X-Idempotency-Key") == idempotency_key
    data2 = res2.json()
    assert data2["id"] == prod_id
    assert data2["name"] == payload["name"]

    # Verifica se não houve duplicação de produtos no banco
    products_res = client.get("/api/products")
    matching = [p for p in products_res.json() if p["id"] == prod_id]
    assert len(matching) == 1


def test_idempotency_hash_mismatch_conflict(client):
    """
    Mesma chave de idempotência com payloads divergentes deve retornar 409 Conflict (RFC 7807).
    """
    idempotency_key = str(uuid.uuid4())
    payload_a = {
        "name": "Produto A",
        "unit": "UN",
        "initial_quantity": 10.0,
    }
    payload_b = {
        "name": "Produto B - Tentativa de Tampering",
        "unit": "KG",
        "initial_quantity": 999.0,
    }

    res1 = client.post(
        "/api/products",
        json=payload_a,
        headers={"X-Idempotency-Key": idempotency_key},
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/products",
        json=payload_b,
        headers={"X-Idempotency-Key": idempotency_key},
    )
    assert res2.status_code == 409
    err = res2.json()
    assert err["type"] == "https://api.estoque.local/errors/idempotency-conflict"
    assert "Chave de Idempotência já utilizada com um payload diferente" in err["detail"]


def test_idempotency_concurrent_processing_conflict(client, db_session, default_tenant):
    """
    Chave em estado PROCESSING deve rejeitar nova requisição com 409 Conflict.
    """
    idempotency_key = str(uuid.uuid4())
    payload = {
        "name": "Produto Em Processamento Concorrente",
        "unit": "UN",
        "initial_quantity": 5.0,
    }
    req_hash = compute_request_hash("POST", "/api/products", payload)

    # Injeta registro diretamente como PROCESSING simulando outra thread/worker ativa
    repo = SqlAlchemyIdempotencyRepository(db_session)
    repo.create(
        key=idempotency_key,
        request_hash=req_hash,
        endpoint="/api/products",
        tenant_id=default_tenant.id,
    )

    res = client.post(
        "/api/products",
        json=payload,
        headers={"X-Idempotency-Key": idempotency_key},
    )
    assert res.status_code == 409
    err = res.json()
    assert err["type"] == "https://api.estoque.local/errors/idempotency-processing"
    assert "já está sendo processada no momento" in err["detail"]


def test_idempotency_failure_allows_retry(client, db_session, default_tenant):
    """
    Se uma operação anterior falhou e ficou como FAILED, uma nova tentativa com a mesma chave é permitida.
    """
    idempotency_key = str(uuid.uuid4())
    payload = {
        "name": "Produto Retry Apos Falha",
        "unit": "UN",
        "initial_quantity": 10.0,
    }
    req_hash = compute_request_hash("POST", "/api/products", payload)

    # Simula gravação prévia de FAILED (ex: erro inesperado de infraestrutura)
    repo = SqlAlchemyIdempotencyRepository(db_session)
    rec = repo.create(
        key=idempotency_key,
        request_hash=req_hash,
        endpoint="/api/products",
        tenant_id=default_tenant.id,
    )
    repo.mark_failed(tenant_id=default_tenant.id, key=idempotency_key, error_message="Falha simulada 500")

    # A nova requisição com a mesma chave DEVE ser permitida e concluída
    res = client.post(
        "/api/products",
        json=payload,
        headers={"X-Idempotency-Key": idempotency_key},
    )
    assert res.status_code == 201
    assert res.headers.get("X-Cache") == "MISS"
    data = res.json()
    assert data["name"] == payload["name"]

    # O registro no banco deve estar agora COMPLETED
    updated_rec = repo.get_by_key(tenant_id=default_tenant.id, key=idempotency_key)
    assert updated_rec.status == IdempotencyStatus.COMPLETED.value


def test_idempotency_multi_tenant_isolation(client, db_session):
    """
    Dois tenants distintos utilizando a mesma chave de idempotência não devem colidir.
    """
    # 1. Cria Tenant 1 e Usuário 1
    u1_res = client.post("/api/auth/register", json={
        "email": "user.tenant1@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "User Tenant 1",
    }).json()
    token1 = create_access_token({"sub": u1_res["id"], "email": u1_res["email"]})
    tenant1 = client.post(
        "/api/tenants",
        json={"name": "Tenant Alfa", "slug": "tenant-alfa-idem"},
        headers={"Authorization": f"Bearer {token1}"},
    ).json()

    # 2. Cria Tenant 2 e Usuário 2
    u2_res = client.post("/api/auth/register", json={
        "email": "user.tenant2@empresa.com",
        "password": "SenhaSegura123",
        "full_name": "User Tenant 2",
    }).json()
    token2 = create_access_token({"sub": u2_res["id"], "email": u2_res["email"]})
    tenant2 = client.post(
        "/api/tenants",
        json={"name": "Tenant Beta", "slug": "tenant-beta-idem"},
        headers={"Authorization": f"Bearer {token2}"},
    ).json()

    # Chave compartilhada idêntica entre os dois tenants
    shared_key = f"key-shared-uuid-{uuid.uuid4()}"

    headers1 = {
        "Authorization": f"Bearer {token1}",
        "X-Tenant-ID": tenant1["id"],
        "X-Idempotency-Key": shared_key,
    }
    headers2 = {
        "Authorization": f"Bearer {token2}",
        "X-Tenant-ID": tenant2["id"],
        "X-Idempotency-Key": shared_key,
    }

    # Tenant 1 cria produto com shared_key
    res_t1 = client.post(
        "/api/products",
        json={"name": "Produto Alfa Exclusivo", "unit": "UN", "initial_quantity": 10.0},
        headers=headers1,
    )
    assert res_t1.status_code == 201
    assert res_t1.headers.get("X-Cache") == "MISS"
    prod_t1 = res_t1.json()

    # Tenant 2 cria produto com A MESMA shared_key (não deve conflitar 409!)
    res_t2 = client.post(
        "/api/products",
        json={"name": "Produto Beta Exclusivo", "unit": "CX", "initial_quantity": 20.0},
        headers=headers2,
    )
    assert res_t2.status_code == 201
    assert res_t2.headers.get("X-Cache") == "MISS"
    prod_t2 = res_t2.json()

    # Cada tenant recebe seu próprio cache HIT ao reenviar
    replay_t1 = client.post(
        "/api/products",
        json={"name": "Produto Alfa Exclusivo", "unit": "UN", "initial_quantity": 10.0},
        headers=headers1,
    )
    assert replay_t1.status_code == 201
    assert replay_t1.headers.get("X-Cache") == "HIT"
    assert replay_t1.json()["id"] == prod_t1["id"]
    assert replay_t1.json()["name"] == "Produto Alfa Exclusivo"

    replay_t2 = client.post(
        "/api/products",
        json={"name": "Produto Beta Exclusivo", "unit": "CX", "initial_quantity": 20.0},
        headers=headers2,
    )
    assert replay_t2.status_code == 201
    assert replay_t2.headers.get("X-Cache") == "HIT"
    assert replay_t2.json()["id"] == prod_t2["id"]
    assert replay_t2.json()["name"] == "Produto Beta Exclusivo"


def test_idempotency_auto_deduplication_without_key(client):
    """
    Deduplicação automática temporal por hash para prevenir duplo clique sem header X-Idempotency-Key.
    """
    payload = {
        "name": "Item Sem Chave Explícita Duplo Clique",
        "unit": "UN",
        "initial_quantity": 12.0,
    }

    # 1ª chamada
    res1 = client.post("/api/products", json=payload)
    assert res1.status_code == 201
    assert res1.headers.get("X-Cache") == "MISS"
    key1 = res1.headers.get("X-Idempotency-Key")
    assert key1 is not None

    # 2ª chamada imediata com o mesmo payload e sem chave
    res2 = client.post("/api/products", json=payload)
    assert res2.status_code == 201
    assert res2.headers.get("X-Cache") == "HIT"
    assert res2.json()["id"] == res1.json()["id"]


def test_idempotency_categories_and_updates(client):
    """Testa idempotência em criação de categorias e atualização de produtos."""
    cat_key = str(uuid.uuid4())
    cat_payload = {"name": "Categoria Idempotente", "description": "Desc", "color": "#123456"}

    res_cat1 = client.post("/api/categories", json=cat_payload, headers={"X-Idempotency-Key": cat_key})
    assert res_cat1.status_code == 201
    assert res_cat1.headers.get("X-Cache") == "MISS"

    res_cat2 = client.post("/api/categories", json=cat_payload, headers={"X-Idempotency-Key": cat_key})
    assert res_cat2.status_code == 201
    assert res_cat2.headers.get("X-Cache") == "HIT"
    assert res_cat2.json()["id"] == res_cat1.json()["id"]

    # Cria produto e testa PUT idempotente
    prod = client.post("/api/products", json={"name": "Item PUT", "unit": "UN", "initial_quantity": 1.0}).json()
    put_key = str(uuid.uuid4())
    put_payload = {"name": "Item PUT Atualizado", "description": "Nova desc"}

    res_put1 = client.put(f"/api/products/{prod['id']}", json=put_payload, headers={"X-Idempotency-Key": put_key})
    assert res_put1.status_code == 200
    assert res_put1.headers.get("X-Cache") == "MISS"

    res_put2 = client.put(f"/api/products/{prod['id']}", json=put_payload, headers={"X-Idempotency-Key": put_key})
    assert res_put2.status_code == 200
    assert res_put2.headers.get("X-Cache") == "HIT"
    assert res_put2.json()["name"] == "Item PUT Atualizado"


def test_idempotency_repository_methods(db_session, default_tenant):
    """Valida métodos da classe SqlAlchemyIdempotencyRepository isoladamente."""
    repo = SqlAlchemyIdempotencyRepository(db_session)
    t_id = default_tenant.id
    key = str(uuid.uuid4())
    endpoint = "/api/test"
    h = compute_request_hash("POST", endpoint, {"data": 123})

    # create & get_by_key
    rec = repo.create(key=key, request_hash=h, endpoint=endpoint, tenant_id=t_id)
    assert rec.status == IdempotencyStatus.PROCESSING.value

    found = repo.get_by_key(tenant_id=t_id, key=key)
    assert found is not None
    assert found.key == key

    # save com domain entity
    entity = IdempotencyRecord(
        key=key,
        tenant_id=t_id,
        request_hash=h,
        endpoint=endpoint,
        status=IdempotencyStatus.COMPLETED,
        response_code=200,
        response_body='{"ok": true}',
    )
    repo.save(entity)
    found_after_save = repo.get_by_key(t_id, key)
    assert found_after_save.status == IdempotencyStatus.COMPLETED.value
    assert found_after_save.response_code == 200

    # mark_failed & mark_completed
    repo.mark_failed(tenant_id=t_id, key=key, error_message="Erro teste")
    assert repo.get_by_key(t_id, key).status == IdempotencyStatus.FAILED.value

    repo.mark_completed(tenant_id=t_id, key=key, response_code=201, response_body='{"created": true}')
    assert repo.get_by_key(t_id, key).status == IdempotencyStatus.COMPLETED.value

    # find_recent_by_hash
    recent = repo.find_recent_by_hash(request_hash=h, endpoint=endpoint, max_age_seconds=60, tenant_id=t_id)
    assert recent is not None
    assert recent.key == key


def test_idempotency_domain_entities():
    """Valida instanciação e enums de domínio."""
    t_id = uuid.uuid4()
    rec = IdempotencyRecord(
        key="test-key",
        tenant_id=t_id,
        request_hash="abcd"*16,
        endpoint="/test",
        status=IdempotencyStatus.PROCESSING,
    )
    assert rec.key == "test-key"
    assert rec.status == IdempotencyStatus.PROCESSING
    assert IdempotencyStatus.RESOLVED == IdempotencyStatus.COMPLETED


def test_idempotency_repository_edge_cases(db_session, default_tenant):
    """Valida assinaturas flexíveis e branches internas do repositório."""
    repo = SqlAlchemyIdempotencyRepository(db_session)
    t_id = default_tenant.id
    key = str(uuid.uuid4())
    req_hash = "1234" * 16

    # get_by_key com chave simples sem tenant
    assert repo.get_by_key(key) is None

    # create e consulta com strings e tipos variados
    model = repo.create(key=key, request_hash=req_hash, endpoint="/test", tenant_id=t_id)
    assert repo.get_by_key(str(t_id), key) is not None
    assert repo.get_by_key(t_id, key) is not None
    assert repo.get_by_key(key=key, tenant_id=t_id) is not None
    assert repo.get_by_key(key, t_id) is not None
    assert repo.get_by_key("not-uuid", key) is None

    # save com IdempotencyRecordModel diretamente
    model.response_code = 200
    repo.save(model)
    assert repo.get_by_key(t_id, key).response_code == 200

    # save criando nova entidade através de IdempotencyRecord
    new_key = str(uuid.uuid4())
    new_entity = IdempotencyRecord(
        key=new_key,
        tenant_id=t_id,
        request_hash=req_hash,
        endpoint="/test/new",
        status=IdempotencyStatus.COMPLETED,
        response_code=201,
        response_body="{}",
    )
    repo.save(new_entity)
    assert repo.get_by_key(t_id, new_key).status == IdempotencyStatus.COMPLETED.value

    # Métodos legados resolve e fail
    repo.resolve(key=new_key, response_code=200, response_body='{"resolved": true}', tenant_id=t_id)
    assert repo.get_by_key(t_id, new_key).response_code == 200
    repo.fail(key=new_key, error_message="Erro legado", tenant_id=t_id)
    assert repo.get_by_key(t_id, new_key).status == IdempotencyStatus.FAILED.value


def test_idempotency_guard_edge_cases(db_session, default_tenant):
    """Valida branches e casos excepcionais no guard."""
    from app.modules.idempotency.interfaces.guard import datetime_now_timestamp, IdempotencyGuard
    from app.shared.domain.exceptions import IdempotencyProcessingError

    assert datetime_now_timestamp() > 0

    guard = IdempotencyGuard(db_session, tenant_id=default_tenant.id)
    key = str(uuid.uuid4())
    endpoint = "/api/edge"
    payload = {"foo": "bar"}

    # 1. Start e mark_completed com objeto não-string
    k, cached = guard.check_or_start(endpoint=endpoint, payload=payload, client_key=key)
    assert cached is None
    guard.mark_completed(key=key, response_code=200, response_body={"data": 42})

    # Cache HIT com dict
    k2, cached2 = guard.check_or_start(endpoint=endpoint, payload=payload, client_key=key)
    assert cached2 == {"data": 42}

    # 2. Resposta que não é JSON válido salva no banco (fallback {"message": body})
    key_text = str(uuid.uuid4())
    guard.check_or_start(endpoint=endpoint, payload={"type": "plain"}, client_key=key_text)
    guard.mark_completed(key=key_text, response_code=200, response_body="Plain text response")
    _, cached_text = guard.check_or_start(endpoint=endpoint, payload={"type": "plain"}, client_key=key_text)
    assert cached_text == {"message": "Plain text response"}

    # 3. Chave explícita com body vazio
    key_empty = str(uuid.uuid4())
    guard.check_or_start(endpoint=endpoint, payload={"type": "empty"}, client_key=key_empty)
    guard.repo.mark_completed(tenant_id=default_tenant.id, key=key_empty, response_code=204, response_body="")
    _, cached_empty = guard.check_or_start(endpoint=endpoint, payload={"type": "empty"}, client_key=key_empty)
    assert cached_empty == {}

    # 4. mark_failed
    key_fail = str(uuid.uuid4())
    guard.check_or_start(endpoint=endpoint, payload={"type": "fail"}, client_key=key_fail)
    guard.mark_failed(key=key_fail, error_message="Falha guard")
    rec = guard.repo.get_by_key(default_tenant.id, key_fail)
    assert rec.status == IdempotencyStatus.FAILED.value

    # 5. Deduplicação sem chave quando já existe requisição idêntica em PROCESSING
    hash_proc = compute_request_hash("POST", "/api/concurrent-auto", {"test": 99})
    guard.repo.create(key=f"auto-{hash_proc[:16]}", request_hash=hash_proc, endpoint="/api/concurrent-auto", tenant_id=default_tenant.id)
    with pytest.raises(IdempotencyProcessingError):
        guard.check_or_start(endpoint="/api/concurrent-auto", payload={"test": 99}, client_key=None)

    # 6. Deduplicação sem chave com payload texto simples no cache
    hash_txt = compute_request_hash("POST", "/api/auto-text", {"test": 100})
    rec_txt = guard.repo.create(key=f"auto-txt-{hash_txt[:16]}", request_hash=hash_txt, endpoint="/api/auto-text", tenant_id=default_tenant.id)
    guard.repo.mark_completed(tenant_id=default_tenant.id, key=rec_txt.key, response_code=200, response_body="Texto Simples")
    _, cached_auto_txt = guard.check_or_start(endpoint="/api/auto-text", payload={"test": 100}, client_key=None)
    assert cached_auto_txt == {"message": "Texto Simples"}


def test_idempotency_domain_abstract_repository():
    """Valida a classe abstrata IIdempotencyRepository."""
    from app.modules.idempotency.domain.repositories import IIdempotencyRepository

    class DummyRepo(IIdempotencyRepository):
        def get_by_key(self, tenant_id, key):
            return super().get_by_key(tenant_id, key)

        def save(self, record):
            return super().save(record)

        def mark_completed(self, tenant_id, key, response_code, response_body):
            return super().mark_completed(tenant_id, key, response_code, response_body)

        def mark_failed(self, tenant_id, key):
            return super().mark_failed(tenant_id, key)

    dummy = DummyRepo()
    u = uuid.uuid4()
    assert dummy.get_by_key(u, "k") is None
    assert dummy.save(None) is None
    assert dummy.mark_completed(u, "k", 200, "") is None
    assert dummy.mark_failed(u, "k") is None

