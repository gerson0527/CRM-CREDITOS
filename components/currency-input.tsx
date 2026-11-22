'use client';

import { Input } from '@/components/ui/input';

interface CurrencyInputProps {
  value: string | number | null | undefined;
  onValueChange: (raw: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  required?: boolean;
}

/**
 * Input para valores monetarios: guarda solo los dígitos en el estado y
 * muestra el número con separador de miles de Colombia (1.000.000).
 */
export function CurrencyInput({
  value,
  onValueChange,
  placeholder,
  disabled,
  className,
  id,
  name,
  min,
  max,
  required,
}: CurrencyInputProps) {
  const raw = value === null || value === undefined ? '' : String(value).replace(/\D/g, '');
  const display = raw ? Number(raw).toLocaleString('es-CO') : '';

  return (
    <Input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={display}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      min={min}
      max={max}
      required={required}
      onChange={(e) => onValueChange(e.target.value.replace(/\D/g, ''))}
    />
  );
}
