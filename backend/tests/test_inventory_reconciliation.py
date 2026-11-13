import uuid
from datetime import datetime, timezone
import pytest
from app.core.security import create_access_token, get_password_hash
from app.modules.auth.infrastructure.models import UserModel
from app.modules.tenants.infrastructure.models import TenantModel, TenantMembershipModel
from app.modules.tenants.domain.entities import TenantRole
from app.modules.products.infrastructure.models import ProductModel
from app.modules.inventory.application.use_cases import ReconcileInventoryUseCase, reconcile_inventory


def test_reconciliation_empty_tenant(client):
    """
    Validar que tenant sem produtos retorna relatório íntegro com zero verificações.
    """
    res = client.get("/api/inventory/reconciliation")
    assert res.status_code == 200
    data = res.json()
    assert data["is_reconciled"] is True
    assert data["total_products_checked"] == 0
    assert data["discrepant_products_count"] == 0
    assert data["discrepancies"] == []
    assert "generated_at" in data


def test_reconciliation_zero_discrepancies(client):
    """
    Validar cenário íntegro com múltiplos produtos e movimentações:
    - Produto 1: saldo inicial 0, 2 entradas (IN) e 1 saída (OUT)
    - Produto 2: saldo inicial 50.0, 1 ajuste (ADJUSTMENT) para 35.0
    - Produto 3: saldo inicial 10.0, soft-deleted (PRODUCT_DELETED registrado)
    Equação contábil deve fechar com 100% de precisão (is_reconciled = True).
    """
    # Produto 1
    p1 = client.post("/api/products", json={
        "name": "Cimento CP II 50kg",
        "unit": "SC",
        "initial_quantity": 0,
    }).json()
    p1_id = p1["id"]

    client.post("/api/inventory/in", json={
        "product_id": p1_id,
        "quantity": 20.0,
        "reason": "Lote 1",
    }, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    client.post("/api/inventory/in", json={
        "product_id": p1_id,
        "quantity": 30.0,
        "reason": "Lote 2",
    }, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    client.post("/api/inventory/out", json={
        "product_id": p1_id,
        "quantity": 15.0,
        "reason": "Uso em obra",
    }, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    # Produto 2
    p2 = client.post("/api/products", json={
        "name": "Tinta Acrílica Fosca 18L",
        "unit": "GL",
        "initial_quantity": 50.0,
    }).json()
    p2_id = p2["id"]

    client.post("/api/inventory/adjustment", json={
        "product_id": p2_id,
        "quantity": 35.0,
        "reason": "Inventário físico rotativo",
    }, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    # Produto 3 (soft deleted)
    p3 = client.post("/api/products", json={
        "name": "Tubo PVC Soldável 25mm",
        "unit": "BR",
        "initial_quantity": 10.0,
    }).json()
    p3_id = p3["id"]
    client.delete(f"/api/products/{p3_id}")

    # Executa reconciliação contábil via API
    res = client.get("/api/inventory/reconciliation")
    assert res.status_code == 200
    report = res.json()

    assert report["is_reconciled"] is True
    assert report["total_products_checked"] == 3
    assert report["discrepant_products_count"] == 0
    assert report["discrepancies"] == []


def test_reconciliation_forced_discrepancy_detection(client, db_session, default_tenant):
    """
    Validar detecção precisa de discrepância quando o saldo do produto
    é adulterado diretamente no banco (simulando corrupção ou bug externo).
    """
    p = client.post("/api/products", json={
        "name": "Argamassa AC-III 20kg",
        "unit": "SC",
        "initial_quantity": 100.0,
    }).json()
    p_id = p["id"]

    # Adiciona movimentações normais
    client.post("/api/inventory/out", json={
        "product_id": p_id,
        "quantity": 25.0,
        "reason": "Saída de estoque",
    }, headers={"X-Idempotency-Key": str(uuid.uuid4())})

    # Saldo esperado pelo livro-razão: 100.0 - 25.0 = 75.0 (75000 scaled)
    # Forçamos uma adulteração em products.current_quantity diretamente no banco: 80.0 (80000 scaled)
    db_product = db_session.query(ProductModel).filter(ProductModel.id == uuid.UUID(p_id)).first()
    db_product.current_quantity = 80000  # +5.0 SC de divergência positiva
    db_session.commit()

    res = client.get("/api/inventory/reconciliation")
    assert res.status_code == 200
    report = res.json()

    assert report["is_reconciled"] is False
    assert report["total_products_checked"] == 1
    assert report["discrepant_products_count"] == 1
    assert len(report["discrepancies"]) == 1

    disc = report["discrepancies"][0]
    assert disc["product_id"] == p_id
    assert disc["product_name"] == "Argamassa AC-III 20kg"
    assert disc["current_quantity"] == 80.0
    assert disc["expected_quantity"] == 75.0
    assert disc["difference"] == 5.0
    assert disc["has_discrepancy"] is True


def test_reconciliation_multi_tenant_isolation(client, db_session, default_user, default_tenant):
    """
    Garantir que a auditoria contábil respeita estritamente o isolamento multi-tenant:
    - Tenant A possui produtos íntegros.
    - Tenant B possui produto com discrepância forçada.
    - A auditoria de Tenant A NUNCA enxerga os produtos ou discrepâncias de Tenant B.
    """
    # 1. Tenant A cria produto íntegro
    p_a = client.post("/api/products", json={
        "name": "Produto Tenant A",
        "unit": "UN",
        "initial_quantity": 10.0,
    }).json()

    # 2. Cria Tenant B e vincula default_user como OWNER
    tenant_b = TenantModel(
        name="Tenant B Corporativo",
        slug="tenant-b-corp",
        description="Tenant isolado B",
        is_active=True,
    )
    db_session.add(tenant_b)
    db_session.commit()
    db_session.refresh(tenant_b)

    membership_b = TenantMembershipModel(
        user_id=default_user.id,
        tenant_id=tenant_b.id,
        role="OWNER",
    )
    db_session.add(membership_b)
    db_session.commit()

    token_b = create_access_token({"sub": str(default_user.id), "email": default_user.email})
    headers_b = {
        "Authorization": f"Bearer {token_b}",
        "X-Tenant-ID": str(tenant_b.id),
    }

    # Tenant B cria produto
    p_b = client.post("/api/products", json={
        "name": "Produto Tenant B",
        "unit": "UN",
        "initial_quantity": 50.0,
    }, headers=headers_b).json()

    # Força discrepância exclusiva no Produto do Tenant B
    db_prod_b = db_session.query(ProductModel).filter(ProductModel.id == uuid.UUID(p_b["id"])).first()
    db_prod_b.current_quantity = 60000  # +10.0 de divergência
    db_session.commit()

    # 3. Reconciliação do Tenant A deve reportar 100% íntegro (1 produto verificado, 0 discrepâncias)
    res_a = client.get("/api/inventory/reconciliation")
    assert res_a.status_code == 200
    report_a = res_a.json()
    assert report_a["is_reconciled"] is True
    assert report_a["total_products_checked"] == 1
    assert report_a["discrepant_products_count"] == 0
    assert report_a["discrepancies"] == []

    # 4. Reconciliação do Tenant B deve acusar a discrepância
    res_b = client.get("/api/inventory/reconciliation", headers=headers_b)
    assert res_b.status_code == 200
    report_b = res_b.json()
    assert report_b["is_reconciled"] is False
    assert report_b["total_products_checked"] == 1
    assert report_b["discrepant_products_count"] == 1
    assert report_b["discrepancies"][0]["product_id"] == p_b["id"]


def test_reconciliation_rbac_permissions(client, db_session, default_tenant):
    """
    Validar matriz de controle de acesso (RBAC):
    - OWNER, GESTOR e AUDITOR: autorizados (200 OK)
    - ALMOXARIFE: bloqueado com HTTP 403 Forbidden
    - Sem autenticação: HTTP 401 Unauthorized
    """
    def create_user_with_role(role_name: str, email: str) -> dict:
        user = UserModel(
            email=email,
            password_hash=get_password_hash("SenhaForte123"),
            full_name=f"User {role_name}",
            is_active=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        membership = TenantMembershipModel(
            user_id=user.id,
            tenant_id=default_tenant.id,
            role=role_name,
        )
        db_session.add(membership)
        db_session.commit()

        token = create_access_token({"sub": str(user.id), "email": user.email})
        return {
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": str(default_tenant.id),
        }

    # GESTOR -> 200
    headers_gestor = create_user_with_role("GESTOR", "gestor@empresa.com")
    res_gestor = client.get("/api/inventory/reconciliation", headers=headers_gestor)
    assert res_gestor.status_code == 200

    # AUDITOR -> 200
    headers_auditor = create_user_with_role("AUDITOR", "auditor@empresa.com")
    res_auditor = client.get("/api/inventory/reconciliation", headers=headers_auditor)
    assert res_auditor.status_code == 200

    # ALMOXARIFE -> 403 Forbidden
    headers_almoxarife = create_user_with_role("ALMOXARIFE", "almoxarife@empresa.com")
    res_almoxarife = client.get("/api/inventory/reconciliation", headers=headers_almoxarife)
    assert res_almoxarife.status_code == 403
    assert "insufficient-permissions" in res_almoxarife.json().get("type", "").lower()

    # Sem autenticação -> 401 Unauthorized
    res_no_auth = client.get(
        "/api/inventory/reconciliation",
        headers={"Authorization": "", "X-Tenant-ID": str(default_tenant.id)},
    )
    assert res_no_auth.status_code in (401, 403)


def test_reconciliation_use_case_and_helper_direct(db_session, default_tenant):
    """
    Validar invocação direta de ReconcileInventoryUseCase e da função utilitária reconcile_inventory.
    """
    use_case = ReconcileInventoryUseCase(db_session)
    report1 = use_case.execute(default_tenant.id)
    assert report1.is_reconciled is True
    assert report1.total_products_checked == 0

    report2 = reconcile_inventory(db_session, default_tenant.id)
    assert report2.is_reconciled is True
    assert report2.tenant_id == default_tenant.id
