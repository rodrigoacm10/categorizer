from sqlalchemy import Column, String, Integer, BigInteger, Boolean, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from app.shared.infrastructure.database import Base

def utc_now():
    return datetime.now(timezone.utc)

def generate_uuid():
    return str(uuid.uuid4())

# Tabela associativa Muitos-para-Muitos (N:N)
product_categories = Table(
    "product_categories",
    Base.metadata,
    Column("product_id", String(36), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", String(36), ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True)
)

class Category(Base):
    __tablename__ = "categories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    color = Column(String(20), default="#3B82F6")  # Cor hex para tags e badges
    created_at = Column(DateTime, default=utc_now, nullable=False)

    products = relationship("Product", secondary=product_categories, back_populates="categories")

class Product(Base):
    __tablename__ = "products"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    unit = Column(String(10), default="UN", nullable=False)  # UN, KG, L, M, CX, etc.
    
    # Quantidades armazenadas como INTEIROS ESCALADOS (x1000) para precisão absoluta
    current_quantity = Column(BigInteger, default=0, nullable=False)
    min_stock = Column(BigInteger, nullable=True)  # Estoque mínimo para alerta visual
    
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    categories = relationship("Category", secondary=product_categories, back_populates="products")
    movements = relationship("StockMovement", back_populates="product", cascade="all, delete-orphan")
