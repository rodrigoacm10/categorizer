from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID, uuid4


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Category:
    name: str
    tenant_id: UUID
    id: UUID = field(default_factory=uuid4)
    description: Optional[str] = None
    color: Optional[str] = "#3B82F6"
    created_at: datetime = field(default_factory=utc_now)


@dataclass
class Product:
    name: str
    tenant_id: UUID
    unit: str = "UN"
    current_quantity: int = 0
    min_stock: Optional[int] = None
    id: UUID = field(default_factory=uuid4)
    description: Optional[str] = None
    is_active: bool = True
    categories: List[Category] = field(default_factory=list)
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)
    deleted_at: Optional[datetime] = None

    def __post_init__(self):
        if self.unit:
            self.unit = self.unit.strip().upper()
        if self.name:
            self.name = self.name.strip()

    def is_low_stock(self) -> bool:
        """
        Retorna True se houver min_stock definido e current_quantity for menor ou igual ao estoque mínimo.
        """
        if self.min_stock is not None and self.current_quantity <= self.min_stock:
            return True
        return False

    def deactivate(self, reason: Optional[str] = None) -> None:
        """
        Inativa logicamente o produto (soft-delete) registrando o timestamp de exclusão.
        """
        self.is_active = False
        self.deleted_at = utc_now()
        self.updated_at = utc_now()
