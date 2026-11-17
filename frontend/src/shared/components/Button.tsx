import React, { forwardRef } from "react";
import { cn } from "../utils/cn";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "solid" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  solid:
    "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 border border-zinc-900 shadow-sm",
  secondary:
    "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 border border-zinc-200/80 shadow-xs",
  outline:
    "bg-white text-zinc-900 hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 shadow-xs",
  ghost:
    "bg-transparent text-zinc-800 hover:bg-zinc-100 active:bg-zinc-200 border border-transparent",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 border border-rose-600 shadow-sm",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded",
  sm: "h-8 px-3 text-xs font-medium gap-1.5 rounded",
  md: "h-9 px-3.5 text-sm font-medium gap-2 rounded",
  lg: "h-10 px-4 text-sm font-medium gap-2 rounded",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "solid",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center font-sans transition-colors select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1",
          "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
