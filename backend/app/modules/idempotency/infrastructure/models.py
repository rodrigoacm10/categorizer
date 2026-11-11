from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.shared.infrastructure.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        primary_key=True,
    )
    key = Column(String(255), primary_key=True, index=True)
    request_hash = Column(String(64), nullable=False, index=True)
    endpoint = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="PROCESSING")
    response_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    tenant = relationship("TenantModel")

    __table_args__ = (
        Index("ix_idempotency_records_tenant_id", "tenant_id"),
    )


IdempotencyRecordModel = IdempotencyRecord
