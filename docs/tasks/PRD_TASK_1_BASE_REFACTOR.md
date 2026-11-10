# PRD - Task 1: Alinhamento e Refatoração da Base (PostgreSQL 16 & Alembic)

---

## 1. Identificação da Tarefa
- **Identificador:** `TASK-01`
- **Nome:** Alinhamento e Refatoração da Base de Persistência
- **Escopo:** Infraestrutura, Configuração de Banco, Migrações Alembic e Modelos ORM
- **Responsável:** `code_implementer` (supervisionado por `orchestrator`)
- **Status:** Planejada / Pronta para Execução
- **Requisito Mandatório de Qualidade:** **Cobertura de testes unitários e de integração $\ge 80\%$** aferida via `pytest-cov`.

---

## 2. Contexto e Justificativa de Engenharia

O protótipo inicial do backend continha código legado e condicionalidades de banco de dados SQLite (`is_sqlite`, `check_same_thread`, PRAGMAs de WAL) e chamada direta a `Base.metadata.create_all()` no ciclo de vida da aplicação (`main.py`).

Para garantir robustez industrial, suporte nativo a concorrência via `SELECT ... FOR UPDATE` e rastreabilidade estrita de esquema:
1. **O SQLite deve ser 100% purgado** do código de produção e de testes.
2. O banco de dados oficial e exclusivo é o **PostgreSQL 16** via Docker.
3. A evolução de esquema deve ser controlada exclusivamente através de migrações versionadas com **Alembic**.
4. Os modelos ORM devem utilizar tipos nativos do PostgreSQL (`postgresql.UUID`, `DateTime(timezone=True)`, `BigInteger`) e integridade referencial com `ON DELETE RESTRICT` no Ledger.

---

## 3. Requisitos Funcionais e Arquiteturais

### 3.1. RF-01: Gestão de Dependências de Migração e Testes
- Adicionar ao [backend/requirements.txt](file:///home/rodrigo/projects/extensao/backend/requirements.txt):
  - `alembic>=1.13.0`
  - `psycopg2-binary>=2.9.9`
  - `pytest-cov>=5.0.0`
- Garantir que a instalação do ambiente virtual execute sem conflitos de dependências.

### 3.2. RF-02: Purga Completa de SQLite no Código de Produção
- Em [backend/app/shared/infrastructure/database.py](file:///home/rodrigo/projects/extensao/backend/app/shared/infrastructure/database.py):
  - Remover qualquer importação ou condicional de `sqlite3`, `connect` listener com `PRAGMA journal_mode=WAL`, e `connect_args={"check_same_thread": False}`.
  - Configurar a engine do SQLAlchemy voltada exclusivamente para PostgreSQL com pool otimizado:
    ```python
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,
    )
    ```
- Em [backend/app/core/config.py](file:///home/rodrigo/projects/extensao/backend/app/core/config.py):
  - Remover qualquer fallback para `sqlite:///./estoque.db`.
  - Definir `DATABASE_URL` padrão estrito:
    `postgresql+psycopg2://postgres:postgres@localhost:5432/estoque_db`
- Em [.env.example](file:///home/rodrigo/projects/extensao/.env.example):
  - Atualizar documentação das variáveis para PostgreSQL 16.

### 3.3. RF-03: Refatoração dos Modelos ORM para Tipos Nativos PostgreSQL
- **Chaves Primárias e Estrangeiras:**
  - Substituir `String(36)` por `from sqlalchemy.dialects.postgresql import UUID`.
  - Chaves primárias: `id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)`.
- **Datas com Fuso Horário:**
  - Substituir `Column(DateTime)` por `Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))`.
- **Quantidades e Saldos:**
  - Garantir `BigInteger` para todas as colunas de quantidade física (`current_quantity`, `min_stock`, `quantity`, `balance_after`).
- **Integridade do Livro-Razão (Ledger):**
  - Em `StockMovementModel`:
    `product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)`
  - Em `ProductModel`:
    - Remover `cascade="all, delete-orphan"` do relacionamento `movements`. O histórico contábil é imutável e perene.

### 3.4. RF-04: Desacoplamento do DDL em Runtime (`main.py`)
- Em [backend/app/main.py](file:///home/rodrigo/projects/extensao/backend/app/main.py):
  - Remover completamente a chamada `Base.metadata.create_all(bind=engine)`.
  - O startup da API não deve alterar a estrutura de tabelas em tempo de execução.

### 3.5. RF-05: Inicialização e Configuração do Alembic
- Estruturar a pasta `backend/alembic/` e `backend/alembic.ini`.
- Em `backend/alembic/env.py`:
  - Carregar a URL a partir de `from app.core.config import settings; config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)`.
  - Importar e consolidar os metadados de todos os modelos ORM:
    ```python
    from app.shared.infrastructure.database import Base
    from app.modules.products.infrastructure.models import ProductModel, CategoryModel, product_categories
    from app.modules.inventory.infrastructure.models import StockMovementModel
    from app.modules.idempotency.infrastructure.models import IdempotencyRecordModel

    target_metadata = Base.metadata
    ```
- Configurar suporte a renderização de tipos nativos de `UUID` e `DateTime(timezone=True)` nas revisões.

### 3.6. RF-06: Geração da Migração Inicial e Teste de Reversibilidade
- Subir o container PostgreSQL 16 via Docker: `docker compose up -d postgres`.
- Gerar migração: `alembic revision --autogenerate -m "0001_initial_schema"`.
- Testar aplicação: `alembic upgrade head`.
- Testar rollback completo: `alembic downgrade base`.
- Reaplicar: `alembic upgrade head`.

---

## 4. Requisito de Cobertura de Testes ($\ge 80\%$)

### 4.1. Meta de Cobertura
- A suíte de testes unitários e de integração da Task 1 deve cobrir **no mínimo 80% das linhas** de:
  - `app/core/config.py`
  - `app/shared/infrastructure/database.py`
  - `app/shared/utils/scale.py`
  - Modelos ORM refatorados (`products`, `inventory`, `idempotency`).

### 4.2. Casos de Teste Obrigatórios
1. **`test_config_postgres_url`:** Validar que a configuração lê corretamente `DATABASE_URL` e que rejeita strings vazias ou inválidas.
2. **`test_database_engine_settings`:** Validar que a engine SQLAlchemy foi instanciada com `pool_pre_ping=True` e `PostgreSQLDialect`.
3. **`test_models_native_types`:** Validar que os tipos das colunas nos metadados do SQLAlchemy correspondem a `UUID`, `BigInteger` e `DateTime(timezone=True)`.
4. **`test_foreign_key_ondelete_restrict`:** Validar que a constraint de FK entre `stock_movements` e `products` possui regra `RESTRICT`.
5. **`test_alembic_migrations_bidirectional`:** Teste automatizado executando `upgrade head` seguido de `downgrade -1` e novo `upgrade` em banco de testes limpo.

---

## 5. Critérios de Aceitação (DoD - Definition of Done)

- [ ] Zero ocorrências das strings `sqlite`, `check_same_thread` ou `PRAGMA` nos diretórios `backend/app/`.
- [ ] Container Docker `estoque_postgres` ativo e respondendo na porta 5432 (`pg_isready`).
- [ ] Arquivo `alembic.ini` e pasta `alembic/` configurados e versionados no Git.
- [ ] Migração inicial `0001_initial_schema.py` criada e aplicada com sucesso.
- [ ] Relatório do pytest com `pytest --cov=app/shared --cov=app/core --cov-report=term-missing` registrando cobertura $\ge 80\%$.
- [ ] Documentação e código livres de warnings críticos do SQLAlchemy 2.0.