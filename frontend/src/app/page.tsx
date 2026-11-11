"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Boxes,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Database,
  Cpu,
  Lock,
  Layers,
  FileCode2,
  ScanBarcode,
  Terminal,
  Activity,
  GitCommit,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button, Badge } from "@/shared/components";

export default function LandingPage() {
  // Estado para o Simulador Interativo do Ledger
  const [simType, setSimType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");
  const [simQty, setSimQty] = useState("250");
  const [simReason, setSimReason] = useState("Recebimento NF Fornecedor #4812");
  const [simLogs, setSimLogs] = useState<
    Array<{
      id: string;
      time: string;
      type: "IN" | "OUT" | "ADJUSTMENT";
      delta: string;
      balance: string;
      hash: string;
    }>
  >([
    {
      id: "MOV-091",
      time: "10:14:02",
      type: "IN",
      delta: "+1.000 UN",
      balance: "1.450 UN",
      hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    {
      id: "MOV-092",
      time: "10:28:44",
      type: "OUT",
      delta: "-200 UN",
      balance: "1.250 UN",
      hash: "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
    },
  ]);
  const [currentBalance, setCurrentBalance] = useState(1250);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulateTransaction = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const qtyNum = parseFloat(simQty) || 0;
      let newBalance = currentBalance;
      let deltaFormatted = "";

      if (simType === "IN") {
        newBalance += qtyNum;
        deltaFormatted = `+${qtyNum} UN`;
      } else if (simType === "OUT") {
        newBalance = Math.max(0, newBalance - qtyNum);
        deltaFormatted = `-${qtyNum} UN`;
      } else {
        newBalance = qtyNum;
        const diff = qtyNum - currentBalance;
        deltaFormatted = `${diff >= 0 ? "+" : ""}${diff} UN (Ajuste)`;
      }

      const randomHash = Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");

      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];

      setSimLogs((prev) => [
        {
          id: `MOV-0${prev.length + 93}`,
          time: timeStr,
          type: simType,
          delta: deltaFormatted,
          balance: `${newBalance.toLocaleString("pt-BR")} UN`,
          hash: randomHash,
        },
        ...prev,
      ]);

      setCurrentBalance(newBalance);
      setIsSimulating(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-zinc-950 selection:text-white">
      {/* 1. NAVBAR INDUSTRIAL CONTÍNUA */}
      <nav className="border-b border-zinc-200 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 bg-zinc-950 text-white rounded flex items-center justify-center font-mono font-bold text-xs tracking-tighter group-hover:bg-zinc-800 transition-colors">
                EX
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-sm tracking-tight text-zinc-950">
                  EXTENSÃO
                </span>
                <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest">
                  // OS
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-zinc-600">
              <a href="#arquitetura" className="hover:text-zinc-950 transition-colors">
                Arquitetura
              </a>
              <a href="#pilares" className="hover:text-zinc-950 transition-colors">
                Os 4 Pilares
              </a>
              <a href="#simulador" className="hover:text-zinc-950 transition-colors">
                Simulador Ledger
              </a>
              <a href="#comparativo" className="hover:text-zinc-950 transition-colors">
                Comparativo
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 border-r border-zinc-200 pr-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                RFC 9474 IDEMPOTENTE
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                ACID POSTGRES 16
              </span>
            </div>

            <Link href="/workbench">
              <Button variant="solid" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Abrir Console Operacional
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION DE ALTO IMPACTO (Sem cards inflados, tipografia cirúrgica) */}
      <section className="relative pt-16 pb-14 border-b border-zinc-200 bg-gradient-to-b from-zinc-50/60 to-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl space-y-5">
            {/* Tag técnica */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-mono font-medium">
              <Terminal className="w-3.5 h-3.5 text-zinc-900" />
              <span>SISTEMA DE GESTÃO FÍSICA DE ALMOXARIFADO & ESTOQUE</span>
            </div>

            {/* Headline Contundente */}
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-950 leading-[1.12]">
              Controle físico intransigente. Sem furos. Sem perdas. Com rigor contábil.
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-lg text-zinc-600 leading-relaxed max-w-2xl">
              Substitua comandos destrutivos de <code className="text-xs font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">UPDATE</code> por um
              <strong> Livro-Razão Contábil Imutável (Ledger Append-Only)</strong>.
              Elimine desvios de arredondamento com escala inteira <strong className="font-mono text-zinc-900">x1000</strong> e
              garanta integridade física com <strong>Idempotência RFC 9474</strong> direto na ponta do leitor de código de barras.
            </p>

            {/* Botões de Ação */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link href="/workbench">
                <Button variant="solid" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Acessar Bancada Operacional
                </Button>
              </Link>
              <a href="#simulador">
                <Button variant="outline" size="md" leftIcon={<Activity className="w-4 h-4" />}>
                  Testar Simulador de Ledger
                </Button>
              </a>
              <a
                href="#pilares"
                className="text-xs font-mono font-medium text-zinc-500 hover:text-zinc-900 pl-2 transition-colors"
              >
                Ver especificações técnicas ↓
              </a>
            </div>
          </div>

          {/* Hero Artifact: Pré-visualização da Fita do Ledger em Tempo Real */}
          <div className="mt-12 border border-zinc-200 rounded overflow-hidden shadow-xs bg-white">
            {/* Header da Janela Técnica */}
            <div className="px-4 py-2.5 bg-zinc-900 text-white flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="text-zinc-400 ml-2">extensao-daemon // ledger.stream</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <span>POSTGRES: ACTIVE</span>
                <span>LOCK: ROW-EXCLUSIVE</span>
                <span className="text-emerald-400">● SYNC</span>
              </div>
            </div>

            {/* Exibição da Linha Contábil */}
            <div className="p-4 sm:p-5 font-mono text-xs overflow-x-auto bg-zinc-950 text-zinc-200 space-y-2">
              <div className="text-zinc-500 flex gap-4 border-b border-zinc-800 pb-2 text-[11px]">
                <span className="w-24">TIMESTAMPTZ</span>
                <span className="w-28">EVENT_TYPE</span>
                <span className="w-28 text-right">DELTA (X1000)</span>
                <span className="w-32 text-right">BALANCE_AFTER</span>
                <span className="flex-1">IDEMPOTENCY_FINGERPRINT (SHA-256)</span>
              </div>

              <div className="flex gap-4 items-center text-zinc-300 py-1">
                <span className="w-24 text-zinc-500">11:02:14.810</span>
                <span className="w-28 text-emerald-400 font-semibold">+ IN_PURCHASE</span>
                <span className="w-28 text-right text-emerald-400 font-bold tabular-nums">+250.000</span>
                <span className="w-32 text-right text-white font-bold tabular-nums">1.450.000 UN</span>
                <span className="flex-1 text-zinc-400 truncate">sha256:4a8b11c9...3e7a [NF #004812 - NSK BRASIL]</span>
              </div>

              <div className="flex gap-4 items-center text-zinc-300 py-1">
                <span className="w-24 text-zinc-500">10:48:02.125</span>
                <span className="w-28 text-zinc-400 font-semibold">- OUT_PICKING</span>
                <span className="w-28 text-right text-zinc-200 font-bold tabular-nums">-40.000</span>
                <span className="w-32 text-right text-white font-bold tabular-nums">1.200.000 L</span>
                <span className="flex-1 text-zinc-400 truncate">sha256:7b2e91f0...1a8d [OS #991 - PRENSA HIDRÁULICA]</span>
              </div>

              <div className="flex gap-4 items-center text-zinc-300 py-1">
                <span className="w-24 text-zinc-500">09:15:33.400</span>
                <span className="w-28 text-indigo-400 font-semibold">Δ INVENTORY_ADJ</span>
                <span className="w-28 text-right text-indigo-400 font-bold tabular-nums">+4.250</span>
                <span className="w-32 text-right text-white font-bold tabular-nums">84.250 KG</span>
                <span className="flex-1 text-zinc-400 truncate">sha256:1f9c88e4...88a2 [CONTAGEM CÍCLICA GALPÃO-B]</span>
              </div>
            </div>

            {/* Barra de Rodapé do Preview */}
            <div className="px-4 py-2.5 bg-zinc-100 border-t border-zinc-200 text-xs text-zinc-600 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-zinc-800">
                  Integridade Referencial Absoluta:
                </span>
                <span>Zero linhas deletadas. Zero saldos sobrescritos.</span>
              </div>
              <Link
                href="/workbench"
                className="font-mono text-[11px] text-zinc-700 hover:text-zinc-950 font-semibold flex items-center gap-1"
              >
                <span>Ver Workbench em execução</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FAIXA DE MÉTRICAS & CREDIBILIDADE INDUSTRIAL (Dividida em 1px, sem cards flutuantes) */}
      <section className="border-b border-zinc-200 bg-zinc-50/75">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-zinc-200">
          <div className="p-6">
            <div className="text-[11px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
              Arquitetura de Dados
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-950 mt-1 tabular-nums">
              100% Append-Only
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              Livro-Razão imutável sem comandos destrutivos no banco de dados.
            </p>
          </div>

          <div className="p-6">
            <div className="text-[11px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
              Precisão de Quantidade
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-950 mt-1 tabular-nums">
              Escala Fixa x1000
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              Zero erros de ponto flutuante em frações de KG, L e metros.
            </p>
          </div>

          <div className="p-6">
            <div className="text-[11px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
              Garantia de Rede & Hardware
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-950 mt-1 tabular-nums">
              RFC 9474
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              Idempotência com impressão digital SHA-256 e detecção de duplo envio.
            </p>
          </div>

          <div className="p-6">
            <div className="text-[11px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
              Concorrência de Almoxarifado
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-950 mt-1 tabular-nums">
              Row Locks ACID
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              Trava transacional em PostgreSQL que impede saldo negativo em paralelo.
            </p>
          </div>
        </div>
      </section>

      {/* 4. OS 4 PILARES TÉCNICOS FUNDAMENTAIS */}
      <section id="pilares" className="py-16 border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl space-y-2 mb-12">
            <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider">
              Engenharia de Confiança Físico-Digital
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
              Por que os softwares tradicionais de estoque falham no galpão?
            </h2>
            <p className="text-sm text-zinc-600">
              A maioria dos ERPs executa <code className="text-xs font-mono bg-zinc-100 px-1 py-0.5 rounded">UPDATE products SET quantity = quantity - 10</code>.
              Esse erro de projeto destrói o histórico de auditoria e cria furos irreversíveis de concorrência.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 border border-zinc-200 rounded divide-y md:divide-y-0 md:divide-x divide-zinc-200">
            {/* Pilar 1 */}
            <div className="p-6 sm:p-8 space-y-4">
              <div className="w-8 h-8 rounded bg-zinc-900 text-white flex items-center justify-center font-mono font-bold text-xs">
                01
              </div>
              <h3 className="text-base font-bold text-zinc-950">
                O Padrão Ledger (Livro-Razão Contábil Imutável)
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Toda e qualquer alteração de saldo gera uma nova entrada cronológica perpétua no final do Ledger:
                <strong className="text-zinc-900"> IN</strong> (Entrada),
                <strong className="text-zinc-900"> OUT</strong> (Saída),
                <strong className="text-zinc-900"> ADJUSTMENT</strong> (Ajuste de inventário físico) ou
                <strong className="text-zinc-900"> PRODUCT_DELETED</strong> (Soft-delete com preservação contábil).
                Você sabe exatamente quem movimentou, qual documento originou a carga e qual era o saldo exato em qualquer segundo do passado.
              </p>
              <div className="font-mono text-[11px] bg-zinc-50 border border-zinc-200 p-2.5 rounded text-zinc-700">
                <code>NO HARD DELETE • NO UPDATE • APPEND-ONLY GARANTIDO</code>
              </div>
            </div>

            {/* Pilar 2 */}
            <div className="p-6 sm:p-8 space-y-4">
              <div className="w-8 h-8 rounded bg-zinc-900 text-white flex items-center justify-center font-mono font-bold text-xs">
                02
              </div>
              <h3 className="text-base font-bold text-zinc-950">
                Precisão Inteira Escalada (Fixed-Point x1000)
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Tipos de ponto flutuante (<code className="text-xs font-mono">float</code>/<code className="text-xs font-mono">double</code>)
                acumulam desvios binários (ex: <code className="text-xs font-mono">0.1 + 0.2 = 0.30000000000000004</code>).
                Nosso motor armazena quantidades estritamente em <strong className="text-zinc-900">BIGINT escalado por 1.000</strong>.
                1 UN é gravada como <code className="text-xs font-mono">1000</code>; 2,5 KG como <code className="text-xs font-mono">2500</code>;
                0,125 L como <code className="text-xs font-mono">125</code>. Erros de arredondamento são matematicamente eliminados.
              </p>
              <div className="font-mono text-[11px] bg-zinc-50 border border-zinc-200 p-2.5 rounded text-zinc-700">
                <code>Armazenado: BIGINT • Exibido: Formatador pt-BR Tabular</code>
              </div>
            </div>

            {/* Pilar 3 */}
            <div className="p-6 sm:p-8 space-y-4">
              <div className="w-8 h-8 rounded bg-zinc-900 text-white flex items-center justify-center font-mono font-bold text-xs">
                03
              </div>
              <h3 className="text-base font-bold text-zinc-950">
                Idempotência de Hardware & Rede (RFC 9474)
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                No chão de fábrica, coletores de dados e leitores de código de barras sofrem oscilação de Wi-Fi e cliques duplos involuntários.
                O backend calcula uma <strong>impressão digital semântica (SHA-256)</strong> de cada intenção.
                Se a requisição for repetida, o backend detecta a retransmissão e retorna o mesmo resultado com header <code className="text-xs font-mono">X-Cache: HIT</code>, sem aplicar a baixa de estoque duas vezes.
              </p>
              <div className="font-mono text-[11px] bg-zinc-50 border border-zinc-200 p-2.5 rounded text-zinc-700">
                <code>hash = SHA256(endpoint + produto + delta + motivo)</code>
              </div>
            </div>

            {/* Pilar 4 */}
            <div className="p-6 sm:p-8 space-y-4">
              <div className="w-8 h-8 rounded bg-zinc-900 text-white flex items-center justify-center font-mono font-bold text-xs">
                04
              </div>
              <h3 className="text-base font-bold text-zinc-950">
                Concorrência Física com Bloqueio Transacional
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                Se dois conferentes em bancadas diferentes tentarem expedir a última unidade de um rolamento ao mesmo milissegundo,
                o sistema utiliza <strong className="text-zinc-900 font-mono">SELECT ... FOR UPDATE</strong> no PostgreSQL.
                A segunda transação aguarda a liberação e, ao constatar que o saldo esgotou, rejeita a saída antes de violar o saldo zero.
                Estoque físico negativo é proibido por restrição de domínio.
              </p>
              <div className="font-mono text-[11px] bg-zinc-50 border border-zinc-200 p-2.5 rounded text-zinc-700">
                <code>Strict ACID • PostgreSQL 16 • Zero Saldo Negativo</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SIMULADOR INTERATIVO DO LIVRO-RAZÃO (O Coração do Produto em Ação) */}
      <section id="simulador" className="py-16 border-b border-zinc-200 bg-zinc-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl space-y-2 mb-8">
            <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider">
              Demonstração Interativa
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
              Simulador do Livro-Razão Transacional
            </h2>
            <p className="text-sm text-zinc-600">
              Dispare uma movimentação real no motor de simulação abaixo para observar a geração do delta,
              a assinatura semântica e a inserção imediata na fita perpétua do Ledger.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 border border-zinc-200 rounded bg-white overflow-hidden shadow-xs">
            {/* Painel de Disparo de Transação (Esquerda) */}
            <div className="lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-r border-zinc-200 space-y-5 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
                  Parâmetros da Movimentação
                </span>
                <span className="text-[11px] font-mono text-zinc-500">Item: ROL-6204</span>
              </div>

              {/* Seletor de Tipo */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700">
                  Tipo de Operação no Ledger
                </label>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setSimType("IN")}
                    className={`py-1.5 px-2 rounded border font-semibold transition-colors ${
                      simType === "IN"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    + ENTRADA
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimType("OUT")}
                    className={`py-1.5 px-2 rounded border font-semibold transition-colors ${
                      simType === "OUT"
                        ? "bg-zinc-900 border-zinc-900 text-white"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    - SAÍDA
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimType("ADJUSTMENT")}
                    className={`py-1.5 px-2 rounded border font-semibold transition-colors ${
                      simType === "ADJUSTMENT"
                        ? "bg-indigo-50 border-indigo-300 text-indigo-800"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    Δ AJUSTE
                  </button>
                </div>
              </div>

              {/* Quantidade */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700">
                  Quantidade Física ({simType === "ADJUSTMENT" ? "Novo Saldo Total Contado" : "Delta"})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={simQty}
                    onChange={(e) => setSimQty(e.target.value)}
                    className="w-full h-9 px-3 rounded border border-zinc-300 font-mono tabular-nums text-sm focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950"
                    placeholder="Quantidade"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-zinc-500 font-semibold">
                    UN
                  </span>
                </div>
              </div>

              {/* Motivo */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700">
                  Motivo / Justificativa de Auditoria
                </label>
                <input
                  type="text"
                  value={simReason}
                  onChange={(e) => setSimReason(e.target.value)}
                  className="w-full h-9 px-3 rounded border border-zinc-300 text-xs focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950"
                  placeholder="Ex: NF 1234, Devolução, O.S."
                />
              </div>

              {/* Botão de Disparo */}
              <Button
                variant="solid"
                size="md"
                className="w-full"
                onClick={handleSimulateTransaction}
                isLoading={isSimulating}
                leftIcon={<Zap className="w-4 h-4" />}
              >
                Executar Transação Imutável
              </Button>

              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                <span>Saldo Físico Resultante:</span>
                <span className="font-mono font-bold text-sm text-zinc-950">
                  {currentBalance.toLocaleString("pt-BR")} UN
                </span>
              </div>
            </div>

            {/* Fita do Ledger em Tempo Real (Direita) */}
            <div className="lg:col-span-7 p-6 bg-zinc-50/75 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3">
                  <span className="text-xs font-mono font-semibold text-zinc-700 uppercase tracking-wider">
                    Fita Contábil em Tempo Real (Append-Only)
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700 font-medium">
                    ● {simLogs.length} Movimentos Gravados
                  </span>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {simLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-white border border-zinc-200 rounded font-mono text-xs space-y-1 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-950">{log.id}</span>
                          <span className="text-[10px] text-zinc-400">às {log.time}</span>
                          {log.type === "IN" && (
                            <Badge variant="ledger-in" size="sm">+ ENTRADA</Badge>
                          )}
                          {log.type === "OUT" && (
                            <Badge variant="ledger-out" size="sm">- SAÍDA</Badge>
                          )}
                          {log.type === "ADJUSTMENT" && (
                            <Badge variant="ledger-adjust" size="sm">Δ AJUSTE</Badge>
                          )}
                        </div>
                        <span className="font-bold text-zinc-900">{log.delta}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-100">
                        <span>Saldo pós-evento: <strong className="text-zinc-800">{log.balance}</strong></span>
                        <span className="text-[10px] text-zinc-400 truncate max-w-xs" title={log.hash}>
                          sha256:{log.hash.slice(0, 16)}...
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-1.5 pt-2">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Nenhum registro pode sofrer alteração física após gravado no banco.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. COMPARATIVO BRUTAL (Sistemas Frágeis Tradicionais vs. Extensão OS) */}
      <section id="comparativo" className="py-16 border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl space-y-2 mb-10">
            <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider">
              Análise Técnica de Confiabilidade
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
              Sistemas Convencionais vs. Extensão OS
            </h2>
            <p className="text-sm text-zinc-600">
              Compare as decisões arquiteturais fundamentais que separam controles vulneráveis de uma infraestrutura corporativa à prova de auditoria.
            </p>
          </div>

          <div className="border border-zinc-200 rounded overflow-x-auto">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-mono uppercase text-[11px]">
                  <th className="p-4 w-1/4">Critério Arquitetural</th>
                  <th className="p-4 w-3/8 text-zinc-500">Abordagem Tradicional (Frágil)</th>
                  <th className="p-4 w-3/8 text-zinc-950 font-bold bg-zinc-100/60">
                    Extensão OS (Intransigente)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                <tr>
                  <td className="p-4 font-semibold text-zinc-900 font-mono">Mutação de Saldo</td>
                  <td className="p-4 text-zinc-600">
                    Executa <code className="text-zinc-800 bg-zinc-100 px-1 py-0.5 rounded">UPDATE</code> destrutivo. Sobrescreve o saldo anterior e perde o histórico de quem alterou e quando.
                  </td>
                  <td className="p-4 bg-zinc-50/40 font-medium text-emerald-900">
                    <strong>Ledger Append-Only</strong> imutável. Toda alteração é um evento cronológico. Histórico auditável para sempre.
                  </td>
                </tr>

                <tr>
                  <td className="p-4 font-semibold text-zinc-900 font-mono">Precisão Fracionária</td>
                  <td className="p-4 text-zinc-600">
                    Usa tipos de ponto flutuante (<code className="text-zinc-800 bg-zinc-100 px-1 py-0.5 rounded">FLOAT</code> / <code className="text-zinc-800 bg-zinc-100 px-1 py-0.5 rounded">DOUBLE</code>), gerando dízimas e perdas residuais acumuladas de KG e Litros.
                  </td>
                  <td className="p-4 bg-zinc-50/40 font-medium text-emerald-900">
                    <strong>Inteiro Escalado (Fixed-Point $x1000$)</strong> com tipos <code className="font-mono">BIGINT</code>. Zero desvios de float.
                  </td>
                </tr>

                <tr>
                  <td className="p-4 font-semibold text-zinc-900 font-mono">Duplo Envio de Leitor</td>
                  <td className="p-4 text-zinc-600">
                    Não valida idempotência. Dois bips rápidos do conferente baixam o estoque duas vezes.
                  </td>
                  <td className="p-4 bg-zinc-50/40 font-medium text-emerald-900">
                    <strong>RFC 9474 Idempotente</strong> com hash semântico SHA-256 no backend. Duplo envio é absorvido com resposta em cache.
                  </td>
                </tr>

                <tr>
                  <td className="p-4 font-semibold text-zinc-900 font-mono">Concorrência de Galpão</td>
                  <td className="p-4 text-zinc-600">
                    Leituras desprotegidas geram condições de corrida (*race conditions*), permitindo saídas maiores que o saldo físico real.
                  </td>
                  <td className="p-4 bg-zinc-50/40 font-medium text-emerald-900">
                    <strong>SELECT FOR UPDATE</strong> com bloqueio de linha no PostgreSQL. Impossível ter estoque negativo.
                  </td>
                </tr>

                <tr>
                  <td className="p-4 font-semibold text-zinc-900 font-mono">Descontinuação de Item</td>
                  <td className="p-4 text-zinc-600">
                    Ou deleta do banco (<code className="text-zinc-800 bg-zinc-100 px-1 py-0.5 rounded">DELETE CASCADE</code> quebrando integridade fiscal) ou esconde sem auditoria.
                  </td>
                  <td className="p-4 bg-zinc-50/40 font-medium text-emerald-900">
                    Desativa no catálogo e grava evento imutável <code className="font-mono">PRODUCT_DELETED</code> com o saldo restante e motivo informado.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. CTA FINAL & ACESSO IMEDIATO */}
      <section className="py-20 bg-zinc-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono">
            <Boxes className="w-4 h-4 text-emerald-400" />
            <span>ESTAÇÃO DE TRABALHO PRONTA PARA OPERAÇÃO</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight max-w-2xl mx-auto">
            Experimente o Console Operacional em Modo Workbench
          </h2>

          <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Navegue pelo catálogo de itens, simule entradas e saídas físicas de almoxarifado e confira o design system de alta densidade em ação.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link href="/workbench">
              <Button
                variant="solid"
                size="md"
                className="bg-white text-zinc-950 hover:bg-zinc-100 border-white font-bold"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Abrir Workbench Operacional
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 8. FOOTER TÉCNICO */}
      <footer className="border-t border-zinc-200 bg-zinc-50/80 py-8 text-xs text-zinc-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-zinc-900 text-white rounded flex items-center justify-center font-mono font-bold text-[10px]">
              EX
            </div>
            <span className="font-semibold text-zinc-900">
              Extensão // Sistema de Gestão Física de Estoque Multi-Tenant
            </span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px] text-zinc-500">
            <span>Next.js 14</span>
            <span>•</span>
            <span>FastAPI Python 3.12</span>
            <span>•</span>
            <span>PostgreSQL 16 Alpine</span>
            <span>•</span>
            <span>Docker</span>
          </div>

          <div className="text-[11px] text-zinc-400">
            © 2026 Extensão OS. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
