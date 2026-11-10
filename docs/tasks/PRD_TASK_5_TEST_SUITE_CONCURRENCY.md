# PRD - Task 5: Suíte de Testes, Validação Concorrente e Cobertura ($\ge 80\%$)

---

## 1. Identificação da Tarefa
- **Identificador:** `TASK-05`
- **Nome:** Suíte de Testes de Concorrência, Auditoria e Validação de Cobertura
- **Escopo:** Fixtures com PostgreSQL Real, Testes de Race Conditions com Threads, Fluxo Ponta a Ponta e Homologação de Cobertura
- **Responsável:** `code_implementer` (supervisionado por `orchestrator`)
- **Status:** Planejada / Depende das Tasks 1, 2, 3 e 4
- **Requisito Mandatório de Qualidade:** **Cobertura global de código do backend $\ge 80\%$** aferida via `pytest-cov` com flag de bloqueio `--cov-fail-under=80`.

---

## 2. Contexto e Justificativa de Engenharia

Para sistemas transacionais de missão crítica com Livro-Razão Contábil, testes puramente unitários com mocks em memória são insuficientes para validar o comportamento real de:
1. Bloqueios pessimistas de linha (`SELECT ... FOR UPDATE`) gerenciados pelo PostgreSQL.
2. Comportamento sob concorrência agressiva de requisições paralelas disputando o mesmo item de estoque.
3. Consistência matemática contínua entre lançamentos no Ledger e o saldo dos produtos.
4. Efetividade da idempotência RFC 9474 frente a retentativas de rede de alta frequência.

Esta tarefa estrutura a esteira completa de testes automatizados executados diretamente contra o PostgreSQL, validando race conditions e garantindo a **cobertura mínima de 80%** em todo o código de produção.

---

## 3. Requisitos Funcionais e Arquiteturais

### 3.1. RF-01: Fixtures de Teste com Isolamento no PostgreSQL
- Em `backend/tests/conftest.py`:
  - Remover qualquer inicialização de banco SQLite em arquivo ou em memória.
  - Conectar a uma base de dados de testes dedicada no PostgreSQL (`estoque_test_db` ou transações gerenciadas com savepoints).
  - Padrão transacional de isolamento: cada teste roda dentro de uma transação aninhada (`connection.begin_nested()`), emitindo rollback ao término do teste. Isso garante testes ultra-rápidos sem acúmulo de estado entre cenários.
  - Disponibilizar fixtures:
    - `db_session`: Sessão SQLAlchemy isolada por transação.
    - `client`: `TestClient(app)` do FastAPI com injeção de dependências substituindo a sessão de banco.
    - `sample_product`: Criação rápida de produto com categorias para testes.

### 3.2. RF-02: Teste de Carga e Concorrência (*Race Conditions*)
- Em `backend/tests/test_concurrency.py`:
  - **Cenário de Teste de Ruptura Concorrente:**
    1. Cadastrar um produto com saldo inicial de 5 unidades (`current_quantity = 5000`).
    2. Utilizar `concurrent.futures.ThreadPoolExecutor` com 10 threads concorrentes.
    3. Cada thread tenta registrar simultaneamente uma saída de 1 unidade (`quantity = 1000`) para o mesmo produto, cada qual com sua própria chave `X-Idempotency-Key`.
    4. **Asserções Obrigatórias:**
       - Exatamente **5 requisições** devem obter sucesso (`HTTP 201 Created`).
       - Exatamente **5 requisições** devem ser rejeitadas por saldo insuficiente (`HTTP 422 Unprocessable Entity`).
       - O saldo final do produto deve ser exatamente **`0`** (nunca negativo).
       - O Livro-Razão (`stock_movements`) deve conter exatamente **5 registros de saída** de `-1000`.

### 3.3. RF-03: Teste de Fluxo Completo de Auditoria e Reconciliação Matemática
- Em `backend/tests/test_audit_flow.py`:
  - Simular o ciclo de vida operacional integral de um item:
    1. Cadastro do produto "Resina Epóxi" com `min_stock = 5.0` e categorias associadas.
    2. Entrada de 10.0 KG (`POST /api/inventory/in`).
    3. Saída de 4.0 KG (`POST /api/inventory/out`).
    4. Ajuste de inventário físico para 8.0 KG (`POST /api/inventory/adjustment`).
    5. Soft-delete do produto com motivo formal (`DELETE /api/products/{id}`).
  - **Asserções de Auditoria Contábil:**
    - Consultar extrato completo (`GET /api/inventory/movements?product_id={id}`).
    - Validar que existem 4 registros no Ledger (`IN`, `OUT`, `ADJUSTMENT`, `PRODUCT_DELETED`).
    - Validar matematicamente a reconciliação perene:
      $$\sum \text{movement.quantity} = \text{Product.current\_quantity}$$
    - Validar que o produto permanece com seus dados preservados e `is_active = False`.

### 3.4. RF-04: Teste de Replay e Integridade de Idempotência
- Repetir as requisições do fluxo de auditoria reenviando os mesmos cabeçalhos `X-Idempotency-Key`:
  - Validar recebimento de `X-Cache: HIT`.
  - Validar que nenhuma linha duplicada foi criada em `stock_movements`.

---

## 4. Requisito de Cobertura de Testes ($\ge 80\%$)

### 4.1. Meta Global de Cobertura
- A execução de `pytest` deve cobrir **pelo menos 80% das linhas** de código sob `backend/app/`.
- Módulos avaliados:
  - `app/core/` $\ge 80\%$
  - `app/shared/` $\ge 80\%$
  - `app/modules/idempotency/` $\ge 80\%$
  - `app/modules/products/` $\ge 80\%$
  - `app/modules/inventory/` $\ge 80\%$

### 4.2. Comando de Execução e Homologação
```bash
pytest --cov=app --cov-report=term-missing --cov-report=html --cov-fail-under=80
```
- Se a cobertura geral for inferior a 80%, o pipeline de validação deve falhar automaticamente com código de saída não-zero (`exit code 1`).

---

## 5. Critérios de Aceitação (DoD)

- [ ] Suíte de testes completa executando 100% verde contra o PostgreSQL.
- [ ] Teste concorrente de 10 threads comprova ausência de race conditions e bloqueia saldo negativo.
- [ ] Conciliação matemática do Ledger aprovada em asserções automatizadas.
- [ ] Relatório do `pytest-cov` registrando cobertura global **$\ge 80\%$**.
- [ ] Zero dependência de arquivos SQLite temporários.