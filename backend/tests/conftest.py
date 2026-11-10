import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Garante que backend esteja no sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Configuração exclusiva do banco de testes em PostgreSQL 16
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/estoque_test_db",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app.shared.infrastructure.database import Base, get_db
# Garante o registro de todos os modelos no Base.metadata para isolamento dos testes
from app.modules.products.infrastructure.models import (
    ProductModel,
    CategoryModel,
    product_categories,
)
from app.modules.inventory.infrastructure.models import StockMovementModel
from app.modules.idempotency.infrastructure.models import IdempotencyRecordModel
from app.main import app

test_engine = create_engine(
    TEST_DATABASE_URL,
    pool_pre_ping=True,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(autouse=True)
def setup_database():
    # Recria as tabelas a cada rodada de testes para isolamento total no PostgreSQL
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
