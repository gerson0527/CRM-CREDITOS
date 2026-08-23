import { cn } from '@/lib/utils';
import { CREDIT_STATUS_MAP } from '@/lib/constants';
import type { CreditStatus } from '@/lib/types';
import { motion } from 'framer-motion';

interface StatusBadgeProps {
  status: CreditStatus;
  className?: string;
  animate?: boolean;
}

export function StatusBadge({ status, className, animate = false }: StatusBadgeProps) {
  const config = CREDIT_STATUS_MAP[status];
  if (!config) return null;

  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.bgColor,
        config.textColor,
        config.borderColor,
        className
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  );

  if (animate) {
    return (
      <motion.span
        key={status}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="inline-block"
      >
        {content}
      </motion.span>
    );
  }

  return content;
}
