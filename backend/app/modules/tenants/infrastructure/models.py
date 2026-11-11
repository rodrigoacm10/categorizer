import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.shared.infrastructure.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class TenantRole(str, Enum):
    OWNER = "OWNER"
    GESTOR = "GESTOR"
    ALMOXARIFE = "ALMOXARIFE"
    AUDITOR = "AUDITOR"


class TenantModel(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    memberships = relationship(
        "TenantMembershipModel",
        back_populates="tenant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    created_by_user = relationship("UserModel", foreign_keys=[created_by_user_id])


class TenantMembershipModel(Base):
    __tablename__ = "tenant_memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(String(32), nullable=False, default=TenantRole.ALMOXARIFE.value)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    user = relationship("UserModel", back_populates="memberships")
    tenant = relationship("TenantModel", back_populates="memberships")

    __table_args__ = (
        UniqueConstraint("user_id", "tenant_id", name="uq_tenant_membership_user_tenant"),
        Index("ix_tenant_memberships_tenant_user", "tenant_id", "user_id"),
    )


Tenant = TenantModel
TenantMembership = TenantMembershipModel
