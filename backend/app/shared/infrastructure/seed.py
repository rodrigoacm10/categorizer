import uuid
from typing import Optional
from uuid import UUID
from app.shared.infrastructure.database import SessionLocal
from app.modules.products.infrastructure.models import Category
from app.modules.tenants.infrastructure.models import TenantModel

DEFAULT_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def seed_initial_categories(tenant_id: Optional[UUID] = None):
    """Popula categorias padrão no banco caso não existam no tenant."""
    db = SessionLocal()
    try:
        # Se tenant_id não foi informado, busca ou cria o tenant default
        if tenant_id is None:
            default_tenant = db.query(TenantModel).filter(TenantModel.slug == "default").first()
            if not default_tenant:
                default_tenant = TenantModel(
                    id=DEFAULT_TENANT_ID,
                    name="Default Tenant",
                    slug="default",
                    description="Tenant padrão para migração e testes",
                    is_active=True,
                )
                db.add(default_tenant)
                db.commit()
                db.refresh(default_tenant)
            target_tenant_id = default_tenant.id
        else:
            target_tenant_id = tenant_id

        count = db.query(Category).filter(Category.tenant_id == target_tenant_id).count()
        if count == 0:
            default_categories = [
                Category(tenant_id=target_tenant_id, name="Matéria-Prima", description="Insumos básicos de produção", color="#10B981"),
                Category(tenant_id=target_tenant_id, name="Embalagens", description="Caixas, fitas e recipientes", color="#F59E0B"),
                Category(tenant_id=target_tenant_id, name="Componentes", description="Peças e componentes diversos", color="#3B82F6"),
                Category(tenant_id=target_tenant_id, name="Material de Escritório", description="Uso interno e administrativo", color="#8B5CF6"),
            ]
            db.add_all(default_categories)
            db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_initial_categories()
    print("Categorias iniciais populadas com sucesso.")
