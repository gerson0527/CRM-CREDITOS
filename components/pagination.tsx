'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  hidePageSize?: boolean;
  className?: string;
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const pages: (number | 'ellipsis')[] = [0];
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);
  if (start > 1) pages.push('ellipsis');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 2) pages.push('ellipsis');
  if (total > 1) pages.push(total - 1);
  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 25, 50, 100],
  itemLabel = 'registros',
  hidePageSize = false,
  className,
}: PaginationProps) {
  const start = totalItems === 0 ? 0 : currentPage * pageSize + 1;
  const end = Math.min((currentPage + 1) * pageSize, totalItems);
  const pageNumbers = useMemo(() => getPageNumbers(currentPage, totalPages), [currentPage, totalPages]);

  if (totalPages <= 0) return null;

  return (
    <div
      className={cn(
        'flex flex-col items-start justify-between gap-3 rounded-2xl border border-border/80 bg-card/60 px-4 py-3 shadow-2xs backdrop-blur-sm sm:flex-row sm:items-center',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          Mostrando <span className="font-bold text-foreground tabular-nums">{start}–{end}</span> de{' '}
          <span className="font-bold text-foreground tabular-nums">{totalItems}</span> {itemLabel}
        </span>
        {!hidePageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Por página:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-7 w-[72px] rounded-lg border-border/80 bg-background text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg border-border/80 shadow-none hover:bg-accent"
          disabled={currentPage === 0}
          onClick={() => onPageChange(0)}
          aria-label="Primera página"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg border-border/80 shadow-none hover:bg-accent"
          disabled={currentPage === 0}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        <div className="flex items-center gap-1 px-1">
          {pageNumbers.map((p, idx) =>
            p === 'ellipsis' ? (
              <span key={`e-${idx}`} className="px-2 text-xs text-muted-foreground">…</span>
            ) : (
              <Button
                key={p}
                variant={p === currentPage ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-8 min-w-[32px] rounded-lg px-2.5 text-xs font-semibold tabular-nums shadow-none transition-all',
                  p === currentPage
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border-border/80 hover:bg-accent'
                )}
                onClick={() => onPageChange(p)}
              >
                {p + 1}
              </Button>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg border-border/80 shadow-none hover:bg-accent"
          disabled={currentPage >= totalPages - 1}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg border-border/80 shadow-none hover:bg-accent"
          disabled={currentPage >= totalPages - 1}
          onClick={() => onPageChange(totalPages - 1)}
          aria-label="Última página"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}