from sqlalchemy import Column, String, BigInteger, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from app.shared.infrastructure.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class StockMovement(Base):
    """
    Livro-Razão (Ledger) imutável de movimentações de estoque.
    Nenhum registro nesta tabela pode ser alterado ou removido.
    """
    __tablename__ = "stock_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    # IN (Entrada), OUT (Saída), ADJUSTMENT (Ajuste), PRODUCT_DELETED (Registro de remoção)
    type = Column(String(32), nullable=False)
    
    # Delta em escala x1000 (positivo para entrada, negativo para saída)
    quantity = Column(BigInteger, nullable=False)
    
    # Saldo resultante exato do produto após o movimento
    balance_after = Column(BigInteger, nullable=False)
    
    reason = Column(Text, nullable=True)
    idempotency_key = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    product = relationship("Product", back_populates="movements")

StockMovementModel = StockMovement
