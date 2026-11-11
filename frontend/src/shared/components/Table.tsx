import React, { forwardRef } from "react";
import { cn } from "../utils/cn";
import { Inbox } from "lucide-react";

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  dense?: boolean;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, dense = false, children, ...props }, ref) => (
    <div className="w-full overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-xs">
      <table
        ref={ref}
        className={cn(
          "w-full text-left text-sm text-zinc-950 font-sans border-collapse",
          dense && "text-xs",
          className
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  )
);
Table.displayName = "Table";

export interface TableHeaderProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  sticky?: boolean;
}

export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, sticky = true, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        "bg-zinc-50 text-zinc-700 text-xs font-semibold uppercase tracking-wider border-b border-zinc-200",
        sticky && "sticky top-0 z-10 shadow-xs",
        className
      )}
      {...props}
    />
  )
);
TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("divide-y divide-zinc-200/80 bg-white", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

export const TableFooter = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-zinc-200 bg-zinc-50/80 font-medium text-zinc-700",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  interactive?: boolean;
  selected?: boolean;
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, interactive = true, selected = false, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "transition-colors",
        interactive && "hover:bg-zinc-50/80 cursor-default",
        selected && "bg-blue-50/60 hover:bg-blue-50",
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = "TableRow";

export interface TableHeadProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
  numeric?: boolean;
}

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, align, numeric = false, children, ...props }, ref) => {
    const computedAlign = align || (numeric ? "right" : "left");
    const alignClass =
      computedAlign === "right"
        ? "text-right"
        : computedAlign === "center"
        ? "text-center"
        : "text-left";

    return (
      <th
        ref={ref}
        className={cn(
          "h-9 px-3.5 py-2 font-semibold text-zinc-600 select-none",
          alignClass,
          numeric && "font-mono",
          className
        )}
        {...props}
      >
        {children}
      </th>
    );
  }
);
TableHead.displayName = "TableHead";

export interface TableCellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
  numeric?: boolean;
}

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, align, numeric = false, children, ...props }, ref) => {
    const computedAlign = align || (numeric ? "right" : "left");
    const alignClass =
      computedAlign === "right"
        ? "text-right"
        : computedAlign === "center"
        ? "text-center"
        : "text-left";

    return (
      <td
        ref={ref}
        className={cn(
          "px-3.5 py-2.5 align-middle text-zinc-900",
          alignClass,
          numeric && "font-mono tabular-nums text-zinc-950 font-medium",
          className
        )}
        {...props}
      >
        {children}
      </td>
    );
  }
);
TableCell.displayName = "TableCell";

export interface TableEmptyProps {
  colSpan: number;
  message?: string;
  description?: string;
  action?: React.ReactNode;
}

export const TableEmpty: React.FC<TableEmptyProps> = ({
  colSpan,
  message = "Nenhum registro encontrado",
  description = "Tente alterar os filtros de busca ou cadastrar um novo item.",
  action,
}) => (
  <tr>
    <td
      colSpan={colSpan}
      className="h-44 text-center px-4 py-8 text-zinc-500 bg-white"
    >
      <div className="flex flex-col items-center justify-center space-y-2">
        <div className="p-3 bg-zinc-100 rounded-full text-zinc-400">
          <Inbox className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-zinc-800">{message}</p>
        <p className="text-xs text-zinc-500 max-w-sm">{description}</p>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </td>
  </tr>
);
TableEmpty.displayName = "TableEmpty";
