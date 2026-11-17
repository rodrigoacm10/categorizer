"use client";

import React, { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Product,
  ProductFormValues,
  productFormSchema,
  STANDARD_UOMS,
  ProductFormFieldErrors,
} from "../types/product.types";
import { productsApi } from "../services/products.api";
import { categoriesApi } from "@/features/categories/services/categories.api";
import { Category } from "@/features/categories/types/category.types";
import { CategoryBadge } from "@/features/categories/components/CategoryBadge";
import { CategoryModal } from "@/features/categories/components/CategoryModal";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { queryKeys } from "@/shared/lib/query-client";
import { Input, Button } from "@/shared/components";
import {
  AlertTriangle,
  Check,
  Plus,
  X,
  Layers,
  Info,
  Scale,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

export interface ProductFormProps {
  initialData?: Product;
  mode?: "create" | "edit";
  readOnly?: boolean;
  onSuccess?: (product: Product) => void;
  onCancel?: () => void;
}

/**
 * ProductForm (FT-13 / FT-14 / Impeccable Workbench):
 * Formulário operacional de alta densidade para cadastro e edição cadastral de produtos físicos.
 * Invariante contábil: Produtos novos iniciam obrigatoriamente com saldo ZERO no Livro-Razão.
 * Proibição absoluta de campos de saldo inicial na interface.
 */
export const ProductForm: React.FC<ProductFormProps> = ({
  initialData,
  mode = initialData ? "edit" : "create",
  readOnly = false,
  onSuccess,
  onCancel,
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  // Estados dos Campos
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [unit, setUnit] = useState(initialData?.unit || "UN");
  const [minStock, setMinStock] = useState(
    initialData?.min_stock !== null && initialData?.min_stock !== undefined
      ? String(initialData.min_stock)
      : ""
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    initialData?.categories?.map((c) => c.id) || []
  );

  // Estados de Interface e Validação
  const [errors, setErrors] = useState<ProductFormFieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const descriptionId = useId();

  // Atualiza estados quando initialData mudar
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setDescription(initialData.description || "");
      setUnit(initialData.unit || "UN");
      setMinStock(
        initialData.min_stock !== null && initialData.min_stock !== undefined
          ? String(initialData.min_stock)
          : ""
      );
      setSelectedCategoryIds(initialData.categories?.map((c) => c.id) || []);
    }
  }, [initialData]);

  // Consulta categorias disponíveis no tenant ativo
  const { data: availableCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: queryKeys.categories.list(tenantId || ""),
    queryFn: () => categoriesApi.list(),
    enabled: !!tenantId,
  });

  const toggleCategory = (categoryId: string) => {
    if (readOnly) return;
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const removeCategory = (categoryId: string) => {
    if (readOnly) return;
    setSelectedCategoryIds((prev) => prev.filter((id) => id !== categoryId));
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (readOnly) return;
    setUnit(e.target.value.toUpperCase());
    if (errors.unit) {
      setErrors((prev) => ({ ...prev, unit: undefined }));
    }
  };

  const validate = (): ProductFormValues | null => {
    setErrors({});
    setGeneralError(null);

    const result = productFormSchema.safeParse({
      name,
      description: description.trim() || undefined,
      unit,
      min_stock: minStock.trim() || undefined,
      category_ids: selectedCategoryIds,
    });

    if (!result.success) {
      const fieldErrors: ProductFormFieldErrors = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0] as keyof ProductFormValues;
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
    if (readOnly) return;

    const validatedData = validate();
    if (!validatedData) return;

    try {
      setIsSubmitting(true);
      setGeneralError(null);

      const parsedMinStock =
        validatedData.min_stock && validatedData.min_stock.trim() !== ""
          ? parseFloat(validatedData.min_stock.trim().replace(",", "."))
          : null;

      let savedProduct: Product;

      if (mode === "edit" && initialData?.id) {
        savedProduct = await productsApi.update(initialData.id, {
          name: validatedData.name,
          description: validatedData.description,
          unit: validatedData.unit,
          min_stock: parsedMinStock,
          category_ids: validatedData.category_ids,
        });

        if (tenantId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.products.detail(tenantId, initialData.id),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.products.all(tenantId),
          });
        }
      } else {
        savedProduct = await productsApi.create({
          name: validatedData.name,
          description: validatedData.description,
          unit: validatedData.unit,
          min_stock: parsedMinStock,
          category_ids: validatedData.category_ids,
        });

        if (tenantId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.products.all(tenantId),
          });
        }
      }

      if (onSuccess) {
        onSuccess(savedProduct);
      } else {
        router.push("/products");
      }
    } catch (err: unknown) {
      let message = "Ocorreu um erro ao processar a operação.";
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "object" && err !== null && "detail" in err) {
        message = String((err as { detail: unknown }).detail);
      }
      setGeneralError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/products");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-4xl font-sans"
      data-testid="product-form"
      noValidate
    >
      {/* Banner Obrigatório de Alerta Contábil (FT-13): Saldo inicial é ZERO */}
      {mode === "create" && (
        <div
          role="alert"
          className="border border-amber-300 bg-amber-50/80 px-4 py-3 text-amber-950 flex items-start gap-3 rounded-none shadow-xs"
          data-testid="zero-stock-banner"
        >
          <Scale className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5 text-xs">
            <span className="font-semibold tracking-wide uppercase text-amber-900 block">
              Aviso Contábil // Novos produtos iniciam obrigatoriamente com saldo físico ZERO (0.000). Entradas físicas devem ser registradas na bancada de movimentação do Livro-Razão.
            </span>
            <span className="text-amber-800/90 block leading-relaxed">
              O catálogo de produtos não permite inclusão direta de quantidades físicas. Toda entrada de estoque requer um evento contábil com justificativa e registro imutável no Livro-Razão.
            </span>
          </div>
        </div>
      )}

      {/* Erro Geral da API */}
      {generalError && (
        <div
          role="alert"
          className="border border-rose-300 bg-rose-50 px-4 py-3 text-rose-950 flex items-start gap-2.5 rounded-none"
          data-testid="form-general-error"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs">
            <span className="font-semibold block">Erro na Operação:</span>
            <span>{generalError}</span>
          </div>
        </div>
      )}

      {/* Painel Principal de Dados Cadastrais */}
      <div className="border border-zinc-200 bg-white divide-y divide-zinc-200 rounded-none shadow-xs">
        {/* Seção 1: Identificação do Item */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="border-b border-zinc-100 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
              1. Identificação do Produto
            </h3>
            <span className="text-[11px] text-zinc-400 font-mono">
              {readOnly ? "Modo Somente-Leitura" : "Campos com * são obrigatórios"}
            </span>
          </div>

          <div className="space-y-4">
            {/* Nome do Produto */}
            <Input
              label="Nome do Produto"
              name="name"
              id="product-name"
              required
              disabled={readOnly}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="ex: Eletrodo Revestido AWS E7018 3.25mm"
              error={errors.name}
              helperText="Mínimo 2 caracteres. Deve identificar claramente o item ou SKU."
              data-testid="product-name-input"
            />

            {/* Descrição Técnica */}
            <div className="space-y-1.5">
              <label
                htmlFor={descriptionId}
                className="block text-xs font-semibold text-zinc-700 tracking-wide"
              >
                Descrição Técnica / Aplicação
              </label>
              <textarea
                id={descriptionId}
                name="description"
                rows={3}
                disabled={readOnly}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes técnicos, norma regulamentadora, fabricante ou especificações..."
                className={cn(
                  "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-950 placeholder:text-zinc-400 transition-colors",
                  "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
                  "disabled:bg-zinc-50 disabled:text-zinc-400 disabled:border-zinc-200 disabled:cursor-not-allowed",
                  errors.description && "border-rose-500 focus:border-rose-600 focus:ring-rose-600"
                )}
                data-testid="product-description-input"
              />
              {errors.description && (
                <p className="text-xs font-medium text-rose-600">{errors.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Seção 2: Especificações Físicas & Reposição */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="border-b border-zinc-100 pb-2">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
              2. Métricas Físicas & Reposição
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Unidade de Medida (UOM) */}
            <div className="space-y-1.5">
              <label
                htmlFor="product-unit"
                className="block text-xs font-semibold text-zinc-700 tracking-wide"
              >
                Unidade de Medida (UOM) <span className="text-rose-600">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="product-unit"
                  name="unit"
                  type="text"
                  required
                  disabled={readOnly}
                  value={unit}
                  onChange={handleUnitChange}
                  placeholder="UN, KG, L..."
                  className={cn(
                    "w-28 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-zinc-950 transition-colors",
                    "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
                    "disabled:bg-zinc-50 disabled:text-zinc-400 disabled:border-zinc-200 disabled:cursor-not-allowed",
                    errors.unit && "border-rose-500 text-rose-950"
                  )}
                  maxLength={10}
                  data-testid="product-unit-input"
                />

                {!readOnly && (
                  <select
                    aria-label="Selecionar Unidade de Medida Padronizada"
                    className="flex-1 rounded border border-zinc-300 bg-zinc-50/60 px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-950 transition-colors"
                    value={STANDARD_UOMS.some((u) => u.code === unit) ? unit : ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        setUnit(e.target.value);
                        if (errors.unit) setErrors((prev) => ({ ...prev, unit: undefined }));
                      }
                    }}
                    data-testid="product-unit-preset-select"
                  >
                    <option value="">UOMs Padrão...</option>
                    {STANDARD_UOMS.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {errors.unit ? (
                <p className="text-xs font-medium text-rose-600">{errors.unit}</p>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Unidade física contábil mandatória em maiúsculas.
                </p>
              )}
            </div>

            {/* Estoque Mínimo de Alerta */}
            <div>
              <Input
                label="Estoque Mínimo de Segurança"
                name="min_stock"
                id="product-min-stock"
                disabled={readOnly}
                value={minStock}
                onChange={(e) => {
                  setMinStock(e.target.value);
                  if (errors.min_stock) {
                    setErrors((prev) => ({ ...prev, min_stock: undefined }));
                  }
                }}
                placeholder="0.000"
                monoNumbers
                rightAddon={unit || "UN"}
                error={errors.min_stock}
                helperText={`Ponto de reposição automática. Dispara alerta se saldo ≤ mínimo (${unit || "UN"}).`}
                data-testid="product-min-stock-input"
              />
            </div>
          </div>
        </div>

        {/* Seção 3: Categorias N:N */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="border-b border-zinc-100 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
              3. Categorização N:N
            </h3>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setIsCategoryModalOpen(true)}
                leftIcon={<FolderPlus className="w-3.5 h-3.5" />}
                data-testid="open-inline-category-modal"
              >
                Nova Categoria
              </Button>
            )}
          </div>

          <div className="space-y-3" data-testid="product-categories-selector">
            {/* Categorias Atualmente Selecionadas */}
            <div className="min-h-[38px] p-2 rounded border border-zinc-200 bg-zinc-50/50 flex flex-wrap items-center gap-1.5">
              {selectedCategoryIds.length === 0 ? (
                <span className="text-xs text-zinc-400 italic">
                  Nenhuma categoria vinculada a este produto.
                </span>
              ) : (
                selectedCategoryIds.map((id) => {
                  const cat = availableCategories.find((c) => c.id === id);
                  if (!cat) return null;
                  return (
                    <div key={cat.id} className="inline-flex items-center gap-1">
                      <CategoryBadge category={cat} size="sm" />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeCategory(cat.id)}
                          className="text-zinc-400 hover:text-rose-600 p-0.5 rounded focus:outline-none"
                          title={`Remover categoria ${cat.name}`}
                          aria-label={`Remover categoria ${cat.name}`}
                          data-testid={`remove-category-${cat.id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Lista Rápida de Categorias para Seleção */}
            {!readOnly && availableCategories.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  Clique para associar ou desassociar:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableCategories.map((cat) => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1.5",
                          isSelected
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                        )}
                        data-testid={`toggle-category-${cat.id}`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || "#3B82F6" }}
                        />
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barra de Ações Operacionais */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCancelClick}
          data-testid="cancel-button"
        >
          {readOnly ? "Voltar ao Catálogo" : "Cancelar"}
        </Button>

        {!readOnly && (
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="solid"
              size="sm"
              isLoading={isSubmitting}
              data-testid="submit-product-button"
            >
              {mode === "create" ? "Cadastrar Produto (Saldo Zero)" : "Atualizar Dados Cadastrais"}
            </Button>
          </div>
        )}
      </div>

      {/* Modal Inline para Criação Rápida de Nova Categoria */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={(newCat) => {
          setSelectedCategoryIds((prev) =>
            prev.includes(newCat.id) ? prev : [...prev, newCat.id]
          );
          if (tenantId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.categories.list(tenantId),
            });
          }
        }}
      />
    </form>
  );
};

ProductForm.displayName = "ProductForm";
