from sqlalchemy import Column, String, BigInteger, Boolean, Text, DateTime, ForeignKey, Table, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from app.shared.infrastructure.database import Base


def utc_now():
    return datetime.now(timezone.utc)


# Tabela associativa Muitos-para-Muitos (N:N)
product_categories = Table(
    "product_categories",
    Base.metadata,
    Column("product_id", UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True)
)


class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), default="#3B82F6")  # Cor hex para tags e badges
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    products = relationship("Product", secondary=product_categories, back_populates="categories")
    tenant = relationship("TenantModel")

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_categories_tenant_name"),
    )


CategoryModel = Category


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    unit = Column(String(10), default="UN", nullable=False)  # UN, KG, L, M, CX, etc.
    
    # Quantidades armazenadas como INTEIROS ESCALADOS (x1000) para precisão absoluta
    current_quantity = Column(BigInteger, default=0, nullable=False)
    min_stock = Column(BigInteger, nullable=True)  # Estoque mínimo para alerta visual
    
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    categories = relationship("Category", secondary=product_categories, back_populates="products")
    # Histórico contábil do Ledger imutável e perene (cascade delete removido)
    movements = relationship("StockMovement", back_populates="product")
    tenant = relationship("TenantModel")

    __table_args__ = (
        Index("ix_products_tenant_active", "tenant_id", "is_active"),
    )


ProductModel = Product
