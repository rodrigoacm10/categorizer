from decimal import Decimal, ROUND_HALF_UP
from typing import Union

DEFAULT_SCALE = 1000  # 3 casas decimais

def to_scaled_int(val: Union[Decimal, float, str, int], scale: int = DEFAULT_SCALE) -> int:
    """Converte um valor decimal (ex: 2.500 ou '2,5') para inteiro escalado (ex: 2500)."""
    if val is None:
        return 0
    if isinstance(val, str):
        val = val.replace(",", ".").strip()
    d = Decimal(str(val))
    scaled = (d * Decimal(scale)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(scaled)

def from_scaled_int(val: int, scale: int = DEFAULT_SCALE) -> Decimal:
    """Converte um inteiro escalado (ex: 2500) de volta para Decimal (ex: 2.500)."""
    if val is None:
        return Decimal("0.000")
    d = (Decimal(val) / Decimal(scale)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    return d

def format_quantity_ptbr(val: int, scale: int = DEFAULT_SCALE) -> str:
    """Formata para exibição em português (ex: 2500 -> '2,5')."""
    d = from_scaled_int(val, scale)
    # Remove zeros irrelevantes à direita, mas mantém se for inteiro
    formatted = f"{d:f}".rstrip("0").rstrip(".") if "." in f"{d:f}" else f"{d:f}"
    return formatted.replace(".", ",")
