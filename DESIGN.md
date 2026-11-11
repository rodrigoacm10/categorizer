# Diretrizes do Design System: Impeccable Warehouse UI (Workbench Style)

## 1. Filosofia e Princípios de Design

O Design System deste projeto segue o princípio **"Operate Mode"**: ferramentas operacionais de alta densidade e precisão industrial. A interface é concebida para transmitir solidez, velocidade e clareza absoluta, priorizando a usabilidade de conferentes e inventariantes em terminais de galpão.

### 1.1. Anti-Padrão "Cara de IA" Eliminado (Zero AI-Slop)
Muitos sistemas gerados por IA cometem o erro de empilhar dezenas de "cards flutuantes" com cantos excessivamente arredondados (`rounded-2xl`/`rounded-3xl`), sombras pesadas e espaços em branco inflados de marketing. **Este projeto rejeita categoricamente esse visual.**
- **Sem Cards Arredondados Flutuantes:** A interface adota o estilo **Workbench / Linear / Bloomberg**, baseado em **Painéis Contínuos e Divisores Retos de 1px** (`border-zinc-200`, `divide-zinc-200`).
- **Raio de Borda Contido:** Máximo de 4px (`rounded`) em botões e inputs; contêineres e tabelas usam bordas retas industriais (`rounded` sutil ou `rounded-none` em divisórias de grade).
- **Sem Sombras Difusas:** Superfícies planas com bordas de 1px contrastantes.
- **KPIs em Strip Contínua:** Em vez de cards soltos de métricas, as métricas ficam em uma faixa horizontal única dividida por bordas verticais de 1px.

### 1.2. Pilares Impeccable
1. **Contraste Rígido (WCAG AAA/AA):** Texto principal sempre em `#09090b` (Zinc 950) ou `#18181b` (Zinc 900) sobre fundo branco ou neutro claro. Proibido texto cinza claro de baixo contraste em informações essenciais.
2. **Tipografia Tabular para Dados Numéricos:** Uso mandatório de fontes monoespaçadas com números tabulares (`tabular-nums font-mono`) para colunas de quantidades, saldos, deltas do ledger, códigos de barras (EAN/SKU) e timestamps.
3. **Densidade Otimizada (High Information Density):** Alturas de linha enxutas, paddings calculados para minimizar rolagem desnecessária e permitir a visualização de dezenas de itens por tela sem poluição visual.
4. **Ergonomia e Foco Acessível:** Focus rings visíveis e de alto contraste em todas as ações via teclado (`focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1`).

---

## 2. Paleta de Cores e Tokens Semânticos

A paleta é fundamentada na escala de neutros frios (Zinc), combinada com uma cor de ação industrial (Aço/Marinho) e cores semânticas funcionais de alto contraste.

### 2.1. Neutros Estruturais (Zinc)
- `bg-background`: `#ffffff` (Canvas principal de trabalho)
- `bg-surface-subtle`: `#f4f4f5` (Zinc 100 - cabeçalhos de tabela, inputs inativos, barras de ferramenta)
- `bg-surface-elevated`: `#ffffff` com `border border-zinc-200`
- `text-foreground`: `#09090b` (Zinc 950 - texto padrão de leitura primária)
- `text-muted`: `#52525b` (Zinc 600 - rótulos secundários, unidades de medida e dicas)
- `border-default`: `#e4e4e7` (Zinc 200 - separadores e bordas estruturais de 1px)
- `border-strong`: `#a1a1aa` (Zinc 400 - bordas de inputs em foco ou tabelas ativas)

### 2.2. Ação e Marca (Steel Industrial / Dark Navy)
- `primary-900`: `#0f172a` (Slate 900 - Botão principal sólido, cabeçalhos de destaque)
- `primary-800`: `#1e293b` (Hover do botão principal)
- `primary-700`: `#334155`
- `accent-action`: `#2563eb` (Blue 600 - links, seleções ativas e badges informativos)

### 2.3. Cores de Estado e Estoque (Semântica Funcional)
| Estado do Estoque | Token | Fundo (`bg`) | Borda (`border`) | Texto (`text`) | Significado Operacional |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Em Estoque** | `stock-ok` | `#f0fdf4` (Emerald 50) | `#bbf7d0` (Emerald 200) | `#15803d` (Emerald 700) | Saldo saudável acima do mínimo |
| **Estoque Baixo** | `stock-low` | `#fffbeb` (Amber 50) | `#fde68a` (Amber 200) | `#b45309` (Amber 700) | Saldo $\le$ `min_stock` (Alerta de reposição) |
| **Zerado / Crítico** | `stock-empty` | `#fef2f2` (Rose 50) | `#fecdd3` (Rose 200) | `#b91c1c` (Rose 700) | Saldo zero ou negativo |
| **Descontinuado** | `stock-inactive` | `#f4f4f5` (Zinc 100) | `#e4e4e7` (Zinc 200) | `#71717a` (Zinc 500) | Item inativo / soft-deleted |

### 2.4. Semântica do Ledger (Livro-Razão)
- **`IN` (Entrada):** Texto `#15803d` (Emerald 700) com prefixo explícito `+` e badge sutil esmeralda.
- **`OUT` (Saída):** Texto `#18181b` (Zinc 950) com prefixo explícito `-` e badge sutil neutro.
- **`ADJUSTMENT` (Ajuste):** Texto `#4338ca` (Indigo 700) com símbolo `Δ` e badge sutil índigo.
- **`PRODUCT_DELETED`:** Texto `#71717a` (Zinc 500) com badge sutil cinza.

---

## 3. Tipografia e Escala de Texto

| Estilo | Tamanho | Peso | Line-Height | Uso Recomendado |
| :--- | :--- | :--- | :--- | :--- |
| **Workbench Title** | 14px / 16px | Semibold (600) | 20px | Cabeçalho unificado do topo / toolbar |
| **Section Title** | 12px | Semibold (600) | 16px | Título de seções em caixa alta (`uppercase tracking-wider`) |
| **Body** | 13px / 14px | Regular (400) | 18px | Texto padrão de leitura e formulários |
| **Body Semibold** | 13px / 14px | Medium (500) / Semibold (600) | 18px | Rótulos de campo, botões, cabeçalhos de tabela |
| **Micro / Dense** | 11px / 12px | Regular / Medium | 14px | Metadados, tags secundárias, rodapés de bancada |
| **Numbers / Data** | 13px / 14px (`font-mono`) | Medium / Bold | `tabular-nums` | Quantidades, saldos, preços, SKUs, datas, códigos de barras |

---

## 4. Estrutura de Workbench (Substituição de Cards por Painéis)

1. **Top Bar Contínuo:** Cabeçalho de altura 48px fixo no topo com navegação, status da conexão, tenant e ações rápidas.
2. **KPI Strip Linear:** Faixa horizontal com divisão por bordas verticais de 1px (`divide-x divide-zinc-200`) e fundo sutil `bg-zinc-50/60`. Elimina cards individuais soltos.
3. **Toolbar de Comando:** Barra de ferramentas com abas de navegação direta, busca com atalho de teclado (`Ctrl+K`) e campo dedicado para leitor de código de barras.
4. **Grid de Dados em Largura Total:** Tabelas com cabeçalho sticky, linhas com hover discreto e alinhamento à direita obrigatório para números.
