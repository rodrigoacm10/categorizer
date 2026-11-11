from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID
from app.modules.idempotency.infrastructure.models import IdempotencyRecord
from app.modules.idempotency.domain.entities import IdempotencyStatus


class IdempotencyRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_key(self, key: str, tenant_id: Optional[UUID] = None) -> Optional[IdempotencyRecord]:
        q = self.db.query(IdempotencyRecord).filter(IdempotencyRecord.key == key)
        if tenant_id is not None:
            q = q.filter(IdempotencyRecord.tenant_id == tenant_id)
        return q.first()

    def find_recent_by_hash(
        self,
        request_hash: str,
        endpoint: str,
        max_age_seconds: int = 10,
        tenant_id: Optional[UUID] = None,
    ) -> Optional[IdempotencyRecord]:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=max_age_seconds)
        q = self.db.query(IdempotencyRecord).filter(
            IdempotencyRecord.request_hash == request_hash,
            IdempotencyRecord.endpoint == endpoint,
            IdempotencyRecord.created_at >= cutoff,
        )
        if tenant_id is not None:
            q = q.filter(IdempotencyRecord.tenant_id == tenant_id)
        return q.first()

    def create(
        self,
        key: str,
        request_hash: str,
        endpoint: str,
        tenant_id: Optional[UUID] = None,
    ) -> IdempotencyRecord:
        record = IdempotencyRecord(
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

    def resolve(self, key: str, response_code: int, response_body: str, tenant_id: Optional[UUID] = None):
        record = self.get_by_key(key, tenant_id=tenant_id)
        if record:
            record.status = IdempotencyStatus.RESOLVED.value
            record.response_code = response_code
            record.response_body = response_body
            self.db.commit()

    def fail(self, key: str, error_message: str, tenant_id: Optional[UUID] = None):
        record = self.get_by_key(key, tenant_id=tenant_id)
        if record:
            record.status = IdempotencyStatus.FAILED.value
            record.response_code = 400
            record.response_body = error_message
            self.db.commit()
