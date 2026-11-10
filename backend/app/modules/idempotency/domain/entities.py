from enum import Enum

class IdempotencyStatus(str, Enum):
    PROCESSING = "PROCESSING"
    RESOLVED = "RESOLVED"
    FAILED = "FAILED"
