"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { storage } from "@/shared/lib/storage";

/**
 * Redirecionamento permanente da antiga rota estática /workbench para a bancada operacional real.
 * Se o operador não estiver autenticado, direciona para /login.
 * Se autenticado, direciona para /dashboard.
 */
export default function WorkbenchRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const token = storage.getToken();
    if (!token) {
      router.replace("/login");
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center font-mono text-xs text-zinc-400 gap-3">
      <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      <span>Carregando bancada operacional integrada à API...</span>
    </div>
  );
}
