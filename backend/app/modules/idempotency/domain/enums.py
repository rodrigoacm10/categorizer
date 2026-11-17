from enum import Enum


class IdempotencyStatus(str, Enum):
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

    # Alias para retrocompatibilidade
    RESOLVED = "COMPLETED"
