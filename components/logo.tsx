'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  variant?: 'light' | 'dark';
  size?: 'sm' | 'lg';
}

export function Logo({ className, showText = true, variant = 'dark', size = 'sm' }: LogoProps) {
  // Si no existe /public/logo-credilibranzas.png, caemos al SVG estilizado original.
  const [imgError, setImgError] = useState(false);
  const useImage = !imgError;

  const iconBox = size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const titleSize = size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-base';
  const badgeSize = size === 'lg' ? 'text-xs px-2 py-0.5' : 'text-[9px] px-1 py-0.5';
  const subtitleSize = size === 'lg' ? 'text-xs mt-1' : 'text-[9px] mt-0.5';
  const rowGap = size === 'lg' ? 'gap-3' : 'gap-1.5';
  const outerGap = size === 'lg' ? 'gap-4' : 'gap-3';

  return (
    <div className={cn('flex items-center select-none', outerGap, className)}>
      {useImage ? (
        <img
          src="/logo-credilibranzas.png"
          alt="Credilibranzas"
          className={cn(
            'shrink-0 rounded-xl object-contain bg-white shadow-sm shadow-primary/10 ring-1 ring-border/40',
            iconBox
          )}
          onError={() => setImgError(true)}
          draggable={false}
        />
      ) : (
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary via-blue-600 to-indigo-500 shadow-md shadow-primary/20',
            iconBox
          )}
        >
          <svg
            width={size === 'lg' ? 30 : 22}
            height={size === 'lg' ? 30 : 22}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white"
          >
            <path
              d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-90"
            />
            <path
              d="M12 8V16M8 10L16 14M16 10L8 14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
        </div>
      )}

      {showText && (
        <div className="flex flex-col leading-none">
          <div className={cn('flex items-center', rowGap)}>
            <span
              className={cn(
                'font-display font-extrabold tracking-tight',
                titleSize,
                variant === 'light' ? 'text-white' : 'text-slate-900 dark:text-white'
              )}
            >
              Credilibranzas
            </span>
            <span
              className={cn(
                'rounded bg-primary/10 font-black uppercase tracking-wider text-primary dark:bg-primary/20',
                badgeSize
              )}
            >
              JG
            </span>
          </div>
          <span
            className={cn(
              'font-semibold tracking-widest uppercase',
              subtitleSize,
              variant === 'light' ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'
            )}
          >
            Tu Aliado Financiero
          </span>
        </div>
      )}
    </div>
  );
}
