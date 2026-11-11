from typing import Optional, Union, Callable
from uuid import UUID
from sqlalchemy.orm import Session

from app.shared.infrastructure.database import SessionLocal
from app.modules.products.infrastructure.models import ProductModel
from app.modules.products.infrastructure.repositories import ProductRepository
from app.modules.inventory.infrastructure.repositories import StockMovementRepository


class InventoryUnitOfWork:
    """
    Gerenciador transacional com isolamento estrito por tenant e bloqueio pessimista (SELECT ... FOR UPDATE).
    Garante atomicidade (ACID) entre a atualização do saldo físico do produto e a inserção no Ledger imutável.
    """
    def __init__(self, session_factory_or_session: Optional[Union[Session, Callable[[], Session]]] = None):
        if isinstance(session_factory_or_session, Session):
            self.session = session_factory_or_session
            self.session_factory = None
            self._close_on_exit = False
            self.products = ProductRepository(self.session)
            self.movements = StockMovementRepository(self.session)
        elif callable(session_factory_or_session):
            self.session_factory = session_factory_or_session
            self.session = None
            self._close_on_exit = True
            self.products = None
            self.movements = None
        else:
            self.session_factory = SessionLocal
            self.session = None
            self._close_on_exit = True
            self.products = None
            self.movements = None

    def __enter__(self) -> "InventoryUnitOfWork":
        if self.session is None and self.session_factory:
            self.session = self.session_factory()
            self.products = ProductRepository(self.session)
            self.movements = StockMovementRepository(self.session)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type:
                self.rollback()
            else:
                self.commit()
        finally:
            if self._close_on_exit and self.session:
                self.session.close()

    def commit(self):
        if self.session:
            self.session.commit()

    def rollback(self):
        if self.session:
            self.session.rollback()

    def get_product_for_update(
        self,
        tenant_id_or_product_id: Union[UUID, str],
        product_id: Optional[Union[UUID, str]] = None,
        tenant_id: Optional[Union[UUID, str]] = None,
        include_inactive: bool = False,
    ) -> Optional[ProductModel]:
        """
        Bloqueia exclusivamente a linha do produto no PostgreSQL (SELECT ... FOR UPDATE)
        serializando quaisquer operações concorrentes de alteração de estoque até o encerramento da transação.
        Suporta chamadas no formato (tenant_id, product_id) ou (product_id).
        """
        if product_id is not None:
            t_uuid = UUID(str(tenant_id_or_product_id)) if not isinstance(tenant_id_or_product_id, UUID) else tenant_id_or_product_id
            p_uuid = UUID(str(product_id)) if not isinstance(product_id, UUID) else product_id
        else:
            p_uuid = UUID(str(tenant_id_or_product_id)) if not isinstance(tenant_id_or_product_id, UUID) else tenant_id_or_product_id
            t_uuid = UUID(str(tenant_id)) if tenant_id and not isinstance(tenant_id, UUID) else None

        query = self.session.query(ProductModel).filter(ProductModel.id == p_uuid)
        if t_uuid is not None:
            query = query.filter(ProductModel.tenant_id == t_uuid)
        if not include_inactive:
            query = query.filter(ProductModel.is_active == True)

        return query.with_for_update().first()
