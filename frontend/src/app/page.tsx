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
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components";
import {
  Boxes,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  FileSpreadsheet,
  ScanBarcode,
  PackageCheck,
  AlertTriangle,
} from "lucide-react";

// Mock representativo do Ledger e Catálogo de Estoque Físico
const MOCK_STOCK_ITEMS = [
  {
    id: "prod-001",
    sku: "ROL-6204-2RS",
    name: "Rolamento de Esferas 6204-2RS Blindado",
    category: "Peças Mecânicas",
    unit: "UN",
    currentStock: "1.450",
    minStock: "500",
    status: "in-stock" as const,
    lastMovement: "Hoje, 09:15",
  },
  {
    id: "prod-002",
    sku: "OLE-ISO-VG68",
    name: "Óleo Hidráulico Industrial ISO VG 68",
    category: "Fluidos & Lubrificantes",
    unit: "L",
    currentStock: "120,500",
    minStock: "200",
    status: "low-stock" as const,
    lastMovement: "Ontem, 16:40",
  },
  {
    id: "prod-003",
    sku: "COR-V-B52",
    name: "Correia de Transmissão em V Perfil B-52",
    category: "Transmissão",
    unit: "UN",
    currentStock: "0",
    minStock: "25",
    status: "out-of-stock" as const,
    lastMovement: "08/11/2026, 11:20",
  },
  {
    id: "prod-004",
    sku: "GRA-LIT-EP2",
    name: "Graxa de Lítio Multiuso Complexo EP-2",
    category: "Fluidos & Lubrificantes",
    unit: "KG",
    currentStock: "84,250",
    minStock: "30",
    status: "in-stock" as const,
    lastMovement: "09/11/2026, 14:00",
  },
];

const MOCK_LEDGER_ENTRIES = [
  {
    id: "mov-1001",
    timestamp: "11/11/2026 09:15:22",
    type: "IN" as const,
    delta: "+250",
    balanceAfter: "1.450 UN",
    reason: "Recebimento NF 004812 - Fornecedor NSK",
    idempotencyKey: "idem_9a8f12c4d9e",
  },
  {
    id: "mov-1002",
    timestamp: "10/11/2026 16:40:05",
    type: "OUT" as const,
    delta: "-40,000",
    balanceAfter: "120,500 L",
    reason: "Ordem de Manutenção Prensa Hidráulica 04",
    idempotencyKey: "idem_7b3e51a82f0",
  },
  {
    id: "mov-1003",
    timestamp: "09/11/2026 14:00:11",
    type: "ADJUSTMENT" as const,
    delta: "+4,250",
    balanceAfter: "84,250 KG",
    reason: "Ajuste de inventário físico periódico (Galpão B)",
    idempotencyKey: "idem_1f4c88e99a1",
  },
];

export default function DesignSystemShowcasePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 md:p-10 font-sans text-zinc-950">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Cabeçalho Operacional */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-zinc-900 text-white rounded-md shadow-xs">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-zinc-950">
                  Almoxarifado Central & Estoque Físico
                </h1>
                <p className="text-xs text-zinc-500">
                  Operate Mode • Design System Impeccable • Alta Densidade & Precisão Tabular
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
            >
              Exportar Ledger
            </Button>
            <Button
              variant="solid"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setIsLoading(true);
                setTimeout(() => setIsLoading(false), 1200);
              }}
              isLoading={isLoading}
            >
              Nova Entrada (Ledger)
            </Button>
          </div>
        </header>

        {/* Barra de Filtros e Busca Rápida (com suporte a Leitor de Código de Barras) */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              shortcutHint="Ctrl+K"
              placeholder="Buscar SKU, código de barras EAN ou item de estoque..."
            />
          </div>
          <div className="md:col-span-3">
            <Input
              size="md"
              placeholder="EAN-13 / Leitor..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              monoNumbers
              leftAddon={<ScanBarcode className="w-4 h-4" />}
            />
          </div>
          <div className="md:col-span-3 flex gap-2">
            <Button variant="secondary" size="md" className="w-full">
              Filtrar por Categoria
            </Button>
            <Button variant="outline" size="md" leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Atualizar
            </Button>
          </div>
        </section>

        {/* Tabela Densa de Catálogo e Posição Física */}
        <Card>
          <CardHeader
            action={
              <div className="flex items-center gap-2">
                <Badge variant="in-stock" size="sm" showDot>
                  2 Saudáveis
                </Badge>
                <Badge variant="low-stock" size="sm" showDot>
                  1 Crítico
                </Badge>
                <Badge variant="out-of-stock" size="sm" showDot>
                  1 Esgotado
                </Badge>
              </div>
            }
          >
            <CardTitle>Posição de Estoque Físico Atual</CardTitle>
            <CardDescription>
              Valores calculados em inteiro escalado ($x1000$) e exibidos em precisão tabular
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table dense>
              <TableHeader>
                <TableRow interactive={false}>
                  <TableHead className="w-36">SKU / Código</TableHead>
                  <TableHead>Descrição do Item</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="w-20">UOM</TableHead>
                  <TableHead numeric className="w-32">Saldo Atual</TableHead>
                  <TableHead numeric className="w-28">Estoque Mín.</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead className="w-40 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_STOCK_ITEMS.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell numeric className="font-semibold text-zinc-900">
                      {item.sku}
                    </TableCell>
                    <TableCell className="font-medium text-zinc-950">
                      {item.name}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex px-2 py-0.5 rounded text-xs bg-zinc-100 text-zinc-700 font-medium">
                        {item.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-zinc-600 bg-zinc-100/80 px-1.5 py-0.5 rounded">
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
                        <Button variant="outline" size="xs">
                          Movimentar
                        </Button>
                        <Button variant="ghost" size="xs">
                          Histórico
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Extrato do Livro-Razão (Ledger Imutável) */}
        <Card>
          <CardHeader
            action={
              <Badge variant="info" size="sm">
                Auditoria Perpétua RFC 9474
              </Badge>
            }
          >
            <CardTitle>Extrato de Movimentações Recentes (Ledger Append-Only)</CardTitle>
            <CardDescription>
              Nenhum dado é apagado ou sobrescrito. Cada movimentação possui chave de idempotência e saldo após movimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table dense>
              <TableHeader>
                <TableRow interactive={false}>
                  <TableHead className="w-44">Data / Hora</TableHead>
                  <TableHead className="w-28">Tipo</TableHead>
                  <TableHead numeric className="w-28">Delta</TableHead>
                  <TableHead numeric className="w-36">Saldo Resultante</TableHead>
                  <TableHead>Motivo / Documento</TableHead>
                  <TableHead className="w-48 text-right font-mono text-xs">Chave Idempotência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_LEDGER_ENTRIES.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell numeric className="text-zinc-500 text-xs">
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
                          ? "text-zinc-900 font-bold"
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
                    <TableCell align="right" className="font-mono text-[11px] text-zinc-400">
                      {entry.idempotencyKey}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Guia de Estilos / Componentes em Isolamento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Variantes de Botão */}
          <Card>
            <CardHeader>
              <CardTitle>Variantes de Botão</CardTitle>
              <CardDescription>Focus states nítidos e feedback tátil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="solid" size="sm">Solid (Padrão)</Button>
                <Button variant="secondary" size="sm">Secondary</Button>
                <Button variant="outline" size="sm">Outline</Button>
                <Button variant="ghost" size="sm">Ghost</Button>
                <Button variant="danger" size="sm">Danger</Button>
              </div>
              <div className="pt-2 border-t border-zinc-100 flex gap-2">
                <Button variant="solid" size="xs" disabled>Desabilitado</Button>
                <Button variant="solid" size="xs" isLoading>Salvando</Button>
              </div>
            </CardContent>
          </Card>

          {/* Variantes de Badges */}
          <Card>
            <CardHeader>
              <CardTitle>Badges & Status</CardTitle>
              <CardDescription>Contraste estrito para leitura rápida</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="in-stock" size="sm" showDot>Em Estoque</Badge>
                <Badge variant="low-stock" size="sm" showDot>Estoque Baixo</Badge>
                <Badge variant="out-of-stock" size="sm" showDot>Zerado</Badge>
                <Badge variant="inactive" size="sm">Inativo</Badge>
              </div>
              <div className="pt-2 border-t border-zinc-100 flex flex-wrap gap-2">
                <Badge variant="ledger-in" size="sm">+ Entrada</Badge>
                <Badge variant="ledger-out" size="sm">- Saída</Badge>
                <Badge variant="ledger-adjust" size="sm">Δ Ajuste</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Inputs & Formatação */}
          <Card>
            <CardHeader>
              <CardTitle>Inputs & Campos</CardTitle>
              <CardDescription>Precisão para valores e leitor de código</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                label="Quantidade Física"
                placeholder="0,000"
                rightAddon="KG"
                monoNumbers
                size="sm"
              />
              <Input
                label="Código com Erro"
                defaultValue="EAN-INVÁLIDO"
                error="Formato de código inválido para o produto"
                size="sm"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
