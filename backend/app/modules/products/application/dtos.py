from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List, Union
from datetime import datetime
from decimal import Decimal
from app.shared.utils.scale import to_scaled_int, from_scaled_int

class CategoryBaseDto(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    color: str = Field(default="#3B82F6", max_length=20)

class CategoryCreateDto(CategoryBaseDto):
    pass

class CategoryResponseDto(CategoryBaseDto):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime

class ProductCreateDto(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    unit: str = Field(default="UN", max_length=10)
    initial_quantity: Optional[Union[Decimal, float, str, int]] = 0
    min_stock: Optional[Union[Decimal, float, str, int]] = None
    category_ids: List[str] = Field(default_factory=list)

    @field_validator("name")
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("O nome do produto é obrigatório")
        return v.strip()

class ProductUpdateDto(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    min_stock: Optional[Union[Decimal, float, str, int]] = None
    category_ids: Optional[List[str]] = None

class ProductResponseDto(BaseModel):
    id: str
    name: str
    description: Optional[str]
    unit: str
    current_quantity: Decimal
    current_quantity_scaled: int
    min_stock: Optional[Decimal]
    min_stock_scaled: Optional[int]
    is_low_stock: bool
    is_active: bool
    categories: List[CategoryResponseDto]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_model(cls, product) -> "ProductResponseDto":
        qty = from_scaled_int(product.current_quantity)
        min_qty = from_scaled_int(product.min_stock) if product.min_stock is not None else None
        is_low = False
        if product.min_stock is not None and product.current_quantity <= product.min_stock:
            is_low = True

        return cls(
            id=product.id,
            name=product.name,
            description=product.description,
            unit=product.unit,
            current_quantity=qty,
            current_quantity_scaled=product.current_quantity,
            min_stock=min_qty,
            min_stock_scaled=product.min_stock,
            is_low_stock=is_low,
            is_active=product.is_active,
            categories=[CategoryResponseDto.model_validate(c) for c in product.categories],
            created_at=product.created_at,
            updated_at=product.updated_at
        )
