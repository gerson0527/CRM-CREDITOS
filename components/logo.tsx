import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  variant?: 'light' | 'dark';
}

export function Logo({ className, showText = true, variant = 'dark' }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary via-blue-600 to-indigo-500 shadow-md shadow-primary/20">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-white"
        >
          {/* Stylized interconnected nodes & growth path */}
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

      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'font-display text-base font-extrabold tracking-tight',
                variant === 'light' ? 'text-white' : 'text-slate-900 dark:text-white'
              )}
            >
              Credilibranzas
            </span>
            <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary dark:bg-primary/20">
              JG
            </span>
          </div>
          <span
            className={cn(
              'text-[9px] font-semibold tracking-widest uppercase mt-0.5',
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

