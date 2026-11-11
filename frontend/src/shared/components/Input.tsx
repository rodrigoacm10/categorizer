import React, { forwardRef } from "react";
import { cn } from "../utils/cn";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  helperText?: string;
  error?: string;
  size?: "sm" | "md";
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  monoNumbers?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      size = "md",
      leftAddon,
      rightAddon,
      monoNumbers = false,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    const sizeClasses =
      size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm";

    return (
      <div className="w-full space-y-1.5 font-sans">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-zinc-700 tracking-wide"
          >
            {label}
            {required && <span className="text-rose-600 ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-2.5 flex items-center pointer-events-none text-zinc-400">
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            className={cn(
              "w-full rounded border bg-white text-zinc-950 placeholder:text-zinc-400 transition-colors",
              "border-zinc-300 hover:border-zinc-400",
              "focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950",
              "disabled:bg-zinc-50 disabled:text-zinc-400 disabled:border-zinc-200 disabled:cursor-not-allowed",
              error && "border-rose-500 focus:border-rose-600 focus:ring-rose-600 text-rose-950",
              monoNumbers && "font-mono tabular-nums",
              sizeClasses,
              leftAddon ? "pl-8" : "",
              rightAddon ? "pr-8" : "",
              className
            )}
            {...props}
          />

          {rightAddon && (
            <div className="absolute right-2.5 flex items-center text-zinc-500 text-xs font-medium">
              {rightAddon}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-xs font-medium text-rose-600 mt-1">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-zinc-500 mt-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
