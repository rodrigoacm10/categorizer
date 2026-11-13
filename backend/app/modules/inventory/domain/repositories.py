from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from app.modules.inventory.domain.entities import StockMovement


class IStockMovementRepository(ABC):
    @abstractmethod
    def append(self, movement: StockMovement) -> StockMovement:
        """Adiciona um novo lançamento ao livro-razão imutável."""
        pass

    @abstractmethod
    def list_by_product(
        self,
        tenant_id: UUID,
        product_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> List[StockMovement]:
        """Consulta movimentações de um produto ordenadas cronologicamente decrescente."""
        pass

    @abstractmethod
    def list_all(
        self,
        tenant_id: UUID,
        product_id: Optional[UUID] = None,
        movement_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[StockMovement]:
        """Consulta histórico geral do livro-razão com filtros opcionais."""
        pass

    @abstractmethod
    def count_movements_since(self, tenant_id: UUID, since: datetime) -> int:
        """Contabiliza movimentações contábeis do tenant a partir de uma data específica."""
        pass

