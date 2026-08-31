'use client';

import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedCounter } from '@/components/animated-counter';
import { Card, CardContent } from '@/components/ui/card';

type Tone = 'blue' | 'green' | 'emerald' | 'violet' | 'amber' | 'red' | 'slate';

const TONE_STYLES: Record<
  Tone,
  {
    bg: string;
    text: string;
    glow: string;
    border: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  blue: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
    text: 'text-blue-600 dark:text-blue-400',
    glow: 'from-blue-500/10 to-indigo-500/5',
    border: 'hover:border-blue-500/30',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-700 dark:text-blue-300',
  },
  green: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    glow: 'from-emerald-500/10 to-teal-500/5',
    border: 'hover:border-emerald-500/30',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    glow: 'from-emerald-500/10 to-teal-500/5',
    border: 'hover:border-emerald-500/30',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  violet: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
    text: 'text-purple-600 dark:text-purple-400',
    glow: 'from-purple-500/10 to-pink-500/5',
    border: 'hover:border-purple-500/30',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-700 dark:text-purple-300',
  },
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    glow: 'from-amber-500/10 to-orange-500/5',
    border: 'hover:border-amber-500/30',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  red: {
    bg: 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400',
    text: 'text-red-600 dark:text-red-400',
    glow: 'from-red-500/10 to-rose-500/5',
    border: 'hover:border-red-500/30',
    badgeBg: 'bg-red-500/10',
    badgeText: 'text-red-700 dark:text-red-300',
  },
  slate: {
    bg: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
    glow: 'from-slate-500/10 to-slate-500/5',
    border: 'hover:border-slate-500/30',
    badgeBg: 'bg-slate-500/10',
    badgeText: 'text-slate-700 dark:text-slate-300',
  },
};

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: Tone;
  format?: (n: number) => string;
  change?: number | null;
  changeLabel?: string;
  footer?: string;
}

export function KpiCard({
  label,
  value,
  icon,
  tone = 'blue',
  format,
  change,
  changeLabel,
  footer,
}: KpiCardProps) {
  const styles = TONE_STYLES[tone];
  const showChange = change !== undefined && change !== null;
  const isUp = showChange && change! > 0;
  const isDown = showChange && change! < 0;
  const isFlat = showChange && change === 0;

  return (
    <Card
      className={cn(
        'group relative h-full overflow-hidden border border-border/80 bg-card/90 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
        styles.border
      )}
    >
      {/* Ambient background glow on top right */}
      <div
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-80',
          styles.glow
        )}
      />

      <CardContent className="relative flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="mt-2 text-2xl font-black tracking-tight text-foreground font-display sm:text-3xl tabular-nums"
            >
              <AnimatedCounter value={value} format={format} />
            </motion.p>
          </div>

          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-xs transition-transform duration-300 group-hover:scale-105',
              styles.bg
            )}
          >
            {icon}
          </div>
        </div>

        {(showChange || footer) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {showChange && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold tracking-tight shadow-2xs',
                  isUp && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
                  isDown && 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20',
                  isFlat && 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/20'
                )}
              >
                {isUp && <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />}
                {isDown && <ArrowDownRight className="h-3.5 w-3.5 stroke-[2.5]" />}
                {isFlat && <Minus className="h-3.5 w-3.5 stroke-[2.5]" />}
                {isUp ? '+' : ''}
                {change!.toFixed(1)}%
              </span>
            )}
            {(changeLabel || footer) && (
              <span className="text-muted-foreground text-[11px] font-medium truncate">
                {changeLabel || footer}
              </span>
            )}
          </div>
        )}

        {(showChange || footer) && <div className="mt-auto" />}
      </CardContent>
    </Card>
  );
}