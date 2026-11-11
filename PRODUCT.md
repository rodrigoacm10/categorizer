# Contexto de Produto: Sistema de Gestão de Estoque e Almoxarifado Físico Multi-Tenant

## 1. Visão Geral e Propósito

Este sistema é uma plataforma industrial de missão crítica para gestão física de estoque e almoxarifado multi-tenant. Desenvolvido para operar em ambientes reais de armazenagem — como centros de distribuição, almoxarifados industriais, estoques de peças e galpões logísticos —, o produto substitui controles frágeis de planilhas e sistemas legados por uma arquitetura transacional robusta baseada em **Livro-Razão (Ledger Imutável)** e **Idempotência Estrita**.

O software atua no **"Operate Mode"**: uma postura de produto voltada para a execução rápida, repetitiva e precisa de tarefas no chão de fábrica e na bancada de expedição, onde erros custam paradas de linha, divergências fiscais e prejuízos operacionais.

---

## 2. Personas e Cenários Operacionais

### 2.1. Operador de Almoxarifado / Conferente
- **Cenário:** Recebimento de cargas, conferência de notas fiscais, guarda em prateleiras, separação de pedidos (picking) e expedição.
- **Ambiente:** Galpão com iluminação mista (artificial/natural alta ou penumbra), poeira, barulho, luvas de proteção, uso de leitores de código de barras USB/Bluetooth, tablets industriais ou terminais desktop de bancada.
- **Necessidades Vitais:**
  - Telas de altíssimo contraste legíveis a 1 metro de distância.
  - Digitação mínima: foco automático em campos de busca de código de barras.
  - Feedback visual e sonoro imediato em caso de sucesso ou erro.
  - Zero tolerância a duplicação de lançamentos por duplo clique ou instabilidade de Wi-Fi (garantido pela idempotência).

### 2.2. Supervisor de Estoque / Inventariante
- **Cenário:** Auditorias rotineiras, contagens cíclicas de inventário físico, conferência de divergências e ajustes de estoque.
- **Necessidades Vitais:**
  - Histórico cronológico inalterável de cada item (quem alterou, quando e por que motivo).
  - Tabela densa com alinhamento tabular de números para bater rapidamente saldo contábil versus físico.
  - Alertas visuais nítidos para itens abaixo do ponto de reposição (`min_stock`).

### 2.3. Gestor de Compras / Administrador Multi-Tenant
- **Cenário:** Gestão de múltiplos galpões/unidades (tenants) sob um mesmo teto corporativo, cálculo de giro e ordens de compra.
- **Necessidades Vitais:**
  - Isolamento rigoroso entre tenants.
  - Visão clara de catálogo, categorias N:N e relatórios de auditoria perpétua.

---

## 3. Pilares Arquiteturais que Moldam a Interface

### 3.1. O Padrão Ledger (Livro-Razão Contábil Append-Only)
- **Regra de Ouro:** Não existe `UPDATE` nem `HARD DELETE` em saldos de movimentação. Toda ação física gera uma linha perpétua no Ledger (`IN`, `OUT`, `ADJUSTMENT`, `PRODUCT_DELETED`).
- **Impacto no Frontend:**
  - O extrato de movimentações é apresentado no formato clássico de livro contábil (Data/Hora, Tipo, Delta com sinal explícito `+`/`-`, Saldo Resultante, Motivo, Chave de Idempotência).
  - Destaque cromático pontual: Verde esmeralda para entradas (`+`), Grafite escuro para saídas (`-`), Azul anil para ajustes (`Δ`).

### 3.2. Precisão Numérica Escalada (Fixed-Point x1000)
- **Regra de Ouro:** O backend e o banco de dados armazenam quantidades em inteiros escalados por $1.000$ (`BIGINT`), eliminando desvios de arredondamento em float.
- **Impacto no Frontend:**
  - O frontend formata inteiros para exibição amigável brasileira (ex: `2500` -> `2,5 KG`, `1000` -> `1 UN`, `125` -> `0,125 L`).
  - Todos os números, saldos, deltas e códigos utilizam **tipografia monoespaçada tabular** (`tabular-nums`), garantindo que colunas numéricas fiquem perfeitamente alinhadas verticalmente nas casas decimais.

### 3.3. Idempotência e Confiança de Rede (RFC 9474)
- **Regra de Ouro:** Cada mutação gera ou recebe uma chave única (`X-Idempotency-Key`).
- **Impacto no Frontend:**
  - Botões de ação desabilitam visualmente no envio para evitar múltiplos submits, mas caso ocorra retransmissão por instabilidade, o sistema reconhece a resposta sem duplicar estoque.
  - Indicador claro de status nas transações (processado, em cache, duplicado).

---

## 4. O que Este Produto NÃO É (Anti-Patterns Proibidos)

1. **Sem "AI Slop":** Não usamos gradientes roxos/violetas genéricos, cards flutuantes com sombras neon, ilustrações vazias de astronautas ou robôs, nem textos em cinza claro (#9ca3af) sobre fundo branco que são ilegíveis em galpões.
2. **Sem Espaçamento Desperdiçado:** Não usamos paddings inflados de landing pages de marketing. Cada pixel da tela serve para exibir dados operacionais úteis.
3. **Sem Ambiguidade Semântica:** Verde é estritamente "em estoque/sucesso/entrada"; Amarelo/Âmbar é "estoque crítico/atenção"; Vermelho é "sem estoque/perigo/bloqueio". Cores semânticas nunca são usadas como enfeite decorativo.
