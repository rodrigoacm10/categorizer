# Diretrizes do Design System: Impeccable Warehouse UI

## 1. Filosofia e Princípios de Design

O Design System deste projeto segue o princípio **"Operate Mode"**: ferramentas operacionais de alta densidade e precisão industrial. A interface é concebida para transmitir solidez, velocidade e clareza absoluta, priorizando a usabilidade de conferentes e inventariantes em terminais de galpão.

### 1.1. Pilares Impeccable
1. **Contraste Rígido (WCAG AAA/AA):** Texto principal sempre em `#09090b` (Zinc 950) ou `#18181b` (Zinc 900) sobre fundo branco ou neutro claro. Proibido texto cinza claro de baixo contraste em informações essenciais.
2. **Tipografia Tabular para Dados Numéricos:** Uso mandatório de fontes monoespaçadas com números tabulares (`tabular-nums font-mono`) para colunas de quantidades, saldos, deltas do ledger, códigos de barras (EAN/SKU) e timestamps.
3. **Densidade Otimizada (High Information Density):** Alturas de linha enxutas, paddings calculados para minimizar rolagem desnecessária e permitir a visualização de dezenas de itens por tela sem poluição visual.
4. **Anatomia Limpa (Zero Slop):** Bordas sólidas e finas (1px `#e4e4e7`), cantos arredondados contidos (4px a 8px, nunca pills gigantes em containers estruturais), sombras sutis e naturais (`shadow-sm`). Sem gradientes decorativos ou efeitos cosméticos desnecessários.
5. **Ergonomia e Foco Acessível:** Focus rings visíveis e de alto contraste em todas as ações via teclado (`focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1`).

---

## 2. Paleta de Cores e Tokens Semânticos

A paleta é fundamentada na escala de neutros frios (Zinc), combinada com uma cor de ação industrial (Aço/Marinho) e cores semânticas funcionais de alto contraste.

### 2.1. Neutros Estruturais (Zinc)
- `bg-background`: `#ffffff` (Canvas principal de trabalho)
- `bg-surface-subtle`: `#f4f4f5` (Zinc 100 - cabeçalhos de tabela, inputs inativos, barras de ferramenta)
- `bg-surface-elevated`: `#ffffff` com `border border-zinc-200 shadow-sm`
- `text-foreground`: `#09090b` (Zinc 950 - texto padrão de leitura primária)
- `text-muted`: `#52525b` (Zinc 600 - rótulos secundários, unidades de medida e dicas)
- `border-default`: `#e4e4e7` (Zinc 200 - separadores e bordas estruturais)
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
- **`OUT` (Saída):** Texto `#18181b` (Zinc 900) com prefixo explícito `-` e badge sutil neutro.
- **`ADJUSTMENT` (Ajuste):** Texto `#4338ca` (Indigo 700) com símbolo `Δ` e badge sutil índigo.
- **`PRODUCT_DELETED`:** Texto `#71717a` (Zinc 500) com badge sutil cinza.

---

## 3. Tipografia e Escala de Texto

A tipografia utiliza a fonte do sistema ou Inter para a interface geral, e monoespaçada com `tabular-nums` para dados tabulares.

| Estilo | Tamanho | Peso | Line-Height | Uso Recomendado |
| :--- | :--- | :--- | :--- | :--- |
| **Title 1** | 20px (`text-xl`) | Semibold (600) | 28px | Título principal da página / módulo |
| **Title 2** | 16px (`text-base`) | Semibold (600) | 24px | Cabeçalho de seções e modais |
| **Body** | 14px (`text-sm`) | Regular (400) | 20px | Texto padrão de leitura e formulários |
| **Body Semibold** | 14px (`text-sm`) | Medium (500) / Semibold (600) | 20px | Rótulos de campo, botões, cabeçalhos de tabela |
| **Micro / Dense** | 12px (`text-xs`) | Regular / Medium | 16px | Metadados, tags secundárias, rodapés |
| **Numbers / Data** | 13px / 14px (`font-mono`) | Medium (500) | `tabular-nums` | Quantidades, saldos, preços, SKUs, datas |

---

## 4. Sistema Espacial e Densidade (Spacing Grid)

Baseado em módulo de 4px:
- `space-1` (4px): espaçamento entre ícone e texto em badges e botões compactos.
- `space-2` (8px): espaçamento entre campos de filtro e botões na mesma barra.
- `space-3` (12px): padding interno de células de tabela densa e inputs.
- `space-4` (16px): gap entre cards e seções do layout.
- `space-6` (24px): padding de containers de conteúdo e cabeçalhos principais.

### Densidade de Tabelas:
- **Linhas de Tabela:** Altura padrão de 38px a 44px (`py-2` ou `py-2.5`).
- **Alinhamento:**
  - Texto / Códigos / Categorias: alinhados à esquerda (`text-left`).
  - Quantidades / Saldos / Valores / Ações: estritamente alinhados à direita (`text-right`).

---

## 5. Especificações dos Componentes Base

### 5.1. Button (`src/shared/components/Button.tsx`)
- **Variantes:**
  - `solid` (padrão): fundo `#0f172a`, texto branco, hover `#1e293b`.
  - `outline`: fundo transparente, borda 1px `#e4e4e7`, texto `#09090b`, hover `#f4f4f5`.
  - `ghost`: fundo transparente, sem borda, texto `#09090b`, hover `#f4f4f5`.
  - `danger`: fundo `#dc2626`, texto branco, hover `#b91c1c`.
  - `secondary`: fundo `#f4f4f5`, texto `#09090b`, hover `#e4e4e7`.
- **Tamanhos:**
  - `xs`: altura 28px (`px-2.5 py-1 text-xs`) - ideal para ações em linhas de tabela.
  - `sm`: altura 32px (`px-3 py-1.5 text-xs font-medium`).
  - `md`: altura 36px (`px-4 py-2 text-sm font-medium`) - padrão do sistema.
  - `lg`: altura 42px (`px-5 py-2.5 text-base font-medium`).
- **Estados:** `hover`, `active`, `disabled` (`opacity-50 cursor-not-allowed`), `loading` (spinner giratório preservando largura), `focus-visible`.

### 5.2. Input e SearchInput (`src/shared/components/Input.tsx`, `SearchInput.tsx`)
- Borda definida de 1px `#e4e4e7`, transição para `focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950`.
- Fundo branco contrastante com o canvas.
- Suporte a prefixos/sufixos integrados (ex: ícone de busca à esquerda, unidade `KG` à direita).
- `SearchInput` com atalho de teclado visual (ex: `Ctrl + K` ou `/`), botão de limpeza imediata (`X` ou tecla `Escape`) e indicador de leitor de código de barras.

### 5.3. Badge (`src/shared/components/Badge.tsx`)
- Pílula compacta de alto contraste com indicador de ponto sólido (`dot`) opcional.
- Variantes para saúde de estoque: `in-stock`, `low-stock`, `out-of-stock`, `inactive`.
- Variantes para eventos do Ledger: `ledger-in`, `ledger-out`, `ledger-adjust`.
- Tipografia em 11px / 12px com peso `medium` para leitura imediata em movimento.

### 5.4. Table (`src/shared/components/Table.tsx`)
- Container com rolagem horizontal segura e cabeçalho `sticky top-0 bg-zinc-50 border-b border-zinc-200 z-10`.
- Linhas com efeito hover sutil (`hover:bg-zinc-50/75`).
- Suporte a linhas zebra opcionais para listagens extensas de contagem de inventário.
- Suporte a células numéricas com classe utilitária de formatação tabular.
- Componente `TableEmpty` integrado para estados sem dados (zero estado operacional claro).

### 5.5. Card (`src/shared/components/Card.tsx`)
- Superfície plana e sólida com borda 1px `#e4e4e7` e raio de 8px (`rounded-lg`).
- Divisão semântica clara: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- Sem sombras pesadas, sem bordas coloridas artificiais.
