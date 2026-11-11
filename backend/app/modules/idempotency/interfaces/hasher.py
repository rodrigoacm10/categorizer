import hashlib
import json
from typing import Any, Optional


def canonical_json(payload: Any) -> str:
    """
    Normaliza dados/payload para uma string JSON canônica e determinística:
    - Ordenação alfabética recursiva de chaves (sort_keys=True).
    - Remoção de espaços em branco supérfluos (separators=(',', ':')).
    - Suporte a dicionários, listas, valores escalares e objetos com str().
    - Invariante a quebras de linha e ordem de propriedades.
    """
    if payload is None:
        return ""
    if isinstance(payload, str):
        payload_str = payload.strip()
        if not payload_str:
            return ""
        try:
            parsed = json.loads(payload_str)
            return json.dumps(parsed, sort_keys=True, separators=(",", ":"), default=str)
        except Exception:
            return payload_str
    if isinstance(payload, bytes):
        try:
            parsed = json.loads(payload.decode("utf-8"))
            return json.dumps(parsed, sort_keys=True, separators=(",", ":"), default=str)
        except Exception:
            return payload.decode("utf-8", errors="replace")
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def compute_request_hash(
    method_or_endpoint: str,
    path_or_payload: Any = None,
    payload: Any = None,
) -> str:
    """
    Gera o digest SHA-256 hexadecimal estável de 64 caracteres:
    SHA256(METHOD + '|' + PATH + '|' + canonical_payload)

    Suporta assinaturas:
    1. compute_request_hash(method, path, payload) -> Padrão canônico RFC 9474
    2. compute_request_hash(endpoint, payload) -> Retrocompatibilidade
    """
    http_methods = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}
    if payload is not None or (
        isinstance(method_or_endpoint, str) and method_or_endpoint.upper() in http_methods
    ):
        method = method_or_endpoint.upper().strip()
        path = str(path_or_payload or "").strip()
        body = payload
    else:
        # Modo de retrocompatibilidade: compute_request_hash(endpoint, payload)
        method = "POST"
        path = str(method_or_endpoint).strip()
        body = path_or_payload

    canonical_body = canonical_json(body)
    raw = f"{method}|{path}|{canonical_body}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
