from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.modules.auth.infrastructure.models import UserModel


class SQLAlchemyUserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: UUID) -> Optional[UserModel]:
        return self.db.query(UserModel).filter(UserModel.id == user_id).first()

    def get_by_email(self, email: str) -> Optional[UserModel]:
        return self.db.query(UserModel).filter(UserModel.email == email.strip().lower()).first()

    def create(self, email: str, password_hash: str, full_name: str, is_active: bool = True) -> UserModel:
        user = UserModel(
            email=email.strip().lower(),
            password_hash=password_hash,
            full_name=full_name.strip(),
            is_active=is_active,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
