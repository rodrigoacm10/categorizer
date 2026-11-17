from abc import ABC, abstractmethod
from typing import Optional, List, Union, Dict
from uuid import UUID

from app.modules.products.domain.entities import Product, Category


class ICategoryRepository(ABC):
    @abstractmethod
    def get_by_id(self, category_id: UUID, tenant_id: UUID) -> Optional[Category]:
        pass

    @abstractmethod
    def get_by_name(self, name: str, tenant_id: UUID) -> Optional[Category]:
        pass

    @abstractmethod
    def list(self, tenant_id: UUID) -> List[Category]:
        pass

    @abstractmethod
    def get_products_count_by_category(self, tenant_id: UUID) -> Dict[UUID, int]:
        pass

    @abstractmethod
    def create(self, category: Category) -> Category:
        pass

    @abstractmethod
    def delete(self, category_id: UUID, tenant_id: UUID) -> bool:
        pass


class IProductRepository(ABC):
    @abstractmethod
    def get_by_id(self, product_id: UUID, tenant_id: UUID, include_inactive: bool = False) -> Optional[Product]:
        pass

    @abstractmethod
    def get_by_name(self, name: str, tenant_id: UUID, is_active: Optional[bool] = True) -> Optional[Product]:
        pass

    @abstractmethod
    def lookup(self, code: str, tenant_id: UUID) -> Optional[Product]:
        pass

    @abstractmethod
    def list(
        self,
        tenant_id: UUID,
        category_id: Optional[Union[UUID, str, List[Union[UUID, str]]]] = None,
        low_stock_only: bool = False,
        search: Optional[str] = None,
        include_inactive: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Product]:
        pass

    @abstractmethod
    def count(
        self,
        tenant_id: UUID,
        category_id: Optional[Union[UUID, str, List[Union[UUID, str]]]] = None,
        low_stock_only: bool = False,
        search: Optional[str] = None,
        include_inactive: bool = False,
    ) -> int:
        pass

    @abstractmethod
    def create(self, product: Product) -> Product:
        pass

    @abstractmethod
    def update(self, product: Product) -> Product:
        pass

    @abstractmethod
    def soft_delete(self, product_id: UUID, tenant_id: UUID, reason: Optional[str] = None) -> bool:
        pass
