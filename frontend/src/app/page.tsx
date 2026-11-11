"use client";

import React, { useState } from "react";
import {
  Button,
  Input,
  SearchInput,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components";
import {
  Warehouse,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  FileSpreadsheet,
  ScanBarcode,
  SlidersHorizontal,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";

const MOCK_STOCK_ITEMS = [
  {
    id: "prod-001",
    sku: "ROL-6204-2RS",
    barcode: "7891234560012",
    name: "Rolamento de Esferas 6204-2RS Blindado DDU",
    category: "Peças Mecânicas",
    unit: "UN",
    currentStock: "1.450",
    minStock: "500",
    status: "in-stock" as const,
    shelf: "GALPÃO-A / RUA-03 / NÍVEL-02",
  },
  {
    id: "prod-002",
    sku: "OLE-ISO-VG68",
    barcode: "7891234560029",
    name: "Óleo Hidráulico Industrial Alta Viscosidade ISO VG 68",
    category: "Fluidos & Lubrificantes",
    unit: "L",
    currentStock: "120,500",
    minStock: "200",
    status: "low-stock" as const,
    shelf: "GALPÃO-B / RUA-01 / NÍVEL-01",
  },
  {
    id: "prod-003",
    sku: "COR-V-B52",
    barcode: "7891234560036",
    name: "Correia de Transmissão Industrial em V Perfil B-52",
    category: "Transmissão",
    unit: "UN",
    currentStock: "0",
    minStock: "25",
    status: "out-of-stock" as const,
    shelf: "GALPÃO-A / RUA-04 / NÍVEL-03",
  },
  {
    id: "prod-004",
    sku: "GRA-LIT-EP2",
    barcode: "7891234560043",
    name: "Graxa de Lítio Complexo EP-2 Resistente a Carga Extrema",
    category: "Fluidos & Lubrificantes",
    unit: "KG",
    currentStock: "84,250",
    minStock: "30",
    status: "in-stock" as const,
    shelf: "GALPÃO-B / RUA-02 / NÍVEL-01",
  },
];

const MOCK_LEDGER_ENTRIES = [
  {
    id: "mov-1001",
    timestamp: "11/11/2026 09:15:22",
    type: "IN" as const,
    delta: "+250",
    balanceAfter: "1.450 UN",
    reason: "Recebimento NF 004812 • Fornecedor NSK Brasil",
    idempotencyKey: "idem_9a8f12c4d9e",
    operator: "carlos.silva",
  },
  {
    id: "mov-1002",
    timestamp: "10/11/2026 16:40:05",
    type: "OUT" as const,
    delta: "-40,000",
    balanceAfter: "120,500 L",
    reason: "Ordem de Manutenção Preventiva Prensa Hidráulica 04",
    idempotencyKey: "idem_7b3e51a82f0",
    operator: "marcos.lima",
  },
  {
    id: "mov-1003",
    timestamp: "09/11/2026 14:00:11",
    type: "ADJUSTMENT" as const,
    delta: "+4,250",
    balanceAfter: "84,250 KG",
    reason: "Ajuste de inventário físico periódico (Contagem Cíclica)",
    idempotencyKey: "idem_1f4c88e99a1",
    operator: "auditoria.externa",
  },
];

export default function WarehouseWorkbenchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [activeTab, setActiveTab] = useState<"estoque" | "ledger" | "tokens">("estoque");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-zinc-900 selection:text-white">
      {/* 1. TOP BAR INDUSTRIAL (Linear-grade, contínuo, sem cards) */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Warehouse className="w-4 h-4 text-zinc-900" />
              <span className="font-semibold text-xs tracking-wider uppercase text-zinc-950">
                Almoxarifado Central
              </span>
            </div>
            <span className="text-zinc-300">/</span>
            <span className="text-xs text-zinc-600 font-mono">
              Galpão Principal • Tenant #01
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              leftIcon={<RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />}
              onClick={handleRefresh}
            >
              Sincronizar
            </Button>
            <Button
              variant="outline"
              size="xs"
              leftIcon={<FileSpreadsheet className="w-3 h-3" />}
            >
              Exportar
            </Button>
            <Button
              variant="solid"
              size="xs"
              leftIcon={<Plus className="w-3 h-3" />}
            >
              Registrar Movimento
            </Button>
          </div>
        </div>
      </header>

      {/* 2. KPI STRIP (Métricas em Linha Contínua com divisores de 1px - Sem cards soltos!) */}
      <section className="border-b border-zinc-200 bg-zinc-50/60">
        <div className="max-w-[1600px] mx-auto grid grid-cols-2 sm:grid-cols-4 divide-x divide-zinc-200">
          <div className="px-5 py-3">
            <span className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Total de Itens Cadastrados
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-bold font-mono tabular-nums text-zinc-950">
                1.842
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">SKUs</span>
            </div>
          </div>

          <div className="px-5 py-3">
            <span className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Posição Física Ativa
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-bold font-mono tabular-nums text-emerald-700">
                98,4%
              </span>
              <span className="text-[11px] text-emerald-600 font-medium">Regular</span>
            </div>
          </div>

          <div className="px-5 py-3">
            <span className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Itens em Ponto de Reposição
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-bold font-mono tabular-nums text-amber-700">
                12
              </span>
              <span className="text-[11px] text-amber-600 font-medium">Atenção</span>
            </div>
          </div>

          <div className="px-5 py-3">
            <span className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Última Movimentação (Ledger)
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-sm font-semibold font-mono tabular-nums text-zinc-900">
                09:15:22
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">Hoje</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WORKBENCH TOOLBAR (Busca rápida por código de barras + abas em linha) */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Navegação por Abas Industriais */}
          <div className="flex items-center gap-1 border border-zinc-200 p-0.5 rounded bg-zinc-100/70">
            <button
              onClick={() => setActiveTab("estoque")}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                activeTab === "estoque"
                  ? "bg-white text-zinc-950 shadow-xs border border-zinc-200/80"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              Posição Física de Estoque
            </button>
            <button
              onClick={() => setActiveTab("ledger")}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                activeTab === "ledger"
                  ? "bg-white text-zinc-950 shadow-xs border border-zinc-200/80"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              Extrato do Ledger (Auditoria Perpétua)
            </button>
            <button
              onClick={() => setActiveTab("tokens")}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                activeTab === "tokens"
                  ? "bg-white text-zinc-950 shadow-xs border border-zinc-200/80"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              Design System Tokens
            </button>
          </div>

          {/* Filtros em linha */}
          <div className="flex items-center gap-2 max-w-xl w-full md:w-auto">
            <div className="w-full md:w-80">
              <SearchInput
                size="sm"
                value={searchQuery}
                onChange={setSearchQuery}
                shortcutHint="Ctrl+K"
                placeholder="Buscar SKU, item ou código de barras..."
              />
            </div>
            <div className="w-44 hidden sm:block">
              <Input
                size="sm"
                placeholder="Leitor EAN..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                monoNumbers
                leftAddon={<ScanBarcode className="w-3.5 h-3.5" />}
              />
            </div>
            <Button variant="outline" size="xs" leftIcon={<SlidersHorizontal className="w-3 h-3" />}>
              Filtros
            </Button>
          </div>
        </div>
      </section>

      {/* 4. ÁREA PRINCIPAL DO WORKBENCH (Tabelas de alta densidade sem cards arredondados) */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
        {activeTab === "estoque" && (
          <div className="border border-zinc-200 rounded overflow-hidden">
            <div className="px-4 py-2 bg-zinc-50/75 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">
                  Catálogo Operacional & Saldos Físicos
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  (Inteiro Escalado $x1000$ • Precisão 3 Decimais)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 font-medium">Legenda:</span>
                <Badge variant="in-stock" size="sm" showDot>Em Estoque</Badge>
                <Badge variant="low-stock" size="sm" showDot>Reposição</Badge>
                <Badge variant="out-of-stock" size="sm" showDot>Zerado</Badge>
              </div>
            </div>

            <Table dense>
              <TableHeader>
                <TableRow interactive={false}>
                  <TableHead className="w-36">Código / SKU</TableHead>
                  <TableHead className="w-40 font-mono text-xs">Código de Barras</TableHead>
                  <TableHead>Descrição Técnica do Item</TableHead>
                  <TableHead className="w-40">Localização Física</TableHead>
                  <TableHead className="w-16 text-center">UOM</TableHead>
                  <TableHead numeric className="w-32">Saldo Físico</TableHead>
                  <TableHead numeric className="w-28">Estoque Mín.</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-36 text-right">Ação Direta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_STOCK_ITEMS.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell numeric className="font-semibold text-zinc-950">
                      {item.sku}
                    </TableCell>
                    <TableCell numeric className="text-zinc-500 text-xs">
                      {item.barcode}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-zinc-950 text-xs">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {item.category}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-zinc-600">
                      {item.shelf}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-[11px] font-semibold text-zinc-700 bg-zinc-100 px-1 py-0.5 rounded">
                        {item.unit}
                      </span>
                    </TableCell>
                    <TableCell numeric className="text-zinc-950 font-bold text-sm">
                      {item.currentStock}
                    </TableCell>
                    <TableCell numeric className="text-zinc-500">
                      {item.minStock}
                    </TableCell>
                    <TableCell>
                      {item.status === "in-stock" && (
                        <Badge variant="in-stock" size="sm" showDot>
                          Em Estoque
                        </Badge>
                      )}
                      {item.status === "low-stock" && (
                        <Badge variant="low-stock" size="sm" showDot>
                          Reposição
                        </Badge>
                      )}
                      {item.status === "out-of-stock" && (
                        <Badge variant="out-of-stock" size="sm" showDot>
                          Zerado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="solid" size="xs">
                          Movimentar
                        </Button>
                        <Button variant="outline" size="xs">
                          Extrato
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {activeTab === "ledger" && (
          <div className="border border-zinc-200 rounded overflow-hidden">
            <div className="px-4 py-2 bg-zinc-50/75 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">
                  Livro-Razão de Movimentações (Ledger Append-Only)
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  • Imutável • No Hard-Delete • RFC 9474 Idempotente
                </span>
              </div>
              <Badge variant="info" size="sm">
                Conferência Fiscal Ativa
              </Badge>
            </div>

            <Table dense>
              <TableHeader>
                <TableRow interactive={false}>
                  <TableHead className="w-44">Data & Hora</TableHead>
                  <TableHead className="w-28">Operação</TableHead>
                  <TableHead numeric className="w-28">Delta</TableHead>
                  <TableHead numeric className="w-36">Saldo Após Movimento</TableHead>
                  <TableHead>Histórico / Documento de Origem</TableHead>
                  <TableHead className="w-36 font-mono text-xs">Operador</TableHead>
                  <TableHead className="w-44 text-right font-mono text-xs">Idempotency Key</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_LEDGER_ENTRIES.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell numeric className="text-zinc-600 text-xs">
                      {entry.timestamp}
                    </TableCell>
                    <TableCell>
                      {entry.type === "IN" && (
                        <Badge variant="ledger-in" size="sm">
                          + ENTRADA
                        </Badge>
                      )}
                      {entry.type === "OUT" && (
                        <Badge variant="ledger-out" size="sm">
                          - SAÍDA
                        </Badge>
                      )}
                      {entry.type === "ADJUSTMENT" && (
                        <Badge variant="ledger-adjust" size="sm">
                          Δ AJUSTE
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell
                      numeric
                      className={
                        entry.type === "IN"
                          ? "text-emerald-700 font-bold"
                          : entry.type === "OUT"
                          ? "text-zinc-950 font-bold"
                          : "text-indigo-700 font-bold"
                      }
                    >
                      {entry.delta}
                    </TableCell>
                    <TableCell numeric className="font-semibold text-zinc-950">
                      {entry.balanceAfter}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-700">
                      {entry.reason}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {entry.operator}
                    </TableCell>
                    <TableCell align="right" className="font-mono text-[11px] text-zinc-400">
                      {entry.idempotencyKey}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {activeTab === "tokens" && (
          <div className="border border-zinc-200 rounded p-5 bg-white space-y-6">
            <div>
              <h2 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                Catálogo de Componentes e Diretrizes Impeccable
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Design System sem cartões arredondados ou sombras difusas. Precisão geométrica de 1px e foco operacional.
              </p>
            </div>

            {/* Painel de Botões */}
            <div className="border-t border-zinc-200 pt-4">
              <h3 className="text-xs font-semibold text-zinc-700 mb-2">1. Botões de Ação (Focus States Nítidos)</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="solid" size="xs">Solid XS</Button>
                <Button variant="solid" size="sm">Solid SM</Button>
                <Button variant="solid" size="md">Solid MD</Button>
                <Button variant="secondary" size="sm">Secondary</Button>
                <Button variant="outline" size="sm">Outline</Button>
                <Button variant="ghost" size="sm">Ghost</Button>
                <Button variant="danger" size="sm">Danger</Button>
                <Button variant="solid" size="sm" isLoading>Processando</Button>
                <Button variant="solid" size="sm" disabled>Desabilitado</Button>
              </div>
            </div>

            {/* Painel de Badges */}
            <div className="border-t border-zinc-200 pt-4">
              <h3 className="text-xs font-semibold text-zinc-700 mb-2">2. Badges de Estoque e Ledger (Sem pills infladas)</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="in-stock" size="sm" showDot>Em Estoque</Badge>
                <Badge variant="low-stock" size="sm" showDot>Ponto Reposição</Badge>
                <Badge variant="out-of-stock" size="sm" showDot>Zerado / Crítico</Badge>
                <Badge variant="inactive" size="sm">Inativo</Badge>
                <Badge variant="ledger-in" size="sm">+ ENTRADA</Badge>
                <Badge variant="ledger-out" size="sm">- SAÍDA</Badge>
                <Badge variant="ledger-adjust" size="sm">Δ AJUSTE</Badge>
              </div>
            </div>

            {/* Painel de Inputs */}
            <div className="border-t border-zinc-200 pt-4">
              <h3 className="text-xs font-semibold text-zinc-700 mb-2">3. Inputs Industriais com suporte a Leitores</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
                <Input label="Quantidade Física (KG)" placeholder="0,000" rightAddon="KG" monoNumbers size="sm" />
                <Input label="Código EAN / SKU" placeholder="789000123" monoNumbers size="sm" />
                <Input label="Com Validação de Erro" defaultValue="ERR_QTD" error="Quantidade excede capacidade física" size="sm" />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 5. FOOTER OPERACIONAL DE BANCADA */}
      <footer className="border-t border-zinc-200 bg-zinc-50/75 py-2 px-4 sm:px-6 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2 mt-8">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Sessão Ativa: <strong className="text-zinc-700 font-mono">carlos.silva (Conferente Sênior)</strong></span>
          <span className="text-zinc-300">•</span>
          <span>Terminal: <strong className="text-zinc-700 font-mono">BANCADA-EXPEDICAO-01</strong></span>
        </div>
        <div className="font-mono text-[11px] text-zinc-400">
          Escala Fixa: x1000 • Latência: 12ms • Idempotência: RFC 9474
        </div>
      </footer>
    </div>
  );
}
