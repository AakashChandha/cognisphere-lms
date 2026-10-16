import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** For action cells: clicks inside must not trigger `onRowClick`. */
  stopRowClick?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  skeletonRows?: number;
  /** Makes the whole row clickable (hover background, pointer, Enter key). */
  onRowClick?: (row: T) => void;
  rowAriaLabel?: (row: T) => string;
  /**
   * Phone layout. When given, the table is shown from `md` up and a stacked
   * list of cards below it, so a wide table never forces the page to scroll
   * sideways. Interactive elements inside the card should stop propagation
   * if the row itself is clickable.
   */
  renderCard?: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  emptyTitle = "No results found",
  emptyDescription = "Try adjusting your search or filters.",
  skeletonRows = 5,
  onRowClick,
  rowAriaLabel,
  renderCard,
}: DataTableProps<T>) {
  if (isError) {
    return <ErrorState description={errorMessage} onRetry={onRetry} />;
  }

  const isEmpty = !isLoading && data.length === 0;

  const emptyState = isEmpty ? (
    <EmptyState title={emptyTitle} description={emptyDescription} className="rounded-none border-0 border-t" />
  ) : null;

  const table = (
    <div className={cn("w-full max-w-full overflow-hidden rounded-lg border border-border", renderCard && "hidden md:block")}>
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead key={column.id} className={column.headerClassName}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`}>
                    {columns.map((column) => (
                      <TableCell key={column.id}>
                        <Skeleton className="h-5 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    className={cn(onRowClick && "cursor-pointer")}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={onRowClick && rowAriaLabel ? rowAriaLabel(row) : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" && event.target === event.currentTarget) {
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(column.className, column.stopRowClick && "cursor-default")}
                        onClick={column.stopRowClick ? (event) => event.stopPropagation() : undefined}
                        onKeyDown={column.stopRowClick ? (event) => event.stopPropagation() : undefined}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      {emptyState}
    </div>
  );

  if (!renderCard) return table;

  return (
    <>
      {table}
      <div className="w-full max-w-full md:hidden">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: Math.min(skeletonRows, 4) }).map((_, index) => (
              <Skeleton key={`card-skeleton-${index}`} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="overflow-hidden rounded-lg border border-border">{emptyState}</div>
        ) : (
          <ul className="space-y-3">
            {data.map((row) => (
              <li key={rowKey(row)}>
                <div
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowAriaLabel ? rowAriaLabel(row) : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 text-sm",
                    onRowClick &&
                      "cursor-pointer transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  )}
                >
                  {renderCard(row)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
