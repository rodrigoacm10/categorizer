from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID


@dataclass
class User:
    id: UUID
    email: str
    password_hash: str
    full_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
