import json
import time
from typing import Optional, Tuple, Any
from uuid import UUID
from sqlalchemy.orm import Session

from app.modules.idempotency.domain.enums import IdempotencyStatus
from app.modules.idempotency.infrastructure.repositories import SqlAlchemyIdempotencyRepository
from app.modules.idempotency.interfaces.hasher import compute_request_hash
from app.shared.domain.exceptions import (
    IdempotencyConflictError,
    IdempotencyProcessingError,
)


def datetime_now_timestamp() -> float:
    return time.time()


def check_or_start_idempotency(
    db: Session,
    endpoint: str,
    payload: Any,
    client_key: Optional[str] = None,
    tenant_id: Optional[UUID] = None,
    method: str = "POST",
) -> Tuple[str, Optional[dict]]:
    """
    Garante a idempotência pelo Backend com escopo estrito por tenant (RFC 9474):
    1. Se client_key foi enviada:
       - Se já existe COMPLETED e o hash bate: retorna (key, resposta_salva) -> Cache HIT
       - Se já existe com hash divergente: lança 409 Conflict (IdempotencyConflictError)
       - Se está PROCESSING: lança 409 Conflict (IdempotencyProcessingError)
       - Se está FAILED: permite retry, atualizando para PROCESSING
       - Se não existe: cria novo registro como PROCESSING e retorna (key, None) -> Cache MISS
    2. Se client_key NÃO foi enviada:
       - O backend verifica deduplicação semântica temporal por hash recente (janela de 10s)
       - Se já tem idêntico recente em PROCESSING: lança 409 Conflict
       - Se já tem idêntico recente COMPLETED: retorna resposta salva -> Cache HIT
       - Senão: cria uma chave backend-generated com o hash
    """
    repo = SqlAlchemyIdempotencyRepository(db)
    request_hash = compute_request_hash(method, endpoint, payload)

    # 1. Caso com chave explícita do cliente
    if client_key:
        record = repo.get_by_key(tenant_id=tenant_id, key=client_key)
        if record:
            # Operação em andamento
            if record.status == IdempotencyStatus.PROCESSING.value:
                raise IdempotencyProcessingError(
                    detail="Esta operação já está sendo processada no momento. Aguarde alguns instantes.",
                    instance=endpoint,
                )

            # Falha anterior permite nova tentativa legítima com a mesma chave (RFC 9474)
            if record.status == IdempotencyStatus.FAILED.value:
                record.status = IdempotencyStatus.PROCESSING.value
                record.request_hash = request_hash
                record.endpoint = endpoint
                record.response_code = None
                record.response_body = None
                db.commit()
                db.refresh(record)
                return client_key, None

            # Chave já consumida: valida integridade do hash
            if record.request_hash != request_hash:
                raise IdempotencyConflictError(
                    detail="Chave de Idempotência já utilizada com um payload diferente. Operação bloqueada pelo backend para evitar inconsistência.",
                    instance=endpoint,
                )

            # Replay de resposta arquivada (Cache HIT)
            if record.status in (IdempotencyStatus.COMPLETED.value, IdempotencyStatus.RESOLVED.value):
                if record.response_body:
                    try:
                        return client_key, json.loads(record.response_body)
                    except Exception:
                        return client_key, {"message": record.response_body}
                return client_key, {}

        # Chave nova: registrar como PROCESSING
        repo.create(
            key=client_key,
            request_hash=request_hash,
            endpoint=endpoint,
            tenant_id=tenant_id,
        )
        return client_key, None

    # 2. Caso sem chave explícita: Proteção semântica temporal (anti-duplo clique)
    recent = repo.find_recent_by_hash(
        request_hash=request_hash,
        endpoint=endpoint,
        max_age_seconds=10,
        tenant_id=tenant_id,
    )
    if recent:
        if recent.status == IdempotencyStatus.PROCESSING.value:
            raise IdempotencyProcessingError(
                detail="Esta operação já está sendo processada no momento. Aguarde alguns instantes.",
                instance=endpoint,
            )
        if recent.status in (IdempotencyStatus.COMPLETED.value, IdempotencyStatus.RESOLVED.value) and recent.response_body:
            try:
                return recent.key, json.loads(recent.response_body)
            except Exception:
                return recent.key, {"message": recent.response_body}

    backend_key = f"auto-{request_hash[:16]}-{int(time.time() * 1000)}"
    repo.create(
        key=backend_key,
        request_hash=request_hash,
        endpoint=endpoint,
        tenant_id=tenant_id,
    )
    return backend_key, None


class IdempotencyGuard:
    """
    Guard/Dependency de Idempotência com contexto de tenant e ciclo de vida completo.
    """

    def __init__(self, db: Session, tenant_id: Optional[UUID] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.repo = SqlAlchemyIdempotencyRepository(db)

    def check_or_start(
        self,
        endpoint: str,
        payload: Any,
        client_key: Optional[str] = None,
        method: str = "POST",
    ) -> Tuple[str, Optional[dict]]:
        return check_or_start_idempotency(
            db=self.db,
            endpoint=endpoint,
            payload=payload,
            client_key=client_key,
            tenant_id=self.tenant_id,
            method=method,
        )

    def mark_completed(
        self,
        key: str,
        response_code: int,
        response_body: Any,
    ) -> None:
        body_str = (
            response_body
            if isinstance(response_body, str)
            else json.dumps(response_body, default=str)
        )
        self.repo.mark_completed(
            tenant_id=self.tenant_id,
            key=key,
            response_code=response_code,
            response_body=body_str,
        )

    def mark_failed(self, key: str, error_message: str = "") -> None:
        self.repo.mark_failed(
            tenant_id=self.tenant_id,
            key=key,
            error_message=error_message,
        )
