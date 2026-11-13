from datetime import datetime
from typing import Optional, List, Union
from uuid import UUID
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func

from app.modules.inventory.domain.entities import StockMovement
from app.modules.inventory.domain.repositories import IStockMovementRepository
from app.modules.inventory.infrastructure.models import StockMovementModel


class StockMovementRepository(IStockMovementRepository):
    """
    Repositório de movimentações contábeis do Livro-Razão (Append-Only Ledger).
    Disponibiliza unicamente operações de inserção (append) e consulta (list_by_product, list_all).
    Operações mutatórias (update/delete) são expressamente proibidas.
    """
    def __init__(self, db: Session):
        self.db = db

    def append(self, movement: Union[StockMovement, StockMovementModel]) -> StockMovementModel:
        """
        Adiciona um novo registro ao Ledger imutável.
        Aceita tanto entidade pura de domínio quanto modelo SQLAlchemy.
        """
        if isinstance(movement, StockMovementModel):
            model = movement
        else:
            model = StockMovementModel(
                id=movement.id,
                tenant_id=movement.tenant_id,
                product_id=movement.product_id,
                type=str(movement.type),
                quantity=movement.quantity,
                balance_after=movement.balance_after,
                reason=movement.reason,
                idempotency_key=movement.idempotency_key,
                created_at=movement.created_at,
            )
        self.db.add(model)
        self.db.flush()
        return model

    def list_by_product(
        self,
        tenant_id: UUID,
        product_id: Union[UUID, str],
        limit: int = 100,
        offset: int = 0,
    ) -> List[StockMovementModel]:
        """
        Consulta extrato cronológico decrescente de movimentações de um produto por tenant.
        """
        p_uuid = UUID(str(product_id)) if not isinstance(product_id, UUID) else product_id
        t_uuid = UUID(str(tenant_id)) if not isinstance(tenant_id, UUID) else tenant_id
        return (
            self.db.query(StockMovementModel)
            .options(selectinload(StockMovementModel.product))
            .filter(
                StockMovementModel.tenant_id == t_uuid,
                StockMovementModel.product_id == p_uuid,
            )
            .order_by(StockMovementModel.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def list_all(
        self,
        tenant_id: UUID,
        product_id: Optional[Union[UUID, str]] = None,
        movement_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = 100,
        offset: int = 0,
    ) -> List[StockMovementModel]:
        """
        Consulta geral do Livro-Razão paginada com filtros por tenant, produto, tipo e período.
        Ordenação padrão estrita: cronológica decrescente (created_at DESC).
        """
        t_uuid = UUID(str(tenant_id)) if not isinstance(tenant_id, UUID) else tenant_id
        query = (
            self.db.query(StockMovementModel)
            .options(selectinload(StockMovementModel.product))
            .filter(StockMovementModel.tenant_id == t_uuid)
        )

        if product_id is not None:
            p_uuid = UUID(str(product_id)) if not isinstance(product_id, UUID) else product_id
            query = query.filter(StockMovementModel.product_id == p_uuid)

        if movement_type is not None:
            query = query.filter(StockMovementModel.type == str(movement_type).strip().upper())

        if start_date is not None:
            query = query.filter(StockMovementModel.created_at >= start_date)

        if end_date is not None:
            query = query.filter(StockMovementModel.created_at <= end_date)

        query = query.order_by(StockMovementModel.created_at.desc())
        if offset:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)

        return query.all()

    def count_movements(
        self,
        tenant_id: UUID,
        product_id: Optional[Union[UUID, str]] = None,
        movement_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> int:
        """
        Contabiliza total de movimentações contábeis do tenant com filtros opcionais.
        """
        t_uuid = UUID(str(tenant_id)) if not isinstance(tenant_id, UUID) else tenant_id
        query = (
            self.db.query(func.count(StockMovementModel.id))
            .filter(StockMovementModel.tenant_id == t_uuid)
        )

        if product_id is not None:
            p_uuid = UUID(str(product_id)) if not isinstance(product_id, UUID) else product_id
            query = query.filter(StockMovementModel.product_id == p_uuid)

        if movement_type is not None:
            query = query.filter(StockMovementModel.type == str(movement_type).strip().upper())

        if start_date is not None:
            query = query.filter(StockMovementModel.created_at >= start_date)

        if end_date is not None:
            query = query.filter(StockMovementModel.created_at <= end_date)

        return query.scalar() or 0

    def count_movements_since(self, tenant_id: UUID, since: datetime) -> int:
        """
        Contabiliza total de movimentações contábeis do tenant desde o timestamp informado (ex: últimas 24h).
        Utiliza o índice composto ix_stock_movements_tenant_created para execução otimizada.
        """
        t_uuid = UUID(str(tenant_id)) if not isinstance(tenant_id, UUID) else tenant_id
        return (
            self.db.query(func.count(StockMovementModel.id))
            .filter(
                StockMovementModel.tenant_id == t_uuid,
                StockMovementModel.created_at >= since,
            )
            .scalar()
            or 0
        )

    def get_reconciliation_summary(self, tenant_id: UUID) -> List[dict]:
        """
        Executa agregação SQL atômica no banco calculando a soma dos deltas de stock_movements
        por produto para o tenant_id ativo e confrontando com current_quantity de products.
        """
        from app.modules.products.infrastructure.models import ProductModel
        t_uuid = UUID(str(tenant_id)) if not isinstance(tenant_id, UUID) else tenant_id

        rows = (
            self.db.query(
                ProductModel.id.label("product_id"),
                ProductModel.name.label("product_name"),
                ProductModel.current_quantity.label("current_quantity_scaled"),
                func.coalesce(func.sum(StockMovementModel.quantity), 0).label("expected_quantity_scaled"),
            )
            .outerjoin(
                StockMovementModel,
                (StockMovementModel.product_id == ProductModel.id)
                & (StockMovementModel.tenant_id == t_uuid),
            )
            .filter(ProductModel.tenant_id == t_uuid)
            .group_by(ProductModel.id, ProductModel.name, ProductModel.current_quantity)
            .order_by(ProductModel.name.asc())
            .all()
        )

        return [
            {
                "product_id": r.product_id,
                "product_name": r.product_name,
                "current_quantity_scaled": r.current_quantity_scaled,
                "expected_quantity_scaled": r.expected_quantity_scaled,
            }
            for r in rows
        ]

    def update(self, *args, **kwargs):
        raise NotImplementedError("Operações de UPDATE são terminantemente proibidas no Livro-Razão imutável.")

    def delete(self, *args, **kwargs):
        raise NotImplementedError("Operações de DELETE são terminantemente proibidas no Livro-Razão imutável.")
