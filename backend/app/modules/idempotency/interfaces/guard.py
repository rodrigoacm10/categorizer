import hashlib
import json
from typing import Optional, Tuple
from fastapi import Header, HTTPException, status
from sqlalchemy.orm import Session
from app.modules.idempotency.infrastructure.repositories import IdempotencyRepository
from app.modules.idempotency.domain.entities import IdempotencyStatus

def compute_request_hash(endpoint: str, payload: dict) -> str:
    """Gera um hash SHA-256 estável do endpoint e payload da requisição."""
    serialized = json.dumps(payload, sort_keys=True, default=str)
    raw = f"{endpoint}:{serialized}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def check_or_start_idempotency(
    db: Session,
    endpoint: str,
    payload: dict,
    client_key: Optional[str] = None
) -> Tuple[str, Optional[dict]]:
    """
    Garante a idempotência pelo Backend:
    1. Se client_key foi enviada:
       - Se já existe RESOLVED e o hash bate: retorna (key, resposta_salva)
       - Se já existe RESOLVED mas o hash difere: lança 409 CONFLICT (fraude ou reuso indevido)
       - Se está PROCESSING: lança 409 CONFLICT (operação em andamento)
    2. Se client_key NÃO foi enviada:
       - O backend verifica deduplicação semântica por hash recente (evita double-click)
       - Se já tem idêntico recente: retorna a resposta salva
       - Senão: cria uma chave backend-generated com o hash
    """
    repo = IdempotencyRepository(db)
    request_hash = compute_request_hash(endpoint, payload)

    # 1. Caso com chave explícita
    if client_key:
        record = repo.get_by_key(client_key)
        if record:
            if record.request_hash != request_hash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Chave de Idempotência já utilizada com um payload diferente. Operação bloqueada pelo backend para evitar inconsistência."
                )
            if record.status == IdempotencyStatus.PROCESSING.value:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Esta operação já está sendo processada no momento. Aguarde alguns instantes."
                )
            if record.status == IdempotencyStatus.RESOLVED.value and record.response_body:
                # Retorna a resposta previamente salva (Cache HIT)
                try:
                    return client_key, json.loads(record.response_body)
                except Exception:
                    return client_key, {"message": record.response_body}
        
        # Chave nova: registrar como PROCESSING
        repo.create(client_key, request_hash, endpoint)
        return client_key, None

    # 2. Caso sem chave explícita: Backend faz a proteção semântica (anti-duplo clique)
    recent = repo.find_recent_by_hash(request_hash, endpoint, max_age_seconds=10)
    if recent and recent.status == IdempotencyStatus.RESOLVED.value and recent.response_body:
        try:
            return recent.key, json.loads(recent.response_body)
        except Exception:
            return recent.key, {"message": recent.response_body}

    backend_key = f"auto-{request_hash[:16]}-{int(datetime_now_timestamp())}"
    repo.create(backend_key, request_hash, endpoint)
    return backend_key, None

def datetime_now_timestamp() -> float:
    import time
    return time.time()
