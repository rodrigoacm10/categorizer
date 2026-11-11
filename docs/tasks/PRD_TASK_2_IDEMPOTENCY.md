# PRD - Task 2: Módulo de Idempotência Robusta (RFC 9474 & SHA-256)

---

## 1. Identificação da Tarefa
- **Identificador:** `TASK-03` (anteriormente `TASK-02`)
- **Nome:** Módulo de Idempotência e Tolerância a Falhas de Rede por Tenant
- **Escopo:** Hasher Semântico com Tenant Context, Tabela de Auditoria, Interceptor/Guard FastAPI e Replay de Respostas
- **Responsável:** `code_implementer` (supervisionado por `orchestrator`)
- **Status:** Planejada / Depende da Task 1 e Task 2 (TASK-AUTH-TENANCY)
- **Requisito Mandatório de Qualidade:** **Cobertura de testes unitários e de integração $\ge 80\%$** aferida via `pytest-cov`.

---

## 2. Contexto e Justificativa de Engenharia

Em sistemas operacionais de almoxarifado, falhas transitórias de conexão móvel e ações repetidas de duplo clique por operadores em botões de "Registrar Entrada/Saída" provocam retransmissões automáticas da mesma requisição HTTP. 

Se o backend não for estritamente idempotente, duas ou mais movimentações idênticas serão inseridas no Livro-Razão (Ledger), gerando divergência patrimonial de estoque e quebra de conformidade contábil.

A implementação adota a especificação **RFC 9474 (The Idempotency-Key HTTP Header Field)** gerenciada 100% pelo backend, combinando **Hash Semântico SHA-256 da Intenção** com persistência atômica no PostgreSQL.

---

## 3. Requisitos Funcionais e Arquiteturais

### 3.1. RF-01: Modelo de Domínio e Entidade de Idempotência
- Definir em `app/modules/idempotency/domain/enums.py`:
  ```python
  from enum import Enum

  class IdempotencyStatus(str, Enum):
      PROCESSING = "PROCESSING"
      COMPLETED = "COMPLETED"
      FAILED = "FAILED"
  ```
- Definir em `app/modules/idempotency/domain/entities.py`:
  - `IdempotencyRecord`: com campos `key`, `tenant_id`, `request_hash`, `endpoint`, `status`, `response_code`, `response_body`, `created_at`, `updated_at`.
- Definir contrato de repositório em `app/modules/idempotency/domain/repositories.py`:
  - `IIdempotencyRepository`:
    - `get_by_key(tenant_id: UUID, key: str) -> Optional[IdempotencyRecord]`
    - `save(record: IdempotencyRecord) -> None`
    - `mark_completed(tenant_id: UUID, key: str, response_code: int, response_body: str) -> None`
    - `mark_failed(tenant_id: UUID, key: str) -> None`

### 3.2. RF-02: Modelo de Persistência no PostgreSQL
- Em `app/modules/idempotency/infrastructure/models.py`:
  ```python
  class IdempotencyRecordModel(Base):
      __tablename__ = "idempotency_records"

      key = Column(String(255), primary_key=True, index=True)
      tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
      request_hash = Column(String(64), nullable=False)
      endpoint = Column(String(255), nullable=False)
      status = Column(String(32), nullable=False, default=IdempotencyStatus.PROCESSING.value)
      response_code = Column(Integer, nullable=True)
      response_body = Column(Text, nullable=True)
      created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
      updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

      __table_args__ = (
          UniqueConstraint("tenant_id", "key", name="uq_idempotency_tenant_key"),
      )
  ```

### 3.3. RF-03: Normalizador Canônico e Hasher Semântico (SHA-256)
- Em `app/modules/idempotency/interfaces/hasher.py`:
  - Normalizar payloads JSON ordenando alfabeticamente todas as chaves (`sort_keys=True`) e removendo espaços (`separators=(',', ':')`).
  - Calcular digest SHA-256 hexadecimal de 64 caracteres:
    $$\text{request\_hash} = \text{SHA256}(\text{METHOD} + "|" + \text{PATH} + "|" + \text{canonical\_payload})$$
  - Garantir que variações cosméticas no JSON de entrada (ex: quebras de linha ou ordem de propriedades) gerem rigorosamente o mesmo hash.

### 3.4. RF-04: FastAPI Guard / Interceptor
- Em `app/modules/idempotency/interfaces/guard.py`:
  - Interceptar requisições mutatórias (`POST`, `PUT`, `DELETE`).
  - Extrair o cabeçalho `X-Idempotency-Key` (formato UUIDv4).
  - **Fluxo de Decisão:**
    1. **Chave Inexistente no Banco:**
       - Insere `IdempotencyRecord(key=key, request_hash=hash, status=PROCESSING)`.
       - Permite a execução normal da rota.
       - Após retorno bem-sucedido, comita `status=COMPLETED`, `response_code` e `response_body`.
       - Adiciona cabeçalhos na resposta: `X-Idempotency-Key: <key>` e `X-Cache: MISS`.
    2. **Chave Existe com `status=COMPLETED` e Hash Idêntico:**
       - Replay imediato: retorna a resposta arquivada em cache com o mesmo código HTTP original e o mesmo payload JSON.
       - Adiciona cabeçalho `X-Cache: HIT`. Nenhuma lógica de domínio ou movimentação de estoque é reexecutada.
    3. **Chave Existe com Hash Divergente:**
       - Rejeição imediata com `HTTP 409 Conflict` (padrão RFC 7807), detalhando que a chave já foi consumida para outra operação com parâmetros diferentes.
    4. **Chave Existe com `status=PROCESSING`:**
       - Rejeição com `HTTP 409 Conflict` (ou `HTTP 425 Too Early`), informando que uma operação idêntica está em curso e orientando o cliente a aguardar.
    5. **Chave Ausente:**
       - Mecanismo de deduplicação semântica temporal: verifica em janela de 10 segundos se o mesmo hash foi executado recentemente para mitigar duplo clique desatento.

---

## 4. Requisito de Cobertura de Testes ($\ge 80\%$)

### 4.1. Meta de Cobertura
- A cobertura de testes automatizados do módulo `app/modules/idempotency/` deve atingir **no mínimo 80%** de linhas e branches.

### 4.2. Casos de Teste Obrigatórios
1. **`test_hasher_canonical_json_invariance`:** Garantir que dicionários com chaves invertidas ou espaços em branco gerem exatamente o mesmo digest SHA-256.
2. **`test_idempotency_replay_hit`:** Enviar duas requisições idênticas sequenciais com a mesma `X-Idempotency-Key`. Validar que a segunda retorna `X-Cache: HIT`, payload idêntico e que nenhuma inserção extra ocorre no banco.
3. **`test_idempotency_hash_mismatch_conflict`:** Enviar primeira requisição com payload A e chave K1. Enviar segunda requisição com payload B e mesma chave K1. Validar resposta `HTTP 409 Conflict`.
4. **`test_idempotency_concurrent_processing_conflict`:** Simular concorrência em que a chave está em estado `PROCESSING`. Validar rejeição da segunda chamada com `HTTP 409`.
5. **`test_idempotency_failure_allows_retry`:** Simular erro 500 no use case que deixa a chave como `FAILED`. Validar que nova tentativa com a mesma chave é permitida.

---

## 5. Critérios de Aceitação (DoD)

- [ ] Tabelas `idempotency_records` criadas via migração Alembic no PostgreSQL.
- [ ] Testes do módulo passando com **cobertura $\ge 80\%$** via `pytest --cov=app/modules/idempotency`.
- [ ] Header `X-Cache: HIT` verificado em testes de retransmissão legítima.
- [ ] Conflitos de hash e de requisições em processamento tratados com códigos RFC 7807 e HTTP 409.