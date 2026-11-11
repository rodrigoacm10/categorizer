from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.shared.infrastructure.database import Base
from app.modules.idempotency.domain.enums import IdempotencyStatus


def utc_now():
    return datetime.now(timezone.utc)


class IdempotencyRecordModel(Base):
    __tablename__ = "idempotency_records"

    key = Column(String(255), primary_key=True, index=True)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    request_hash = Column(String(64), nullable=False, index=True)
    endpoint = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default=IdempotencyStatus.PROCESSING.value)
    response_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    tenant = relationship("TenantModel")

    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_idempotency_tenant_key"),
        Index("ix_idempotency_records_tenant_id", "tenant_id"),
    )


# Retrocompatibilidade
IdempotencyRecord = IdempotencyRecordModel
