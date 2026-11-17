"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { X, Warehouse, AlertTriangle, ArrowRight } from "lucide-react";
import { Button, Input } from "@/shared/components";
import { ProblemDetailsError } from "@/shared/types/rfc7807.types";
import { useTenant } from "../hooks/useTenant";
import { tenantsApi } from "../services/tenants.api";
import {
  createTenantSchema,
  CreateTenantFormValues,
  slugify,
  Tenant,
} from "../types/tenant.types";

export interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (tenant: Tenant) => void;
}

export function CreateTenantModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTenantModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTenant } = useTenant();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  const [errors, setErrors] = useState<{
    name?: string;
    slug?: string;
    description?: string;
  }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fecha com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Limpa estados ao fechar ou reabrir
  useEffect(() => {
    if (isOpen) {
      setName("");
      setSlug("");
      setDescription("");
      setIsSlugManuallyEdited(false);
      setErrors({});
      setGeneralError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (!isSlugManuallyEdited) {
      setSlug(slugify(newName));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    setSlug(e.target.value.toLowerCase().trim());
  };

  const validate = (): CreateTenantFormValues | null => {
    setErrors({});
    setGeneralError(null);

    const result = createTenantSchema.safeParse({
      name,
      slug: slug || slugify(name),
      description: description || undefined,
    });

    if (!result.success) {
      const fieldErrors: { name?: string; slug?: string; description?: string } = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0] as "name" | "slug" | "description";
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
      const newTenant = await tenantsApi.createTenant({
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description,
      });

      // 1. Atualiza contexto global de tenant como OWNER
      setTenant(newTenant.id, "OWNER");

      // 2. Invalida cache de tenants no React Query
      await queryClient.invalidateQueries({ queryKey: ["tenants"] });

      // 3. Notifica callback e redireciona para a bancada
      onSuccess?.(newTenant);
      onClose();
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof ProblemDetailsError) {
        if (
          err.problem.status === 409 ||
          err.problem.type.includes("slug-already-exists") ||
          err.problem.detail?.toLowerCase().includes("slug")
        ) {
          setErrors((prev) => ({
            ...prev,
            slug: "Este identificador já está em uso por outro almoxarifado. Escolha um nome diferente.",
          }));
        } else {
          setGeneralError(
            err.problem.detail ||
              err.problem.title ||
              "Erro ao criar novo almoxarifado."
          );
        }
      } else if (err instanceof Error) {
        setGeneralError(
          err.message ||
            "Não foi possível conectar ao servidor. Verifique sua conexão de rede."
        );
      } else {
        setGeneralError("Erro inesperado ao criar almoxarifado.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg bg-white border border-zinc-200 shadow-lg font-sans">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 bg-zinc-50/75">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center bg-zinc-900 text-white rounded">
              <Warehouse className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="modal-title"
                className="text-xs font-mono font-bold tracking-wider text-zinc-950 uppercase"
              >
                Criar Novo Almoxarifado
              </h2>
              <p className="text-[11px] text-zinc-500 font-sans">
                Você será associado automaticamente como OWNER desta unidade.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-zinc-400 hover:text-zinc-700 transition-colors p-1"
            aria-label="Fechar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {generalError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Erro de Criação</p>
                <p className="text-rose-700">{generalError}</p>
              </div>
            </div>
          )}

          <Input
            id="tenant-name-input"
            label="Nome do Almoxarifado"
            type="text"
            required
            autoFocus
            placeholder="Ex: Almoxarifado Central - Galpão 3"
            value={name}
            onChange={handleNameChange}
            error={errors.name}
            disabled={isSubmitting}
          />

          <Input
            id="tenant-slug-input"
            label="Slug Identificador (Kebab-case)"
            type="text"
            required
            placeholder="ex: almoxarifado-central-galpao-3"
            value={slug}
            onChange={handleSlugChange}
            error={errors.slug}
            helperText="Identificador único alfanumérico com hífens gerado a partir do nome."
            monoNumbers
            disabled={isSubmitting}
          />

          <div className="space-y-1.5 font-sans">
            <label
              htmlFor="tenant-description-input"
              className="block text-xs font-semibold text-zinc-700 tracking-wide"
            >
              Finalidade Operacional (Opcional)
            </label>
            <textarea
              id="tenant-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder="Ex: Depósito principal de matérias-primas e suprimentos de usinagem."
              className="w-full rounded border border-zinc-300 bg-white p-2.5 text-xs text-zinc-950 placeholder:text-zinc-400 transition-colors focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 disabled:bg-zinc-50"
            />
            {errors.description && (
              <p className="text-xs font-medium text-rose-600">
                {errors.description}
              </p>
            )}
          </div>

          {/* Rodapé / Botões */}
          <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              isLoading={isSubmitting}
              rightIcon={!isSubmitting && <ArrowRight className="h-4 w-4" />}
            >
              {isSubmitting ? "Criando Unidade..." : "Criar e Assumir Gestão"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
