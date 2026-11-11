from datetime import datetime, timezone, timedelta
from typing import Optional, Union, Any
from uuid import UUID
from sqlalchemy.orm import Session

from app.modules.idempotency.domain.entities import IdempotencyRecord
from app.modules.idempotency.domain.enums import IdempotencyStatus
from app.modules.idempotency.domain.repositories import IIdempotencyRepository
from app.modules.idempotency.infrastructure.models import IdempotencyRecordModel


class SqlAlchemyIdempotencyRepository(IIdempotencyRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_key(
        self,
        tenant_id: Any,
        key: Optional[str] = None,
    ) -> Optional[IdempotencyRecordModel]:
        """
        Permite consulta por (tenant_id: UUID, key: str) ou (key: str, tenant_id: Optional[UUID] = None).
        """
        if key is None:
            actual_key = str(tenant_id)
            actual_tenant_id = None
        else:
            if isinstance(key, UUID):
                actual_tenant_id = key
                actual_key = str(tenant_id)
            elif isinstance(tenant_id, UUID):
                actual_tenant_id = tenant_id
                actual_key = str(key)
            elif tenant_id is None:
                actual_tenant_id = None
                actual_key = str(key)
            else:
                try:
                    actual_tenant_id = UUID(str(tenant_id))
                except (ValueError, AttributeError):
                    return None
                actual_key = str(key)

        q = self.db.query(IdempotencyRecordModel).filter(IdempotencyRecordModel.key == actual_key)
        if actual_tenant_id is not None:
            q = q.filter(IdempotencyRecordModel.tenant_id == actual_tenant_id)
        return q.first()

    def save(self, record: Union[IdempotencyRecord, IdempotencyRecordModel]) -> None:
        if isinstance(record, IdempotencyRecordModel):
            model = record
            if model not in self.db:
                self.db.add(model)
        else:
            model = self.get_by_key(tenant_id=record.tenant_id, key=record.key)
            if not model:
                model = IdempotencyRecordModel(
                    key=record.key,
                    tenant_id=record.tenant_id,
                    request_hash=record.request_hash,
                    endpoint=record.endpoint,
                    status=record.status.value if hasattr(record.status, "value") else str(record.status),
                    response_code=record.response_code,
                    response_body=record.response_body,
                )
                self.db.add(model)
            else:
                model.status = record.status.value if hasattr(record.status, "value") else str(record.status)
                model.response_code = record.response_code
                model.response_body = record.response_body
                model.request_hash = record.request_hash
                model.endpoint = record.endpoint
        self.db.commit()
        self.db.refresh(model)

    def mark_completed(
        self,
        tenant_id: Optional[UUID],
        key: str,
        response_code: int,
        response_body: str,
    ) -> None:
        record = self.get_by_key(tenant_id=tenant_id, key=key)
        if record:
            record.status = IdempotencyStatus.COMPLETED.value
            record.response_code = response_code
            record.response_body = response_body
            self.db.commit()
            self.db.refresh(record)

    def mark_failed(
        self,
        tenant_id: Optional[UUID],
        key: str,
        error_message: Optional[str] = None,
    ) -> None:
        record = self.get_by_key(tenant_id=tenant_id, key=key)
        if record:
            record.status = IdempotencyStatus.FAILED.value
            if error_message is not None:
                record.response_body = error_message
            self.db.commit()
            self.db.refresh(record)

    def resolve(
        self,
        key: str,
        response_code: int,
        response_body: str,
        tenant_id: Optional[UUID] = None,
    ) -> None:
        """Compatibilidade com implementações existentes."""
        self.mark_completed(
            tenant_id=tenant_id,
            key=key,
            response_code=response_code,
            response_body=response_body,
        )

    def fail(
        self,
        key: str,
        error_message: str = "",
        tenant_id: Optional[UUID] = None,
    ) -> None:
        """Compatibilidade com implementações existentes."""
        self.mark_failed(
            tenant_id=tenant_id,
            key=key,
            error_message=error_message,
        )

    def create(
        self,
        key: str,
        request_hash: str,
        endpoint: str,
        tenant_id: Optional[UUID] = None,
    ) -> IdempotencyRecordModel:
        record = IdempotencyRecordModel(
            key=key,
            tenant_id=tenant_id,
            request_hash=request_hash,
            endpoint=endpoint,
            status=IdempotencyStatus.PROCESSING.value,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def find_recent_by_hash(
        self,
        request_hash: str,
        endpoint: str,
        max_age_seconds: int = 10,
        tenant_id: Optional[UUID] = None,
    ) -> Optional[IdempotencyRecordModel]:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=max_age_seconds)
        q = self.db.query(IdempotencyRecordModel).filter(
            IdempotencyRecordModel.request_hash == request_hash,
            IdempotencyRecordModel.endpoint == endpoint,
            IdempotencyRecordModel.created_at >= cutoff,
        )
        if tenant_id is not None:
            q = q.filter(IdempotencyRecordModel.tenant_id == tenant_id)
        return q.first()


# Retrocompatibilidade
IdempotencyRepository = SqlAlchemyIdempotencyRepository
