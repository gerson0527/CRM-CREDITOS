import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const PALETTE: { bg: string; text: string }[] = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}

interface UserAvatarProps {
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP: Record<NonNullable<UserAvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
};

export function UserAvatar({ name, className, size = 'md' }: UserAvatarProps) {
  const palette = PALETTE[hashString(name || '') % PALETTE.length];
  return (
    <Avatar className={cn(SIZE_MAP[size], className)}>
      <AvatarFallback className={cn('font-semibold', palette.bg, palette.text)}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}