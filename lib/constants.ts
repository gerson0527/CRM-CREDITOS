import type { CreditStatus, UserStatus, UserRole } from './types';

export const CREDIT_STATUSES: { value: CreditStatus; label: string; color: string; bgColor: string; textColor: string; borderColor: string }[] = [
  { value: 'lead', label: 'Lead / Prospecto', color: '#64748b', bgColor: 'bg-slate-100', textColor: 'text-slate-700', borderColor: 'border-slate-300' },
  { value: 'documentacion', label: 'Documentación', color: '#3b82f6', bgColor: 'bg-blue-100', textColor: 'text-blue-700', borderColor: 'border-blue-300' },
  { value: 'enviado', label: 'Enviado', color: '#8b5cf6', bgColor: 'bg-violet-100', textColor: 'text-violet-700', borderColor: 'border-violet-300' },
  { value: 'estudio', label: 'En Estudio', color: '#f59e0b', bgColor: 'bg-amber-100', textColor: 'text-amber-700', borderColor: 'border-amber-300' },
  { value: 'aprobado', label: 'Aprobado', color: '#22c55e', bgColor: 'bg-green-100', textColor: 'text-green-700', borderColor: 'border-green-300' },
  { value: 'desembolsado', label: 'Desembolsado', color: '#16a34a', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700', borderColor: 'border-emerald-300' },
  { value: 'rechazado', label: 'Rechazado', color: '#ef4444', bgColor: 'bg-red-100', textColor: 'text-red-700', borderColor: 'border-red-300' },
  { value: 'desistido', label: 'Desistido', color: '#94a3b8', bgColor: 'bg-gray-200', textColor: 'text-gray-600', borderColor: 'border-gray-300' },
];

export const CREDIT_STATUS_MAP = CREDIT_STATUSES.reduce((acc, s) => {
  acc[s.value] = s;
  return acc;
}, {} as Record<CreditStatus, typeof CREDIT_STATUSES[0]>);

export const PIPELINE_ORDER: CreditStatus[] = [
  'lead',
  'documentacion',
  'enviado',
  'estudio',
  'aprobado',
  'desembolsado',
  'rechazado',
  'desistido',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  asesor: 'Asesor',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  pendiente_aprobacion: 'Pendiente de aprobación',
  activo: 'Activo',
  rechazado: 'Rechazado',
  inactivo: 'Inactivo',
};

export const STATUS_STYLES: Record<UserStatus, { bgColor: string; textColor: string }> = {
  pendiente_aprobacion: { bgColor: 'bg-amber-100', textColor: 'text-amber-700' },
  activo: { bgColor: 'bg-green-100', textColor: 'text-green-700' },
  rechazado: { bgColor: 'bg-red-100', textColor: 'text-red-700' },
  inactivo: { bgColor: 'bg-gray-200', textColor: 'text-gray-600' },
};

export const FOLLOW_UP_CHANNELS = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'visita', label: 'Visita' },
  { value: 'email', label: 'Email' },
];

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateShort(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString('es-CO', { month: 'short' }).replace(/\./g, '');
  const year = d.getFullYear().toString().slice(-2);
  return `${day} ${month} ${year}`;
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatTime(date: string | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

export function daysSince(date: string): number {
  const diff = Date.now() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
