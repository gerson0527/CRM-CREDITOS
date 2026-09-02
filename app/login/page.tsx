'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { Eye, EyeOff, LogIn, Clock, XCircle, PauseCircle, Zap, ShieldCheck, CheckCircle2, ArrowRight, Building2, CreditCard, Landmark, LineChart } from 'lucide-react';
import { STATUS_LABELS } from '@/lib/constants';

const DEMO_ACCOUNTS: Record<string, { role: string; full_name: string; status: string; label: string; color: string }> = {
  'admin@credilibranzas.com': {
    role: 'admin',
    full_name: 'Administrador Principal',
    status: 'activo',
    label: 'Director de Riesgo & Admin',
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25 hover:bg-purple-500/25',
  },
  'supervisor@credilibranzas.com': {
    role: 'supervisor',
    full_name: 'Supervisor de Ventas',
    status: 'activo',
    label: 'Supervisor Comercial',
    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25 hover:bg-blue-500/25',
  },
  'asesor1@credilibranzas.com': {
    role: 'asesor',
    full_name: 'Juan Pérez (Asesor)',
    status: 'activo',
    label: 'Asesor Libranzas (Juan)',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/25',
  },
  'asesor2@credilibranzas.com': {
    role: 'asesor',
    full_name: 'María Rodríguez (Asesor)',
    status: 'activo',
    label: 'Asesor Libranzas (María)',
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25 hover:bg-amber-500/25',
  },
  'asesor3@credilibranzas.com': {
    role: 'asesor',
    full_name: 'Asesor Pendiente',
    status: 'pendiente_aprobacion',
    label: 'Asesor en Aprobación',
    color: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25 hover:bg-rose-500/25',
  },
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();
  const blockedStatus = searchParams.get('blocked');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isLocalEnv = process.env.NODE_ENV !== 'production';

  const loginWithCredentials = async (targetEmail: string, targetPass: string) => {
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: targetPass }),
        credentials: 'include',
      });

      const data = await res.json();
      console.log('[login] API response', {
        status: res.status,
        ok: res.ok,
        error: data.error,
        user: data.user ? { id: data.user.id, role: data.user.role } : undefined,
      });

      if (!res.ok) {
        toast.error('Acceso denegado', { description: data.error });
        setLoading(false);
        return;
      }

      if (data.user?.status && data.user.status !== 'activo') {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/login?blocked=' + data.user.status);
        return;
      }

      await fetch('/api/auth/me', { credentials: 'include' });
      toast.success('Sesión autorizada', { description: `Bienvenido a la consola, ${data.user.full_name}.` });
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error('Error al iniciar sesión', { description: err?.message });
      setLoading(false);
    }
  };

  const DEMO_PASSWORD = 'Credi123456!';

  const handleQuickAccess = (emailVal: string) => {
    setEmail(emailVal);
    setPassword(DEMO_PASSWORD);
    loginWithCredentials(emailVal, DEMO_PASSWORD);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await loginWithCredentials(email, password);
  };

  const blockedMessage = blockedStatus
    ? STATUS_LABELS[blockedStatus as keyof typeof STATUS_LABELS]
    : null;

  const blockedIcon = blockedStatus === 'pendiente_aprobacion' ? Clock : blockedStatus === 'rechazado' ? XCircle : PauseCircle;
  const BlockedIcon = blockedIcon;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-background">
      {/* Left Brand Panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-slate-950 p-8 text-white lg:w-1/2 lg:p-14 selection:bg-primary/30">
        {/* Glowing Background Mesh */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />

        {/* Top Logo */}
        <div className="relative z-10">
          <Logo variant="light" showText={true} />
        </div>

        {/* Center Pitch Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 my-auto py-10 max-w-lg"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sistema Especializado de Créditos de Libranza</span>
          </div>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Plataforma Integral de <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">Gestión & Origuración de Libranzas</span>
          </h1>

          <p className="mt-4 text-base text-slate-300 leading-relaxed">
            Optimiza el ciclo comercial de crédito por descuento de nómina para pensionados, docentes, fuerzas armadas y servidores públicos con trazabilidad institucional en tiempo real.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {[
              { title: 'Gestión por Pagadurías', desc: 'Convenios con entes públicos y privados' },
              { title: 'Pipeline Kanban de Visado', desc: 'Trazabilidad desde radicación a desembolso' },
              { title: 'Scoring & Capacidad', desc: 'Evaluación de margen libre y endeudamiento' },
              { title: 'Liquidación de Comisiones', desc: 'Cálculo automatizado para fuerza comercial' },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{f.title}</p>
                  <p className="text-[11px] text-slate-400">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Footer Security Badge */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
          <span>© 2026 Credilibranzas JG S.A.S.</span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Infraestructura Financiera Segura · SSL 256-bit</span>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10 lg:p-14">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="rounded-3xl border border-border/80 bg-card/80 p-7 sm:p-9 shadow-xl backdrop-blur-md">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Acceso Corporativo
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Ingresa tus credenciales institucionales para acceder a la consola de libranzas.
              </p>
            </div>

            {blockedMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"
              >
                <BlockedIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Acceso restringido</p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                    {blockedStatus === 'pendiente_aprobacion' &&
                      'Tu cuenta de asesor comercial está en validación por la Dirección Operativa.'}
                    {blockedStatus === 'rechazado' &&
                      'Tu solicitud fue denegada. Si consideras que es un error, contacta a Gerencia.'}
                    {blockedStatus === 'inactivo' &&
                      'Tu cuenta institucional se encuentra inactiva. Contacta al administrador del CRM.'}
                  </p>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Correo Institucional
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="asesor@credilibranzas.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 rounded-xl border-border/80 bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Contraseña de Acceso
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Mínimo 6 caracteres</span>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-11 rounded-xl border-border/80 bg-background pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Ver contraseña"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-lg"
                disabled={loading}
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Ingresar a la Consola
                  </>
                )}
              </Button>
            </form>

            {/* Quick Demo Access Pills in Dev */}
            {isLocalEnv && (
              <div className="mt-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                  <Zap className="h-4 w-4 fill-primary text-primary" />
                  <span>Acceso Rápido Demo (1-Click)</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecciona un perfil institucional para iniciar sesión de prueba:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(DEMO_ACCOUNTS).map(([demoEmail, u]) => (
                    <button
                      key={demoEmail}
                      type="button"
                      disabled={loading}
                      onClick={() => handleQuickAccess(demoEmail)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-2xs transition-all active:scale-95 disabled:opacity-50 ${u.color}`}
                    >
                      <span>{u.label}</span>
                      <ArrowRight className="h-3 w-3 opacity-60" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-border/80 pt-4 text-center text-xs text-muted-foreground">
              <span>¿Eres asesor comercial nuevo? </span>
              <Link
                href="/registro"
                className="font-bold text-primary hover:underline"
              >
                Solicita tu vinculación aquí
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
