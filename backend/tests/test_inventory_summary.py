import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import create_access_token, get_password_hash
from app.modules.auth.infrastructure.models import UserModel
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel
from app.modules.tenants.domain.entities import TenantRole
from app.modules.products.infrastructure.models import ProductModel
from app.modules.inventory.infrastructure.models import StockMovementModel
from app.modules.inventory.infrastructure.unit_of_work import InventoryUnitOfWork
from app.modules.inventory.application.use_cases import (
    GetInventorySummaryUseCase,
    get_inventory_summary,
)
from app.modules.inventory.application.dtos import InventorySummaryResponseDto
from app.modules.products.infrastructure.repositories import SQLAlchemyProductRepository
from app.modules.inventory.infrastructure.repositories import StockMovementRepository
from tests.conftest import TestingSessionLocal


def test_inventory_summary_populated_scenario(client, db_session, default_tenant):
    """
    Cenário a) Cálculo exato dos 4 contadores em cenário populado:
    - total_products: Total de produtos ativos no catálogo do tenant.
    - low_stock_count: Quantidade de produtos ativos onde current_quantity <= min_stock e current_quantity > 0.
    - out_of_stock_count: Quantidade de produtos ativos onde current_quantity == 0.
    - movements_today: Total de movimentações contábeis registradas nas últimas 24 horas no tenant.
    """
    now = datetime.now(timezone.utc)

    # 1. Produtos Ativos
    # Produto 1: Estoque normal (current_quantity > min_stock)
    p1 = ProductModel(
        tenant_id=default_tenant.id,
        name="Produto Normal",
        unit="UN",
        current_quantity=10000,  # 10.0 UN
        min_stock=2000,          # 2.0 UN
        is_active=True,
    )
    # Produto 2: Estoque baixo (0 < current_quantity <= min_stock)
    p2 = ProductModel(
        tenant_id=default_tenant.id,
        name="Produto Estoque Baixo",
        unit="UN",
        current_quantity=1500,   # 1.5 UN
        min_stock=3000,          # 3.0 UN
        is_active=True,
    )
    # Produto 3: Estoque baixo no limite exato (current_quantity == min_stock > 0)
    p3 = ProductModel(
        tenant_id=default_tenant.id,
        name="Produto Estoque Baixo Limite",
        unit="UN",
        current_quantity=2000,   # 2.0 UN
        min_stock=2000,          # 2.0 UN
        is_active=True,
    )
    # Produto 4: Sem estoque com estoque mínimo definido (current_quantity == 0)
    p4 = ProductModel(
        tenant_id=default_tenant.id,
        name="Produto Esgotado Com Min",
        unit="UN",
        current_quantity=0,
        min_stock=5000,          # 5.0 UN
        is_active=True,
    )
    # Produto 5: Sem estoque e sem estoque mínimo configurado (current_quantity == 0, min_stock == None)
    p5 = ProductModel(
        tenant_id=default_tenant.id,
        name="Produto Esgotado Sem Min",
        unit="UN",
        current_quantity=0,
        min_stock=None,
        is_active=True,
    )
    # Produto 6: Estoque normal sem estoque mínimo configurado (current_quantity > 0, min_stock == None)
    p6 = ProductModel(
        tenant_id=default_tenant.id,
        name="Produto Normal Sem Min",
        unit="UN",
        current_quantity=8000,   # 8.0 UN
        min_stock=None,
        is_active=True,
    )

    # 2. Produtos Inativos / Soft-Deleted (NÃO devem ser contabilizados)
    p7_inativo = ProductModel(
        tenant_id=default_tenant.id,
        name="Produto Inativo Saldo Zero",
        unit="UN",
        current_quantity=0,
        min_stock=1000,
        is_active=False,
    )
    p8_inativo = ProductModel(
        tenant_id=default_tenant.id,
        name="Produto Inativo Estoque Baixo",
        unit="UN",
        current_quantity=1000,
        min_stock=3000,
        is_active=False,
    )
    p9_inativo = ProductModel(
        tenant_id=default_tenant.id,
        name="Produto Inativo Saldo Alto",
        unit="UN",
        current_quantity=25000,
        min_stock=5000,
        is_active=False,
    )

    db_session.add_all([p1, p2, p3, p4, p5, p6, p7_inativo, p8_inativo, p9_inativo])
    db_session.commit()

    # 3. Movimentações Contábeis no Ledger
    # Movimentações dentro das últimas 24h
    m1 = StockMovementModel(
        tenant_id=default_tenant.id,
        product_id=p1.id,
        type="IN",
        quantity=10000,
        balance_after=10000,
        created_at=now - timedelta(minutes=10),
    )
    m2 = StockMovementModel(
        tenant_id=default_tenant.id,
        product_id=p2.id,
        type="IN",
        quantity=5000,
        balance_after=5000,
        created_at=now - timedelta(hours=4),
    )
    m3 = StockMovementModel(
        tenant_id=default_tenant.id,
        product_id=p2.id,
        type="OUT",
        quantity=-3500,
        balance_after=1500,
        created_at=now - timedelta(hours=23, minutes=30),
    )
    # Movimentações antigas (> 24h, NÃO devem ser contabilizadas em movements_today)
    m4_antiga = StockMovementModel(
        tenant_id=default_tenant.id,
        product_id=p1.id,
        type="IN",
        quantity=2000,
        balance_after=2000,
        created_at=now - timedelta(hours=25),
    )
    m5_antiga = StockMovementModel(
        tenant_id=default_tenant.id,
        product_id=p3.id,
        type="ADJUSTMENT",
        quantity=2000,
        balance_after=2000,
        created_at=now - timedelta(days=5),
    )

    db_session.add_all([m1, m2, m3, m4_antiga, m5_antiga])
    db_session.commit()

    # Executa requisição no endpoint
    response = client.get("/api/inventory/summary")
    assert response.status_code == 200

    data = response.json()
    assert data["total_products"] == 6
    assert data["low_stock_count"] == 2
    assert data["out_of_stock_count"] == 2
    assert data["movements_today"] == 3


def test_inventory_summary_empty_scenario(client, db_session):
    """
    Cenário b) Cenário vazio:
    - Zero produtos e zero movimentações.
    - Deve retornar exatamente 0 em todos os 4 contadores.
    """
    # Cria um novo tenant isolado e sem produtos
    fresh_tenant = TenantModel(
        name="Tenant Vazio",
        slug="tenant-vazio",
        description="Tenant recém-criado sem nenhum produto",
        is_active=True,
    )
    db_session.add(fresh_tenant)
    db_session.commit()

    user = UserModel(
        email="owner.vazio@empresa.com",
        password_hash=get_password_hash("SenhaSegura123"),
        full_name="Owner Vazio",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    membership = TenantMembershipModel(
        user_id=user.id,
        tenant_id=fresh_tenant.id,
        role="OWNER",
    )
    db_session.add(membership)
    db_session.commit()

    token = create_access_token({"sub": str(user.id), "email": user.email})
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": str(fresh_tenant.id),
    }

    res = client.get("/api/inventory/summary", headers=headers)
    assert res.status_code == 200

    data = res.json()
    assert data["total_products"] == 0
    assert data["low_stock_count"] == 0
    assert data["out_of_stock_count"] == 0
    assert data["movements_today"] == 0


def test_inventory_summary_strict_multi_tenant_isolation(client, db_session):
    """
    Cenário c) Isolamento Multi-Tenant Estrito:
    - Tenant A possui 2 produtos ativos (1 low stock, 1 normal) e 2 movimentações hoje.
    - Tenant B possui 5 produtos ativos (2 out of stock, 2 low stock, 1 normal) e 5 movimentações hoje.
    - Validação de que produtos e movimentações do Tenant B não alteram o resumo do Tenant A.
    """
    now = datetime.now(timezone.utc)

    # 1. Tenant A e seu usuário
    t_a = TenantModel(name="Tenant Alfa", slug="tenant-alfa-kpi", is_active=True)
    db_session.add(t_a)
    db_session.commit()

    u_a = UserModel(
        email="user.a@alfa.com",
        password_hash=get_password_hash("Senha123"),
        full_name="User Alfa",
        is_active=True,
    )
    db_session.add(u_a)
    db_session.commit()

    mem_a = TenantMembershipModel(user_id=u_a.id, tenant_id=t_a.id, role="OWNER")
    db_session.add(mem_a)
    db_session.commit()

    # 2. Tenant B e seu usuário
    t_b = TenantModel(name="Tenant Beta", slug="tenant-beta-kpi", is_active=True)
    db_session.add(t_b)
    db_session.commit()

    u_b = UserModel(
        email="user.b@beta.com",
        password_hash=get_password_hash("Senha123"),
        full_name="User Beta",
        is_active=True,
    )
    db_session.add(u_b)
    db_session.commit()

    mem_b = TenantMembershipModel(user_id=u_b.id, tenant_id=t_b.id, role="OWNER")
    db_session.add(mem_b)
    db_session.commit()

    # 3. Popula Tenant A: 2 produtos (1 normal, 1 low_stock)
    p_a1 = ProductModel(
        tenant_id=t_a.id,
        name="Prod Alfa 1 (Normal)",
        unit="UN",
        current_quantity=10000,
        min_stock=2000,
        is_active=True,
    )
    p_a2 = ProductModel(
        tenant_id=t_a.id,
        name="Prod Alfa 2 (Low Stock)",
        unit="UN",
        current_quantity=1000,
        min_stock=5000,
        is_active=True,
    )
    db_session.add_all([p_a1, p_a2])
    db_session.commit()

    # Movimentações do Tenant A (2 hoje)
    m_a1 = StockMovementModel(
        tenant_id=t_a.id,
        product_id=p_a1.id,
        type="IN",
        quantity=10000,
        balance_after=10000,
        created_at=now - timedelta(hours=1),
    )
    m_a2 = StockMovementModel(
        tenant_id=t_a.id,
        product_id=p_a2.id,
        type="IN",
        quantity=1000,
        balance_after=1000,
        created_at=now - timedelta(hours=2),
    )
    db_session.add_all([m_a1, m_a2])
    db_session.commit()

    # 4. Popula Tenant B: 5 produtos (1 normal, 2 low_stock, 2 out_of_stock)
    p_b1 = ProductModel(
        tenant_id=t_b.id,
        name="Prod Beta 1 (Normal)",
        unit="UN",
        current_quantity=20000,
        min_stock=1000,
        is_active=True,
    )
    p_b2 = ProductModel(
        tenant_id=t_b.id,
        name="Prod Beta 2 (Low Stock 1)",
        unit="UN",
        current_quantity=500,
        min_stock=1000,
        is_active=True,
    )
    p_b3 = ProductModel(
        tenant_id=t_b.id,
        name="Prod Beta 3 (Low Stock 2)",
        unit="UN",
        current_quantity=800,
        min_stock=2000,
        is_active=True,
    )
    p_b4 = ProductModel(
        tenant_id=t_b.id,
        name="Prod Beta 4 (Out of Stock 1)",
        unit="UN",
        current_quantity=0,
        min_stock=1000,
        is_active=True,
    )
    p_b5 = ProductModel(
        tenant_id=t_b.id,
        name="Prod Beta 5 (Out of Stock 2)",
        unit="UN",
        current_quantity=0,
        min_stock=None,
        is_active=True,
    )
    db_session.add_all([p_b1, p_b2, p_b3, p_b4, p_b5])
    db_session.commit()

    # Movimentações do Tenant B (5 hoje)
    for i in range(5):
        m_b = StockMovementModel(
            tenant_id=t_b.id,
            product_id=p_b1.id,
            type="IN",
            quantity=1000,
            balance_after=1000 * (i + 1),
            created_at=now - timedelta(minutes=15 * (i + 1)),
        )
        db_session.add(m_b)
    db_session.commit()

    # 5. Consulta Tenant A
    token_a = create_access_token({"sub": str(u_a.id), "email": u_a.email})
    headers_a = {"Authorization": f"Bearer {token_a}", "X-Tenant-ID": str(t_a.id)}
    res_a = client.get("/api/inventory/summary", headers=headers_a)
    assert res_a.status_code == 200
    data_a = res_a.json()

    assert data_a["total_products"] == 2
    assert data_a["low_stock_count"] == 1
    assert data_a["out_of_stock_count"] == 0
    assert data_a["movements_today"] == 2

    # 6. Consulta Tenant B
    token_b = create_access_token({"sub": str(u_b.id), "email": u_b.email})
    headers_b = {"Authorization": f"Bearer {token_b}", "X-Tenant-ID": str(t_b.id)}
    res_b = client.get("/api/inventory/summary", headers=headers_b)
    assert res_b.status_code == 200
    data_b = res_b.json()

    assert data_b["total_products"] == 5
    assert data_b["low_stock_count"] == 2
    assert data_b["out_of_stock_count"] == 2
    assert data_b["movements_today"] == 5


def test_inventory_summary_rbac_authorization_and_rejections(db_session, default_tenant):
    """
    Cenário d) Validação de RBAC:
    - Todos os 4 papéis autorizados têm acesso: OWNER, GESTOR, ALMOXARIFE, AUDITOR.
    - Acesso sem header X-Tenant-ID é rejeitado com 403 (RFC 7807).
    - Acesso com usuário estranho ao tenant é rejeitado com 403 (RFC 7807).
    """
    # Cria um produto de exemplo no tenant
    prod = ProductModel(
        tenant_id=default_tenant.id,
        name="Item RBAC Test",
        unit="UN",
        current_quantity=5000,
        min_stock=1000,
        is_active=True,
    )
    db_session.add(prod)
    db_session.commit()

    # 1. Cria usuários para cada um dos 4 papéis
    roles = [TenantRole.OWNER, TenantRole.GESTOR, TenantRole.ALMOXARIFE, TenantRole.AUDITOR]
    tokens = {}

    for r in roles:
        u = UserModel(
            email=f"user.{r.value.lower()}@empresa.com",
            password_hash=get_password_hash("Senha123"),
            full_name=f"User {r.value}",
            is_active=True,
        )
        db_session.add(u)
        db_session.commit()

        mem = TenantMembershipModel(user_id=u.id, tenant_id=default_tenant.id, role=r.value)
        db_session.add(mem)
        db_session.commit()

        tokens[r] = create_access_token({"sub": str(u.id), "email": u.email})

    standalone_client = TestClient(app)

    # Valida que todos os 4 papéis autorizados têm acesso 200 OK
    for r in roles:
        headers = {
            "Authorization": f"Bearer {tokens[r]}",
            "X-Tenant-ID": str(default_tenant.id),
        }
        res = standalone_client.get("/api/inventory/summary", headers=headers)
        assert res.status_code == 200, f"Papel {r.value} deveria ter acesso 200, mas obteve {res.status_code}"
        data = res.json()
        assert data["total_products"] == 1
        assert "low_stock_count" in data
        assert "out_of_stock_count" in data
        assert "movements_today" in data

    # 2. Acesso sem header X-Tenant-ID (ou cabeçalho vazio) -> Rejeitado com 403 (RFC 7807)
    headers_no_tenant = {
        "Authorization": f"Bearer {tokens[TenantRole.OWNER]}",
    }
    res_no_tenant = standalone_client.get("/api/inventory/summary", headers=headers_no_tenant)
    assert res_no_tenant.status_code == 403
    err_no_tenant = res_no_tenant.json()
    assert err_no_tenant["status"] == 403
    assert "type" in err_no_tenant
    assert "detail" in err_no_tenant

    headers_empty_tenant = {
        "Authorization": f"Bearer {tokens[TenantRole.OWNER]}",
        "X-Tenant-ID": "",
    }
    res_empty_tenant = standalone_client.get("/api/inventory/summary", headers=headers_empty_tenant)
    assert res_empty_tenant.status_code == 403
    assert res_empty_tenant.json()["status"] == 403

    # 3. Acesso com usuário estranho ao tenant (sem membership) -> Rejeitado com 403 (RFC 7807)
    strange_user = UserModel(
        email="estranho@outro.com",
        password_hash=get_password_hash("Senha123"),
        full_name="Usuario Estranho",
        is_active=True,
    )
    db_session.add(strange_user)
    db_session.commit()
    token_strange = create_access_token({"sub": str(strange_user.id), "email": strange_user.email})

    headers_strange = {
        "Authorization": f"Bearer {token_strange}",
        "X-Tenant-ID": str(default_tenant.id),
    }
    res_strange = standalone_client.get("/api/inventory/summary", headers=headers_strange)
    assert res_strange.status_code == 403
    err_strange = res_strange.json()
    assert err_strange["status"] == 403
    assert err_strange["type"] == "https://api.estoque.local/errors/tenant-access-denied"
    assert "não possui vínculo ativo" in err_strange["detail"]


def test_inventory_summary_use_case_and_repository_methods_direct(db_session, default_tenant):
    """
    Testes diretos de unidade para GetInventorySummaryUseCase,
    InventoryUnitOfWork e métodos de repositório.
    """
    now = datetime.now(timezone.utc)
    t_id = default_tenant.id

    prod_repo = SQLAlchemyProductRepository(db_session)
    mov_repo = StockMovementRepository(db_session)
    uow = InventoryUnitOfWork(db_session)
    use_case = GetInventorySummaryUseCase(uow)

    # Estado inicial vazio
    empty_summary = use_case.execute(tenant_id=t_id)
    assert empty_summary.total_products == 0
    assert empty_summary.low_stock_count == 0
    assert empty_summary.out_of_stock_count == 0
    assert empty_summary.movements_today == 0

    # Cria produtos
    p_norm = ProductModel(
        tenant_id=t_id,
        name="Prod Normal Unit",
        unit="UN",
        current_quantity=5000,
        min_stock=1000,
        is_active=True,
    )
    p_low = ProductModel(
        tenant_id=t_id,
        name="Prod Baixo Unit",
        unit="UN",
        current_quantity=500,
        min_stock=1000,
        is_active=True,
    )
    p_out = ProductModel(
        tenant_id=t_id,
        name="Prod Sem Estoque Unit",
        unit="UN",
        current_quantity=0,
        min_stock=1000,
        is_active=True,
    )
    p_inact = ProductModel(
        tenant_id=t_id,
        name="Prod Inativo Unit",
        unit="UN",
        current_quantity=0,
        min_stock=1000,
        is_active=False,
    )
    db_session.add_all([p_norm, p_low, p_out, p_inact])
    db_session.commit()

    # Movimentações
    m1 = StockMovementModel(
        tenant_id=t_id,
        product_id=p_norm.id,
        type="IN",
        quantity=5000,
        balance_after=5000,
        created_at=now - timedelta(hours=2),
    )
    m2 = StockMovementModel(
        tenant_id=t_id,
        product_id=p_norm.id,
        type="OUT",
        quantity=-1000,
        balance_after=4000,
        created_at=now - timedelta(hours=30),  # > 24h
    )
    db_session.add_all([m1, m2])
    db_session.commit()

    # Validação dos métodos do repositório de produto
    assert prod_repo.count_active_products(t_id) == 3
    assert prod_repo.count_low_stock_products(t_id) == 1
    assert prod_repo.count_out_of_stock_products(t_id) == 1

    counts = prod_repo.get_inventory_summary_counts(t_id)
    assert counts["total_products"] == 3
    assert counts["low_stock_count"] == 1
    assert counts["out_of_stock_count"] == 1

    # Validação do método do repositório de movimentações
    assert mov_repo.count_movements_since(t_id, since=now - timedelta(hours=24)) == 1
    assert mov_repo.count_movements_since(t_id, since=now - timedelta(hours=48)) == 2

    # Validação via UseCase com since default (24h)
    res_dto = use_case.execute(tenant_id=t_id)
    assert isinstance(res_dto, InventorySummaryResponseDto)
    assert res_dto.total_products == 3
    assert res_dto.low_stock_count == 1
    assert res_dto.out_of_stock_count == 1
    assert res_dto.movements_today == 1

    # Validação da função auxiliar procedural get_inventory_summary
    helper_res = get_inventory_summary(db=db_session, tenant_id=t_id)
    assert helper_res.total_products == 3
    assert helper_res.movements_today == 1
