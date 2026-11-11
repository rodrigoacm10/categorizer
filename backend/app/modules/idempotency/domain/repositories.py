from abc import ABC, abstractmethod
from typing import Optional
from uuid import UUID

from app.modules.idempotency.domain.entities import IdempotencyRecord


class IIdempotencyRepository(ABC):
    @abstractmethod
    def get_by_key(self, tenant_id: UUID, key: str) -> Optional[IdempotencyRecord]:
        """Obtém um registro de idempotência pelo tenant_id e key."""
        pass

    @abstractmethod
    def save(self, record: IdempotencyRecord) -> None:
        """Salva ou atualiza um registro de idempotência."""
        pass

    @abstractmethod
    def mark_completed(
        self, tenant_id: UUID, key: str, response_code: int, response_body: str
    ) -> None:
        """Marca o registro de idempotência como COMPLETED com código e corpo de resposta."""
        pass

    @abstractmethod
    def mark_failed(self, tenant_id: UUID, key: str) -> None:
        """Marca o registro de idempotência como FAILED."""
        pass
