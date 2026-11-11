import React, { forwardRef, useRef, useImperativeHandle } from "react";
import { cn } from "../utils/cn";
import { Search, X, ScanBarcode } from "lucide-react";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  size?: "sm" | "md";
  showBarcodeHint?: boolean;
  shortcutHint?: string;
  placeholder?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      value,
      onChange,
      onClear,
      size = "md",
      showBarcodeHint = true,
      shortcutHint,
      placeholder = "Buscar por código, SKU, descrição ou código de barras...",
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => internalRef.current as HTMLInputElement);

    const handleClear = () => {
      onChange("");
      if (onClear) onClear();
      internalRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && value) {
        e.preventDefault();
        handleClear();
      }
      if (onKeyDown) onKeyDown(e);
    };

    const isCompact = size === "sm";

    return (
      <div className={cn("relative flex items-center w-full font-sans", className)}>
        <div className="absolute left-2.5 flex items-center pointer-events-none text-zinc-400">
          <Search className={cn("shrink-0", isCompact ? "w-3.5 h-3.5" : "w-4 h-4")} />
        </div>

        <input
          ref={internalRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full rounded border bg-white text-zinc-950 placeholder:text-zinc-400 transition-colors",
            "border-zinc-300 hover:border-zinc-400",
            "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
            isCompact ? "h-8 pl-8 pr-16 text-xs" : "h-9 pl-9 pr-20 text-sm",
            "font-mono tabular-nums"
          )}
          {...props}
        />

        <div className="absolute right-2 flex items-center gap-1.5">
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors"
              title="Limpar busca (Esc)"
              aria-label="Limpar busca"
            >
              <X className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} />
            </button>
          ) : (
            <>
              {showBarcodeHint && (
                <span
                  title="Pronto para leitor de código de barras"
                  className="flex items-center text-zinc-400"
                >
                  <ScanBarcode className={isCompact ? "w-3.5 h-3.5" : "w-4 h-4"} />
                </span>
              )}
              {shortcutHint && (
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-zinc-400 bg-zinc-100 border border-zinc-200 rounded">
                  {shortcutHint}
                </kbd>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
