"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  X,
  ArrowRight,
} from "lucide-react";
import { Button, Input } from "@/shared/components";
import { ProblemDetailsError } from "@/shared/types/rfc7807.types";
import { authApi } from "../services/auth.api";
import { registerSchema, RegisterFormValues } from "../types/auth.types";

export interface RegisterFormProps {
  onSuccess?: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormValues, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validações visuais de complexidade de senha em tempo real
  const ruleMinLength = password.length >= 8;
  const ruleHasNumber = /\d/.test(password);
  const ruleHasUppercase = /[A-Z]/.test(password);
  const allPasswordRulesMet = ruleMinLength && ruleHasNumber && ruleHasUppercase;

  const validate = (): RegisterFormValues | null => {
    setErrors({});
    setGeneralError(null);

    const result = registerSchema.safeParse({
      full_name: fullName,
      email,
      password,
      confirm_password: confirmPassword,
    });

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof RegisterFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0] as keyof RegisterFormValues;
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
      await authApi.register({
        email: validatedData.email,
        password: validatedData.password,
        full_name: validatedData.full_name,
      });

      onSuccess?.();
      router.push("/login?registered=true");
    } catch (err: unknown) {
      if (err instanceof ProblemDetailsError) {
        if (
          err.problem.status === 409 ||
          err.problem.type.includes("email-already-exists") ||
          err.problem.detail?.toLowerCase().includes("já cadastrado")
        ) {
          setErrors((prev) => ({
            ...prev,
            email: "Este e-mail já está cadastrado no sistema.",
          }));
          setGeneralError(
            "Este e-mail já está cadastrado no sistema. Tente fazer login ou recupere o acesso."
          );
        } else {
          setGeneralError(
            err.problem.detail || err.problem.title || "Falha no cadastro de usuário."
          );
        }
      } else if (err instanceof Error) {
        setGeneralError(
          err.message || "Não foi possível conectar ao servidor. Verifique sua conexão de rede."
        );
      } else {
        setGeneralError("Erro inesperado durante o cadastro. Tente novamente.");
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
            Cadastro de Operador
          </h2>
        </div>
        <p className="text-xs text-zinc-500">
          Crie sua conta corporativa para operar ou gerenciar almoxarifados.
        </p>
      </div>

      {generalError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 flex items-start gap-2.5 border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Erro no Cadastro</p>
            <p className="text-rose-700">{generalError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          id="fullname-input"
          label="Nome Completo"
          type="text"
          autoComplete="name"
          autoFocus
          required
          placeholder="Ex: Carlos Eduardo Silva"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.full_name}
          leftAddon={<User className="h-4 w-4" />}
          disabled={isSubmitting}
        />

        <Input
          id="email-input"
          label="E-mail Corporativo"
          type="email"
          autoComplete="email"
          required
          placeholder="operador@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          leftAddon={<Mail className="h-4 w-4" />}
          disabled={isSubmitting}
        />

        <div className="space-y-1.5">
          <Input
            id="password-input"
            label="Senha de Acesso"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
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

          {/* Validação Visual de Requisitos de Senha */}
          <div className="border border-zinc-200 bg-zinc-50 p-2.5 rounded text-[11px] space-y-1">
            <p className="font-mono text-zinc-500 uppercase tracking-wider text-[10px] mb-1">
              Requisitos de Senha Industrial:
            </p>
            <div className="grid grid-cols-1 gap-1">
              <div
                className={`flex items-center gap-1.5 ${
                  ruleMinLength ? "text-emerald-700 font-medium" : "text-zinc-500"
                }`}
              >
                {ruleMinLength ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 ml-1 mr-1 shrink-0" />
                )}
                <span>Mínimo de 8 caracteres</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${
                  ruleHasNumber ? "text-emerald-700 font-medium" : "text-zinc-500"
                }`}
              >
                {ruleHasNumber ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 ml-1 mr-1 shrink-0" />
                )}
                <span>Pelo menos 1 número</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${
                  ruleHasUppercase ? "text-emerald-700 font-medium" : "text-zinc-500"
                }`}
              >
                {ruleHasUppercase ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 ml-1 mr-1 shrink-0" />
                )}
                <span>Pelo menos 1 letra maiúscula</span>
              </div>
            </div>
          </div>
        </div>

        <Input
          id="confirm-password-input"
          label="Confirmação de Senha"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirm_password}
          leftAddon={<Lock className="h-4 w-4" />}
          disabled={isSubmitting}
          rightAddon={
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="text-zinc-400 hover:text-zinc-700 p-0.5 focus:outline-none"
              aria-label={showConfirmPassword ? "Ocultar confirmação" : "Exibir confirmação"}
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
        />

        <Button
          type="submit"
          variant="solid"
          size="md"
          className="w-full mt-2"
          isLoading={isSubmitting}
          rightIcon={!isSubmitting && <ArrowRight className="h-4 w-4" />}
        >
          {isSubmitting ? "Criando Conta..." : "Criar Conta na Bancada"}
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t border-zinc-200 text-center text-xs text-zinc-500">
        Já possui conta?{" "}
        <Link
          href="/login"
          className="font-semibold text-zinc-900 hover:underline inline-flex items-center gap-1"
        >
          Faça login na bancada
        </Link>
      </div>
    </div>
  );
}
