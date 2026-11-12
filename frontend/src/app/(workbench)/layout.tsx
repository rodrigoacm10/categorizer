"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  History,
  Users,
  Terminal,
} from "lucide-react";
import { TopBar } from "@/shared/components/TopBar";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { storage } from "@/shared/lib/storage";
import { cn } from "@/shared/utils/cn";

export interface WorkbenchLayoutProps {
  children: React.ReactNode;
}

interface NavTab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const PRIMARY_NAV_TABS: NavTab[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Catálogo",
    href: "/products",
    icon: Boxes,
    exact: false,
  },
  {
    label: "Movimentações",
    href: "/inventory/move",
    icon: ArrowLeftRight,
    exact: true,
  },
  {
    label: "Extrato",
    href: "/inventory/movements",
    icon: History,
    exact: false,
  },
  {
    label: "Membros",
    href: "/settings/members",
    icon: Users,
    exact: false,
  },
];

export default function WorkbenchLayout({ children }: WorkbenchLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { tenantId, isLoading: isTenantLoading } = useTenant();
  const [isReady, setIsReady] = useState(false);

  // Verificação de autenticação e redirecionamento de tenant
  useEffect(() => {
    const token = storage.getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    if (!isTenantLoading) {
      if (!tenantId && pathname !== "/tenants") {
        router.push("/tenants");
        return;
      }
      setIsReady(true);
    }
  }, [router, tenantId, isTenantLoading, pathname]);

  // Listener global do atalho de teclado Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input =
          document.getElementById("quick-search-input") ||
          document.querySelector<HTMLInputElement>('input[data-quick-search="true"]') ||
          document.querySelector<HTMLInputElement>('input[type="search"]');

        if (input) {
          input.focus();
          if (input instanceof HTMLInputElement) {
            input.select();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isTenantsPage = pathname === "/tenants";

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 flex flex-col justify-between antialiased">
      <div className="flex-1 flex flex-col">
        {/* TopBar Industrial Fixa de 48px */}
        <TopBar />

        {/* Abas Industriais de Navegação Primária (ocultas apenas na seleção de almoxarifado) */}
        {!isTenantsPage && (
          <nav
            aria-label="Navegação Primária da Bancada"
            className="h-10 border-b border-zinc-200 bg-white px-4 md:px-6 flex items-center justify-between select-none overflow-x-auto z-20"
          >
            <div className="flex items-center gap-1 h-full -mb-px">
              {PRIMARY_NAV_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.exact
                  ? pathname === tab.href
                  : pathname.startsWith(tab.href);

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "h-full px-3 inline-flex items-center gap-1.5 border-b-2 text-xs font-mono uppercase tracking-wider transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-inset",
                      isActive
                        ? "border-zinc-950 text-zinc-950 font-bold bg-zinc-50/60"
                        : "border-transparent text-zinc-600 hover:text-zinc-950 hover:border-zinc-300"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-3.5 h-3.5 shrink-0",
                        isActive ? "text-zinc-950" : "text-zinc-400"
                      )}
                      aria-hidden="true"
                    />
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Informações Técnicas da Bancada */}
            <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-zinc-400" />
                <span>ESCALA: 10³</span>
              </span>
              <span className="text-zinc-300">|</span>
              <span>LEDGER IMUTÁVEL</span>
            </div>
          </nav>
        )}

        {/* Conteúdo Principal */}
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>

      {/* Rodapé Industrial da Bancada */}
      <footer className="h-8 border-t border-zinc-200 bg-white px-4 md:px-6 flex items-center justify-between text-[11px] font-mono text-zinc-500 select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-700">EXTENSÃO WAREHOUSE</span>
          <span className="text-zinc-300">//</span>
          <span>BANCADA OPERACIONAL</span>
        </div>
        <div className="flex items-center gap-3">
          <span>RFC 9474 IDEMPOTENCY</span>
          <span className="text-zinc-300">|</span>
          <span>RFC 7807 ERRORS</span>
        </div>
      </footer>
    </div>
  );
}
