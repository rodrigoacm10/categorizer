import React, { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = {
  title: "Login de Operador | Extensão Estoque",
  description: "Autenticação de acesso à bancada industrial de estoque e almoxarifado.",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md bg-white border border-zinc-200 p-8 text-center font-mono text-xs text-zinc-500">
          Carregando terminal de autenticação...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
