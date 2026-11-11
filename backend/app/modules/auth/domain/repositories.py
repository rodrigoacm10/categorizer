from abc import ABC, abstractmethod
from typing import Optional, List
from uuid import UUID
from app.modules.auth.domain.entities import User


class IUserRepository(ABC):
    @abstractmethod
    def get_by_id(self, user_id: UUID) -> Optional[User]:
        pass

    @abstractmethod
    def get_by_email(self, email: str) -> Optional[User]:
        pass

    @abstractmethod
    def create(self, user: User) -> User:
        pass
