"""0002_add_auth_and_multi_tenancy

Revision ID: d2ee3016a250
Revises: c1ffb3f71349
Create Date: 2026-11-10 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2ee3016a250'
down_revision: Union[str, Sequence[str], None] = 'c1ffb3f71349'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tabela users
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. Tabela tenants
    op.create_table(
        'tenants',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_by_user_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tenants_slug'), 'tenants', ['slug'], unique=True)

    # 3. Tabela tenant_memberships
    op.create_table(
        'tenant_memberships',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('role', sa.String(length=32), nullable=False, server_default='ALMOXARIFE'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'tenant_id', name='uq_tenant_membership_user_tenant')
    )
    op.create_index('ix_tenant_memberships_tenant_user', 'tenant_memberships', ['tenant_id', 'user_id'])

    # 4. Criação do tenant default para migração de dados legados
    op.execute(
        "INSERT INTO tenants (id, name, slug, description, is_active, created_at, updated_at) "
        "VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'default', 'Tenant padrão para migração de dados legados', true, NOW(), NOW()) "
        "ON CONFLICT (slug) DO NOTHING;"
    )

    # 5. Adiciona coluna tenant_id nullable nas tabelas de domínio
    op.add_column('categories', sa.Column('tenant_id', sa.UUID(), nullable=True))
    op.add_column('products', sa.Column('tenant_id', sa.UUID(), nullable=True))
    op.add_column('stock_movements', sa.Column('tenant_id', sa.UUID(), nullable=True))
    op.add_column('idempotency_records', sa.Column('tenant_id', sa.UUID(), nullable=True))

    # 6. Atualiza dados legados para o tenant default
    op.execute("UPDATE categories SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;")
    op.execute("UPDATE products SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;")
    op.execute("UPDATE stock_movements SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;")
    op.execute("UPDATE idempotency_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;")

    # 7. Torna tenant_id NOT NULL
    op.alter_column('categories', 'tenant_id', nullable=False)
    op.alter_column('products', 'tenant_id', nullable=False)
    op.alter_column('stock_movements', 'tenant_id', nullable=False)
    op.alter_column('idempotency_records', 'tenant_id', nullable=False)

    # 8. Cria Foreign Keys
    op.create_foreign_key('fk_categories_tenant_id', 'categories', 'tenants', ['tenant_id'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_products_tenant_id', 'products', 'tenants', ['tenant_id'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_stock_movements_tenant_id', 'stock_movements', 'tenants', ['tenant_id'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_idempotency_records_tenant_id', 'idempotency_records', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')

    # 9. Índices e Constraints de Unicidade
    # Categories: remove índice único global em 'name' e adiciona constraint composta (tenant_id, name)
    op.drop_index('ix_categories_name', table_name='categories')
    op.create_unique_constraint('uq_categories_tenant_name', 'categories', ['tenant_id', 'name'])
    op.create_index('ix_categories_tenant_id', 'categories', ['tenant_id'])

    # Products
    op.create_index('ix_products_tenant_id', 'products', ['tenant_id'])
    op.create_index('ix_products_tenant_active', 'products', ['tenant_id', 'is_active'])

    # Stock Movements
    op.create_index('ix_stock_movements_tenant_id', 'stock_movements', ['tenant_id'])
    op.create_index('ix_stock_movements_tenant_created', 'stock_movements', ['tenant_id', 'created_at'])

    # Idempotency Records
    op.drop_constraint('idempotency_records_pkey', 'idempotency_records', type_='primary')
    op.create_primary_key('pk_idempotency_records', 'idempotency_records', ['tenant_id', 'key'])
    op.create_index('ix_idempotency_records_tenant_id', 'idempotency_records', ['tenant_id'])


def downgrade() -> None:
    # 9. Reverte índices e constraints
    op.drop_index('ix_idempotency_records_tenant_id', table_name='idempotency_records')
    op.drop_constraint('pk_idempotency_records', 'idempotency_records', type_='primary')
    op.create_primary_key('idempotency_records_pkey', 'idempotency_records', ['key'])

    op.drop_index('ix_stock_movements_tenant_created', table_name='stock_movements')
    op.drop_index('ix_stock_movements_tenant_id', table_name='stock_movements')

    op.drop_index('ix_products_tenant_active', table_name='products')
    op.drop_index('ix_products_tenant_id', table_name='products')

    op.drop_index('ix_categories_tenant_id', table_name='categories')
    op.drop_constraint('uq_categories_tenant_name', 'categories', type_='unique')
    op.create_index('ix_categories_name', 'categories', ['name'], unique=True)

    # 8. Reverte Foreign Keys
    op.drop_constraint('fk_idempotency_records_tenant_id', 'idempotency_records', type_='foreignkey')
    op.drop_constraint('fk_stock_movements_tenant_id', 'stock_movements', type_='foreignkey')
    op.drop_constraint('fk_products_tenant_id', 'products', type_='foreignkey')
    op.drop_constraint('fk_categories_tenant_id', 'categories', type_='foreignkey')

    # 5. Remove colunas tenant_id
    op.drop_column('idempotency_records', 'tenant_id')
    op.drop_column('stock_movements', 'tenant_id')
    op.drop_column('products', 'tenant_id')
    op.drop_column('categories', 'tenant_id')

    # 3. Drop tenant_memberships
    op.drop_index('ix_tenant_memberships_tenant_user', table_name='tenant_memberships')
    op.drop_table('tenant_memberships')

    # 2. Drop tenants
    op.drop_index(op.f('ix_tenants_slug'), table_name='tenants')
    op.drop_table('tenants')

    # 1. Drop users
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
