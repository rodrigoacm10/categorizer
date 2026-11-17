from uuid import UUID
from typing import Optional
from fastapi import status
from app.shared.domain.exceptions import ProblemDetailsException
from app.shared.utils.scale import from_scaled_int


class InsufficientStockError(ProblemDetailsException):
    def __init__(
        self,
        product_id: UUID,
        current: int,
        requested: int,
        unit: str = "UN",
        detail: Optional[str] = None,
        instance: Optional[str] = None,
    ):
        self.product_id = product_id
        self.current = current
        self.requested = requested
        self.unit = unit
        if not detail:
            detail = (
                f"Saldo insuficiente para o produto '{product_id}'. "
                f"Saldo disponível: {from_scaled_int(current)} {unit}, "
                f"solicitado para saída: {from_scaled_int(requested)} {unit}."
            )
        super().__init__(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            type_suffix="insufficient-stock",
            title="Saldo Insuficiente",
            detail=detail,
            instance=instance,
        )


class InvalidMovementError(ProblemDetailsException):
    def __init__(
        self,
        detail: str = "Movimentação de estoque inválida.",
        instance: Optional[str] = None,
    ):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            type_suffix="invalid-movement",
            title="Movimentação Inválida",
            detail=detail,
            instance=instance,
        )
