# Especificação Técnica do Sistema de Gestão de Estoque

## 1. Visão Geral da Arquitetura

O sistema é concebido como um **Monólito Modular** de alta confiabilidade, projetado para empresas que exigem rastreabilidade física rigorosa, auditoria contínua e consistência transacional absoluta:

- **Backend:** Python 3.12 + FastAPI estruturado em **Clean Architecture Modular** (Domain, Application, Infrastructure, Interfaces).
- **Frontend:** Next.js (App Router, React, TypeScript, Tailwind CSS) estruturado em **Feature-Based Architecture**.
- **Banco de Dados Principal:** **PostgreSQL 16** executado via **Docker / Docker Compose**, com suporte nativo a transações ACID estritas e bloqueios de concorrência (`SELECT ... FOR UPDATE`).
- **Idempotência:** Decidida, controlada e validada 100% pelo **Backend** via impressão digital semântica (SHA-256) e RFC 9474.

---

## 2. Infraestrutura e Banco de Dados (Docker + PostgreSQL)

### 2.1. Containerização com Docker Compose
O banco de dados PostgreSQL roda isolado em um container Docker dedicado, garantindo paridade total entre ambientes de desenvolvimento e produção:

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    container_name: estoque_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-estoque_db}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-estoque_db}"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### 2.2. Drivers e Conexão no Backend
- Driver recomendado: `psycopg` (v3) ou `psycopg2-binary`.
- String de conexão: `postgresql+psycopg2://postgres:postgres@localhost:5432/estoque_db`.
- O backend inclui suporte transparente a fallback local (SQLite WAL) caso o container Docker esteja temporariamente parado em desenvolvimento ou para execução ultrarrápida de testes unitários isolados.

---

## 3. O Padrão Ledger (Livro-Razão Imutável) e Auditoria Perpétua

### 3.1. Por que o modelo tradicional de UPDATE falha?
Em sistemas de estoque tradicionais e simplistas, as aplicações executam comandos destrutivos como:
```sql
-- Abordagem frágil que perde rastreabilidade:
UPDATE products SET quantity = quantity - 10 WHERE id = '...';
```
Esse modelo destrutivo apresenta falhas graves:
1. **Perda de Rastreabilidade:** Se o saldo estiver errado, é impossível saber quem alterou, quando alterou ou por qual motivo.
2. **Vulnerabilidade a Concorrência:** Duas requisições simultâneas podem ler o mesmo saldo e aplicar updates que deixam o estoque inconsistente ou negativo.
3. **Impossibilidade de Reconstrução:** Não é possível responder a perguntas como *"Qual era o estoque físico exato deste item no dia 15 do mês passado?"*.

### 3.2. A Regra de Ouro do Ledger: Append-Only e Imutabilidade Estrita
No nosso sistema, a tabela `stock_movements` é um **Livro-Razão Contábil Imutável**:
- **`NO HARD DELETE`:** Nenhuma linha de movimentação pode ser deletada do banco de dados em hipótese alguma.
- **`NO UPDATE`:** Nenhuma linha de movimentação pode sofrer alteração após ser gravada.
- **`APPEND-ONLY`:** Toda e qualquer alteração no estoque físico é materializada como um novo evento cronológico registrado no final do Ledger.

### 3.3. Anatomia de uma Movimentação no Ledger
Cada entrada no Ledger contém metadados completos de auditoria:
```sql
CREATE TABLE stock_movements (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL REFERENCES products(id),
    type VARCHAR(32) NOT NULL,            -- IN, OUT, ADJUSTMENT, PRODUCT_DELETED
    quantity BIGINT NOT NULL,             -- Delta físico (+ ou -) em escala x1000
    balance_after BIGINT NOT NULL,        -- Saldo exato resultante após o movimento
    reason TEXT,                          -- Motivo explícito (NF, avaria, contagem física)
    idempotency_key VARCHAR(255),         -- Chave da requisição que gerou o movimento
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 3.4. Tipos de Eventos do Ledger
1. **`IN` (Entrada de Estoque):**
   - Incrementa a quantidade física disponível (ex: recebimento de fornecedor, devolução).
   - Delta positivo ($+q$). `balance_after = current_balance + q`.
2. **`OUT` (Saída de Estoque):**
   - Decrementa a quantidade física (ex: expedição, consumo interno, perda).
   - Delta negativo ($-q$). O sistema impede estritamente que `balance_after < 0`.
3. **`ADJUSTMENT` (Ajuste de Inventário Físico):**
   - Utilizado em contagens periódicas de estoque onde o operador encontrou uma quantidade física diferente do sistema.
   - O operador informa a nova quantidade total contada ($Q_{\text{novo}}$).
   - O Ledger calcula o delta real ($\Delta = Q_{\text{novo}} - Q_{\text{atual}}$) e grava o ajuste com o motivo registrado.
4. **`PRODUCT_DELETED` (Remoção / Descontinuação de Produto):**
   - Registrado quando um produto é retirado do catálogo ativo.

### 3.5. O Ciclo de Exclusão de Produto (Soft-Delete com Histórico Perpétuo)
Quando um operador clica em "Excluir Produto", o sistema **NÃO apaga o produto do banco**:
1. **Desativação no Catálogo:**
   - O registro na tabela `products` recebe `is_active = FALSE` e `deleted_at = NOW()`.
   - O produto desaparece das telas de operação diária e de novas movimentações.
2. **Registro de Auditoria no Ledger:**
   - É gravado um evento imutável no Ledger com:
     - `type: "PRODUCT_DELETED"`
     - `quantity: 0`
     - `balance_after: [saldo restante do produto no momento do descarte]`
     - `reason: "[Motivo informado pelo operador, ex: Produto descontinuado pela fábrica]"`
3. **Auditoria Retrospectiva Completa:**
   - Em qualquer data futura, relatórios contábeis e fiscais continuam conseguindo auditar todas as entradas, saídas e a exata data/hora em que o item foi descontinuado. **A integridade referencial jamais é violada**.

---

## 4. Precisão de Quantidade (Inteiro Escalado - Fixed-Point)

### 4.1. Eliminação do Ponto Flutuante (`float`)
Para evitar erros de arredondamento em quantidades fracionárias (ex: 2,5 kg de insumo, 0,125 litros de solvente):
- O sistema adota a convenção contábil de **Inteiro com Escala Fixa ($10^3 = 1.000$)**.
- O banco de dados armazena sempre valores inteiros (`BIGINT`):
  $$\text{Valor Armazenado} = \text{round}(\text{Quantidade Real} \times 1.000)$$

| Quantidade Real | Armazenado no PostgreSQL (`BIGINT`) | Exibição na Interface |
| :--- | :--- | :--- |
| `1` unidade | `1000` | `1 UN` |
| `2,500` kg | `2500` | `2,5 KG` |
| `0,125` litros | `125` | `0,125 L` |
| `15,000` caixas | `15000` | `15 CX` |

---

## 5. Idempotência Decidida e Garantida pelo Backend

### 5.1. Princípio de Segurança
O Frontend não decide se uma requisição é duplicada ou válida. O **Backend é a autoridade central**:

1. **Hash Semântico da Intenção (Fingerprint):**
   $$\text{hash} = \text{SHA256}(\text{endpoint} + \text{produto\_id} + \text{tipo\_movimento} + \text{quantidade\_escalada} + \text{motivo})$$
2. **Tratamento de Chaves (`X-Idempotency-Key`):**
   - **Chave Reenviada com Mesmo Hash:** O backend reconhece como retransmissão de rede ou duplo clique e retorna imediatamente a resposta gravada (`201 Created` com header `X-Cache: HIT`). O estoque **não** se altera.
   - **Chave Reenviada com Hash Diferente:** O backend detecta tentativa de violação e rejeita com `409 Conflict`.
   - **Sem Chave Enviada:** O backend executa verificação semântica em janela temporal recente (10 segundos) para impedir envios repetidos acidentais.
3. **Bloqueio Concorrente no PostgreSQL (`SELECT FOR UPDATE`):**
   - Durante o processamento de uma movimentação, a linha do produto no PostgreSQL é travada com `with_for_update()`.
   - Requisições concorrentes para o mesmo item aguardam a liberação da transação, impossibilitando condições de corrida (*race conditions*).

---

## 6. Categorias e Relacionamento N:N (Muitos-para-Muitos)

- Um produto pode pertencer a múltiplas categorias (ex: *Químicos*, *Inflamáveis*, *Matéria-Prima*).
- Uma categoria agrupa múltiplos produtos.
- Mapeado no PostgreSQL via tabela associativa `product_categories (product_id, category_id)`.
- Suporte a filtros múltiplos combinados no Frontend.

---

## 7. Unidades de Medida (UOM) e Alertas de Estoque Mínimo

1. **Unidade de Medida (`unit`):** Campo descritivo curto em letras maiúsculas (ex: `UN`, `KG`, `L`, `M`, `CX`, `G`).
2. **Alerta de Estoque Baixo (`min_stock`):**
   - Campo opcional configurável por produto.
   - Quando `current_quantity <= min_stock`, o sistema marca a flag calculada `is_low_stock = TRUE`, disparando alertas visuais nos cards e tabelas.

---

## 8. Arquitetura das Pastas

```text
extensao/
├── docker-compose.yml               # PostgreSQL 16 Alpine
├── SPEC.md                          # Este documento de especificação
├── backend/
│   ├── app/
│   │   ├── core/                    # Configurações (PostgreSQL URL, Scale factor, CORS)
│   │   ├── shared/
│   │   │   ├── infrastructure/      # SQLAlchemy Engine, Session, Base
│   │   │   └── utils/               # Conversor de escala x1000
│   │   └── modules/
│   │       ├── idempotency/         # Hash semântico, tabela e guard de concorrência
│   │       ├── products/            # Modelos Product, Category, N:N, UseCases, Routers
│   │       └── inventory/           # Livro-Razão (Ledger), Locks transacionais, UseCases
│   ├── tests/                       # Testes automatizados com isolamento completo
│   └── requirements.txt
├── frontend/                        # Next.js com Feature-Based Architecture
│   ├── src/
│   │   ├── features/products/       # Catálogo, Cadastro, Modais e Hooks
│   │   ├── features/categories/     # Gestão de Categorias e Badges
│   │   ├── features/inventory/      # Extrato do Ledger, Modais de Entrada/Saída/Ajuste
│   │   ├── shared/lib/              # Cliente HTTP com injeção de Idempotency-Key
│   │   └── app/                     # Rotas e páginas (Dashboard, Produtos, Categorias, Extrato)
│   └── package.json
└── README.md
```
