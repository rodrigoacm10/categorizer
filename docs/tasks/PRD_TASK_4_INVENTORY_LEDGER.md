# PRD - Task 4: Módulo do Livro-Razão (Append-Only Ledger & Concorrência)

---

## 1. Identificação da Tarefa
- **Identificador:** `TASK-05` (anteriormente `TASK-04`)
- **Nome:** Módulo do Livro-Razão Imutável e Bloqueio Concorrente Pessimista Multi-Tenant
- **Escopo:** Livro-Razão (`stock_movements`) com `tenant_id`, Transações ACID, Unit of Work escopado por tenant, `SELECT ... FOR UPDATE`, Prevenção de Saldo Negativo e Extrato Histórico
- **Responsável:** `code_implementer` (supervisionado por `orchestrator`)
- **Status:** Planejada / Depende das Tasks 1, 2, 3 e 4
- **Requisito Mandatório de Qualidade:** **Cobertura de testes unitários e de integração $\ge 80\%$** aferida via `pytest-cov`.

---

## 2. Contexto e Justificativa de Engenharia

Em sistemas simplistas de estoque, comandos diretos de `UPDATE products SET quantity = quantity - ?` são fonte constante de inconsistências graves:
- Perda irreparável do histórico contábil (quem alterou, quando e por quê).
- Corrupção de dados por concorrência (duas baixas simultâneas leem o mesmo saldo e uma sobrescreve a outra).
- Risco de estoque negativo se não houver isolamento transacional estrito.

A solução contábil deste sistema fundamenta-se no padrão **Livro-Razão Imutável (Append-Only Ledger)**:
1. **Imutabilidade Absoluta:** É terminantemente proibido executar `UPDATE` ou `DELETE` sobre registros de movimentação (`stock_movements`). Toda alteração física é um novo lançamento cronológico cumulativo.
2. **Serialização Pessimista:** Toda movimentação de estoque exige bloqueio exclusivo da linha do produto no PostgreSQL (`SELECT ... FOR UPDATE`), serializando operações concorrentes.
3. **Não-Negatividade de Saldo:** Operações de saída que demandem quantidade superior ao saldo disponível são rejeitadas atomicamente no domínio (`InsufficientStockError`), retornando `HTTP 422`.

---

## 3. Requisitos Funcionais e Arquiteturais

### 3.1. RF-01: Domínio e Tipos de Movimentação Contábil
- Em `app/modules/inventory/domain/enums.py`:
  ```python
  from enum import Enum

  class MovementType(str, Enum):
      IN = "IN"                          # Entrada física (+ delta)
      OUT = "OUT"                        # Saída física (- delta)
      ADJUSTMENT = "ADJUSTMENT"          # Ajuste de inventário físico (+ ou - delta)
      PRODUCT_DELETED = "PRODUCT_DELETED"# Evento de inativação de produto (delta = 0)
  ```
- Em `app/modules/inventory/domain/exceptions.py`:
  - `InsufficientStockError(product_id: UUID, current: int, requested: int)`: Mapeado para `HTTP 422 Unprocessable Entity` (RFC 7807).
  - `InvalidMovementError(detail: str)`: Mapeado para `HTTP 400 Bad Request`.
- Em `app/modules/inventory/domain/entities.py`:
  - Entidade pura `StockMovement` contendo `id`, `tenant_id`, `product_id`, `type`, `quantity` (delta em escala $10^3$), `balance_after`, `reason`, `idempotency_key`, `created_at`.

### 3.2. RF-02: Modelo de Persistência no PostgreSQL
- Em `app/modules/inventory/infrastructure/models.py`:
  ```python
  class StockMovementModel(Base):
      __tablename__ = "stock_movements"

      id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
      tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)
      product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
      type = Column(String(32), nullable=False)
      quantity = Column(BigInteger, nullable=False)          # Delta (+ ou -) em escala x1000
      balance_after = Column(BigInteger, nullable=False)     # Saldo resultante em escala x1000
      reason = Column(Text, nullable=True)
      idempotency_key = Column(String(255), nullable=True, index=True)
      created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
  ```
- **Regra de Repositório:** A classe `StockMovementRepository` disponibiliza unicamente os métodos `append(movement)` e métodos de consulta (`list_by_product`, `list_all`). Não implementar nenhum método de `update` ou `delete`.

### 3.3. RF-03: Padrão Unit of Work com Bloqueio Pessimista (`FOR UPDATE`)
- Em `app/modules/inventory/infrastructure/unit_of_work.py`:
  - Implementar gerenciador de contexto transacional:
    ```python
    class InventoryUnitOfWork:
        def __init__(self, session_factory):
            self.session_factory = session_factory

        def __enter__(self):
            self.session = self.session_factory()
            self.products = ProductRepository(self.session)
            self.movements = StockMovementRepository(self.session)
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            if exc_type:
                self.session.rollback()
            else:
                self.session.commit()
            self.session.close()

        def get_product_for_update(self, product_id: UUID) -> Optional[ProductModel]:
            # Trava a linha exclusivamente no PostgreSQL até o término da transação:
            return self.session.query(ProductModel).filter(
                ProductModel.id == product_id,
                ProductModel.is_active == True
            ).with_for_update().first()
    ```

### 3.4. RF-04: Casos de Uso do Ledger
- Em `app/modules/inventory/application/use_cases.py`:
  1. **`RegisterStockInUseCase`:**
     - Valida `quantity > 0`.
     - Obtém lock pessimista no produto via `uow.get_product_for_update(product_id)`.
     - Calcula: `balance_after = product.current_quantity + quantity`.
     - Atualiza: `product.current_quantity = balance_after`.
     - Insere registro no Ledger: `type = "IN"`, `quantity = +quantity`, `balance_after = balance_after`.
     - Transação comita atomicamente e retorna DTO com dados do movimento e novo saldo.
  2. **`RegisterStockOutUseCase`:**
     - Valida `quantity > 0`.
     - Obtém lock pessimista no produto via `uow.get_product_for_update(product_id)`.
     - **Validação Estrita:** Se `product.current_quantity < quantity`, lança `InsufficientStockError`.
     - Calcula: `balance_after = product.current_quantity - quantity`.
     - Atualiza: `product.current_quantity = balance_after`.
     - Insere registro no Ledger: `type = "OUT"`, `quantity = -quantity`, `balance_after = balance_after`.
     - Comita e retorna confirmação.
  3. **`RegisterStockAdjustmentUseCase`:**
     - Valida motivo obrigatório (não pode ser nulo ou vazio).
     - Valida `new_quantity >= 0`.
     - Obtém lock pessimista no produto.
     - Calcula delta real: $\Delta = \text{new\_quantity} - \text{product.current\_quantity}$.
     - Atualiza: `product.current_quantity = new_quantity`.
     - Insere registro no Ledger: `type = "ADJUSTMENT"`, `quantity = Delta`, `balance_after = new_quantity`.
     - Comita e retorna confirmação com o delta apurado.
  4. **`GetLedgerUseCase`:**
     - Consulta histórica paginada com filtros opcionais: `product_id`, `type`, `start_date`, `end_date`, `limit`, `offset`.
     - Ordenação padrão estrita: cronológica decrescente (`created_at DESC`).

### 3.5. RF-05: Schemas DTO e Endpoints RESTful
- Em `app/modules/inventory/interfaces/router.py`:
  - `POST /api/inventory/in` (201 Created)
  - `POST /api/inventory/out` (201 Created / 422 Unprocessable Entity)
  - `POST /api/inventory/adjustment` (201 Created)
  - `GET /api/inventory/movements` (200 OK)

---

## 4. Requisito de Cobertura de Testes ($\ge 80\%$)

### 4.1. Meta de Cobertura
- A cobertura de testes do módulo `app/modules/inventory/` deve ser **$\ge 80\%$** nas camadas de domínio, Unit of Work, casos de uso e endpoints.

### 4.2. Casos de Teste Obrigatórios
1. **`test_stock_in_increases_balance_and_appends_ledger`:** Validar incremento de saldo e inserção de registro `IN` com delta positivo.
2. **`test_stock_out_decreases_balance_and_appends_ledger`:** Validar decremento de saldo e inserção de registro `OUT` com delta negativo.
3. **`test_stock_out_insufficient_stock_rejection`:** Tentar dar saída em quantidade maior do que o saldo atual. Validar lançamento de `InsufficientStockError`, resposta HTTP 422 e saldo inalterado.
4. **`test_stock_adjustment_positive_and_negative_delta`:** Testar ajuste aumentando o saldo (delta positivo) e ajuste reduzindo o saldo (delta negativo).
5. **`test_ledger_immutability_no_delete_no_update`:** Garantir que o repositório não expõe métodos mutatórios e que tentativas diretas de delete no banco violam integridade.
6. **`test_ledger_mathematical_reconciliation`:** Validar que para qualquer sequência de movimentações, $\sum \text{quantity}_i = \text{Product.current\_quantity}$.

---

## 5. Critérios de Aceitação (DoD)

- [ ] Todas as movimentações registradas exclusivamente via inserções (*Append-Only*) em `stock_movements`.
- [ ] Bloqueio concorrente pessimista implementado com `with_for_update()`.
- [ ] Saídas que causem saldo negativo bloqueadas com HTTP 422.
- [ ] Relatório do pytest com `pytest --cov=app/modules/inventory` registrando **cobertura $\ge 80\%$**.