from sqlalchemy import Column, String, BigInteger, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from app.shared.infrastructure.database import Base

def utc_now():
    return datetime.now(timezone.utc)

def generate_uuid():
    return str(uuid.uuid4())

class StockMovement(Base):
    """
    Livro-Razão (Ledger) imutável de movimentações de estoque.
    Nenhum registro nesta tabela pode ser alterado ou removido.
    """
    __tablename__ = "stock_movements"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_id = Column(String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # IN (Entrada), OUT (Saída), ADJUSTMENT (Ajuste), PRODUCT_DELETED (Registro de remoção)
    type = Column(String(32), nullable=False)
    
    # Delta em escala x1000 (positivo para entrada, negativo para saída)
    quantity = Column(BigInteger, nullable=False)
    
    # Saldo resultante exato do produto após o movimento
    balance_after = Column(BigInteger, nullable=False)
    
    reason = Column(Text, nullable=True)
    idempotency_key = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)

    product = relationship("Product", back_populates="movements")
