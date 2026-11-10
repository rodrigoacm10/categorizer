# Briefing para o Agente Orquestrador (orchestrator)

> [!IMPORTANT]
> **DIRETRIZ EXPRESSA DO OPERADOR:**
> Este documento contém o dossiê e o contexto completo do projeto. **NÃO INICIE NENHUMA TAREFA DE CÓDIGO AINDA.**
> Você deve apenas ler, assimilar a arquitetura e aguardar a mensagem direta do operador na sua sessão autorizando o início dos trabalhos.

---

## 1. Visão Geral do Projeto
Sistema de Gestão de Estoque com foco exclusivo na **rastreabilidade física/quantitativa** e no **Livro-Razão (Ledger Imutável)**.

- **Stack do Backend:** Python 3.12 + FastAPI em **Clean Architecture Modular**.
- **Banco de Dados:** **PostgreSQL 16** oficial rodando via Docker (`docker-compose.yml`).
- **ORM & Migrations:** **SQLAlchemy 2.0** gerenciado exclusivamente via **Alembic** (`alembic/`).
- **Frontend:** Next.js (Feature-Based) — **PAUSADO**: O frontend só será iniciado no futuro, mediante autorização do operador. O foco total agora é o **Backend**.

---

## 2. Mapa dos Documentos de Especificação

Antes de qualquer ação futura, você deve ler atentamente:

1. **`SPEC.md`**: Visão arquitetural geral e convenções do projeto.
2. **`docs/PRD.md`**: Documento de Requisitos de Produto:
   - Foco 100% físico/quantitativo (sem preços, sem custos médios, sem módulos fiscais).
   - Categorização N:N flexível com tabela associativa `product_categories`.
   - Unidades de Medida (`unit`) padronizadas em maiúsculas (`UN`, `KG`, `L`, etc.).
   - Quantidades fracionárias armazenadas como **Inteiro de Escala Fixa $10^3$ (`BIGINT`)** para precisão absoluta (elimina `float`).
   - Alerta visual dinâmico de estoque mínimo (`min_stock` / `is_low_stock`).
   - **Livro-Razão (Ledger):** Imutabilidade estrita (`NO HARD DELETE`, `NO UPDATE`, `APPEND-ONLY`).
   - **Exclusão de Produto:** Soft-delete (`is_active = FALSE`), gerando evento contábil imutável `PRODUCT_DELETED` no Ledger.
   - **Idempotência no Backend:** Header `X-Idempotency-Key` (RFC 9474), Hash semântico SHA-256 e detecção de conflitos (HTTP 409).
3. **`docs/BACKEND_SPEC.md`**: Especificação Técnica de Backend:
   - Tipos nativos do PostgreSQL (`postgresql.UUID`, `BigInteger`, `DateTime(timezone=True)`).
   - Foreign key do Ledger com `ON DELETE RESTRICT`.
   - Transações e locks pessimistas (`SELECT ... FOR UPDATE` via `with_for_update()`).
   - Migrações exclusivas via Alembic (proibido `Base.metadata.create_all()` em runtime de produção).
4. **`docs/TASKS.md`**: Backlog de tarefas para execução sequencial.
   - **Task 1 (Primeira tarefa a ser realizada quando autorizado):** Alinhamento e Refatoração da Base (remover SQLite, padronizar PostgreSQL no Docker, configurar Alembic).

---

## 3. Estado Atual do Repositório
- `docker-compose.yml` e `.env.example` estão criados para o PostgreSQL 16.
- Os modelos e use cases iniciais foram prototipados, mas necessitam da refatoração da **Task 1** para estarem 100% aderentes ao padrão PostgreSQL + Alembic (removendo o código legado de SQLite).

---

## 4. Próxima Ação do Orquestrador
- Permanecer em estado de espera (*idle*).
- Aguardar o comando do operador para iniciar formalmente a **Task 1**.
