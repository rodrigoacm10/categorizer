# Plano Detalhado de Implementação do Frontend (FRONTEND_TASKS)
## Decomposição de Tarefas Técnicas, Sequenciamento, Contratos de Integração e Critérios de Aceitação

---

## 1. Visão Geral e Estratégia de Execução

Este documento estabelece o roadmap de implementação do Frontend da aplicação de gestão física de estoque e almoxarifado multi-tenant. A implementação é dividida em **7 Fases Sequenciais**, organizadas em tarefas atômicas estritas com escopo delimitado de arquivos, contratos de integração com a API FastAPI/PostgreSQL e suíte de testes automatizados com meta de cobertura de código.

> [!IMPORTANT]
> **Regras de Engenharia Inegociáveis:**
> 1. **Execução Sequencial:** Nenhuma tarefa deve ser iniciada sem que suas dependências estejam implementadas, testadas e validadas.
> 2. **Tipagem Estrita (*Strict TypeScript*):** Proibido o uso de `any` ou `unknown` sem type narrowing. Todos os DTOs e entidades devem ter paridade tipada rigorosa com o backend.
> 3. **Impeccable Workbench Style (Zero AI-Slop):** Nenhuma tela deve utilizar cards flutuantes arredondados ou sombras decorativas difusas. Usar painéis com divisórias de 1px (`border-zinc-200`) e fonte monoespaçada com `tabular-nums` para números e saldos.
> 4. **Isolamento de Tenant em Toda Requisição de Domínio:** Injeção mandatória do cabeçalho `X-Tenant-ID` em qualquer rota de catálogo, estoque ou membros.
> 5. **Idempotência Automática (RFC 9474):** Geração transparente de `X-Idempotency-Key` (UUIDv4) para mutações (`POST`, `PUT`, `DELETE`).
> 6. **Escala Inteira Fixa ($10^3$):** Operações aritméticas de saldo no frontend devem usar inteiros escalados via `scale.ts`, eliminando arredondamentos de ponto flutuante.
> 7. **Meta de Cobertura de Testes Automatizados $\ge 80\%$:** Suíte de testes unitários e de integração de componentes utilizando **Vitest**, **React Testing Library** e **MSW (Mock Service Worker)**.

---

## 2. Mapa Geral de Tarefas e Sequenciamento

| ID da Tarefa | Nome da Tarefa | Fase | Dependências | Arquivos Principais | Meta de Testes |
| :--- | :--- | :---: | :---: | :--- | :---: |
| **FT-01** | Camada Utilitária de Escala Fixa ($10^3$) e Formatadores | Fase 1 | Nenhuma | `shared/utils/scale.ts`, `shared/utils/formatters.ts` | $\ge 95\%$ |
| **FT-02** | Cliente HTTP Robusto com Pipeline de Interceptors | Fase 1 | FT-01 | `shared/lib/api-client.ts`, `shared/types/rfc7807.types.ts` | $\ge 90\%$ |
| **FT-03** | Configuração do TanStack React Query v5 e Storage | Fase 1 | FT-02 | `shared/lib/query-client.ts`, `shared/lib/storage.ts` | $\ge 85\%$ |
| **FT-04** | Contexto Global de Tenant e Matriz de Permissões RBAC | Fase 1 | FT-02, FT-03 | `features/tenants/hooks/useTenant.ts`, `shared/hooks/useRBAC.ts` | $\ge 90\%$ |
| **FT-05** | Módulo de Autenticação: Tela de Login e Gestão de JWT | Fase 2 | FT-02, FT-04 | `app/(auth)/login/page.tsx`, `features/auth/*` | $\ge 85\%$ |
| **FT-06** | Módulo de Autenticação: Tela de Registro de Novo Usuário | Fase 2 | FT-05 | `app/(auth)/register/page.tsx`, `features/auth/components/*` | $\ge 85\%$ |
| **FT-07** | Módulo de Multi-Tenancy: Seleção e Criação de Almoxarifado | Fase 2 | FT-05, FT-06 | `app/(workbench)/tenants/page.tsx`, `features/tenants/*` | $\ge 85\%$ |
| **FT-08** | Shell de Bancada Industrial: TopBar, Navegação e Indicador de Rede | Fase 3 | FT-04, FT-07 | `app/(workbench)/layout.tsx`, `shared/components/TopBar.tsx` | $\ge 80\%$ |
| **FT-09** | Faixa de KPIs Contínua (*KPI Strip*) e Alertas Rápidos | Fase 3 | FT-08 | `features/dashboard/components/KPIStrip.tsx` | $\ge 85\%$ |
| **FT-10** | Tela do Dashboard de Bancada Operacional (`/dashboard`) | Fase 3 | FT-08, FT-09 | `app/(workbench)/dashboard/page.tsx` | $\ge 80\%$ |
| **FT-11** | Módulo de Categorias: Gestão N:N e Seletores Semânticos | Fase 4 | FT-08 | `app/(workbench)/categories/page.tsx`, `features/categories/*` | $\ge 85\%$ |
| **FT-12** | Catálogo de Produtos: Tabela de Alta Densidade e Busca Rápida | Fase 4 | FT-08, FT-11 | `app/(workbench)/products/page.tsx`, `features/products/*` | $\ge 85\%$ |
| **FT-13** | Cadastro de Produtos: Ficha Cadastral e Ponto de Reposição | Fase 4 | FT-12 | `app/(workbench)/products/new/page.tsx` | $\ge 85\%$ |
| **FT-14** | Ficha do Produto e Histórico do Ledger Individual | Fase 4 | FT-12, FT-13 | `app/(workbench)/products/[id]/page.tsx` | $\ge 85\%$ |
| **FT-15** | Bancada de Movimentação Física: Entrada (`IN`) e Saída (`OUT`) | Fase 5 | FT-01, FT-12 | `app/(workbench)/inventory/move/page.tsx`, `features/inventory/*` | $\ge 90\%$ |
| **FT-16** | Bancada de Movimentação Física: Ajuste de Inventário (`ADJUSTMENT`)| Fase 5 | FT-15 | `app/(workbench)/inventory/move/page.tsx` | $\ge 90\%$ |
| **FT-17** | Extrato Geral do Livro-Razão Imutável (`/inventory/movements`) | Fase 5 | FT-15, FT-16 | `app/(workbench)/inventory/movements/page.tsx` | $\ge 85\%$ |
| **FT-18** | Simulador de Saldo em Tempo Real e Prevenção de Saldo Negativo | Fase 5 | FT-15, FT-16 | `features/inventory/components/BalancePreview.tsx` | $\ge 95\%$ |
| **FT-19** | Gestão de Equipe do Almoxarifado e Concessão de Papéis RBAC | Fase 6 | FT-04, FT-08 | `app/(workbench)/settings/members/page.tsx` | $\ge 85\%$ |
| **FT-20** | Proteção de Titular Único (*Sole Owner Protection*) na UI | Fase 6 | FT-19 | `features/settings/components/MemberListTable.tsx` | $\ge 90\%$ |
| **FT-21** | Suíte de Testes de Idempotência, Replay e Detecção de Conflito | Fase 7 | Todas | `tests/integration/idempotency.test.tsx` | $\ge 90\%$ |
| **FT-22** | Suíte de Testes da Matriz RBAC e Bloqueios Visuais | Fase 7 | Todas | `tests/integration/rbac.test.tsx` | $\ge 90\%$ |
| **FT-23** | Testes End-to-End (E2E) dos Fluxos Operacionais Críticos | Fase 7 | Todas | `tests/e2e/inventory-workflow.spec.ts` | Pass 100% |

---

## 3. Detalhamento Atômico das Tarefas por Fase

---

### FASE 1: Arquitetura Base, Infraestrutura de Rede, Escala e Contextos

---

#### Tarefa FT-01: Utilitário de Escala Fixa ($10^3$) e Formatadores de Precisão
- **Identificador:** `FT-01`
- **Prioridade:** P0 (Bloqueante)
- **Dependências:** Nenhuma
- **Arquivos a Criar/Alterar:**
  - `frontend/src/shared/utils/scale.ts`
  - `frontend/src/shared/utils/formatters.ts`
  - `frontend/src/shared/utils/__tests__/scale.test.ts`
  - `frontend/src/shared/utils/__tests__/formatters.test.ts`
- **Descrição Técnica:**
  - Implementar funções de conversão bidirecional:
    - `toScaledInt(value: number | string | null | undefined): number`: Converte decimais (com vírgula ou ponto) para inteiros de escala $10^3$ ($2{,}5 \rightarrow 2500$). Lança erro se o formato for inválido.
    - `fromScaledInt(scaledValue: number | null | undefined): number`: Converte inteiros escalados de volta para número decimal ($2500 \rightarrow 2.5$).
    - `formatScaledQuantity(scaledValue: number | null | undefined, unit?: string): string`: Formata para padrão numérico brasileiro (`pt-BR`) com até 3 casas decimais e sufixo de unidade de medida.
    - `formatDeltaQuantity(scaledValue: number, unit?: string): string`: Adiciona obrigatoriamente prefixo de sinal explícito `+` para valores positivos e `-` para negativos.
- **Critérios de Aceitação:**
  - [ ] `toScaledInt("2,5")` retorna exatamente `2500`.
  - [ ] `toScaledInt(0.125)` retorna exatamente `125`.
  - [ ] `fromScaledInt(125)` retorna exatamente `0.125`.
  - [ ] `formatDeltaQuantity(2500, "KG")` retorna `"+2,5 KG"`.
  - [ ] `formatDeltaQuantity(-1000, "UN")` retorna `"-1 UN"`.
  - [ ] Cobertura de testes unitários $\ge 95\%$.

---

#### Tarefa FT-02: Cliente HTTP Robusto com Pipeline de Interceptors (Auth, Tenant, Idempotency e RFC 7807)
- **Identificador:** `FT-02`
- **Prioridade:** P0 (Bloqueante)
- **Dependências:** `FT-01`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/shared/types/api.types.ts`
  - `frontend/src/shared/types/rfc7807.types.ts`
  - `frontend/src/shared/lib/api-client.ts`
  - `frontend/src/shared/lib/__tests__/api-client.test.ts`
- **Descrição Técnica:**
  - Refatorar completamente `frontend/src/shared/lib/api-client.ts` para implementar o pipeline de interceptors:
    1. **Auth Interceptor:** Injeta `Authorization: Bearer <token>` recuperado de cookie de sessão ou storage seguro.
    2. **Tenant Interceptor:** Se a rota exigir contexto de tenant, injeta o cabeçalho `X-Tenant-ID: <UUID>`. Lança erro preventivo antes do envio se o tenant ativo não estiver definido.
    3. **Idempotency Interceptor:** Para métodos `POST`, `PUT`, `DELETE`, gera um UUIDv4 único caso não tenha sido fornecido. Captura o cabeçalho de resposta `X-Cache: HIT` e o anexa ao retorno tipado.
    4. **RFC 7807 Error Parser:** Se o status HTTP $\ge 400$, decodifica o payload JSON no formato `ProblemDetails` e instancia `ProblemDetailsError`.
    5. **Tratamento de Sessão Expirada (401):** Limpa as credenciais locais e aciona callback de redirecionamento para `/login`.
- **Critérios de Aceitação:**
  - [ ] Requisições `POST` sem chave explícita recebem automaticamente um cabeçalho `X-Idempotency-Key` no formato UUIDv4.
  - [ ] Respostas com `X-Cache: HIT` retornam com flag `isCached: true`.
  - [ ] Erros `403` com corpo RFC 7807 lançam `ProblemDetailsError` contendo `type`, `title`, `status` e `detail`.
  - [ ] Cobertura de testes unitários com mocks de `fetch` $\ge 90\%$.

---

#### Tarefa FT-03: Configuração do TanStack React Query v5 e Storage
- **Identificador:** `FT-03`
- **Prioridade:** P0 (Bloqueante)
- **Dependências:** `FT-02`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/shared/lib/query-client.ts`
  - `frontend/src/shared/lib/storage.ts`
  - `frontend/src/app/layout.tsx`
- **Descrição Técnica:**
  - Configurar instância do `QueryClient` com parâmetros otimizados para aplicação operacional:
    - `staleTime: 10 * 1000` (10 segundos de frescor padrão para catálogo).
    - `gcTime: 5 * 60 * 1000` (5 minutos para garbage collection).
    - `retry: 1` para leituras `GET`; `retry: 0` para mutações (`POST`, `PUT`, `DELETE`), evitando disparos duplicados sem intervenção de idempotência.
  - Criar fábrica padronizada de chaves de query (`queryKeys`) escopadas estritamente pelo `tenant_id` ativo.
  - Implementar camada de persistência `storage.ts` com suporte seguro a cookies e `localStorage`.
- **Critérios de Aceitação:**
  - [ ] Mutações não realizam retry automático de rede sem confirmação do operador.
  - [ ] Chaves de cache contêm invariavelmente o `tenant_id` ativo como primeiro argumento de escopo.

---

#### Tarefa FT-04: Contexto Global de Tenant e Matriz de Permissões RBAC
- **Identificador:** `FT-04`
- **Prioridade:** P0 (Bloqueante)
- **Dependências:** `FT-02`, `FT-03`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/shared/types/rbac.types.ts`
  - `frontend/src/features/tenants/hooks/useTenant.ts`
  - `frontend/src/shared/hooks/useRBAC.ts`
  - `frontend/src/shared/components/Can.tsx`
  - `frontend/src/shared/hooks/__tests__/useRBAC.test.ts`
- **Descrição Técnica:**
  - Criar `TenantProvider` e hook `useTenant` para gerenciar o almoxarifado ativo, sincronizando em cookies para hidratação no servidor.
  - Criar hook `useRBAC()` que expõe métodos de checagem:
    - `can(action: ActionType): boolean`
    - `hasRole(roles: TenantRole | TenantRole[]): boolean`
    - `isOwner(): boolean`
  - Criar componente `<Can I="edit_product">...</Can>` para renderização condicional declarativa na UI.
- **Critérios de Aceitação:**
  - [ ] Um usuário com papel `ALMOXARIFE` tem `can("create_product") === false` e `can("stock_in") === true`.
  - [ ] Um usuário com papel `AUDITOR` tem `can("stock_in") === false` e `can("stock_adjustment") === true`.
  - [ ] Um usuário com papel `OWNER` tem todas as permissões ativas.
  - [ ] Cobertura de testes unitários $\ge 90\%$.

---

### FASE 2: Autenticação, Cadastro e Multi-Tenancy

---

#### Tarefa FT-05: Tela de Login e Gestão de Sessão JWT
- **Identificador:** `FT-05`
- **Prioridade:** P1
- **Dependências:** `FT-02`, `FT-04`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(auth)/login/page.tsx`
  - `frontend/src/features/auth/services/auth.api.ts`
  - `frontend/src/features/auth/hooks/useAuth.ts`
  - `frontend/src/features/auth/components/LoginForm.tsx`
  - `frontend/src/features/auth/components/__tests__/LoginForm.test.tsx`
- **Descrição Técnica:**
  - Construir formulário de login de alta densidade sem cards arredondados inflados.
  - Validação síncrona com Zod de e-mail e senha.
  - Integrar com `POST /api/auth/login`. Ao receber o token, invocar `GET /api/auth/me`.
  - Se o usuário pertencer a exatamente 1 tenant, selecioná-lo automaticamente e redirecionar para `/dashboard`. Caso contrário, direcionar para `/tenants`.
  - Exibir banner de erro RFC 7807 para credenciais inválidas ou usuário inativo.
- **Critérios de Aceitação:**
  - [ ] Validação impede submit se o e-mail for inválido ou a senha estiver vazia.
  - [ ] Botão de login exibe spinner e desabilita durante o envio.
  - [ ] Redirecionamento inteligente: 1 tenant vai para `/dashboard`; múltiplos ou zero vão para `/tenants`.
  - [ ] Cobertura de testes $\ge 85\%$.

---

#### Tarefa FT-06: Tela de Cadastro de Usuário
- **Identificador:** `FT-06`
- **Prioridade:** P1
- **Dependências:** `FT-05`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(auth)/register/page.tsx`
  - `frontend/src/features/auth/components/RegisterForm.tsx`
  - `frontend/src/features/auth/components/__tests__/RegisterForm.test.tsx`
- **Descrição Técnica:**
  - Implementar formulário de registro com validação visual de requisitos de senha (mínimo 8 caracteres, 1 número, 1 maiúscula).
  - Integrar com `POST /api/auth/register`.
  - Tratar erro `409 Conflict` (`email-already-exists`) destacando o campo de e-mail.
  - Ao registrar com sucesso, redirecionar para `/login` com toast de sucesso.
- **Critérios de Aceitação:**
  - [ ] Impede envio se a senha não atender às 3 regras de complexidade do backend.
  - [ ] Trata resposta de conflito exibindo mensagem clara sem crash da aplicação.
  - [ ] Cobertura de testes $\ge 85\%$.

---

#### Tarefa FT-07: Tela de Seleção e Criação de Almoxarifados (`/tenants`)
- **Identificador:** `FT-07`
- **Prioridade:** P1
- **Dependências:** `FT-05`, `FT-06`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(workbench)/tenants/page.tsx`
  - `frontend/src/features/tenants/services/tenants.api.ts`
  - `frontend/src/features/tenants/components/TenantList.tsx`
  - `frontend/src/features/tenants/components/CreateTenantModal.tsx`
  - `frontend/src/features/tenants/components/__tests__/TenantList.test.tsx`
- **Descrição Técnica:**
  - Listar todos os almoxarifados aos quais o usuário pertence via `GET /api/tenants`.
  - Exibir cada almoxarifado em painel plano de 1px com badge de papel (`OWNER`, `GESTOR`, `ALMOXARIFE`, `AUDITOR`).
  - Implementar modal de criação de tenant (`POST /api/tenants`) com geração automática de slug em kebab-case.
  - Ao criar ou selecionar um tenant, atualizar o contexto global de tenant, invalidar o cache anterior e redirecionar para `/dashboard`.
- **Critérios de Aceitação:**
  - [ ] Seleção de um tenant armazena o ID e o papel no estado global.
  - [ ] Criação de tenant atribui o criador como `OWNER` e abre a bancada da nova unidade.
  - [ ] Erro `409` para slug repetido é tratado com feedback direto no input.
  - [ ] Cobertura de testes $\ge 85\%$.

---

### FASE 3: Shell Workbench, Navegação e Dashboard Operacional

---

#### Tarefa FT-08: Shell de Bancada Industrial (TopBar, Switcher de Tenant e Conexão)
- **Identificador:** `FT-08`
- **Prioridade:** P1
- **Dependências:** `FT-04`, `FT-07`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(workbench)/layout.tsx`
  - `frontend/src/shared/components/TopBar.tsx`
  - `frontend/src/shared/components/TenantSwitcher.tsx`
  - `frontend/src/shared/components/NetworkStatusIndicator.tsx`
- **Descrição Técnica:**
  - Construir layout de bancada contínua fixo de 48px com navegação primária por abas industriais.
  - Inserir dropdown `TenantSwitcher` com busca rápida para troca de almoxarifado a qualquer momento.
  - Inserir indicador de status de rede (`Online` / `Offline` via listeners `window.ononline/onoffline`).
  - Implementar atalho global `Ctrl+K` para busca e leitor de código de barras.
- **Critérios de Aceitação:**
  - [ ] Altura exata de 48px sem cantos arredondados inflados.
  - [ ] Dropdown permite alternar de tenant instantaneamente, purgando o cache das queries ativas.
  - [ ] Foco visual de alto contraste em navegação por teclado (`Tab`).

---

#### Tarefa FT-09: Faixa de KPIs Contínua (*KPI Strip*) e Alertas Rápidos
- **Identificador:** `FT-09`
- **Prioridade:** P1
- **Dependências:** `FT-08`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/features/dashboard/components/KPIStrip.tsx`
  - `frontend/src/features/dashboard/components/__tests__/KPIStrip.test.tsx`
- **Descrição Técnica:**
  - Construir componente de faixa horizontal unificada dividida por divisores verticais de 1px (`divide-x divide-zinc-200 bg-zinc-50/60`).
  - Exibir 4 métricas operacionais:
    1. Itens Cadastrados no Catálogo.
    2. Itens em Alerta de Estoque Baixo (`is_low_stock`).
    3. Itens com Estoque Zerado.
    4. Movimentações Registradas Hoje (24h).
  - Todos os valores exibidos com fonte monoespaçada e alinhamento de números tabulares (`tabular-nums font-mono`).
- **Critérios de Aceitação:**
  - [ ] Não utiliza cards individuais separados com sombras.
  - [ ] Valores numéricos refletem exatamente as respostas de `GET /api/products` e `GET /api/inventory/movements`.
  - [ ] Cobertura de testes $\ge 85\%$.

---

#### Tarefa FT-10: Tela do Dashboard de Bancada Operacional (`/dashboard`)
- **Identificador:** `FT-10`
- **Prioridade:** P1
- **Dependências:** `FT-08`, `FT-09`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(workbench)/dashboard/page.tsx`
  - `frontend/src/features/dashboard/components/QuickActionToolbar.tsx`
  - `frontend/src/features/dashboard/components/CriticalStockTable.tsx`
- **Descrição Técnica:**
  - Integrar a `KPIStrip` no topo da tela `/dashboard`.
  - Inserir barra de ações rápidas de bancada:
    - Botão "Registrar Entrada (+)" (desabilitado para `AUDITOR`).
    - Botão "Registrar Saída (-)" (desabilitado para `AUDITOR`).
    - Botão "Ajuste de Inventário (Δ)" (habilitado para todos os papéis).
  - Tabela densa de itens com estoque baixo (`low_stock_only=true`), com link direto para registrar entrada física.
- **Critérios de Aceitação:**
  - [ ] Renderiza lista prioritária de reposição.
  - [ ] Operador com papel `AUDITOR` visualiza ações de entrada e saída desabilitadas com tooltip explicativo.

---

### FASE 4: Módulo de Produtos e Categorias

---

#### Tarefa FT-11: Módulo de Categorias N:N
- **Identificador:** `FT-11`
- **Prioridade:** P2
- **Dependências:** `FT-08`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(workbench)/categories/page.tsx`
  - `frontend/src/features/categories/services/categories.api.ts`
  - `frontend/src/features/categories/components/CategoryListTable.tsx`
  - `frontend/src/features/categories/components/CategoryModal.tsx`
  - `frontend/src/features/categories/components/__tests__/CategoryModal.test.tsx`
- **Descrição Técnica:**
  - Listar categorias do tenant via `GET /api/categories`.
  - Modal de cadastro com validação de nome obrigatório e seletor de paleta de cor industrial.
  - Implementar exclusão com confirmação (`DELETE /api/categories/{id}`).
  - Proteção RBAC: Bloquear acesso à tela para `ALMOXARIFE` e `AUDITOR`.
- **Critérios de Aceitação:**
  - [ ] Criação de categoria envia `POST /api/categories` com `X-Tenant-ID`.
  - [ ] Exclusão de categoria alerta que os produtos vinculados não serão apagados.
  - [ ] Cobertura de testes $\ge 85\%$.

---

#### Tarefa FT-12: Catálogo de Produtos com Tabela de Alta Densidade e Busca Rápida
- **Identificador:** `FT-12`
- **Prioridade:** P1
- **Dependências:** `FT-08`, `FT-11`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(workbench)/products/page.tsx`
  - `frontend/src/features/products/services/products.api.ts`
  - `frontend/src/features/products/components/ProductTable.tsx`
  - `frontend/src/features/products/components/ProductFilters.tsx`
  - `frontend/src/features/products/components/DeactivateProductModal.tsx`
  - `frontend/src/features/products/components/__tests__/ProductTable.test.tsx`
- **Descrição Técnica:**
  - Tabela completa de produtos com cabeçalho sticky e linhas de 36px de altura.
  - Filtros: busca textual com debounce de 300ms, filtro por categoria, checkbox "Apenas Estoque Baixo", checkbox "Incluir Inativos".
  - Badges semânticos de saldo (`stock-ok`, `stock-low`, `stock-empty`, `stock-inactive`).
  - Modal de Inativação (Soft-Delete): exige campo de justificativa obrigatório e dispara `DELETE /api/products/{id}?reason=...` com `X-Idempotency-Key`.
- **Critérios de Aceitação:**
  - [ ] Números de saldo e estoque mínimo alinhados à direita com `font-mono tabular-nums`.
  - [ ] Inativação gera evento contábil no backend e atualiza a tabela instantaneamente.
  - [ ] Botão de "Novo Produto" e "Inativar" ocultos para operadores (`ALMOXARIFE`) e auditores.
  - [ ] Cobertura de testes $\ge 85\%$.

---

#### Tarefa FT-13: Tela de Cadastro de Produtos Físicos (`/products/new`)
- **Identificador:** `FT-13`
- **Prioridade:** P1
- **Dependências:** `FT-12`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(workbench)/products/new/page.tsx`
  - `frontend/src/features/products/components/ProductForm.tsx`
  - `frontend/src/features/products/components/__tests__/ProductForm.test.tsx`
- **Descrição Técnica:**
  - Formulário para registrar itens com saldo inicial ZERO obrigatório.
  - Campos: Nome, Descrição, Unidade de Medida (UOM em maiúsculas), Estoque Mínimo (`min_stock`), Categorias N:N.
  - Proibir explicitamente qualquer campo de saldo físico inicial no formulário.
  - Banner informativo explicando que saldos nascem no Livro-Razão.
- **Critérios de Aceitação:**
  - [ ] Envia `POST /api/products` com `X-Tenant-ID` e `X-Idempotency-Key`.
  - [ ] Valida que `min_stock` seja numérico $\ge 0$.
  - [ ] Redireciona para `/products` ou `/products/[id]` após sucesso.
  - [ ] Bloqueia acesso direto de URL para `ALMOXARIFE` e `AUDITOR`.
  - [ ] Cobertura de testes $\ge 85\%$.

---

#### Tarefa FT-14: Ficha do Produto e Histórico do Ledger Individual (`/products/[id]`)
- **Identificador:** `FT-14`
- **Prioridade:** P2
- **Dependências:** `FT-12`, `FT-13`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(workbench)/products/[id]/page.tsx`
  - `frontend/src/features/products/components/ProductDetailHeader.tsx`
  - `frontend/src/features/products/components/ProductLedgerHistory.tsx`
  - `frontend/src/features/products/components/__tests__/ProductLedgerHistory.test.tsx`
- **Descrição Técnica:**
  - Cabeçalho com dados cadastrais e saldo atual destacado em 24px monoespaçado.
  - Aba 1: Formulário de edição de metadados (`PUT /api/products/{id}`). Não permite edição de saldos.
  - Aba 2: Extrato do Livro-Razão específico deste produto (`GET /api/inventory/products/{id}/ledger`).
  - Linhas do extrato com data formatada, tipo, delta com sinal `+`/`-`, saldo resultante e motivo.
- **Critérios de Aceitação:**
  - [ ] Edição cadastral não envia nem altera saldos de estoque.
  - [ ] Extrato exibe histórico completo sem opções de alteração ou deleção.
  - [ ] Para operadores e auditores, formulário de edição fica em modo somente-leitura.

---

### FASE 5: Livro-Razão e Bancada de Movimentação Física

---

#### Tarefa FT-15: Bancada de Movimentação Física: Entrada (`IN`) e Saída (`OUT`)
- **Identificador:** `FT-15`
- **Prioridade:** P0 (Missão Crítica)
- **Dependências:** `FT-01`, `FT-12`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(workbench)/inventory/move/page.tsx`
  - `frontend/src/features/inventory/services/inventory.api.ts`
  - `frontend/src/features/inventory/components/MovementForm.tsx`
  - `frontend/src/features/inventory/components/__tests__/MovementForm.test.tsx`
- **Descrição Técnica:**
  - Interface de bancada de alta velocidade para operadores de galpão.
  - Campo de busca de produto com suporte a leitor de código de barras USB (foco automático).
  - Abas de modo:
    - **Aba `IN`:** Campo quantidade ($> 0$), motivo/NF. Envia `POST /api/inventory/in`.
    - **Aba `OUT`:** Campo quantidade ($> 0$), motivo/OS obrigatório. Envia `POST /api/inventory/out`.
  - Geração de UUIDv4 exclusivo em `X-Idempotency-Key` antes de submeter.
  - Detecção de resposta `X-Cache: HIT` e exibição de alerta de replay seguro.
- **Critérios de Aceitação:**
  - [ ] Bloqueia duplo clique desabilitando o botão durante a transação.
  - [ ] Ao confirmar com sucesso, reseta o formulário e foca novamente no campo de busca de código de barras.
  - [ ] Trata erro `422 Unprocessable Entity` (`insufficient-stock`) exibindo aviso sonoro/visual de estoque insuficiente.
  - [ ] Cobertura de testes $\ge 90\%$.

---

#### Tarefa FT-16: Bancada de Movimentação Física: Ajuste de Inventário (`ADJUSTMENT`)
- **Identificador:** `FT-16`
- **Prioridade:** P0 (Missão Crítica)
- **Dependências:** `FT-15`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/features/inventory/components/AdjustmentTab.tsx`
  - `frontend/src/features/inventory/components/__tests__/AdjustmentTab.test.tsx`
- **Descrição Técnica:**
  - Aba de conferência cíclica de inventário físico.
  - Aceita o campo "Nova Quantidade Contada no Galpão" ($\ge 0$).
  - Calcula visualmente o $\Delta$ resultante: $\Delta = Q_{\text{contada}} - Q_{\text{atual}}$.
  - Campo de justificativa mandatória (mínimo 5 caracteres).
  - Envia `POST /api/inventory/adjustment` com `X-Idempotency-Key`.
- **Critérios de Aceitação:**
  - [ ] Habilitado para todos os papéis (`OWNER`, `GESTOR`, `ALMOXARIFE`, `AUDITOR`).
  - [ ] Botão de confirmação exibe o delta calculado: *"Registrar Ajuste ($\Delta = -2{,}5\text{ KG}$)"*.
  - [ ] Impede envio sem justificativa preenchida.
  - [ ] Cobertura de testes $\ge 90\%$.

---

#### Tarefa FT-17: Extrato Geral do Livro-Razão Imutável (`/inventory/movements`)
- **Identificador:** `FT-17`
- **Prioridade:** P1
- **Dependências:** `FT-15`, `FT-16`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(workbench)/inventory/movements/page.tsx`
  - `frontend/src/features/inventory/components/LedgerTable.tsx`
  - `frontend/src/features/inventory/components/LedgerFilters.tsx`
  - `frontend/src/features/inventory/components/__tests__/LedgerTable.test.tsx`
- **Descrição Técnica:**
  - Tabela com o extrato perpétuo append-only de todas as movimentações do tenant.
  - Filtros: produto, tipo (`IN`, `OUT`, `ADJUSTMENT`, `PRODUCT_DELETED`), período (data inicial e final).
  - Colunas: Data/Hora, Produto, Tipo de Evento (Badge semântico), Delta Físico com sinal, Saldo Resultante, Justificativa, Chave de Idempotência.
  - Botão de exportação para arquivo CSV estruturado.
- **Critérios de Aceitação:**
  - [ ] Zero controles de edição ou deleção (tabela estritamente somente-leitura).
  - [ ] Deltas alinhados à direita com cores padronizadas (verde para entrada, neutro para saída, anil para ajuste).
  - [ ] Cobertura de testes $\ge 85\%$.

---

#### Tarefa FT-18: Simulador de Saldo em Tempo Real e Prevenção de Saldo Negativo
- **Identificador:** `FT-18`
- **Prioridade:** P0 (Missão Crítica)
- **Dependências:** `FT-15`, `FT-16`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/features/inventory/components/BalancePreview.tsx`
  - `frontend/src/features/inventory/hooks/useStockSimulation.ts`
  - `frontend/src/features/inventory/components/__tests__/BalancePreview.test.tsx`
- **Descrição Técnica:**
  - Componente de cálculo em tempo real acoplado ao formulário de movimentação.
  - Converte valores para inteiros escalados via `scale.ts` e computa o saldo simulado.
  - Se a operação for `OUT` e $\text{Saldo Projetado} < 0$:
    - Borda do painel transiciona para vermelho de advertência (`border-rose-400 bg-rose-50`).
    - Exibe mensagem: *"Operação bloqueada: A quantidade solicitada excede o saldo físico disponível."*
    - Desabilita o botão de submissão do formulário no cliente.
- **Critérios de Aceitação:**
  - [ ] Previne a emissão de requisições de saída com saldo insuficiente antes de tocar a rede.
  - [ ] Não sofre desvios de arredondamento IEEE 754.
  - [ ] Cobertura de testes $\ge 95\%$.

---

### FASE 6: Gestão de Membros e Governança RBAC

---

#### Tarefa FT-19: Gestão de Equipe do Almoxarifado e Concessão de Papéis
- **Identificador:** `FT-19`
- **Prioridade:** P2
- **Dependências:** `FT-04`, `FT-08`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/app/(workbench)/settings/members/page.tsx`
  - `frontend/src/features/settings/services/members.api.ts`
  - `frontend/src/features/settings/components/MemberListTable.tsx`
  - `frontend/src/features/settings/components/InviteMemberModal.tsx`
  - `frontend/src/features/settings/components/__tests__/MemberListTable.test.tsx`
- **Descrição Técnica:**
  - Listar membros vinculados ao tenant via `GET /api/tenants/{tenant_id}/members`.
  - Modal para adicionar membro por e-mail com seleção de papel inicial (`POST /api/tenants/{tenant_id}/members`).
  - Dropdown para alteração de papel (`PUT /api/tenants/{tenant_id}/members/{user_id}`).
  - Botão de remoção de membro (`DELETE /api/tenants/{tenant_id}/members/{user_id}`).
- **Critérios de Aceitação:**
  - [ ] Acessível para `OWNER` e `GESTOR`.
  - [ ] Alteração de papel e remoção de membros habilitadas exclusivamente para `OWNER`.
  - [ ] Cobertura de testes $\ge 85\%$.

---

#### Tarefa FT-20: Proteção de Titular Único (*Sole Owner Protection*) na UI
- **Identificador:** `FT-20`
- **Prioridade:** P1
- **Dependências:** `FT-19`
- **Arquivos a Criar/Alterar:**
  - `frontend/src/features/settings/components/MemberListTable.tsx`
  - `frontend/src/features/settings/components/__tests__/SoleOwnerProtection.test.tsx`
- **Descrição Técnica:**
  - Implementar verificação de contagem de proprietários ativos no tenant.
  - Se houver apenas 1 membro com `role === "OWNER"`:
    - O dropdown de papel desse membro é travado (`disabled`).
    - O botão de remover vínculo desse membro é travado (`disabled`).
    - Tooltip informativo: *"Este é o único Proprietário (OWNER) do almoxarifado. Promova outro membro a OWNER antes de alterar este vínculo."*
  - Capturar erro `422` com `sole-owner-removal` se for disparado do backend.
- **Critérios de Aceitação:**
  - [ ] Impede que o único OWNER remova a si mesmo ou rebaixe seu próprio papel na UI.
  - [ ] Cobertura de testes unitários $\ge 90\%$.

---

### FASE 7: Resiliência de Rede, Testes Automatizados e Homologação E2E

---

#### Tarefa FT-21: Suíte de Testes de Idempotência, Replay e Detecção de Conflito
- **Identificador:** `FT-21`
- **Prioridade:** P1
- **Dependências:** Todas as tarefas das Fases 1 a 6
- **Arquivos a Criar/Alterar:**
  - `frontend/tests/integration/idempotency.test.tsx`
  - `frontend/tests/mocks/handlers.ts`
- **Descrição Técnica:**
  - Implementar suíte de testes de integração com MSW simulando:
    1. Envio de mutação com cabeçalho `X-Idempotency-Key` e verificação do payload interceptado.
    2. Simulação de resposta com `X-Cache: HIT` e validação do feedback de replay seguro na tela.
    3. Simulação de resposta `409 Conflict` (`idempotency-conflict`) e validação da mensagem de erro RFC 7807 apresentada ao operador.
- **Critérios de Aceitação:**
  - [ ] Testes passam de forma determinística sem flakiness.
  - [ ] Cobertura de cenários de idempotência $\ge 90\%$.

---

#### Tarefa FT-22: Suíte de Testes da Matriz RBAC e Bloqueios Visuais
- **Identificador:** `FT-22`
- **Prioridade:** P1
- **Dependências:** Todas as tarefas das Fases 1 a 6
- **Arquivos a Criar/Alterar:**
  - `frontend/tests/integration/rbac.test.tsx`
- **Descrição Técnica:**
  - Testar a renderização dos componentes simulando os 4 papéis:
    - Como `OWNER`: Verifica todos os botões e abas habilitados.
    - Como `GESTOR`: Verifica que criação de produtos funciona, mas alteração de dados do tenant e de membros está restrita.
    - Como `ALMOXARIFE`: Verifica que abas `IN` e `OUT` funcionam, mas botões de edição de produto e categorias estão ocultos.
    - Como `AUDITOR`: Verifica que abas `IN` e `OUT` estão desabilitadas e aba `ADJUSTMENT` está habilitada.
- **Critérios de Aceitação:**
  - [ ] Validação automatizada de 100% dos nós da matriz RBAC.
  - [ ] Cobertura de testes $\ge 90\%$.

---

#### Tarefa FT-23: Testes End-to-End (E2E) dos Fluxos Operacionais Críticos (Playwright)
- **Identificador:** `FT-23`
- **Prioridade:** P1
- **Dependências:** Todas as tarefas anteriores
- **Arquivos a Criar/Alterar:**
  - `frontend/tests/e2e/auth-tenancy-flow.spec.ts`
  - `frontend/tests/e2e/product-catalog-flow.spec.ts`
  - `frontend/tests/e2e/inventory-ledger-flow.spec.ts`
  - `frontend/playwright.config.ts`
- **Descrição Técnica:**
  - Implementar testes E2E executando contra o ambiente completo (FastAPI + PostgreSQL):
    1. **Fluxo 1 (Auth & Tenancy):** Registro de usuário $\rightarrow$ Criação de Almoxarifado $\rightarrow$ Acesso ao Dashboard.
    2. **Fluxo 2 (Catálogo):** Criação de Categoria $\rightarrow$ Criação de Produto (saldo zero) $\rightarrow$ Verificação no catálogo.
    3. **Fluxo 3 (Livro-Razão):** Entrada de 10 unidades $\rightarrow$ Saída de 3 unidades $\rightarrow$ Tentativa bloqueada de saída de 8 unidades $\rightarrow$ Ajuste para 12 unidades $\rightarrow$ Auditoria no Extrato.
- **Critérios de Aceitação:**
  - [ ] 100% dos testes E2E passando com sucesso em pipeline CI/CD.
  - [ ] Zero desvios contábeis entre os saldos exibidos na interface e os registros no PostgreSQL.

---

## 4. Matriz de Rastreabilidade (PRD $\leftrightarrow$ BACKEND_SPEC $\leftrightarrow$ FRONTEND_SPEC $\leftrightarrow$ FRONTEND_TASKS)

| Requisito do PRD | Seção do BACKEND_SPEC | Seção do FRONTEND_SPEC | Tarefa de Implementação |
| :--- | :--- | :--- | :--- |
| **RN-01: Multi-Tenancy Estrito** | Seção 1.1 e 3.1 | Seção 1.1 e 6.3 | `FT-02`, `FT-04`, `FT-07` |
| **RN-02: RBAC N:N Usuário-Tenant** | Seção 6.3 | Seção 4 e 6.11 | `FT-04`, `FT-19`, `FT-20`, `FT-22` |
| **RN-03: Criação Autônoma de Tenant**| Seção 8.2 (Item 1) | Seção 6.3 | `FT-07` |
| **RN-04: Autenticação JWT e X-Tenant-ID** | Seção 6.2 e 8.1 | Seção 2 e 6.1 | `FT-02`, `FT-05`, `FT-06` |
| **RN-05: Categorização N:N** | Seção 8.4 | Seção 6.10 | `FT-11` |
| **RN-07: Escala Inteira Fixa ($10^3$)** | Seção 1.1 (Item 7) | Seção 3 | `FT-01`, `FT-15`, `FT-18` |
| **RN-08: Alerta de Estoque Mínimo** | Seção 8.3 (Item 2) | Seção 6.4 e 6.5 | `FT-09`, `FT-10`, `FT-12` |
| **RN-09: Livro-Razão Imutável** | Seção 5.2 e 8.5 | Seção 6.7 e 6.9 | `FT-14`, `FT-17` |
| **RN-10: Soft-Delete Seguro** | Seção 8.3 (Item 3) | Seção 6.5 | `FT-12` |
| **RN-11: Idempotência Mandatória** | Seção 7 | Seção 2.1 e 7 | `FT-02`, `FT-15`, `FT-21` |
| **RN-12: Trava de Saldo Negativo** | Seção 5.1 e 8.5 | Seção 6.8 | `FT-15`, `FT-18` |
