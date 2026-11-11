import React from "react";
import { Boxes } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-between font-sans text-zinc-950">
      {/* TopBar Minimalista Industrial */}
      <header className="h-12 border-b border-zinc-200 bg-white px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center bg-zinc-900 text-white rounded">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-bold tracking-widest text-zinc-950 uppercase">
              EXTENSÃO
            </span>
            <span className="text-zinc-400 font-mono text-[11px]">//</span>
            <span className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider">
              OPERATE MODE
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-zinc-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>SISTEMA ATIVO</span>
          <span className="text-zinc-300">|</span>
          <span>LEDGER IMMUTABLE 10³</span>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        {children}
      </main>

      {/* Footer Industrial */}
      <footer className="h-10 border-t border-zinc-200 bg-white px-6 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <span>ESTOQUE & LIVRO-RAZÃO MULTI-TENANT</span>
        <span>RFC 7807 • RFC 9474 • NEXT.JS 14</span>
      </footer>
    </div>
  );
}
