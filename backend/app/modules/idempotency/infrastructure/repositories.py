from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Optional
from app.modules.idempotency.infrastructure.models import IdempotencyRecord
from app.modules.idempotency.domain.entities import IdempotencyStatus

class IdempotencyRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_key(self, key: str) -> Optional[IdempotencyRecord]:
        return self.db.query(IdempotencyRecord).filter(IdempotencyRecord.key == key).first()

    def find_recent_by_hash(self, request_hash: str, endpoint: str, max_age_seconds: int = 10) -> Optional[IdempotencyRecord]:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=max_age_seconds)
        return self.db.query(IdempotencyRecord).filter(
            IdempotencyRecord.request_hash == request_hash,
            IdempotencyRecord.endpoint == endpoint,
            IdempotencyRecord.created_at >= cutoff
        ).first()

    def create(self, key: str, request_hash: str, endpoint: str) -> IdempotencyRecord:
        record = IdempotencyRecord(
            key=key,
            request_hash=request_hash,
            endpoint=endpoint,
            status=IdempotencyStatus.PROCESSING.value
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def resolve(self, key: str, response_code: int, response_body: str):
        record = self.get_by_key(key)
        if record:
            record.status = IdempotencyStatus.RESOLVED.value
            record.response_code = response_code
            record.response_body = response_body
            self.db.commit()

    def fail(self, key: str, error_message: str):
        record = self.get_by_key(key)
        if record:
            record.status = IdempotencyStatus.FAILED.value
            record.response_code = 400
            record.response_body = error_message
            self.db.commit()
