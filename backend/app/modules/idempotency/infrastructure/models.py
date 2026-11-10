from sqlalchemy import Column, String, Integer, Text, DateTime
from datetime import datetime, timezone
from app.shared.infrastructure.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"

    key = Column(String(255), primary_key=True, index=True)
    request_hash = Column(String(64), nullable=False, index=True)
    endpoint = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="PROCESSING")
    response_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

IdempotencyRecordModel = IdempotencyRecord
