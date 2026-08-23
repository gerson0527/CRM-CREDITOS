import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  variant?: 'light' | 'dark';
}

export function Logo({ className, showText = true, variant = 'dark' }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        width="36"
        height="36"
        viewBox="0 0 40 40"
        fill="none"
        className="shrink-0"
      >
        {/* Central figure in blue */}
        <circle cx="20" cy="13" r="4.5" fill="hsl(var(--primary))" />
        <path
          d="M13 32c0-4.5 3-8 7-8s7 3.5 7 8"
          stroke="hsl(var(--primary))"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        {/* Left figure in green */}
        <circle cx="7" cy="16" r="3.2" fill="hsl(var(--secondary))" />
        <path
          d="M3 31c0-3 2-5.5 4.5-5.5"
          stroke="hsl(var(--secondary))"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Right figure in green */}
        <circle cx="33" cy="16" r="3.2" fill="hsl(var(--secondary))" />
        <path
          d="M29 31c0-3 2-5.5 4.5-5.5"
          stroke="hsl(var(--secondary))"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-brand text-base ${variant === 'light' ? 'text-white' : 'text-foreground'}`}>
            Credilibranzas
          </span>
          <span className={`text-[10px] font-semibold tracking-widest ${variant === 'light' ? 'text-white/70' : 'text-muted-foreground'}`}>
            JG · TU ALIADO FINANCIERO
          </span>
        </div>
      )}
    </div>
  );
}
