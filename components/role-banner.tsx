'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

type Tone = 'blue' | 'green' | 'violet' | 'amber';

const TONE_STYLES: Record<
  Tone,
  {
    bg: string;
    border: string;
    accent: string;
    chip: string;
  }
> = {
  blue: {
    bg: 'bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent dark:from-blue-600/20 dark:via-indigo-900/10 dark:to-transparent',
    border: 'border-blue-500/20 dark:border-blue-500/30',
    accent: 'text-blue-600 dark:text-blue-400',
    chip: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20',
  },
  green: {
    bg: 'bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-600/20 dark:via-teal-900/10 dark:to-transparent',
    border: 'border-emerald-500/20 dark:border-emerald-500/30',
    accent: 'text-emerald-600 dark:text-emerald-400',
    chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
  },
  violet: {
    bg: 'bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent dark:from-purple-600/20 dark:via-purple-900/10 dark:to-transparent',
    border: 'border-purple-500/20 dark:border-purple-500/30',
    accent: 'text-purple-600 dark:text-purple-400',
    chip: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-600/20 dark:via-amber-900/10 dark:to-transparent',
    border: 'border-amber-500/20 dark:border-amber-500/30',
    accent: 'text-amber-600 dark:text-amber-400',
    chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20',
  },
};

interface QuickAction {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface RoleBannerProps {
  greeting: string;
  subtitle: string;
  tone?: Tone;
  roleLabel: string;
  actions?: QuickAction[];
}

export function RoleBanner({ greeting, subtitle, tone = 'blue', roleLabel, actions }: RoleBannerProps) {
  const styles = TONE_STYLES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-6 shadow-sm backdrop-blur-md',
        styles.bg,
        styles.border
      )}
    >
      {/* Decorative light ring */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <Sparkles className={cn('h-4 w-4', styles.accent)} />
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', styles.chip)}>
              {roleLabel}
            </span>
          </div>
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {greeting}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {actions && actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/80 px-4 py-2 text-sm font-semibold text-foreground shadow-xs backdrop-blur-sm transition-all hover:bg-accent hover:shadow hover:-translate-y-0.5"
              >
                {a.icon}
                {a.label}
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface AttentionItem {
  label: string;
  value: number | string;
  href: string;
  tone?: 'red' | 'amber' | 'blue' | 'green';
  description?: string;
}

interface AttentionSectionProps {
  title: string;
  subtitle?: string;
  items: AttentionItem[];
}

const ATTENTION_TONES = {
  red: {
    bg: 'bg-red-500/10 dark:bg-red-500/15',
    border: 'border-red-500/20 dark:border-red-500/30 hover:border-red-500/40',
    text: 'text-red-700 dark:text-red-300',
    accent: 'text-red-600 dark:text-red-400',
  },
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/20 dark:border-amber-500/30 hover:border-amber-500/40',
    text: 'text-amber-700 dark:text-amber-300',
    accent: 'text-amber-600 dark:text-amber-400',
  },
  blue: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    border: 'border-blue-500/20 dark:border-blue-500/30 hover:border-blue-500/40',
    text: 'text-blue-700 dark:text-blue-300',
    accent: 'text-blue-600 dark:text-blue-400',
  },
  green: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/20 dark:border-emerald-500/30 hover:border-emerald-500/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    accent: 'text-emerald-600 dark:text-emerald-400',
  },
};

export function AttentionSection({ title, subtitle, items }: AttentionSectionProps) {
  if (items.length === 0) return null;
  const countWithPending = items.filter((i) => typeof i.value === 'number' && (i.value as number) > 0).length;

  return (
    <Card className="border border-border/80 bg-card/90 backdrop-blur-sm shadow-xs">
      <CardContent className="p-5">
        <div className="mb-3.5 flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-xs font-bold text-red-600 dark:text-red-400">
            {countWithPending}
          </span>
          <div>
            <h3 className="font-display text-sm font-bold text-foreground">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, idx) => {
            const tone = ATTENTION_TONES[item.tone || 'amber'];
            return (
              <Link
                key={idx}
                href={item.href}
                className={cn(
                  'group flex items-center justify-between rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs',
                  tone.bg,
                  tone.border
                )}
              >
                <div className="min-w-0 pr-2">
                  <p className={cn('text-xs font-bold uppercase tracking-wider', tone.text)}>
                    {item.label}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
                <span className={cn('ml-2 font-display text-2xl font-black tabular-nums transition-transform group-hover:scale-105', tone.accent)}>
                  {item.value}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}