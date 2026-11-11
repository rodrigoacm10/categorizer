"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button, Input } from "@/shared/components";
import { ProblemDetailsError } from "@/shared/types/rfc7807.types";
import { useAuth } from "../hooks/useAuth";
import { loginSchema, LoginFormValues } from "../types/auth.types";

export interface LoginFormProps {
  onSuccess?: () => void;
  defaultEmail?: string;
}

export function LoginForm({ onSuccess, defaultEmail = "" }: LoginFormProps) {
  const searchParams = useSearchParams();
  const isRegisteredSuccess = searchParams?.get("registered") === "true";

  const { login } = useAuth();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): LoginFormValues | null => {
    setErrors({});
    setGeneralError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0] as "email" | "password";
        if (!fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return null;
    }
    return result.data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validatedData = validate();
    if (!validatedData) return;

    setIsSubmitting(true);
    setGeneralError(null);

    try {
      await login(validatedData);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof ProblemDetailsError) {
        if (err.problem.status === 401) {
          setGeneralError("E-mail ou senha incorretos. Verifique suas credenciais.");
        } else if (err.problem.status === 403) {
          setGeneralError("Esta conta de usuário encontra-se desativada. Contate o administrador.");
        } else {
          setGeneralError(err.problem.detail || err.problem.title || "Falha na autenticação.");
        }
      } else if (err instanceof Error) {
        setGeneralError(err.message || "Não foi possível conectar ao servidor do almoxarifado. Verifique sua conexão de rede.");
      } else {
        setGeneralError("Erro inesperado durante a autenticação. Tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-zinc-200 p-6 font-sans">
      <div className="mb-6 space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-zinc-950 inline-block" />
          <h2 className="text-xs font-mono font-bold tracking-widest text-zinc-900 uppercase">
            Autenticação de Operador
          </h2>
        </div>
        <p className="text-xs text-zinc-500">
          Informe suas credenciais para acessar a bancada física de estoque.
        </p>
      </div>

      {isRegisteredSuccess && !generalError && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2.5 border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="font-semibold">Conta criada com sucesso!</p>
            <p className="text-emerald-700">Faça login com suas novas credenciais para continuar.</p>
          </div>
        </div>
      )}

      {generalError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 flex items-start gap-2.5 border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Erro de Acesso</p>
            <p className="text-rose-700">{generalError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          id="email-input"
          label="E-mail Institucional"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="operador@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          leftAddon={<Mail className="h-4 w-4" />}
          disabled={isSubmitting}
        />

        <div className="space-y-1">
          <Input
            id="password-input"
            label="Senha de Acesso"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            leftAddon={<Lock className="h-4 w-4" />}
            disabled={isSubmitting}
            rightAddon={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-zinc-400 hover:text-zinc-700 p-0.5 focus:outline-none"
                aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            }
          />
        </div>

        <Button
          type="submit"
          variant="solid"
          size="md"
          className="w-full mt-2"
          isLoading={isSubmitting}
          rightIcon={!isSubmitting && <ArrowRight className="h-4 w-4" />}
        >
          {isSubmitting ? "Autenticando..." : "Entrar na Bancada"}
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t border-zinc-200 text-center text-xs text-zinc-500">
        Ainda não possui conta?{" "}
        <Link
          href="/register"
          className="font-semibold text-zinc-900 hover:underline inline-flex items-center gap-1"
        >
          Cadastre-se na plataforma
        </Link>
      </div>
    </div>
  );
}
