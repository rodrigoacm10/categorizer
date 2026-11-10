# Plano Detalhado de Implementação do Backend (TASKS)
## Decomposição de Tarefas Técnicas, Pré-condições e Critérios de Aceitação

---

## 1. Visão Geral e Estratégia de Execução

Este documento decompõe o desenvolvimento do Backend em fases e tarefas atômicas sequenciais. Cada tarefa possui escopo estrito de arquivos a serem criados ou alterados, pré-condições bem definidas e procedimentos claros de validação e testes.

> [!IMPORTANT]
> **Regra de Execução:** Nenhuma tarefa deve ser iniciada sem que sua predecessora esteja concluída, com testes verdes e aprovação formal. Conforme determinação arquitetural, o código de produção conecta-se unicamente ao **PostgreSQL 16 via Docker**, sem qualquer uso de SQLite.

---

## 2. Visão Geral das Fases

```mermaid
flowchart TD
    T1["Task 1: Alinhamento e Refatoração da Base<br/>(PostgreSQL nativo, Alembic, limpeza de SQLite)"]
    T2["Task 2: Módulo de Idempotência Robusta<br/>(RFC 9474, Hasher SHA-256, Cache & Guards)"]
    T3["Task 3: Módulo de Produtos & Categorias<br/>(Clean Arch, N:N, Escala x1000, Soft-Delete)"]
    T4["Task 4: Módulo do Livro-Razão (Ledger)<br/>(Append-Only, Locks Pessimistas FOR UPDATE, Saldo >= 0)"]
    T5["Task 5: Suíte de Testes e Validação Concorrente<br/>(PostgreSQL real, Testes de Carga & Race Conditions)"]

    T1 --> T2
    T2 --> T3
    T3 --> T4
    T4 --> T5
```

---

## Task 1: Alinhamento e Refatoração da Base (PostgreSQL + Alembic)

### 1.1. Contexto e Objetivo
Eliminar qualquer menção ou dependência de SQLite do código de produção e de configurações do backend. Padronizar a conexão exclusivamente para o PostgreSQL 16 configurado via Docker Compose, estruturar o versionamento do banco de dados utilizando **Alembic** e adequar os modelos SQLAlchemy aos tipos nativos estritos do PostgreSQL (`UUID`, `BigInteger`, `TIMESTAMP WITH TIME ZONE`).

### 1.2. Subtarefas Detalhadas

- [ ] **Subtarefa 1.1: Adição de Dependências de Migração**
  - **Arquivos:** `backend/requirements.txt`
  - **Ação:** Incluir a dependência `alembic>=1.13.0` no arquivo de dependências do backend.
  - **Validação:** Instalar no ambiente virtual (`pip install -r backend/requirements.txt`) e verificar a disponibilidade do comando `alembic --version`.

- [ ] **Subtarefa 1.2: Purga Completa de SQLite no Código de Produção**
  - **Arquivos:**
    - `backend/app/shared/infrastructure/database.py`
    - `backend/app/core/config.py`
    - `.env.example`
  - **Ação:**
    - Remover todas as verificações condicionais `is_sqlite`, eventos de PRAGMA de SQLite (`PRAGMA journal_mode=WAL`), parâmetros `check_same_thread`.
    - Configurar a engine SQLAlchemy exclusivamente com `pool_pre_ping=True`, `pool_size=10`, `max_overflow=20` voltados para PostgreSQL.
    - Assegurar que `settings.DATABASE_URL` aponte exclusivamente para PostgreSQL:
      `postgresql+psycopg2://postgres:postgres@localhost:5432/estoque_db`.

- [ ] **Subtarefa 1.3: Refatoração dos Modelos SQLAlchemy para Tipos Nativos PostgreSQL**
  - **Arquivos:**
    - `backend/app/modules/products/infrastructure/models.py`
    - `backend/app/modules/inventory/infrastructure/models.py`
    - `backend/app/modules/idempotency/infrastructure/models.py`
  - **Ação:**
    - Substituir `Column(String(36))` por `Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)` utilizando `from sqlalchemy.dialects.postgresql import UUID`.
    - Substituir `Column(DateTime)` por `Column(DateTime(timezone=True), nullable=False, default=utc_now)`.
    - Assegurar que todas as colunas de quantidade usem `BigInteger` (`nullable=False`).
    - Configurar chave estrangeira de `stock_movements.product_id` com `ForeignKey("products.id", ondelete="RESTRICT")` para impedir fisicamente exclusões em cascata.
    - Remover `cascade="all, delete-orphan"` da relação `Product.movements` (o Ledger é estritamente independente e nunca sofre exclusão de registros).

- [ ] **Subtarefa 1.4: Desacoplamento da Criação de Tabelas no Runtime**
  - **Arquivos:** `backend/app/main.py`
  - **Ação:**
    - Remover `Base.metadata.create_all(bind=engine)` do `backend/app/main.py`. A responsabilidade de estruturar o banco cabe exclusivamente ao Alembic.
    - Migrar rotina inicial de seed de categorias para um script ou comando de seed independente acionável sob demanda.

- [ ] **Subtarefa 1.5: Configuração e Inicialização do Alembic**
  - **Arquivos:**
    - `backend/alembic.ini`
    - `backend/alembic/env.py`
    - `backend/alembic/script.py.mako`
  - **Ação:**
    - Inicializar estrutura Alembic em `backend/alembic/`.
    - Em `backend/alembic/env.py`:
      - Importar `app.core.config.settings` e atribuir `config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)`.
      - Importar `Base.metadata` e registrar explicitamente todos os modelos (`Product`, `Category`, `product_categories`, `StockMovement`, `IdempotencyRecord`) em `target_metadata`.

- [ ] **Subtarefa 1.6: Geração da Migração Inicial e Teste de Aplicação**
  - **Arquivos:** `backend/alembic/versions/*_initial_schema.py`
  - **Ação:**
    - Subir o banco PostgreSQL via `docker-compose up -d postgres`.
    - Executar `alembic revision --autogenerate -m "0001_initial_schema"`.
    - Inspecionar a migração gerada, validando a integridade das tabelas (`categories`, `products`, `product_categories`, `stock_movements`, `idempotency_records`).
    - Executar `alembic upgrade head` contra o PostgreSQL e conferir as tabelas criadas via `psql`.

### 1.3. Critérios de Aceitação da Task 1
1. Nenhuma linha de código sob `backend/app/` faz referência a `sqlite`, `test_estoque.db` ou `check_same_thread`.
2. O container PostgreSQL 16 sobe via Docker Compose e aceita conexões na porta 5432.
3. `alembic upgrade head` executa sem erros gerando o schema correto no PostgreSQL.
4. `alembic downgrade base` e subsequente `alembic upgrade head` executam com sucesso atestando a reversibilidade da migração.

---

## Task 2: Módulo de Idempotência e Tolerância a Falhas (RFC 9474)

### 2.1. Contexto e Objetivo
Implementar a infraestrutura de controle de idempotência gerenciada 100% pelo backend, blindando a aplicação contra envios concorrentes e retransmissões de rede decorrentes de duplo clique ou perda de conectividade.

### 2.2. Subtarefas Detalhadas

- [ ] **Subtarefa 2.1: Domain e Value Objects de Idempotência**
  - **Arquivos:**
    - `backend/app/modules/idempotency/domain/entities.py`
    - `backend/app/modules/idempotency/domain/enums.py`
    - `backend/app/modules/idempotency/domain/repositories.py`
  - **Ação:**
    - Definir `IdempotencyStatus` (`PROCESSING`, `COMPLETED`, `FAILED`).
    - Definir interface `IIdempotencyRepository` com métodos: `get_by_key(key)`, `save(record)`, `update_status(key, status, response_code, response_body)`.

- [ ] **Subtarefa 2.2: Repositório SQLAlchemy e Persistência**
  - **Arquivos:** `backend/app/modules/idempotency/infrastructure/repositories.py`
  - **Ação:**
    - Implementar `SQLAlchemyIdempotencyRepository` operando sobre a sessão SQLAlchemy com suporte a flush atômico.

- [ ] **Subtarefa 2.3: Hasher Semântico da Intenção (SHA-256)**
  - **Arquivos:** `backend/app/modules/idempotency/interfaces/hasher.py`
  - **Ação:**
    - Criar função utilitária para normalizar payloads JSON (ordenação alfabética de chaves, remoção de espaços em branco).
    - Gerar hash SHA-256 combinando: `HTTP_METHOD + "|" + PATH + "|" + CANONICAL_JSON`.

- [ ] **Subtarefa 2.4: Guard / Interceptor de Idempotência no FastAPI**
  - **Arquivos:** `backend/app/modules/idempotency/interfaces/guard.py`
  - **Ação:**
    - Implementar dependência FastAPI injetável (`IdempotencyGuard`) que:
      1. Lê o cabeçalho `X-Idempotency-Key`.
      2. Se ausente, permite fluxo direto com verificação temporal contra duplo clique.
      3. Se presente, busca a chave no banco:
         - Se `COMPLETED` com mesmo hash: faz replay imediato da resposta armazenada (`HTTP 200/201`, adicionando header `X-Cache: HIT`).
         - Se `COMPLETED` com hash diferente: levanta `HTTPException(409, detail="Idempotency key reused for different payload")`.
         - Se `PROCESSING`: levanta `HTTPException(409, detail="A request with this idempotency key is currently being processed")`.
      4. Se nova: registra como `PROCESSING` e prossegue com a execução.
      5. Ao concluir o use case, atualiza o registro com `COMPLETED` e os dados da resposta.

- [ ] **Subtarefa 2.5: Testes Unitários e de Integração de Idempotência**
  - **Arquivos:** `backend/tests/test_idempotency.py`
  - **Ação:**
    - Testar replay idêntico com validação de `X-Cache: HIT`.
    - Testar conflito de hash retornando HTTP 409.
    - Testar concorrência simultânea da mesma chave gerando bloqueio.

### 2.3. Critérios de Aceitação da Task 2
1. Retentativas idênticas com a mesma chave retornam o payload salvo e header `X-Cache: HIT` sem tocar na lógica de negócio nem alterar o estoque.
2. Reenvios com parâmetros alterados usando chave pré-existente resultam em `HTTP 409 Conflict`.
3. 100% dos testes de idempotência passam sem falhas contra o PostgreSQL.

---

## Task 3: Módulo de Produtos e Categorias (Catálogo)

### 3.1. Contexto e Objetivo
Implementar o catálogo de produtos e categorias sob Clean Architecture Modular, garantindo relacionamento N:N atômico, conversão estrita de quantidades com escala inteira fixa $10^3$ e soft-delete seguro vinculado a evento contábil.

### 3.2. Subtarefas Detalhadas

- [ ] **Subtarefa 3.1: Entidades de Domínio e Contratos**
  - **Arquivos:**
    - `backend/app/modules/products/domain/entities.py`
    - `backend/app/modules/products/domain/repositories.py`
  - **Ação:**
    - Definir entidades puras `Product` e `Category`.
    - Definir interfaces `IProductRepository` e `ICategoryRepository`.

- [ ] **Subtarefa 3.2: DTOs e Conversão de Escala Fixa ($10^3$)**
  - **Arquivos:** `backend/app/modules/products/application/dtos.py`
  - **Ação:**
    - Criar schemas Pydantic v2:
      - `ProductCreateDTO` (aceita `min_stock` como `float`, converte internamente para `int` escalado x1000).
      - `ProductUpdateDTO`.
      - `ProductResponseDTO` (expõe `current_quantity`, `current_quantity_raw`, `formatted_quantity`, `is_low_stock`).
      - `CategoryCreateDTO`, `CategoryResponseDTO`.

- [ ] **Subtarefa 3.3: Casos de Uso (Application Layer)**
  - **Arquivos:** `backend/app/modules/products/application/use_cases.py`
  - **Ação:**
    - Implementar `CreateProductUseCase`: persiste o produto e associa a lista de categorias em transação atômica.
    - Implementar `ListProductsUseCase`: suporta filtros por categoria, busca textual e filtro `low_stock_only`.
    - Implementar `GetProductByIdUseCase`.
    - Implementar `UpdateProductUseCase`: atualiza metadados cadastrais sem violar saldos físicos.
    - Implementar `SoftDeleteProductUseCase`: marca `is_active = False`, preenche `deleted_at` e delega ao Unit of Work a criação do evento `PRODUCT_DELETED` no Ledger.
    - Implementar `CategoryUseCases` (Listar, Criar, Deletar).

- [ ] **Subtarefa 3.4: Repositórios Concretos SQLAlchemy**
  - **Arquivos:** `backend/app/modules/products/infrastructure/repositories.py`
  - **Ação:**
    - Implementar consultas otimizadas utilizando `selectinload` ou `joinedload` para carregar categorias N:N sem problemas de N+1 queries.

- [ ] **Subtarefa 3.5: Router e Endpoints FastAPI**
  - **Arquivos:** `backend/app/modules/products/interfaces/router.py`
  - **Ação:**
    - Mapear rotas RESTful descritas na especificação (`POST /api/products`, `GET /api/products`, etc.) com injeção de dependências do FastAPI.

### 3.3. Critérios de Aceitação da Task 3
1. Cadastro de produto com múltiplas categorias persiste corretamente na tabela relacional associativa `product_categories`.
2. Leitura de produto retorna `is_low_stock: true` sempre que `current_quantity <= min_stock`.
3. Inativação do produto marca `is_active = false` e o oculta das listagens padrão, preservando seus registros no banco.

---

## Task 4: Módulo do Livro-Razão de Estoque (Append-Only Ledger & Concorrência)

### 4.1. Contexto e Objetivo
Implementar o Livro-Razão contábil perpétuo de movimentações (`stock_movements`), assegurando imutabilidade irrestrita (proibição de `UPDATE` e `DELETE`), serialização atômica de concorrência com locks pessimistas (`SELECT ... FOR UPDATE`) e prevenção estrita de saldo negativo.

### 4.2. Subtarefas Detalhadas

- [ ] **Subtarefa 4.1: Entidades de Domínio e Enums Contábeis**
  - **Arquivos:**
    - `backend/app/modules/inventory/domain/entities.py`
    - `backend/app/modules/inventory/domain/enums.py`
    - `backend/app/modules/inventory/domain/exceptions.py`
  - **Ação:**
    - Definir `MovementType` (`IN`, `OUT`, `ADJUSTMENT`, `PRODUCT_DELETED`).
    - Definir exceção de domínio `InsufficientStockError` e `InvalidMovementError`.

- [ ] **Subtarefa 4.2: Unit of Work com Lock Pessimista**
  - **Arquivos:**
    - `backend/app/modules/inventory/domain/repositories.py`
    - `backend/app/modules/inventory/infrastructure/unit_of_work.py`
    - `backend/app/modules/inventory/infrastructure/repositories.py`
  - **Ação:**
    - Implementar `InventoryUnitOfWork` gerenciando ciclo transacional com `__enter__` e `__exit__`.
    - Implementar `get_product_for_update(product_id)` que executa a query com `.with_for_update()`, bloqueando a linha no PostgreSQL durante o cálculo e inserção do movimento.
    - Implementar `StockMovementRepository` com apenas métodos de inserção (`append`) e leitura (`list_by_product`, `list_all`). Não implementar nenhum método de `update` ou `delete`.

- [ ] **Subtarefa 4.3: Casos de Uso do Ledger**
  - **Arquivos:** `backend/app/modules/inventory/application/use_cases.py`
  - **Ação:**
    - Implementar `RegisterStockInUseCase`:
      - Trava o produto com `with_for_update()`.
      - Incrementa saldo: $\text{balance\_after} = \text{current} + q$.
      - Insere lançamento no Ledger (`type = IN`, `quantity = +q`, `balance_after`).
      - Atualiza `Product.current_quantity = balance_after`.
    - Implementar `RegisterStockOutUseCase`:
      - Trava o produto com `with_for_update()`.
      - Valida: se $\text{current} < q$, aborta com `InsufficientStockError`.
      - Decrementa saldo: $\text{balance\_after} = \text{current} - q$.
      - Insere lançamento no Ledger (`type = OUT`, `quantity = -q`, `balance_after`).
      - Atualiza `Product.current_quantity = balance_after`.
    - Implementar `RegisterStockAdjustmentUseCase`:
      - Trava o produto.
      - Calcula $\Delta = Q_{\text{novo}} - Q_{\text{atual}}$.
      - Grava no Ledger (`type = ADJUSTMENT`, `quantity = Delta`, `balance_after = Q_novo`).
      - Atualiza `Product.current_quantity = Q_novo`.
    - Implementar `GetLedgerUseCase`:
      - Retorna extrato histórico paginado com filtros de produto, período e tipo de evento.

- [ ] **Subtarefa 4.4: Schemas DTO e Router FastAPI**
  - **Arquivos:**
    - `backend/app/modules/inventory/application/dtos.py`
    - `backend/app/modules/inventory/interfaces/router.py`
  - **Ação:**
    - Criar DTOs com validação de quantidades positivas e conversão x1000.
    - Prover endpoints: `POST /api/inventory/in`, `POST /api/inventory/out`, `POST /api/inventory/adjustment`, `GET /api/inventory/movements`.

### 4.3. Critérios de Aceitação da Task 4
1. Todas as movimentações geram linhas novas em `stock_movements`; nenhuma linha é alterada ou removida.
2. Tentativa de saída maior do que o saldo físico retorna `HTTP 422 Unprocessable Entity` e preserva o saldo intacto.
3. Ajuste de inventário grava o delta exato ($\Delta$) e reflete o novo saldo apurado no produto.
4. Requisições concorrentes de saída para o mesmo produto são serializadas pelo PostgreSQL via lock pessimista, nunca permitindo saldo negativo.

---

## Task 5: Suíte de Testes e Validação Concorrente (PostgreSQL)

### 5.1. Contexto e Objetivo
Configurar a infraestrutura de testes automatizados para rodar exclusivamente contra uma base PostgreSQL dedicada (garantindo paridade completa de ambiente e comportamentos de locks transacionais), executando testes de carga concorrente e auditoria de ponta a ponta.

### 5.2. Subtarefas Detalhadas

- [ ] **Subtarefa 5.1: Fixtures de Teste com PostgreSQL**
  - **Arquivos:** `backend/tests/conftest.py`
  - **Ação:**
    - Remover configuração de `sqlite:///./test_estoque.db`.
    - Configurar fixture do `pytest` para conectar a um banco PostgreSQL dedicado de testes (`estoque_test_db`).
    - Configurar ciclo de limpeza das tabelas por truncation controlada entre testes ou transações aninhadas (*nested transactions / savepoints*).

- [ ] **Subtarefa 5.2: Testes de Concorrência e Race Conditions**
  - **Arquivos:** `backend/tests/test_concurrency.py`
  - **Ação:**
    - Criar teste com `ThreadPoolExecutor` disparando 10 saídas simultâneas de 1 unidade para um produto que possui apenas 5 unidades em estoque.
    - Validar que exatamente 5 requisições obtiveram sucesso (`201 Created`) e as outras 5 foram rejeitadas com `422 Unprocessable Entity`.
    - Validar que o saldo final é exatamente 0 (e nunca negativo) e que existem exatamente 5 registros de saída no Ledger.

- [ ] **Subtarefa 5.3: Testes de Integridade de Idempotência e Auditoria Completa**
  - **Arquivos:** `backend/tests/test_audit_flow.py`
  - **Ação:**
    - Executar fluxo completo: Cadastro de Produto -> Entrada de 10 UN -> Saída de 4 UN -> Ajuste para 8 UN -> Descontinuação do Produto (`PRODUCT_DELETED`).
    - Requisitar extrato histórico do produto e verificar que a somatória dos deltas confere matematicamente com o saldo registrado.
    - Testar retentativa de cada requisição com a mesma `X-Idempotency-Key` e assegurar que nenhuma duplicação ocorreu no Ledger.

### 5.3. Critérios de Aceitação da Task 5
1. Toda a suíte de testes do pytest roda 100% verde contra o PostgreSQL sem nenhuma menção a SQLite.
2. O teste de concorrência comprova que o bloqueio pessimista impede corrida de dados e bloqueia estoque negativo.
3. A integridade contábil do Ledger é validada com assertivas matemáticas em todos os cenários de teste.
