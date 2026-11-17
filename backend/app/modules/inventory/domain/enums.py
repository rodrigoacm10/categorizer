from enum import Enum


class MovementType(str, Enum):
    IN = "IN"                          # Entrada física (+ delta)
    OUT = "OUT"                        # Saída física (- delta)
    ADJUSTMENT = "ADJUSTMENT"          # Ajuste de inventário físico (+ ou - delta)
    PRODUCT_DELETED = "PRODUCT_DELETED"# Evento de inativação de produto (delta = 0)
