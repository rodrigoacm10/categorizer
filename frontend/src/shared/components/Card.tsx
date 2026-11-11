import React, { forwardRef } from "react";
import { cn } from "../utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "interactive";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-white text-zinc-950 font-sans shadow-xs transition-colors",
        variant === "default" && "border-zinc-200 bg-white",
        variant === "subtle" && "border-zinc-200/80 bg-zinc-50/50",
        variant === "interactive" &&
          "border-zinc-200 hover:border-zinc-300 hover:shadow-sm cursor-pointer",
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
        "flex items-center justify-between px-5 py-4 border-b border-zinc-100",
        className
      )}
      {...props}
    >
      <div className="space-y-1">{children}</div>
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
      "text-sm font-semibold text-zinc-900 leading-none tracking-tight",
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
  <div ref={ref} className={cn("p-5", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/50 rounded-b-lg",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
