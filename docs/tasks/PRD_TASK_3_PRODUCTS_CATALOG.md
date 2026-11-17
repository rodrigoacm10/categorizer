# PRD - Task 3: Módulo de Produtos e Categorias (Catálogo N:N & Escala Fixa)

---

## 1. Identificação da Tarefa
- **Identificador:** `TASK-04` (anteriormente `TASK-03`)
- **Nome:** Módulo de Gestão de Catálogo de Produtos e Categorias Multi-Tenant
- **Escopo:** Entidades de Domínio com `tenant_id`, Relacionamento N:N, DTOs com Escala Inteira $10^3$, Soft-Delete Contábil e Endpoints RESTful com Contexto de Tenant
- **Responsável:** `code_implementer` (supervisionado por `orchestrator`)
- **Status:** Planejada / Depende da Task 2 (Auth & Tenancy) e Task 3 (Idempotência)
- **Requisito Mandatório de Qualidade:** **Cobertura de testes unitários e de integração $\ge 80\%$** aferida via `pytest-cov`.

---

## 2. Contexto e Justificativa de Engenharia

O catálogo de produtos físicos possui particularidades críticas que diferem de e-commerces convencionais:
1. **Foco 100% Físico/Quantitativo:** O sistema não manipula preços monetários, custos de venda ou tributos.
2. **Precisão Absoluta sem Ponto Flutuante:** Para evitar erros de arredondamento IEEE 754 em materiais fracionários (ex: 2,5 kg ou 0,125 L), todas as quantidades são manipuladas e persistidas como inteiros de 64 bits (`BIGINT`) na escala fixa de $10^3$ ($1 \text{ UN} = 1000$).
3. **Categorização N:N Flexível:** Um produto pode pertencer a múltiplos agrupamentos operacionais (ex: *Inflamáveis*, *Matéria-Prima*).
4. **Soft-Delete Seguro com Evento Contábil:** Excluir fisicamente um produto destruiria a integridade referencial dos relatórios históricos de estoque. Assim, a exclusão é lógica (`is_active = FALSE`), gerando obrigatoriamente um evento contábil `PRODUCT_DELETED` no Ledger.

---

## 3. Requisitos Funcionais e Arquiteturais

### 3.1. RF-01: Domínio e Entidades Puras
- Em `app/modules/products/domain/entities.py`:
  - `Category`: `id: UUID`, `tenant_id: UUID`, `name: str`, `description: Optional[str]`, `color: Optional[str]`, `created_at: datetime`.
  - `Product`: `id: UUID`, `tenant_id: UUID`, `name: str`, `description: Optional[str]`, `unit: str` (maiúsculas padronizadas), `current_quantity: int` (escala x1000), `min_stock: Optional[int]`, `is_active: bool`, `categories: List[Category]`, timestamps.
- Métodos de Domínio em `Product`:
  - `is_low_stock() -> bool`: Retorna `True` se `min_stock is not None and current_quantity <= min_stock`.
  - `deactivate(reason: str)`: Atualiza `is_active = False` e `deleted_at = now_utc`.

### 3.2. RF-02: DTOs Pydantic v2 e Conversor de Escala Fixa ($10^3$)
- Em `app/modules/products/application/dtos.py`:
  - `ProductCreateDTO`:
    - Aceita `min_stock` como `Optional[float]` no JSON de entrada.
    - Converte imediatamente para inteiro escalado: `min_stock_raw = round(min_stock * 1000)`.
    - Aceita lista de `category_ids: List[UUID]`.
    - Validação de `unit`: converte automaticamente para maiúsculas (ex: `"kg"` vira `"KG"`).
  - `ProductResponseDTO`:
    - Expõe tanto os valores inteiros escalados quanto os decimais reais:
      - `current_quantity_raw: int` (ex: `2500`)
      - `current_quantity: float` (ex: `2.5`)
      - `formatted_quantity: str` (ex: `"2,500 KG"`)
      - `min_stock_raw: Optional[int]`
      - `min_stock: Optional[float]`
      - `is_low_stock: bool`
      - `categories: List[CategoryResponseDTO]`

### 3.3. RF-03: Casos de Uso (Application Layer)
- Em `app/modules/products/application/use_cases.py`:
  1. **`CreateProductUseCase`:**
     - Valida se as categorias fornecidas existem.
     - Persiste o produto com `current_quantity = 0` e associa as categorias na tabela relacional `product_categories`.
  2. **`ListProductsUseCase`:**
     - Filtros opcionais:
       - `category_id: Optional[UUID]`
       - `low_stock_only: bool = False` (filtra apenas itens onde `current_quantity <= min_stock`)
       - `search: Optional[str]` (busca textual case-insensitive em `name` e `description`)
       - `include_inactive: bool = False` (por padrão, exibe apenas produtos ativos)
     - Paginação via `limit` (default 50) e `offset` (default 0).
  3. **`GetProductByIdUseCase`:**
     - Retorna detalhes completos do produto ou lança `ProductNotFoundError` (HTTP 404).
  4. **`UpdateProductUseCase`:**
     - Atualiza metadados cadastrais (`name`, `description`, `unit`, `min_stock`, categorias).
     - **Regra de Segurança Inegociável:** O saldo físico (`current_quantity`) **não pode** ser modificado por este caso de uso. Qualquer alteração de quantidade deve obrigatoriamente transitar pelo Livro-Razão (Ledger).
  5. **`SoftDeleteProductUseCase`:**
     - Valida existência e se o produto já não está inativado.
     - Marca `is_active = False` e `deleted_at = now_utc`.
     - Insere no Ledger o evento imutável `type = "PRODUCT_DELETED"`, `quantity = 0`, `balance_after = current_quantity`, `reason = motivo`.
  6. **`CategoryUseCases`:**
     - `CreateCategoryUseCase`, `ListCategoriesUseCase`, `DeleteCategoryUseCase` (desassocia dos produtos sem excluí-los).

### 3.4. RF-04: Repositórios Concretos com Carregamento Otimizado
- Em `app/modules/products/infrastructure/repositories.py`:
  - Carregamento de categorias associadas via `selectinload(ProductModel.categories)` para eliminar o problema de N+1 queries.
  - Consultas paginadas indexadas no PostgreSQL.

### 3.5. RF-05: Rotas RESTful da API
- Mapear em `app/modules/products/interfaces/router.py`:
  - `POST /api/products` (201 Created)
  - `GET /api/products` (200 OK)
  - `GET /api/products/{id}` (200 OK / 404 Not Found)
  - `PUT /api/products/{id}` (200 OK / 404 Not Found)
  - `DELETE /api/products/{id}` (200 OK com justificativa obrigatória)
  - `GET /api/categories` (200 OK)
  - `POST /api/categories` (201 Created)
  - `DELETE /api/categories/{id}` (204 No Content)

---

## 4. Requisito de Cobertura de Testes ($\ge 80\%$)

### 4.1. Meta de Cobertura
- A cobertura de testes do módulo `app/modules/products/` deve ser **$\ge 80\%$** nas camadas de domínio, casos de uso e infraestrutura.

### 4.2. Casos de Teste Obrigatórios
1. **`test_create_product_with_multiple_categories`:** Validar persistência do produto e dos registros vinculados na tabela `product_categories`.
2. **`test_scale_conversion_and_formatting`:** Validar que entrada decimal `15.75` é armazenada como `15750` e formatada como `"15,750 M"`.
3. **`test_is_low_stock_calculation`:** Testar produtos com estoque acima, exatamente igual e abaixo do `min_stock`.
4. **`test_filter_low_stock_only`:** Validar que a listagem com `low_stock_only=True` retorna apenas itens críticos.
5. **`test_update_product_preserves_quantity`:** Validar que alteração de dados cadastrais não sobrescreve o saldo do produto.
6. **`test_soft_delete_product_records_ledger_event`:** Validar que inativação marca `is_active=False`, esconde o produto da listagem padrão e gera o evento `PRODUCT_DELETED` no Ledger.

---

## 5. Critérios de Aceitação (DoD)

- [ ] Relacionamento N:N operacional e persistido na tabela intermediária `product_categories`.
- [ ] Quantidades decimais convertidas com rigor e armazenadas exclusivamente como `BIGINT` ($10^3$).
- [ ] Soft-delete executando de forma atômica com emissão de evento contábil.
- [ ] Suíte de testes do módulo executando com **cobertura $\ge 80\%$** via `pytest --cov=app/modules/products`.