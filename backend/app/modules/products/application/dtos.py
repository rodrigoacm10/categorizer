from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List, Union
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.shared.utils.scale import to_scaled_int, from_scaled_int


def format_quantity_with_unit(raw_qty: int, unit: str) -> str:
    qty_float = raw_qty / 1000.0
    formatted_num = f"{abs(qty_float):,.3f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if qty_float < 0:
        formatted_num = f"-{formatted_num}"
    clean_unit = unit.strip().upper() if unit else "UN"
    return f"{formatted_num} {clean_unit}"


class CategoryBaseDto(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    color: str = Field(default="#3B82F6", max_length=20)

    @field_validator("name")
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("O nome da categoria é obrigatório.")
        return v.strip()


class CategoryCreateDto(CategoryBaseDto):
    pass


class CategoryResponseDto(CategoryBaseDto):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    products_count: int = 0

    @field_validator("id", mode="before")
    @classmethod
    def coerce_uuid_to_str(cls, v):
        return str(v) if v is not None else v


CategoryCreateDTO = CategoryCreateDto
CategoryResponseDTO = CategoryResponseDto


class ProductCreateDto(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    unit: str = Field(default="UN", max_length=10)
    initial_quantity: Optional[Union[Decimal, float, str, int]] = 0
    min_stock: Optional[Union[Decimal, float, str, int]] = None
    category_ids: List[str] = Field(default_factory=list)

    @field_validator("name")
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("O nome do produto é obrigatório.")
        return v.strip()

    @field_validator("unit")
    def validate_unit(cls, v: str) -> str:
        if not v or not v.strip():
            return "UN"
        return v.strip().upper()

    @field_validator("category_ids", mode="before")
    def coerce_category_ids(cls, v):
        if v is None:
            return []
        return [str(item) for item in v]

    @property
    def min_stock_raw(self) -> Optional[int]:
        if self.min_stock is None:
            return None
        return to_scaled_int(self.min_stock)

    @property
    def initial_quantity_raw(self) -> int:
        if self.initial_quantity is None:
            return 0
        return to_scaled_int(self.initial_quantity)


class ProductUpdateDto(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    min_stock: Optional[Union[Decimal, float, str, int]] = None
    category_ids: Optional[List[str]] = None

    @field_validator("name")
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("O nome do produto não pode ser vazio.")
            return v.strip()
        return v

    @field_validator("unit")
    def validate_unit(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return v.strip().upper()
        return v

    @field_validator("category_ids", mode="before")
    def coerce_category_ids(cls, v):
        if v is None:
            return None
        return [str(item) for item in v]

    @property
    def min_stock_raw(self) -> Optional[int]:
        if self.min_stock is None:
            return None
        return to_scaled_int(self.min_stock)


class ProductResponseDto(BaseModel):
    id: str
    name: str
    description: Optional[str]
    unit: str
    current_quantity: float
    current_quantity_raw: int
    current_quantity_scaled: int
    formatted_quantity: str
    min_stock: Optional[float]
    min_stock_raw: Optional[int]
    min_stock_scaled: Optional[int]
    is_low_stock: bool
    is_active: bool
    categories: List[CategoryResponseDto]
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    @classmethod
    def from_orm_model(cls, product) -> "ProductResponseDto":
        raw_qty = int(product.current_quantity or 0)
        qty_float = float(from_scaled_int(raw_qty))
        raw_min = int(product.min_stock) if product.min_stock is not None else None
        min_float = float(from_scaled_int(raw_min)) if raw_min is not None else None

        is_low = False
        if raw_min is not None and raw_qty <= raw_min:
            is_low = True

        categories_dto = [
            CategoryResponseDto.model_validate(c)
            for c in (product.categories or [])
        ]

        formatted = format_quantity_with_unit(raw_qty, product.unit)

        return cls(
            id=str(product.id),
            name=product.name,
            description=product.description,
            unit=product.unit,
            current_quantity=qty_float,
            current_quantity_raw=raw_qty,
            current_quantity_scaled=raw_qty,
            formatted_quantity=formatted,
            min_stock=min_float,
            min_stock_raw=raw_min,
            min_stock_scaled=raw_min,
            is_low_stock=is_low,
            is_active=bool(product.is_active),
            categories=categories_dto,
            created_at=product.created_at,
            updated_at=product.updated_at,
            deleted_at=product.deleted_at,
        )


ProductCreateDTO = ProductCreateDto
ProductUpdateDTO = ProductUpdateDto
ProductResponseDTO = ProductResponseDto
