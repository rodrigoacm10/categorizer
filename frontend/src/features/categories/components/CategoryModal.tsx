"use client";

import React, { useState } from "react";
import { categoriesApi } from "../services/categories.api";
import { Category } from "../types/category.types";
import { X, Tag } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (cat: Category) => void;
}

const PRESET_COLORS = [
  "#3B82F6", // Azul
  "#10B981", // Verde
  "#F59E0B", // Âmbar
  "#EF4444", // Vermelho
  "#8B5CF6", // Roxo
  "#EC4899", // Rosa
  "#06B6D4", // Ciano
  "#64748B", // Grafite
];

export const CategoryModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Informe o nome da categoria.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const created = await categoriesApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
      onSuccess(created);
      setName("");
      setDescription("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao criar categoria.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-800">Nova Categoria</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Nome da Categoria *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Embalagens, Eletrônicos..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Descrição (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Breve descrição da categoria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Cor de Identificação
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? "border-slate-800 scale-110 shadow-sm" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? "Criando..." : "Salvar Categoria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
