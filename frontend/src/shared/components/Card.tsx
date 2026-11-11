import React, { forwardRef } from "react";
import { cn } from "../utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "flush";
}

/**
 * Card / Painel Estrutural
 * Estilo plano, sóbrio e moderno (sem cara de IA com bordas super arredondadas ou sombras flutuantes)
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded border font-sans text-zinc-950 transition-colors",
        variant === "default" && "border-zinc-200 bg-white",
        variant === "subtle" && "border-zinc-200 bg-zinc-50/75",
        variant === "flush" && "border-x-0 rounded-none border-zinc-200 bg-white",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, action, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50/60",
        className
      )}
      {...props}
    >
      <div className="space-y-0.5">{children}</div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xs font-semibold text-zinc-900 uppercase tracking-wider leading-none",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-zinc-500", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between px-4 py-2.5 border-t border-zinc-200 bg-zinc-50/60 text-xs",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
