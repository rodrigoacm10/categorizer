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
from app.modules.auth.infrastructure.models import UserModel
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel
from app.modules.products.infrastructure.models import (
    ProductModel,
    CategoryModel,
    product_categories,
)
from app.modules.inventory.infrastructure.models import StockMovementModel
from app.modules.idempotency.infrastructure.models import IdempotencyRecordModel
from app.core.security import get_password_hash, create_access_token
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
def default_tenant(db_session):
    tenant = TenantModel(
        name="Default Test Tenant",
        slug="default",
        description="Tenant de teste inicial",
        is_active=True,
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)
    return tenant


@pytest.fixture
def default_user(db_session, default_tenant):
    user = UserModel(
        email="owner.test@empresa.com",
        password_hash=get_password_hash("SenhaSegura123"),
        full_name="Owner Tester",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    membership = TenantMembershipModel(
        user_id=user.id,
        tenant_id=default_tenant.id,
        role="OWNER",
    )
    db_session.add(membership)
    db_session.commit()
    return user


@pytest.fixture
def auth_headers(default_user, default_tenant):
    token = create_access_token({"sub": str(default_user.id), "email": default_user.email})
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": str(default_tenant.id),
    }


@pytest.fixture
def sample_category(db_session, default_tenant):
    category = CategoryModel(
        name="Categoria Teste Auxiliar",
        description="Categoria de teste para testes rápidos",
        color="#3B82F6",
        tenant_id=default_tenant.id,
    )
    db_session.add(category)
    db_session.commit()
    db_session.refresh(category)
    return category


@pytest.fixture
def sample_product(db_session, default_tenant, sample_category):
    product = ProductModel(
        tenant_id=default_tenant.id,
        name="Produto Teste Fixture",
        description="Produto de teste padrão com estoque inicial",
        unit="UN",
        current_quantity=10000,  # 10.0 UN
        min_stock=2000,          # 2.0 UN
        is_active=True,
        categories=[sample_category],
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    # Registro contábil no Ledger para reconciliação matemática perene
    movement = StockMovementModel(
        tenant_id=default_tenant.id,
        product_id=product.id,
        type="IN",
        quantity=10000,
        balance_after=10000,
        reason="Estoque inicial de cadastro via fixture",
    )
    db_session.add(movement)
    db_session.commit()

    return product


@pytest.fixture
def client(db_session, auth_headers):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, headers=auth_headers) as c:
        yield c
    app.dependency_overrides.clear()
