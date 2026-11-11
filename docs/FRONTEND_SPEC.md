# Especificação Técnica de Frontend (FRONTEND_SPEC)
## Arquitetura Next.js 14, Fluxos de Navegação, Contratos de Integração, RBAC e Livro-Razão

---

## 1. Visão Geral da Arquitetura e Engenharia de Frontend

O frontend do sistema de gestão física de estoque e almoxarifado multi-tenant é concebido como uma **Aplicação de Missão Crítica para Bancada Operacional** (*Workbench Application*). Ele foi projetado para operar em ambientes industriais, galpões de expedição e terminais de conferência, onde velocidade de digitação, leitura sob condições adversas e tolerância a falhas de rede são requisitos de sobrevivência.

A arquitetura adota o framework **Next.js 14 (App Router)** com **TypeScript** em modo estrito (*Strict Mode*), **Tailwind CSS** para estilização de alta densidade sem cartões inflados (*Zero AI-Slop*, conforme `DESIGN.md`), e uma camada cliente de rede orientada a contratos que implementa **Multi-Tenancy por cabeçalho (`X-Tenant-ID`)**, **Idempotência estrita (RFC 9474)**, **Escala Inteira Fixa ($10^3$)** e tratamento canônico de falhas via **Problem Details (RFC 7807)**.

```mermaid
flowchart TD
    subgraph Browser / Client Tier
        UI[Next.js 14 App Router / React 18]
        ZOD[Validação de Schemas Zod]
        RQ[TanStack React Query v5 - Server Cache]
        SCALE[Conversor de Escala Fixa 10^3]
        HTTP[Cliente HTTP Fetch com Interceptors]
    end

    subgraph Interceptors & Security Pipeline
        AUTH_INT[Interceptor de Auth: Bearer JWT]
        TENANT_INT[Interceptor de Tenant: X-Tenant-ID]
        IDEMP_INT[Interceptor de Idempotência: X-Idempotency-Key UUIDv4]
        ERR_INT[Handler RFC 7807: Problem Details]
    end

    subgraph Backend API Tier (FastAPI & PostgreSQL 16)
        API_AUTH[/api/auth/*]
        API_TENANTS[/api/tenants/*]
        API_PRODUCTS[/api/products/* & /api/categories/*]
        API_INVENTORY[/api/inventory/*]
    end

    UI --> ZOD
    UI --> RQ
    RQ --> HTTP
    HTTP --> SCALE
    HTTP --> AUTH_INT
    AUTH_INT --> TENANT_INT
    TENANT_INT --> IDEMP_INT
    IDEMP_INT --> ERR_INT
    ERR_INT --> API_AUTH
    ERR_INT --> API_TENANTS
    ERR_INT --> API_PRODUCTS
    ERR_INT --> API_INVENTORY
```

---

### 1.1. Princípios Arquiteturais Inegociáveis do Frontend

1. **Separação Rígida entre Saldo Físico e Metadados:** Nenhuma tela de edição cadastral (produtos, categorias ou dados do tenant) pode alterar quantidades em estoque. Toda alteração física transita exclusivamente pela esteira do Livro-Razão (`/api/inventory/in`, `/api/inventory/out`, `/api/inventory/adjustment`).
2. **Escala Inteira Fixa ($10^3$) Transparente:** Todas as quantidades são manipuladas internamente como inteiros de 64 bits multiplicados por $1.000$ (`BIGINT`), eliminando desvios de arredondamento IEEE 754 de ponto flutuante. A interface aceita decimais amigáveis em padrão brasileiro (`2,5` ou `0,125`) e formata números com `tabular-nums font-mono`.
3. **Idempotência no Cliente (RFC 9474):** Toda requisição mutatória (`POST`, `PUT`, `DELETE`) gera automaticamente um cabeçalho `X-Idempotency-Key` com UUIDv4 único. A UI reconhece respostas servidas do cache do backend (`X-Cache: HIT`) e previne submissões acidentais via desativação visual imediata do controle.
4. **Isolamento de Contexto de Tenant:** Nenhuma chamada a rotas de negócio é disparada sem o cabeçalho `X-Tenant-ID`. O tenant ativo é mantido em estado global reativo sincronizado com cookies seguros e `localStorage`.
5. **RBAC Pervasivo (Controle de Acesso Baseado em Papéis):** A interface reflete ativamente os quatro papéis do sistema (`OWNER`, `GESTOR`, `ALMOXARIFE`, `AUDITOR`), desabilitando ou ocultando controles proibidos e exibindo tooltips informativos de permissão.
6. **Tratamento Estruturado de Erros (RFC 7807):** Toda resposta de erro da API com `Content-Type: application/problem+json` é convertida em notificações industriais de alto contraste, detalhando o motivo operacional e a ação corretiva necessária.
7. **Estilo Workbench Industrial (Zero AI-Slop):** Rejeição a cantos excessivamente arredondados (`rounded-2xl`/`3xl`), sombras difusas e cards flutuantes desconexos. Adoção de painéis contínuos com divisores retos de 1px (`border-zinc-200`), cabeçalhos fixos e tabelas de alta densidade.

---

### 1.2. Árvore Estrutural de Diretórios do Frontend

A base de código em `frontend/` segue o padrão **Feature-Sliced / Modular**, segregando infraestrutura compartilhada e módulos funcionais:

```text
frontend/
├── src/
│   ├── app/                                 # Next.js 14 App Router
│   │   ├── (auth)/                          # Grupo de rotas públicas de autenticação
│   │   │   ├── layout.tsx                   # Layout minimalista de autenticação
│   │   │   ├── login/
│   │   │   │   └── page.tsx                 # Tela /login
│   │   │   └── register/
│   │   │       └── page.tsx                 # Tela /register
│   │   ├── (workbench)/                     # Grupo de rotas protegidas da bancada operacional
│   │   │   ├── layout.tsx                   # Shell unificado: TopBar, KPI Strip, Sidebar, Breadcrumb
│   │   │   ├── tenants/
│   │   │   │   └── page.tsx                 # Tela /tenants (Seleção e onboarding de tenant)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx                 # Tela /dashboard (Bancada operacional e alertas)
│   │   │   ├── products/
│   │   │   │   ├── page.tsx                 # Tela /products (Catálogo de produtos e busca rápida)
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx             # Tela /products/new (Cadastro de produto)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx             # Tela /products/[id] (Ficha técnica e histórico)
│   │   │   ├── inventory/
│   │   │   │   ├── move/
│   │   │   │   │   └── page.tsx             # Tela /inventory/move (Bancada de movimentação física)
│   │   │   │   └── movements/
│   │   │   │       └── page.tsx             # Tela /inventory/movements (Extrato do Livro-Razão)
│   │   │   ├── categories/
│   │   │   │   └── page.tsx                 # Tela /categories (Gestão de categorias N:N)
│   │   │   └── settings/
│   │   │       └── members/
│   │   │           └── page.tsx             # Tela /settings/members (Gestão de equipe e RBAC)
│   │   ├── globals.css                      # Estilos globais e tokens Impeccable
│   │   └── layout.tsx                       # RootLayout (Providers, Fontes, QueryClientProvider)
│   ├── features/                            # Módulos de domínio desacoplados
│   │   ├── auth/                            # Autenticação e sessão
│   │   │   ├── components/                  # LoginForm, RegisterForm, AuthGuard
│   │   │   ├── hooks/                       # useAuth, useSession
│   │   │   ├── services/                    # auth.api.ts
│   │   │   └── types/                       # auth.types.ts
│   │   ├── tenants/                         # Multi-Tenancy e memberships
│   │   │   ├── components/                  # TenantSwitcher, TenantCard, CreateTenantModal
│   │   │   ├── hooks/                       # useTenant, useTenantMembers
│   │   │   ├── services/                    # tenants.api.ts
│   │   │   └── types/                       # tenant.types.ts
│   │   ├── products/                        # Catálogo de produtos
│   │   │   ├── components/                  # ProductTable, ProductForm, BarcodeSearchInput
│   │   │   ├── hooks/                       # useProducts, useProductDetail, useProductMutations
│   │   │   ├── services/                    # products.api.ts
│   │   │   └── types/                       # product.types.ts
│   │   ├── categories/                      # Categorização N:N
│   │   │   ├── components/                  # CategoryBadge, CategoryModal, CategorySelect
│   │   │   ├── hooks/                       # useCategories
│   │   │   ├── services/                    # categories.api.ts
│   │   │   └── types/                       # category.types.ts
│   │   ├── inventory/                       # Livro-Razão e movimentação
│   │   │   ├── components/                  # LedgerTable, MovementForm, StockBadge, DeltaCell
│   │   │   ├── hooks/                       # useLedger, useStockMovement, useStockLockSimulation
│   │   │   ├── services/                    # inventory.api.ts
│   │   │   └── types/                       # inventory.types.ts
│   │   └── settings/                        # Configurações do tenant e membros
│   │       ├── components/                  # MemberListTable, InviteMemberModal, RoleSelect
│   │       ├── hooks/                       # useMembers
│   │       └── services/                    # members.api.ts
│   └── shared/                              # Camada transversal reutilizável
│       ├── components/                      # Botões, inputs, tabelas, modais, tooltips industriais
│       ├── hooks/                           # useDebounce, useHotkeys (Ctrl+K, Esc), useIdempotency
│       ├── lib/                             # api-client.ts, query-client.ts, storage.ts
│       ├── types/                           # rfc7807.types.ts, api.types.ts, rbac.types.ts
│       └── utils/                           # scale.ts (x1000), formatters.ts, cn.ts
```

---

## 2. Camada de Comunicação HTTP, Interceptors e Contratos de Rede

### 2.1. Arquitetura do Cliente HTTP (`api-client.ts`)

O cliente HTTP unificado (`frontend/src/shared/lib/api-client.ts`) encapsula a API nativa `fetch` com um pipeline de interceptors para envio de credenciais, isolamento de tenant, rastreamento de idempotência e decodificação estruturada de erros.

```typescript
// frontend/src/shared/types/api.types.ts
export interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  skipIdempotency?: boolean;
  skipTenantHeader?: boolean;
  skipAuth?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  isCached: boolean;
  idempotencyKey?: string;
  status: number;
}
```

#### Pipeline de Interceptors Executados a Cada Requisição:

1. **Interceptor de Autenticação (`Authorization: Bearer <token>`):**
   - Resgata o token de acesso armazenado em cookie seguro `session_token` ou `localStorage`.
   - Se a rota não for pública e o token estiver ausente, intercepta a requisição e redireciona imediatamente para `/login?returnUrl=<origem>`.
2. **Interceptor de Tenant (`X-Tenant-ID: <UUID>`):**
   - Para todos os endpoints sob `/api/products`, `/api/categories`, `/api/inventory` e `/api/tenants/{id}/*`, anexa obrigatoriamente o header `X-Tenant-ID`.
   - Se nenhum tenant estiver selecionado e a rota exigir contexto de tenant, redireciona o operador para a tela de seleção `/tenants`.
3. **Interceptor de Idempotência (`X-Idempotency-Key: <UUIDv4>`):**
   - Para métodos mutatórios (`POST`, `PUT`, `DELETE`), se o chamador não forneceu uma chave explícita, gera uma chave padrão UUIDv4 via `crypto.randomUUID()`.
   - Lê o header de resposta `X-Cache: HIT` para alertar a UI se a transação foi reexecutada a partir do cache do backend.
4. **Interceptor de Falhas RFC 7807 (`ProblemDetails`):**
   - Se `!response.ok`, intercepta o corpo da resposta.
   - Converte o JSON recebido na classe de erro tipada `ProblemDetailsError`.
   - Trata automaticamente status críticos (`401 Token Expirado`, `403 Acesso Negado ao Tenant`, `409 Conflito de Idempotência`, `422 Saldo Insuficiente`).

```typescript
// frontend/src/shared/types/rfc7807.types.ts
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  invalid_params?: Array<{ name: string; reason: string }>;
}

export class ProblemDetailsError extends Error {
  public readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = "ProblemDetailsError";
    this.problem = problem;
  }
}
```

---

## 3. Conversor de Escala Fixa ($10^3$) no Frontend

Para eliminar erros de imprecisão de ponto flutuante em dados críticos de pesagem e dosagem (ex: $2{,}500\text{ KG}$, $0{,}125\text{ L}$), o frontend adota a biblioteca utilitária `scale.ts`:

$$\text{Valor Inteiro Escalado} = \text{Math.round}(\text{Número Real} \times 1000)$$
$$\text{Número Real Decimal} = \frac{\text{Valor Inteiro Escalado}}{1000}$$

```typescript
// frontend/src/shared/utils/scale.ts
export const SCALE_FACTOR = 1000;

export function toScaledInt(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const num = Number(normalized);
  if (isNaN(num)) throw new Error(`Valor numérico inválido: ${value}`);
  return Math.round(num * SCALE_FACTOR);
}

export function fromScaledInt(scaledValue: number | null | undefined): number {
  if (scaledValue === null || scaledValue === undefined) return 0;
  return scaledValue / SCALE_FACTOR;
}

export function formatScaledQuantity(scaledValue: number | null | undefined, unit: string = ""): string {
  const decimal = fromScaledInt(scaledValue);
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(decimal);
  return unit ? `${formatted} ${unit}` : formatted;
}
```

> [!IMPORTANT]
> Nas telas de formulário (`/products/new`, `/products/[id]`, `/inventory/move`), o operador digita números no padrão decimal brasileiro (ex: `12,5`). O frontend valida o padrão com Zod, converte para inteiro escalado no payload ou envia decimal direto conforme o DTO do endpoint, garantindo paridade total com o backend.

---

## 4. Matriz de Papéis e Permissões (RBAC) no Frontend

O sistema implementa quatro papéis associados ao vínculo do usuário com o tenant (`tenant_memberships`):

| Papel (*Role*) | Descrição Operacional no Frontend |
| :--- | :--- |
| **`OWNER`** | Proprietário do Tenant. Acesso total a configurações, membros, produtos, categorias e livro-razão. |
| **`GESTOR`** | Gestor de Almoxarifado. Cria produtos, categorias e registra entradas/saídas/ajustes. Pode convidar novos membros, mas não pode alterar o Tenant nem remover o `OWNER`. |
| **`ALMOXARIFE`** | Operador de Chão de Fábrica. Executa recebimentos (`IN`), baixas (`OUT`) e contagens físicas (`ADJUSTMENT`). Visualiza o catálogo e extrato, mas não edita produtos, não cria categorias e não gerencia membros. |
| **`AUDITOR`** | Controlador de Conformidade. Consulta catálogo e extrato perpétuo; realiza exclusivamente conciliações de inventário (`ADJUSTMENT`). Bloqueado para movimentações rotineiras de `IN` e `OUT`. |

### 4.1. Tabela de Autorização por Rota e Componente de Interface

| Rota / Ação de Interface | `OWNER` | `GESTOR` | `ALMOXARIFE` | `AUDITOR` | Comportamento se Desautorizado |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Acessar `/dashboard`** | Sim | Sim | Sim | Sim | Acesso livre a membros do tenant |
| **Acessar `/products`** | Sim | Sim | Sim | Sim | Acesso livre a membros do tenant |
| **Botão "Novo Produto" (`/products/new`)** | Sim | Sim | **Não** | **Não** | Botão oculto na toolbar; rota redireciona para `/products` com aviso |
| **Botão "Editar Produto" (`/products/[id]`)** | Sim | Sim | **Não** | **Não** | Formulário em modo somente-leitura; campos desabilitados |
| **Botão "Inativar Produto" (Soft-Delete)** | Sim | Sim | **Não** | **Não** | Ação omitida no menu contextual da tabela |
| **Acessar `/inventory/movements` (Extrato)**| Sim | Sim | Sim | Sim | Acesso livre (auditoria perpétua) |
| **Aba / Operação "Entrada (`IN`)"** | Sim | Sim | Sim | **Não** | Aba desabilitada com tooltip: *"Apenas operadores e gestores"* |
| **Aba / Operação "Saída (`OUT`)"** | Sim | Sim | Sim | **Não** | Aba desabilitada com tooltip: *"Apenas operadores e gestores"* |
| **Aba / Operação "Ajuste (`ADJUSTMENT`)"** | Sim | Sim | Sim | Sim | Autorizado a todos os papéis (com justificativa obrigatória) |
| **Acessar `/categories`** | Sim | Sim | **Não** | **Não** | Link oculto na navegação; rota bloqueada |
| **Acessar `/settings/members`** | Sim | Sim | **Não** | **Não** | Link oculto na navegação; rota bloqueada |
| **Convidar / Adicionar Membro** | Sim | Sim | **Não** | **Não** | Botão oculto |
| **Alterar Papel / Remover Membro** | Sim | **Não** | **Não** | **Não** | Controles desabilitados para `GESTOR` |

---

## 5. Mapa de Rotas e Fluxo Geral de Navegação

```mermaid
flowchart TD
    START([Início da Sessão]) --> CHECK_AUTH{Possui JWT válido?}
    
    CHECK_AUTH -- Não --> LOGIN[/login - Autenticação/]
    LOGIN -->|Sucesso| ME_QUERY[GET /api/auth/me]
    LOGIN -->|Não possui conta| REGISTER[/register - Cadastro/]
    REGISTER -->|Sucesso| LOGIN
    
    CHECK_AUTH -- Sim --> ME_QUERY
    
    ME_QUERY --> CHECK_TENANTS{Possui Tenants?}
    CHECK_TENANTS -- Não --> TENANT_CREATE[/tenants - Onboarding: Criar Primeiro Almoxarifado/]
    TENANT_CREATE -->|POST /api/tenants| TENANT_SET[Grava X-Tenant-ID ativo]
    
    CHECK_TENANTS -- Sim --> TENANT_SELECT{Tenant ativo selecionado?}
    TENANT_SELECT -- Não --> TENANTS_LIST[/tenants - Escolha do Almoxarifado/]
    TENANTS_LIST -->|Seleciona Tenant| TENANT_SET
    
    TENANT_SET --> DASHBOARD[/dashboard - Bancada Operacional/]
    TENANT_SELECT -- Sim --> DASHBOARD
    
    subgraph Módulos da Bancada Operacional (Scope do Tenant Ativo)
        DASHBOARD --> PROD_LIST[/products - Catálogo e Busca de Saldo/]
        PROD_LIST --> PROD_NEW[/products/new - Cadastro de Item/]
        PROD_LIST --> PROD_DETAIL[/products/[id] - Ficha Técnica e Histórico/]
        
        DASHBOARD --> INV_MOVE[/inventory/move - Bancada de Movimentação Física/]
        DASHBOARD --> INV_LEDGER[/inventory/movements - Extrato Contábil Perpétuo/]
        
        DASHBOARD --> CAT_LIST[/categories - Gestão de Categorias N:N/]
        DASHBOARD --> SETTINGS_MEMBERS[/settings/members - Gestão do Almoxarifado e Equipe/]
    end
    
    DASHBOARD -.->|Trocar Almoxarifado| TENANTS_LIST
```

---

## 6. Especificação Técnica Completa por Tela

---

### 6.1. Tela: `/login` (Autenticação do Usuário)

#### 1. Objetivo Funcional
Autenticar operadores e gestores de forma segura, gerando o token JWT (`access_token`) necessário para todas as comunicações com a API.

#### 2. Elementos e Controles de Interface
- **Painel Central de Autenticação:** Fundo branco com borda `border-zinc-200`, sem cards flutuantes com sombras.
- **Campo "E-mail Institucional":** Input de texto com validação de formato RFC 5322 e foco automático no carregamento (`autoFocus`).
- **Campo "Senha de Acesso":** Input do tipo `password` com botão de revelação/ocultação de caracteres.
- **Botão de Submissão "Entrar na Bancada":** Botão `primary-900` (`#0f172a`), com indicador de carregamento (*spinner* SVG) no estado de submissão.
- **Link Secundário:** "Ainda não possui conta? Cadastre-se" redirecionando para `/register`.
- **Banner de Erro RFC 7807:** Exibido no topo do formulário em caso de credenciais incorretas ou conta inativa.

#### 3. Contratos de API
- **Endpoint:** `POST /api/auth/login`
- **Headers:** `Content-Type: application/json` (ou formulário OAuth2)
- **Request Body:**
  ```json
  {
    "email": "operador@empresa.com",
    "password": "SenhaSegura123"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1Ni...",
    "token_type": "bearer",
    "expires_in": 3600
  }
  ```

#### 4. Regras de Negócio e Validações do Cliente
- Validação síncrona com Zod antes do disparo:
  - E-mail não vazio e com padrão de e-mail válido.
  - Senha com no mínimo 8 caracteres.
- Ao receber o token `200 OK`:
  - Armazena `access_token` em cookie de sessão (`SameSite=Lax`) e em memória do cliente.
  - Dispara imediatamente `GET /api/auth/me` para descobrir os tenants associados.
  - Se o usuário possui 1 único tenant, define-o automaticamente como ativo e redireciona para `/dashboard`.
  - Se possui múltiplos tenants ou nenhum, redireciona para `/tenants`.

#### 5. Matriz RBAC
- Rota pública. Usuários já autenticados são redirecionados automaticamente para `/dashboard`.

#### 6. Estados de Interface e Tratamento de Erros
- **Carregamento:** Botão exibe *"Autenticando..."* com atributo `disabled` para evitar duplo clique.
- **Erro `401 Unauthorized` (`invalid-credentials`):** Exibe banner vermelho: *"E-mail ou senha incorretos. Verifique suas credenciais."*
- **Erro `403 Forbidden` (`user-inactive`):** *"Esta conta de usuário encontra-se desativada. Contate o administrador."*
- **Falha de Conexão:** *"Não foi possível conectar ao servidor do almoxarifado. Verifique sua conexão de rede."*

---

### 6.2. Tela: `/register` (Cadastro de Novo Usuário)

#### 1. Objetivo Funcional
Permitir a criação autônoma de contas de usuários globais no sistema, habilitando-os a criar novos tenants ou serem convidados para organizações existentes.

#### 2. Elementos e Controles de Interface
- **Campo "Nome Completo":** Input de texto (`min 2`, `max 255`).
- **Campo "E-mail Corporativo":** Input de e-mail único globalmente.
- **Campo "Senha de Acesso":** Input de senha com medidor visual de requisitos mínimos (mínimo 8 caracteres, 1 número, 1 letra maiúscula).
- **Campo "Confirmação de Senha":** Input com validação de igualdade em tempo real.
- **Botão "Criar Conta":** Dispara a criação e redireciona para `/login` com banner de sucesso.
- **Link de Retorno:** "Já possui conta? Faça login".

#### 3. Contratos de API
- **Endpoint:** `POST /api/auth/register`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "novo.gestor@industria.com",
    "password": "SenhaForte2026",
    "full_name": "Carlos Eduardo Silva"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "id": "e4b6c3d2-a1f0-4b8c-9d3e-7a2b1c0d9e8f",
    "email": "novo.gestor@industria.com",
    "full_name": "Carlos Eduardo Silva",
    "is_active": true,
    "created_at": "2026-11-11T10:00:00Z"
  }
  ```

#### 4. Regras de Negócio e Validações
- Validação estrita de complexidade de senha no cliente idêntica ao Pydantic do backend:
  - Tamanho $\ge 8$ caracteres.
  - Pelo menos um dígito numérico `[0-9]`.
  - Pelo menos uma letra maiúscula `[A-Z]`.
- Rejeição imediata antes do submit se `password !== confirm_password`.

#### 5. Matriz RBAC
- Rota pública.

#### 6. Estados de Interface e Tratamento de Erros
- **Erro `409 Conflict` (`email-already-exists`):** Exibe banner: *"Este e-mail já está cadastrado no sistema. Tente fazer login ou recupere o acesso."*

---

### 6.3. Tela: `/tenants` (Seleção e Criação de Almoxarifado / Tenant)

#### 1. Objetivo Funcional
Apresentar a lista de todos os almoxarifados aos quais o operador tem acesso, permitindo alternar o contexto de trabalho ou criar um novo almoxarifado de forma atômica (tornando-se `OWNER`).

#### 2. Elementos e Controles de Interface
- **Cabeçalho da Página:** Título *"Seus Almoxarifados & Organizações"* com descrição clara de isolamento de dados.
- **Botão de Destaque "Criar Novo Almoxarifado":** Abre modal com formulário de criação de tenant.
- **Grade Industrial de Tenants:** Painéis de 1px com:
  - Nome do Almoxarifado (`name`) e slug identificador (`slug`).
  - Badge de papel do usuário naquele tenant (`OWNER`, `GESTOR`, `ALMOXARIFE`, `AUDITOR`).
  - Botão de ação rápida: *"Acessar Bancada"*.
- **Modal de Criação de Tenant:**
  - Campo "Nome do Almoxarifado" (ex: "Almoxarifado Central - Galpão 3").
  - Campo "Slug Único" (gerado automaticamente em kebab-case a partir do nome, customizável).
  - Campo "Finalidade Operacional" (`description`, opcional).
  - Botão "Criar e Assumir Gestão" (`POST /api/tenants`).

#### 3. Contratos de API
- **Listar Tenants:** `GET /api/tenants` (ou extraído de `GET /api/auth/me`)
  - **Headers:** `Authorization: Bearer <token>`
  - **Response `200 OK`:**
    ```json
    [
      {
        "id": "99ee2005-115d-c7e1-88aa-b1c2d3e4f5a6",
        "name": "Almoxarifado Central Matriz",
        "slug": "matriz-central",
        "description": "Depósito principal de matérias-primas",
        "is_active": true,
        "created_at": "2026-11-10T18:00:00Z",
        "updated_at": "2026-11-10T18:00:00Z"
      }
    ]
    ```
- **Criar Tenant:** `POST /api/tenants`
  - **Headers:** `Authorization: Bearer <token>`
  - **Request Body:**
    ```json
    {
      "name": "Almoxarifado Peças Pesadas",
      "slug": "pecas-pesadas",
      "description": "Estoque de peças de reposição mecânica"
    }
    ```
  - **Response `201 Created`:** Retorna o objeto do tenant criado com o usuário associado imediatamente como `OWNER`.

#### 4. Regras de Negócio e Validações
- Ao selecionar um tenant:
  - Persiste `active_tenant_id` no `localStorage` e nos cookies do navegador para hidratação do App Router.
  - Seta o papel (`current_role`) no contexto global de RBAC.
  - Invalida todas as queries do TanStack Query vinculadas ao tenant anterior para impedir contaminação de cache.
  - Redireciona o operador para `/dashboard`.
- Criação de Tenant:
  - Slug deve atender estritamente ao regex `^[a-z0-9-]+$`.

#### 5. Matriz RBAC
- Qualquer usuário autenticado pode listar seus próprios tenants e criar novos tenants.

#### 6. Estados de Interface e Tratamento de Erros
- **Estado Vazio (Sem Tenants):** Exibe painel industrial de primeiro acesso: *"Nenhum almoxarifado vinculado à sua conta. Crie sua primeira unidade de estoque para começar a operar."*
- **Erro `409 Conflict` (`tenant-slug-already-exists`):** Aponta erro no campo slug: *"Este identificador já está em uso por outro almoxarifado. Escolha um nome diferente."*

---

### 6.4. Tela: `/dashboard` (Bancada Operacional & Alertas)

#### 1. Objetivo Funcional
Atuar como o centro de comando visual do conferente e do supervisor. Exibe indicadores rápidos de saúde de estoque, alertas de reposição imediata (`min_stock`) e barra de comandos rápidos para o leitor de código de barras.

#### 2. Elementos e Controles de Interface
- **TopBar de Bancada (48px fixo):**
  - Identificador do Almoxarifado ativo com seletor *dropdown* para troca rápida de unidade.
  - Badge de papel do operador (`OWNER`, `GESTOR`, `ALMOXARIFE`, `AUDITOR`).
  - Indicador de status de conectividade com a API (`Online` / `Offline`).
- **Faixa de KPIs Contínua (*KPI Strip* Linear):** Faixa horizontal com divisores verticais de 1px (`divide-x divide-zinc-200`):
  1. **Total de Itens Ativos no Catálogo:** Quantidade de SKUs cadastrados.
  2. **Itens em Alerta de Estoque Baixo:** Contagem de produtos onde $\text{current\_quantity} \le \text{min\_stock}$.
  3. **Itens com Estoque Zerado:** Contagem de produtos com saldo igual a $0$.
  4. **Movimentações Registradas Hoje:** Lançamentos contábeis nas últimas 24 horas.
- **Barra de Ações Rápidas de Bancada:**
  - Campo de Entrada Rápida de Código / EAN com atalho global (`Ctrl+K` ou foco direto do leitor de código de barras).
  - Botão de Ação Rápida *"Registrar Entrada (`IN`)"* (abre modal ou redireciona para `/inventory/move?mode=IN`).
  - Botão de Ação Rápida *"Registrar Saída (`OUT`)"* (abre modal ou redireciona para `/inventory/move?mode=OUT`).
  - Botão de Ação Rápida *"Conferência / Ajuste"* (redireciona para `/inventory/move?mode=ADJUSTMENT`).
- **Tabela de Alertas Críticos de Reposição:**
  - Lista apenas itens com `is_low_stock === true`.
  - Colunas: SKU/Nome, Categoria, Saldo Atual (`tabular-nums font-mono`), Ponto Mínimo (`min_stock`), Status (`stock-low` / `stock-empty`), Ação Rápida de Entrada.

#### 3. Contratos de API
- **Listagem de Produtos em Alerta:** `GET /api/products?low_stock_only=true&limit=10`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`
- **Extrato Recente:** `GET /api/inventory/movements?limit=10`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`

#### 4. Regras de Negócio e Validações
- A contagem de alertas é calculada em conformidade com o backend: um item só é considerado em alerta se `min_stock` estiver configurado e $\text{current\_quantity} \le \text{min\_stock}$.
- Números de saldo utilizam alinhamento à direita obrigatório e fonte tabular monoespaçada.

#### 5. Matriz RBAC
- Acesso de leitura livre a todos os papéis do tenant.
- Botões de ação rápida de `IN` e `OUT` ficam desabilitados para o papel `AUDITOR`.

#### 6. Estados de Interface
- **Carregamento:** Skeleton industrial em tons de cinza suave (`bg-zinc-100 animate-pulse`) sem cantos arredondados inflados.
- **Sem Alertas (Estoque Saudável):** Painel plano: *"Nenhum item com estoque crítico ou abaixo do mínimo no momento."*

---

### 6.5. Tela: `/products` (Catálogo de Produtos e Busca Rápida)

#### 1. Objetivo Funcional
Apresentar a totalidade do catálogo físico de itens armazenados no tenant ativo, permitindo filtros combinados de alta densidade, conferência de saldos em tempo real e acesso a ações cadastrais.

#### 2. Elementos e Controles de Interface
- **Barra de Ferramentas de Catálogo (*Catalog Toolbar*):**
  - **Input de Busca Global:** Filtra por nome e descrição com debounce de 300ms.
  - **Filtro de Categoria:** Dropdown multi-seleção de categorias do tenant.
  - **Toggle "Apenas Estoque Baixo":** Switch ou checkbox rápido para isolar itens críticos.
  - **Toggle "Incluir Descontinuados":** Permite visualizar itens que sofreram soft-delete.
  - **Botão "+ Novo Produto":** Redireciona para `/products/new` (visível para `OWNER` e `GESTOR`).
- **Tabela de Dados em Largura Total (*High-Density Table*):**
  - Coluna **Nome do Produto e Descrição Técnica**.
  - Coluna **Categorias:** Badges coloridos compactos com borda de 1px.
  - Coluna **Unidade de Medida (UOM):** `UN`, `KG`, `L`, `M`, etc.
  - Coluna **Estoque Mínimo (`min_stock`):** Formatado em casas decimais com `tabular-nums`.
  - Coluna **Saldo Atual Físico (`current_quantity`):** Formatado com badge semântico de status:
    - Verde (`stock-ok`): Saldo saudável.
    - Amarelo (`stock-low`): Saldo $\le$ mínimo.
    - Vermelho (`stock-empty`): Saldo zero.
  - Coluna **Ações:**
    - Botão *"Ficha / Histórico"* (`/products/[id]`).
    - Botão *"Movimentar"* (`/inventory/move?product_id=[id]`).
    - Botão *"Inativar"* (Soft-delete com justificativa obrigatória).

#### 3. Contratos de API
- **Listar Produtos:** `GET /api/products`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`
  - **Query Params:** `search`, `category_id`, `low_stock_only`, `include_inactive`, `limit`, `offset`.
  - **Response `200 OK`:** Array de `ProductResponseDto`.
- **Inativar Produto (Soft-Delete):** `DELETE /api/products/{id}?reason=...`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`, `X-Idempotency-Key: <UUIDv4>`
  - **Response `200 OK`:** Confirmação da desativação e gravação do evento `PRODUCT_DELETED` no Ledger.

#### 4. Regras de Negócio e Validações
- **Proibição de Exclusão Física:** A ação de "Inativar" nunca exclui o registro no PostgreSQL. O frontend abre um modal de confirmação com **campo de justificativa obrigatório** (mínimo 5 caracteres).
- Saldo exibido reflete estritamente o valor contábil retornado pela API.

#### 5. Matriz RBAC
- **Visualização da Tabela:** Todos os papéis (`OWNER`, `GESTOR`, `ALMOXARIFE`, `AUDITOR`).
- **Criar Produto:** Exclusivo para `OWNER` e `GESTOR`.
- **Inativar Produto:** Exclusivo para `OWNER` e `GESTOR`.

#### 6. Estados de Interface
- **Tabela Vazia (Nenhum produto cadastrado):** Painel: *"Nenhum produto cadastrado neste almoxarifado. Clique em 'Novo Produto' para iniciar o catálogo."*
- **Filtro sem Resultados:** *"Nenhum item corresponde aos critérios de pesquisa informados."*

---

### 6.6. Tela: `/products/new` (Cadastro de Produto Físico)

#### 1. Objetivo Funcional
Registrar um novo item no catálogo do tenant ativo, associando suas categorias e configurando seu ponto de reposição (`min_stock`).

#### 2. Elementos e Controles de Interface
- **Aviso Mandatório de Domínio no Topo:** *"Atenção: O cadastro de produtos apenas registra a ficha cadastral do item com saldo inicial zero (0). Lançamentos físicos de entrada devem ser efetuados exclusivamente na Bancada de Movimentação do Livro-Razão."*
- **Campo "Nome do Produto":** Input obrigatório (`min 1`, `max 200` caracteres).
- **Campo "Descrição Técnica / Aplicação":** Textarea opcional para especificações e normas.
- **Campo "Unidade de Medida (UOM)":** Dropdown ou input com autocomplete (`UN`, `KG`, `L`, `M`, `CX`, `G`, `M2`, `M3`). Converte automaticamente para maiúsculas.
- **Campo "Estoque Mínimo de Alerta (`min_stock`)":** Input numérico decimal (ex: `5,000` ou `10`).
- **Seletor de Categorias N:N:** Componente multi-select com chips de categorias já cadastradas no tenant e botão rápido para criar nova categoria em modal inline.
- **Botão "Salvar Produto":** Dispara a criação e redireciona para a ficha do produto ou para o catálogo.
- **Botão "Cancelar":** Retorna para `/products`.

#### 3. Contratos de API
- **Endpoint:** `POST /api/products`
- **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`, `X-Idempotency-Key: <UUIDv4>`
- **Request Body:**
  ```json
  {
    "name": "Eletrodo Revestido AWS E7018 3.25mm",
    "description": "Consumível de soldagem para estruturas metálicas",
    "unit": "KG",
    "min_stock": 25.0,
    "category_ids": [
      "d73b064c-3571-47a3-b4cf-51c09930965e"
    ]
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "id": "84be20c8-7ea1-4cb3-9112-a16f6b579178",
    "name": "Eletrodo Revestido AWS E7018 3.25mm",
    "description": "Consumível de soldagem para estruturas metálicas",
    "unit": "KG",
    "current_quantity": 0.0,
    "current_quantity_scaled": 0,
    "min_stock": 25.0,
    "min_stock_scaled": 25000,
    "is_low_stock": true,
    "is_active": true,
    "categories": [...],
    "created_at": "2026-11-11T10:15:00Z",
    "updated_at": "2026-11-11T10:15:00Z"
  }
  ```

#### 4. Regras de Negócio e Validações
- **Saldo Inicial é Zero:** O formulário **não possui** campo para digitação de quantidade física inicial. O produto nasce obrigatoriamente com saldo zero no PostgreSQL.
- Se `min_stock` for preenchido, deve ser $\ge 0$.
- O nome do item não pode ser composto unicamente por espaços em branco.

#### 5. Matriz RBAC
- Permitido apenas para `OWNER` e `GESTOR`.
- Usuários com papel `ALMOXARIFE` ou `AUDITOR` recebem redirecionamento com banner de permissão insuficiente se tentarem acessar a URL direta.

---

### 6.7. Tela: `/products/[id]` (Ficha Técnica e Histórico do Produto)

#### 1. Objetivo Funcional
Apresentar a visão completa de um produto: dados cadastrais, categorias associadas, saldo contábil atualizado e a aba de **Histórico do Livro-Razão exclusivo deste produto**.

#### 2. Elementos e Controles de Interface
- **Cabeçalho Fixo do Produto:**
  - Nome do Produto, UOM e status de ativação (`Ativo` / `Inativo - Descontinuado`).
  - Painel de Saldo Físico em Destaque: Saldo atual formatado em `tabular-nums font-mono text-2xl` com indicador de status (`stock-ok`, `stock-low` ou `stock-empty`).
  - Botão de Ação Rápida *"Nova Movimentação"* (leva para `/inventory/move?product_id=[id]`).
- **Aba 1: Dados Cadastrais & Edição:**
  - Formulário para alteração de Nome, Descrição, UOM, `min_stock` e categorias associadas.
  - **Invariante Crítica:** Não existe campo de saldo neste formulário.
  - Botão *"Atualizar Dados Cadastrais"* (`PUT /api/products/{id}`).
- **Aba 2: Extrato do Livro-Razão deste Produto:**
  - Tabela cronológica com todas as movimentações contábeis que incidiram sobre este SKU.
  - Colunas: Data/Hora UTC formatada, Tipo de Movimentação (`IN`, `OUT`, `ADJUSTMENT`, `PRODUCT_DELETED`), Delta com sinal explícito (`+` ou `-`), Saldo Resultante (`balance_after`), Justificativa/Documento (`reason`), Chave de Idempotência.

#### 3. Contratos de API
- **Consultar Produto:** `GET /api/products/{id}`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`
- **Atualizar Produto:** `PUT /api/products/{id}`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`, `X-Idempotency-Key: <UUIDv4>`
  - **Request Body:**
    ```json
    {
      "name": "Nome Atualizado",
      "description": "Nova descrição",
      "unit": "KG",
      "min_stock": 30.0,
      "category_ids": ["..."]
    }
    ```
- **Extrato do Produto:** `GET /api/inventory/products/{id}/ledger`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`

#### 4. Regras de Negócio e Validações
- Qualquer tentativa de enviar campos de saldo na mutação cadastral é descartada pelo frontend e ignorada pelo backend.
- O extrato é estritamente somente-leitura e imutável.

#### 5. Matriz RBAC
- **Leitura da Ficha e Extrato:** Aberta a todos os papéis.
- **Edição Cadastral:** Permitida apenas para `OWNER` e `GESTOR`. Para operadores e auditores, os campos são renderizados como texto estático ou `disabled`.

---

### 6.8. Tela: `/inventory/move` (Bancada de Movimentação Física: IN, OUT, ADJUSTMENT)

#### 1. Objetivo Funcional
A tela central de trabalho de chão de fábrica e expedição. Permite registrar rapidamente entradas físicas de mercadoria, saídas para produção ou consumo, e ajustes de inventário físico com simulação de saldo antes do submit.

#### 2. Elementos e Controles de Interface
- **Seletor de Modo Operacional (Abas de Alta Densidade):**
  1. **Aba "Entrada Física (`IN`)"** (Verde esmeralda / `stock-ok`).
  2. **Aba "Saída de Almoxarifado (`OUT`)"** (Grafite escuro / Neutro).
  3. **Aba "Ajuste de Inventário (`ADJUSTMENT`)"** (Azul anil / Índigo).
- **Área de Identificação do Produto:**
  - Campo de Busca com suporte a leitor de código de barras USB/Bluetooth (foco automático ao carregar a página).
  - Ao selecionar o item, exibe imediatamente o **Painel de Saldo Atual**:
    - Nome, SKU, Categorias, Unidade de Medida.
    - Saldo Físico Disponível (`current_quantity`) formatado com decimais e unidade.
- **Campos do Formulário de Movimentação:**
  - **Para `IN` e `OUT`:** Campo "Quantidade a Movimentar" (Input numérico decimal positivo).
  - **Para `ADJUSTMENT`:** Campo "Nova Quantidade Contada Fisicamente no Galpão" (Input numérico decimal $\ge 0$).
  - **Campo "Justificativa / Documento Fiscal":** Textarea ou input de texto (ex: "NF 10429 - Fornecedor X", "Requisição OS 842", "Contagem cíclica prateleira B2"). Obrigatório para `ADJUSTMENT` e `OUT`.
- **Painel de Simulação de Saldo em Tempo Real (*Balance Preview*):**
  - Exibe o cálculo instantâneo:
    $$\text{Saldo Atual} \pm \text{Delta Digitado} = \text{Saldo Projetado}$$
  - Se na operação de `OUT` o Saldo Projetado for negativo ($< 0$), o painel fica em vermelho de alerta e o botão de submissão é **bloqueado no cliente**.
- **Botão de Confirmação de Transação:**
  - Texto dinâmico: *"Confirmar Entrada (+)"*, *"Confirmar Baixa (-)"* ou *"Registrar Ajuste Contábil (Δ)"*.
  - Desabilita instantaneamente ao primeiro clique para prevenir envios repetidos.

#### 3. Contratos de API
- **Entrada Física (`IN`):** `POST /api/inventory/in`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`, `X-Idempotency-Key: <UUIDv4>`
  - **Request Body:**
    ```json
    {
      "product_id": "84be20c8-7ea1-4cb3-9112-a16f6b579178",
      "quantity": 12.5,
      "reason": "NF 10429 - Recebimento de Carga"
    }
    ```
- **Saída Física (`OUT`):** `POST /api/inventory/out`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`, `X-Idempotency-Key: <UUIDv4>`
  - **Request Body:**
    ```json
    {
      "product_id": "84be20c8-7ea1-4cb3-9112-a16f6b579178",
      "quantity": 3.0,
      "reason": "Atendimento à Ordem de Serviço OS-4401"
    }
    ```
- **Ajuste Físico (`ADJUSTMENT`):** `POST /api/inventory/adjustment`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`, `X-Idempotency-Key: <UUIDv4>`
  - **Request Body:**
    ```json
    {
      "product_id": "84be20c8-7ea1-4cb3-9112-a16f6b579178",
      "new_quantity": 9.5,
      "reason": "Auditoria física mensal - divergência identificada"
    }
    ```

#### 4. Regras de Negócio e Validações
- **Idempotência Estrita no Cliente:** Antes de cada submissão, um novo UUIDv4 é gerado e associado à tentativa. Se a requisição sofrer timeout de rede e o usuário clicar em reenviar, o frontend mantém a mesma chave para garantir que o backend deduplique a transação via RFC 9474.
- **Validação de Quantidade Positiva:** Para `IN` e `OUT`, a quantidade digitada deve ser estritamente maior que zero ($> 0$).
- **Bloqueio de Saldo Negativo:** O frontend valida `current_quantity - requested_quantity >= 0`. Se menor, impede a chamada.
- Se o backend retornar `422 Unprocessable Entity` com `insufficient-stock` (devido a uma baixa concorrente concorrente em outro terminal), o frontend exibe alerta crítico: *"Saldo físico insuficiente. Outro operador realizou uma baixa concorrente deste item. Saldo atualizado recarregado."* e atualiza o saldo na tela imediatamente.
- Se a resposta trouxer `X-Cache: HIT`, exibe aviso informativo: *"Transação confirmada (Replay de operação já processada)."*

#### 5. Matriz RBAC
- **Aba `IN`:** `OWNER`, `GESTOR`, `ALMOXARIFE`. (Desabilitada para `AUDITOR`).
- **Aba `OUT`:** `OWNER`, `GESTOR`, `ALMOXARIFE`. (Desabilitada para `AUDITOR`).
- **Aba `ADJUSTMENT`:** `OWNER`, `GESTOR`, `ALMOXARIFE`, `AUDITOR`.

---

### 6.9. Tela: `/inventory/movements` (Extrato Global do Livro-Razão)

#### 1. Objetivo Funcional
Apresentar a auditoria contábil perpétua do almoxarifado. Cada linha é um registro append-only imutável de entrada, saída, ajuste ou inativação, permitindo reconstruir a linha do tempo exata de qualquer produto.

#### 2. Elementos e Controles de Interface
- **Barra de Filtros Contábeis:**
  - **Filtro por Produto:** Autocomplete de produtos do tenant.
  - **Filtro por Tipo de Evento:** Multi-select de tipos (`IN`, `OUT`, `ADJUSTMENT`, `PRODUCT_DELETED`).
  - **Filtro por Período:** Data inicial e final (com conversão para ISO 8601 UTC).
  - **Botão "Exportar Extrato":** Exportação dos dados filtrados para CSV tabular estruturado.
- **Tabela do Livro-Razão (Livro Caixa Industrial):**
  - Coluna **Data e Hora:** Formatada em `DD/MM/AAAA HH:mm:ss` (com tooltip do timestamp UTC exato).
  - Coluna **Produto:** Nome do produto e UOM.
  - Coluna **Tipo de Lançamento:** Badge com destaque cromático semântico:
    - `IN`: Fundo esmeralda suave, texto verde com prefixo `+`.
    - `OUT`: Fundo neutro, texto grafite escuro com prefixo `-`.
    - `ADJUSTMENT`: Fundo índigo suave, texto anil com símbolo `Δ`.
    - `PRODUCT_DELETED`: Fundo cinza, texto zinc-500.
  - Coluna **Delta Físico:** Quantidade movimentada com sinal explícito (`+5,000 KG` ou `-2,000 UN`), alinhada à direita em `tabular-nums font-mono`.
  - Coluna **Saldo Resultante (`balance_after`):** Saldo exato daquele produto imediatamente após o evento.
  - Coluna **Motivo / Documento Comprobatório:** Justificativa informada pelo operador.
  - Coluna **Chave de Idempotência:** Exibição truncada do UUIDv4 com botão para copiar a chave completa de auditoria.

#### 3. Contratos de API
- **Endpoint:** `GET /api/inventory/movements`
- **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`
- **Query Params:** `product_id`, `type`, `start_date`, `end_date`, `limit`, `offset`.
- **Response `200 OK`:** Array de `StockMovementResponseDto`.

#### 4. Regras de Negócio e Validações
- **Sem Ações de Modificação:** A tabela não possui botões de "Editar" ou "Excluir". A imutabilidade do Livro-Razão é total.
- Ordenação padrão estritamente decrescente por data de criação (`created_at DESC`).

#### 5. Matriz RBAC
- Acesso integral de visualização concedido a todos os papéis (`OWNER`, `GESTOR`, `ALMOXARIFE`, `AUDITOR`).

---

### 6.10. Tela: `/categories` (Gestão de Categorias N:N)

#### 1. Objetivo Funcional
Permitir a criação, listagem e remoção de categorias de agrupamento de produtos isoladas no tenant ativo.

#### 2. Elementos e Controles de Interface
- **Botão "+ Nova Categoria":** Abre modal de criação de categoria.
- **Tabela de Categorias:**
  - Coluna **Etiqueta Visual:** Cor e Nome da Categoria.
  - Coluna **Descrição Operacional**.
  - Coluna **Data de Cadastro**.
  - Coluna **Ações:** Botão *"Excluir Categoria"*.
- **Modal de Cadastro de Categoria:**
  - Campo "Nome da Categoria" (ex: "Químicos Inflamáveis").
  - Campo "Descrição" (opcional).
  - Seletor de Cor Semântica (paleta industrial: Aço, Azul, Verde, Âmbar, Roxo, Zinco).

#### 3. Contratos de API
- **Listar Categorias:** `GET /api/categories`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`
- **Criar Categoria:** `POST /api/categories`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`, `X-Idempotency-Key: <UUIDv4>`
  - **Request Body:** `{"name": "EPIs", "description": "Equipamentos de Proteção Individual", "color": "#2563EB"}`
- **Excluir Categoria:** `DELETE /api/categories/{id}`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`

#### 4. Regras de Negócio e Validações
- O nome da categoria é único no escopo do tenant ativo.
- A exclusão de uma categoria desassocia os produtos vinculados sem excluí-los nem alterar seus saldos de estoque.

#### 5. Matriz RBAC
- Visível e gerenciável exclusivamente por `OWNER` e `GESTOR`.

---

### 6.11. Tela: `/settings/members` (Gestão do Almoxarifado e Equipe)

#### 1. Objetivo Funcional
Permitir que proprietários e gestores administrem os membros vinculados ao almoxarifado ativo, deleguem papéis operacionais (`GESTOR`, `ALMOXARIFE`, `AUDITOR`) e convidem novos colaboradores pelo e-mail.

#### 2. Elementos e Controles de Interface
- **Painel de Dados do Almoxarifado:** Exibe Nome, Slug e Data de Criação do Tenant.
- **Botão "+ Convidar Membro":** Abre modal para vincular um usuário existente pelo e-mail.
- **Tabela de Membros do Tenant:**
  - Coluna **Nome Completo e E-mail**.
  - Coluna **Data de Ingresso (`joined_at`)**.
  - Coluna **Papel Atual:** Dropdown com as opções `OWNER`, `GESTOR`, `ALMOXARIFE`, `AUDITOR`.
  - Coluna **Ações:** Botão *"Remover Vínculo"*.
- **Modal de Adição de Membro:**
  - Campo "E-mail do Usuário": Input de e-mail corporativo.
  - Campo "Papel Inicial": Seleção do papel atribuído.

#### 3. Contratos de API
- **Listar Membros:** `GET /api/tenants/{tenant_id}/members`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`
- **Adicionar Membro:** `POST /api/tenants/{tenant_id}/members`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`
  - **Request Body:** `{"email": "operador@empresa.com", "role": "ALMOXARIFE"}`
- **Alterar Papel de Membro:** `PUT /api/tenants/{tenant_id}/members/{user_id}`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`
  - **Request Body:** `{"role": "GESTOR"}`
- **Remover Membro:** `DELETE /api/tenants/{tenant_id}/members/{user_id}`
  - **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <UUID>`

#### 4. Regras de Negócio e Validações
- **Proteção do Único OWNER (*Sole Owner Protection*):** Se o tenant possuir apenas um membro com papel `OWNER`, o frontend desabilita os controles de remoção e de alteração de papel desse membro, prevenindo a criação de tenants órfãos.
- Se o usuário tentar remover a si mesmo como `OWNER` único, o backend rejeita com `422 Unprocessable Entity` (`sole-owner-removal`) e a UI exibe o erro em destaque.

#### 5. Matriz RBAC
- **Acesso à Tela:** `OWNER` e `GESTOR`.
- **Convidar Membros:** `OWNER` e `GESTOR`.
- **Alterar Papel de Membros:** Exclusivo para `OWNER`.
- **Remover Membros:** Exclusivo para `OWNER`.

---

## 7. Gerenciamento de Estado, Cache e Ciclo de Vida do TanStack Query

Para garantir sincronização transacional sem recarregamentos desnecessários de tela e sem perda de dados operacionais, as queries são organizadas por chaves estruturadas (*Query Keys*) escopadas pelo `tenant_id` ativo:

```typescript
export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  tenants: {
    list: ["tenants", "list"] as const,
    detail: (id: string) => ["tenants", "detail", id] as const,
    members: (tenantId: string) => ["tenants", tenantId, "members"] as const,
  },
  products: {
    all: (tenantId: string) => ["products", tenantId] as const,
    list: (tenantId: string, filters: Record<string, any>) => ["products", tenantId, "list", filters] as const,
    detail: (tenantId: string, id: string) => ["products", tenantId, "detail", id] as const,
    alerts: (tenantId: string) => ["products", tenantId, "alerts"] as const,
  },
  categories: {
    list: (tenantId: string) => ["categories", tenantId] as const,
  },
  inventory: {
    movements: (tenantId: string, filters: Record<string, any>) => ["inventory", tenantId, "movements", filters] as const,
    ledgerByProduct: (tenantId: string, productId: string) => ["inventory", tenantId, "ledger", productId] as const,
  },
};
```

### 7.1. Estratégia de Invalidação de Cache Pós-Mutação

Sempre que uma movimentação física for confirmada com sucesso (`IN`, `OUT` ou `ADJUSTMENT`):
1. Invalida imediatamente `queryKeys.products.all(activeTenantId)`.
2. Invalida `queryKeys.products.detail(activeTenantId, productId)`.
3. Invalida `queryKeys.inventory.movements(activeTenantId, {})`.
4. Invalida `queryKeys.inventory.ledgerByProduct(activeTenantId, productId)`.
5. Força recálculo dos KPIs da bancada em `/dashboard`.

---

## 8. Catálogo de Erros RFC 7807 e Mapeamento de Feedback ao Operador

O frontend intercepta todos os códigos de erro padronizados do backend e exibe mensagens em linguagem operacional clara:

| Código HTTP | `type` RFC 7807 | Mensagem Exibida na Interface | Ação Recomendada ao Operador |
| :--- | :--- | :--- | :--- |
| **`400`** | `missing-tenant-header` | *"Sessão sem almoxarifado ativo selecionado."* | Redirecionar para `/tenants` para selecionar a unidade. |
| **`401`** | `token-expired` | *"Sua sessão de trabalho expirou por segurança."* | Redirecionar para `/login?returnUrl=...`. |
| **`401`** | `invalid-credentials` | *"E-mail ou senha incorretos."* | Verificar digitação de usuário e senha. |
| **`403`** | `tenant-access-denied` | *"Você não possui autorização para operar neste almoxarifado."* | Trocar de almoxarifado ou solicitar inclusão ao gestor. |
| **`403`** | `insufficient-permissions` | *"Seu perfil de acesso não permite executar esta operação."* | Consultar a matriz RBAC com o gestor do tenant. |
| **`404`** | `product-not-found` | *"Produto não localizado ou já inativado neste almoxarifado."* | Conferir código de barras ou SKU pesquisado. |
| **`409`** | `idempotency-conflict` | *"Conflito de transação: Chave de requisição reutilizada com dados diferentes."* | Gerar nova tentativa de lançamento na bancada. |
| **`409`** | `tenant-slug-already-exists` | *"Este slug de almoxarifado já está registrado."* | Escolher um nome ou identificador alternativo. |
| **`409`** | `member-already-exists` | *"Este colaborador já participa como membro deste almoxarifado."* | Alterar o papel do membro na tabela de equipe. |
| **`422`** | `insufficient-stock` | *"Saldo físico insuficiente para efetuar esta saída de material."* | Conferir contagem física na prateleira ou lançar entrada. |
| **`422`** | `sole-owner-removal` | *"Impossível remover ou alterar o único Administrador (OWNER) do almoxarifado."* | Nomear outro OWNER antes de remover o atual. |
| **`500`** | `internal-server-error` | *"Falha interna no servidor do almoxarifado."* | Notificar equipe de infraestrutura com o ID da ocorrência. |

---

## 9. Práticas de Acessibilidade e Ergonomia Industrial

1. **Atalhos Globais de Teclado:**
   - `Ctrl + K`: Abre barra de busca global de produtos e foca no leitor de código de barras.
   - `Esc`: Fecha modais e cancela simulações de movimentação.
   - `Ctrl + Enter`: Submete formulários de movimentação quando válidos.
2. **Focus Rings Visíveis:** Todos os botões, links e inputs possuem anel de foco de alto contraste (`focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1`).
3. **Padrão de Cores e Contraste:** Atendimento aos critérios WCAG AA/AAA para texto em fundos claros, eliminando tons cinza claro ilegíveis sob lâmpadas de galpão.
4. **Alinhamento Numérico Estrito:** Todas as colunas com números, saldos e deltas utilizam alinhamento à direita (`text-right font-mono tabular-nums`).
