import React from "react";
import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata: Metadata = {
  title: "Cadastro de Operador | Extensão Estoque",
  description: "Crie sua conta de operador ou gestor na bancada de estoque multi-tenant.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
