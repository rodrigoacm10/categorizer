"""
Script de população de dados de demonstração (Seed Demo).
Cria um almoxarifado piloto (Tenant), usuários para cada papel da matriz RBAC,
categorias industriais, produtos e lançamentos de entrada no Livro-Razão (Ledger).

Execução:
    cd backend
    .venv/bin/python -m app.shared.infrastructure.seed_demo
"""

import uuid
from datetime import datetime, timezone
from app.shared.infrastructure.database import SessionLocal
from app.core.security import get_password_hash
from app.modules.auth.infrastructure.models import UserModel
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel, TenantRole
from app.modules.products.infrastructure.models import ProductModel, CategoryModel
from app.modules.inventory.infrastructure.models import StockMovementModel


def seed_demo_environment():
    db = SessionLocal()
    try:
        print("--> Iniciando criação de dados de demonstração...")

        # 1. Cria ou recupera o Tenant Piloto
        tenant_slug = "almoxarifado-central"
        tenant = db.query(TenantModel).filter(TenantModel.slug == tenant_slug).first()
        if not tenant:
            tenant = TenantModel(
                name="Almoxarifado Central",
                slug=tenant_slug,
                description="Unidade principal de estocagem, manutenção e suprimentos industriais.",
                is_active=True,
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            print(f"    [+] Tenant criado: {tenant.name} ({tenant.slug})")
        else:
            print(f"    [*] Tenant existente: {tenant.name} ({tenant.slug})")

        # 2. Definição dos usuários para cada papel do RBAC
        demo_users = [
            {
                "email": "admin@industria.com",
                "full_name": "Administrador Geral (Owner)",
                "password": "Admin@2026",
                "role": TenantRole.OWNER,
            },
            {
                "email": "gestor@industria.com",
                "full_name": "Gestor de Suprimentos",
                "password": "Gestor@2026",
                "role": TenantRole.GESTOR,
            },
            {
                "email": "almoxarife@industria.com",
                "full_name": "Operador de Almoxarifado",
                "password": "Almoxarife@2026",
                "role": TenantRole.ALMOXARIFE,
            },
            {
                "email": "auditor@industria.com",
                "full_name": "Auditor de Controle e Compliance",
                "password": "Auditor@2026",
                "role": TenantRole.AUDITOR,
            },
        ]

        created_users = {}
        for u_data in demo_users:
            user = db.query(UserModel).filter(UserModel.email == u_data["email"]).first()
            if not user:
                user = UserModel(
                    email=u_data["email"],
                    full_name=u_data["full_name"],
                    password_hash=get_password_hash(u_data["password"]),
                    is_active=True,
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                print(f"    [+] Usuário criado: {user.email} (Senha: {u_data['password']})")
            else:
                print(f"    [*] Usuário já cadastrado: {user.email}")

            created_users[u_data["role"]] = user

            # Vínculo no TenantMembership
            membership = (
                db.query(TenantMembershipModel)
                .filter(
                    TenantMembershipModel.tenant_id == tenant.id,
                    TenantMembershipModel.user_id == user.id,
                )
                .first()
            )
            if not membership:
                membership = TenantMembershipModel(
                    tenant_id=tenant.id,
                    user_id=user.id,
                    role=u_data["role"],
                )
                db.add(membership)
                db.commit()
                print(f"        -> Vínculo atribuído: {u_data['role'].value}")

        # Se o tenant não tinha criador atribuído, atribui o OWNER
        if not tenant.created_by_user_id and TenantRole.OWNER in created_users:
            tenant.created_by_user_id = created_users[TenantRole.OWNER].id
            db.commit()

        # 3. Categorias Industriais
        demo_categories = [
            {"name": "Peças Mecânicas", "desc": "Rolamentos, retentores, mancais e engrenagens", "color": "#2563EB"},
            {"name": "Equipamentos de Proteção (EPI)", "desc": "Capacetes, óculos, luvas e calçados técnicos", "color": "#10B981"},
            {"name": "Fluidos & Lubrificantes", "desc": "Óleos hidráulicos, graxas industriais e desengraxantes", "color": "#F59E0B"},
            {"name": "Consumíveis de Solda", "desc": "Eletrodos, arames MIG/MAG e varetas TIG", "color": "#8B5CF6"},
        ]

        category_map = {}
        for c_data in demo_categories:
            cat = (
                db.query(CategoryModel)
                .filter(CategoryModel.tenant_id == tenant.id, CategoryModel.name == c_data["name"])
                .first()
            )
            if not cat:
                cat = CategoryModel(
                    tenant_id=tenant.id,
                    name=c_data["name"],
                    description=c_data["desc"],
                    color=c_data["color"],
                )
                db.add(cat)
                db.commit()
                db.refresh(cat)
                print(f"    [+] Categoria criada: {cat.name}")
            category_map[c_data["name"]] = cat

        # 4. Produtos e Movimentações Iniciais no Livro-Razão (Ledger)
        # Escala fixa 10^3: 15 UN = 15000, 50 L = 50000, etc.
        demo_products = [
            {
                "name": "Rolamento Rígido de Esferas SKF 6205-2RSH",
                "desc": "Rolamento para motor elétrico de indução trifásico 5CV.",
                "unit": "UN",
                "min_stock": 5000,       # Min 5 UN
                "initial_in": 15000,     # Entrada de 15 UN
                "category": "Peças Mecânicas",
            },
            {
                "name": "Óleo Hidráulico Industrial ISO VG 68",
                "desc": "Fluido de alta viscosidade para transmissões e prensas hidráulicas.",
                "unit": "L",
                "min_stock": 20000,      # Min 20 L
                "initial_in": 60000,     # Entrada de 60 L
                "category": "Fluidos & Lubrificantes",
            },
            {
                "name": "Capacete de Segurança Classe B com Carneira",
                "desc": "Proteção craniana contra impactos para área de caldeiraria pesada.",
                "unit": "UN",
                "min_stock": 10000,      # Min 10 UN
                "initial_in": 8000,      # Entrada de 8 UN (FICA COMO ALERTA DE ESTOQUE BAIXO!)
                "category": "Equipamentos de Proteção (EPI)",
            },
            {
                "name": "Eletrodo Revestido AWS E7018 3.25mm",
                "desc": "Eletrodo básico para soldagem de estruturas em aço de alta resistência.",
                "unit": "KG",
                "min_stock": 15000,      # Min 15 KG
                "initial_in": 35000,     # Entrada de 35 KG
                "category": "Consumíveis de Solda",
            },
        ]

        for p_data in demo_products:
            prod = (
                db.query(ProductModel)
                .filter(ProductModel.tenant_id == tenant.id, ProductModel.name == p_data["name"])
                .first()
            )
            if not prod:
                # Regra: Produto inicia com saldo ZERO
                prod = ProductModel(
                    tenant_id=tenant.id,
                    name=p_data["name"],
                    description=p_data["desc"],
                    unit=p_data["unit"],
                    current_quantity=0,
                    min_stock=p_data["min_stock"],
                    is_active=True,
                )
                cat = category_map.get(p_data["category"])
                if cat:
                    prod.categories.append(cat)
                db.add(prod)
                db.commit()
                db.refresh(prod)
                print(f"    [+] Produto cadastrado (Saldo 0): {prod.name}")

                # Registra movimentação de entrada no Livro-Razão (Ledger)
                qty_in = p_data["initial_in"]
                prod.current_quantity = qty_in

                movement = StockMovementModel(
                    tenant_id=tenant.id,
                    product_id=prod.id,
                    type="IN",
                    quantity=qty_in,
                    balance_after=qty_in,
                    reason="Recebimento e carga inicial do almoxarifado piloto (NF-e Fornecedor #1029)",
                    idempotency_key=f"seed-init-{uuid.uuid4()}",
                    created_at=datetime.now(timezone.utc),
                )
                db.add(movement)
                db.commit()
                print(f"        -> Lançamento Ledger IN: +{qty_in / 1000} {prod.unit} (Saldo: {qty_in / 1000} {prod.unit})")
            else:
                print(f"    [*] Produto já existente: {prod.name}")

        print("\n--> Ambiente de demonstração preparado com sucesso!")
        print("=" * 60)
        print("CREDENCIAS DE ACESSO PARA DEMONSTRAÇÃO:")
        print("Almoxarifado (Tenant): Almoxarifado Central (slug: almoxarifado-central)")
        print("-" * 60)
        for u in demo_users:
            print(f"Papel: {u['role'].value:<12} | E-mail: {u['email']:<28} | Senha: {u['password']}")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_environment()
