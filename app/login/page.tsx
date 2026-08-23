'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, LogIn, AlertCircle, Clock, XCircle, PauseCircle } from 'lucide-react';
import { STATUS_LABELS } from '@/lib/constants';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const blockedStatus = searchParams.get('blocked');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error('Credenciales incorrectas', {
          description: 'Verifica tu email y contraseña.',
        });
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile && profile.status !== 'activo') {
          await supabase.auth.signOut();
          router.replace('/login?blocked=' + profile.status);
          return;
        }

        toast.success('Bienvenido', { description: 'Sesión iniciada correctamente.' });
        router.replace('/dashboard');
      }
    } catch {
      toast.error('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const blockedMessage = blockedStatus
    ? STATUS_LABELS[blockedStatus as keyof typeof STATUS_LABELS]
    : null;

  const blockedIcon = blockedStatus === 'pendiente_aprobacion' ? Clock : blockedStatus === 'rechazado' ? XCircle : PauseCircle;
  const BlockedIcon = blockedIcon;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left brand panel */}
      <div className="relative flex flex-col justify-between bg-gradient-to-br from-primary to-primary/80 p-8 text-white lg:w-1/2 lg:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60" />
        <div className="relative z-10">
          <Logo variant="light" showText={true} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-md"
        >
          <h1 className="font-brand text-3xl leading-tight lg:text-4xl">
            Tu aliado financiero
          </h1>
          <p className="mt-3 text-white/80">
            Gestiona tus créditos, clientes y comisiones en un solo lugar.
            Optimiza tu pipeline de colocación crediticia.
          </p>

          <div className="mt-8 space-y-3">
            {[
              'Pipeline visual tipo Kanban de créditos',
              'Dashboard con métricas en tiempo real',
              'Gestión de clientes y documentación',
              'Seguimiento y recordatorios automáticos',
            ].map((feature, i) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l2.5 2.5L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-sm text-white/90">{feature}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="relative z-10 text-sm text-white/60">
          © 2026 Credilibranzas JG. Todos los derechos reservados.
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <h2 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa tus credenciales para acceder al CRM.
          </p>

          {blockedMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4"
            >
              <BlockedIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">Acceso restringido</p>
                <p className="text-sm text-amber-700">
                  {blockedStatus === 'pendiente_aprobacion' &&
                    'Tu cuenta está pendiente de aprobación por un administrador. Te avisaremos cuando sea aprobada.'}
                  {blockedStatus === 'rechazado' &&
                    'Tu solicitud de acceso ha sido rechazada. Contacta al administrador si crees que es un error.'}
                  {blockedStatus === 'inactivo' &&
                    'Tu cuenta ha sido desactivada. Contacta al administrador para reactivarla.'}
                </p>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <span className="text-xs text-muted-foreground">Mínimo 6 caracteres</span>
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
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={loading}
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Ingresar
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t pt-4 text-center text-sm">
            <span className="text-muted-foreground">¿No tienes cuenta? </span>
            <Link
              href="/registro"
              className="font-medium text-primary hover:underline"
            >
              Regístrate como asesor
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
