import os
import sys
import uuid
from datetime import datetime, timezone
from decimal import Decimal
import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, BigInteger, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from alembic import command
from alembic.config import Config

from app.core.config import Settings
from app.shared.infrastructure.database import engine, get_db, Base
from app.shared.infrastructure.seed import seed_initial_categories
from app.shared.utils.scale import to_scaled_int, from_scaled_int, format_quantity_ptbr
from app.modules.auth.infrastructure.models import UserModel
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel
from app.modules.products.infrastructure.models import (
    Product,
    ProductModel,
    Category,
    CategoryModel,
    product_categories,
    utc_now as products_utc_now,
)
from app.modules.inventory.infrastructure.models import (
    StockMovement,
    StockMovementModel,
    utc_now as inventory_utc_now,
)
from app.modules.idempotency.infrastructure.models import (
    IdempotencyRecord,
    IdempotencyRecordModel,
    utc_now as idempotency_utc_now,
)


def test_config_postgres_url():
    """Valida que a configuração lê corretamente DATABASE_URL e rejeita strings vazias ou inválidas."""
    # 1. Leitura válida
    valid_url = "postgresql+psycopg2://postgres:postgres@localhost:5432/estoque_db"
    cfg = Settings(DATABASE_URL=valid_url)
    assert cfg.DATABASE_URL == valid_url

    # 2. Rejeição de string vazia / espaços
    with pytest.raises(ValidationError) as exc_empty:
        Settings(DATABASE_URL="")
    assert "DATABASE_URL não pode ser vazia" in str(exc_empty.value)

    with pytest.raises(ValidationError) as exc_blank:
        Settings(DATABASE_URL="   ")
    assert "DATABASE_URL não pode ser vazia" in str(exc_blank.value)

    # 3. Rejeição de esquema inválido (ex: sqlite ou mysql)
    with pytest.raises(ValidationError) as exc_sqlite:
        Settings(DATABASE_URL="sqlite:///./estoque.db")
    assert "DATABASE_URL inválida" in str(exc_sqlite.value)

    with pytest.raises(ValidationError) as exc_other:
        Settings(DATABASE_URL="mysql://user:pass@localhost/db")
    assert "DATABASE_URL inválida" in str(exc_other.value)

    # 4. Outras propriedades do settings
    assert cfg.QUANTITY_SCALE == 1000
    assert cfg.PROJECT_NAME == "Estoque Modular API"
    assert cfg.VERSION == "1.0.0"
    assert cfg.IDEMPOTENCY_EXPIRATION_HOURS == 24
    assert len(cfg.CORS_ORIGINS) > 0


def test_database_engine_settings():
    """Valida que a engine SQLAlchemy foi instanciada com pool_pre_ping=True e PostgreSQLDialect."""
    assert engine.dialect.name == "postgresql"
    assert engine.pool._pre_ping is True
    assert engine.pool._recycle == 3600
    assert engine.pool.size() == 10
    assert engine.pool._max_overflow == 20

    # Valida ciclo de get_db
    gen = get_db()
    db = next(gen)
    assert isinstance(db, Session)
    # Fecha a sessão
    try:
        next(gen)
    except StopIteration:
        pass


def test_models_native_types():
    """Valida que os tipos das colunas nos metadados do SQLAlchemy correspondem a UUID, BigInteger e DateTime(timezone=True)."""
    # 1. Product / ProductModel
    assert Product is ProductModel
    assert isinstance(Product.id.type, UUID)
    assert Product.id.type.as_uuid is True
    assert isinstance(Product.tenant_id.type, UUID)
    assert Product.tenant_id.type.as_uuid is True
    assert isinstance(Product.current_quantity.type, BigInteger)
    assert isinstance(Product.min_stock.type, BigInteger)
    assert isinstance(Product.created_at.type, DateTime)
    assert Product.created_at.type.timezone is True
    assert isinstance(Product.updated_at.type, DateTime)
    assert Product.updated_at.type.timezone is True
    assert isinstance(Product.deleted_at.type, DateTime)
    assert Product.deleted_at.type.timezone is True

    # 2. Category / CategoryModel
    assert Category is CategoryModel
    assert isinstance(Category.id.type, UUID)
    assert Category.id.type.as_uuid is True
    assert isinstance(Category.tenant_id.type, UUID)
    assert Category.tenant_id.type.as_uuid is True
    assert isinstance(Category.created_at.type, DateTime)
    assert Category.created_at.type.timezone is True

    # 3. product_categories (tabela associativa N:N)
    assert isinstance(product_categories.c.product_id.type, UUID)
    assert product_categories.c.product_id.type.as_uuid is True
    assert isinstance(product_categories.c.category_id.type, UUID)
    assert product_categories.c.category_id.type.as_uuid is True

    # 4. StockMovement / StockMovementModel
    assert StockMovement is StockMovementModel
    assert isinstance(StockMovement.id.type, UUID)
    assert StockMovement.id.type.as_uuid is True
    assert isinstance(StockMovement.tenant_id.type, UUID)
    assert StockMovement.tenant_id.type.as_uuid is True
    assert isinstance(StockMovement.product_id.type, UUID)
    assert StockMovement.product_id.type.as_uuid is True
    assert isinstance(StockMovement.quantity.type, BigInteger)
    assert isinstance(StockMovement.balance_after.type, BigInteger)
    assert isinstance(StockMovement.created_at.type, DateTime)
    assert StockMovement.created_at.type.timezone is True

    # 5. IdempotencyRecord / IdempotencyRecordModel
    assert IdempotencyRecord is IdempotencyRecordModel
    assert isinstance(IdempotencyRecord.tenant_id.type, UUID)
    assert IdempotencyRecord.tenant_id.type.as_uuid is True
    assert isinstance(IdempotencyRecord.created_at.type, DateTime)
    assert IdempotencyRecord.created_at.type.timezone is True
    assert isinstance(IdempotencyRecord.updated_at.type, DateTime)
    assert IdempotencyRecord.updated_at.type.timezone is True

    # 6. Auth e Tenancy Models
    assert isinstance(UserModel.id.type, UUID)
    assert isinstance(TenantModel.id.type, UUID)
    assert isinstance(TenantMembershipModel.id.type, UUID)

    # 7. utc_now helpers
    for fn in (products_utc_now, inventory_utc_now, idempotency_utc_now):
        now = fn()
        assert now.tzinfo is not None
        assert now.tzinfo == timezone.utc


def test_foreign_key_ondelete_restrict(db_session: Session):
    """Valida que a constraint de FK entre stock_movements e products possui regra RESTRICT e impede deleção."""
    # 1. Inspeção de metadados
    product_fks = [fk for fk in StockMovement.__table__.foreign_keys if fk.target_fullname == "products.id"]
    assert len(product_fks) == 1
    fk = product_fks[0]
    assert fk.ondelete == "RESTRICT"

    # Valida ausência de cascade delete no relacionamento Product.movements
    cascade_options = Product.movements.property.cascade
    assert not cascade_options.delete
    assert not cascade_options.delete_orphan

    # 2. Validação física no banco de dados com tenant associado
    tenant = TenantModel(name="Tenant Test Restrict", slug="test-restrict")
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)

    product = Product(
        tenant_id=tenant.id,
        name="Produto Teste Restrict FK",
        unit="UN",
        current_quantity=10000,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    movement = StockMovement(
        tenant_id=tenant.id,
        product_id=product.id,
        type="IN",
        quantity=10000,
        balance_after=10000,
        reason="Entrada para teste de FK RESTRICT",
    )
    db_session.add(movement)
    db_session.commit()

    # Tentativa de exclusão física do produto DEVE falhar com IntegrityError
    db_session.delete(product)
    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()


def test_alembic_migrations_bidirectional():
    """Teste automatizado executando upgrade head seguido de downgrade -1 e novo upgrade em banco de testes limpo."""
    test_db_url = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5432/estoque_test_db",
    )
    test_clean_engine = create_engine(test_db_url)
    
    # Garante banco de testes limpo antes da migração Alembic
    from sqlalchemy import text
    with test_clean_engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version, stock_movements, product_categories, products, categories, idempotency_records, tenant_memberships, tenants, users CASCADE;"))
        conn.commit()

    ini_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini")
    cfg = Config(ini_path)
    cfg.set_main_option("sqlalchemy.url", test_db_url)

    # 1. Aplica até o topo
    command.upgrade(cfg, "head")

    # 2. Faz rollback de 1 revisão (-1)
    command.downgrade(cfg, "-1")

    # 3. Re-aplica até o topo
    command.upgrade(cfg, "head")


def test_scale_utils_comprehensive():
    """Testa todas as funções utilitárias de escala (scale.py)."""
    # to_scaled_int
    assert to_scaled_int(None) == 0
    assert to_scaled_int(" 2,5 ") == 2500
    assert to_scaled_int("2.5") == 2500
    assert to_scaled_int(2.5) == 2500
    assert to_scaled_int(10) == 10000
    assert to_scaled_int(Decimal("3.1415")) == 3142  # arredondamento HALF_UP
    assert to_scaled_int(0) == 0

    # from_scaled_int
    assert from_scaled_int(None) == Decimal("0.000")
    assert from_scaled_int(2500) == Decimal("2.500")
    assert from_scaled_int(-1500) == Decimal("-1.500")
    assert from_scaled_int(0) == Decimal("0.000")

    # format_quantity_ptbr
    assert format_quantity_ptbr(2500) == "2,5"
    assert format_quantity_ptbr(2000) == "2"
    assert format_quantity_ptbr(2125) == "2,125"
    assert format_quantity_ptbr(0) == "0"


def test_seed_initial_categories(db_session: Session):
    """Testa a rotina independente de seed de categorias iniciais."""
    import runpy
    # Banco está limpo no início do teste
    seed_initial_categories()
    count = db_session.query(Category).count()
    assert count >= 4

    # Execução idempotente
    seed_initial_categories()
    assert db_session.query(Category).count() == count

    # Execução via __main__
    runpy.run_module("app.shared.infrastructure.seed", run_name="__main__")
    assert db_session.query(Category).count() == count
