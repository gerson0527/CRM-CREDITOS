'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, UserPlus, CheckCircle2, Phone, Mail, User, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Este correo ya está registrado', {
            description: 'Intenta iniciar sesión o utiliza otro correo.',
          });
        } else {
          toast.error('Error al registrarse', { description: error.message });
        }
        return;
      }

      if (data?.user) {
        setSuccess(true);
        toast.success('Cuenta creada exitosamente', {
          description: 'Tu solicitud se encuentra en proceso de validación.',
        });
      }
    } catch {
      toast.error('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="rounded-3xl border border-border/80 bg-card/90 p-8 text-center shadow-xl backdrop-blur-md">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/10"
            >
              <CheckCircle2 className="h-10 w-10" />
            </motion.div>

            <h2 className="font-display text-2xl font-bold text-foreground">¡Solicitud Enviada!</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Tu cuenta fue creada con éxito y está <strong className="text-foreground">pendiente de validación</strong> por la administración. Recibirás una notificación en cuanto sea habilitada.
            </p>

            <div className="mt-6 rounded-2xl border border-border/70 bg-accent/40 p-4 text-left text-xs leading-relaxed">
              <p className="font-bold text-foreground mb-1">Resumen de tu registro:</p>
              <p className="text-muted-foreground">
                <strong className="text-foreground/80">Nombre:</strong> {fullName}
                <br />
                <strong className="text-foreground/80">Correo:</strong> {email}
                <br />
                <strong className="text-foreground/80">Teléfono:</strong> {phone || 'No especificado'}
              </p>
            </div>

            <Button
              onClick={() => router.push('/login')}
              className="mt-6 w-full rounded-xl bg-primary text-sm font-bold shadow-md shadow-primary/20"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ir a Iniciar Sesión
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-background">
      {/* Left Brand Panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:w-1/2 selection:bg-primary/30">
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />

        <div className="relative z-10">
          <Logo variant="light" showText={true} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 my-auto py-10 max-w-lg"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Únete al Equipo Comercial</span>
          </div>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Impulsa tus ventas de <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">créditos y libranzas</span>
          </h1>

          <p className="mt-4 text-base text-slate-300 leading-relaxed">
            Regístrate como asesor y accede a herramientas de cotización rápida, gestión de clientes, seguimiento en tiempo real y comisiones transparentes.
          </p>
        </motion.div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
          <span>© 2026 Credilibranzas JG</span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Protocolo de Protección de Datos</span>
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
            <div className="mb-6 lg:hidden">
              <Logo showText={true} />
            </div>

            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Crear cuenta
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Regístrate como asesor comercial para comenzar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Nombre Completo
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Ej. Carlos Mendoza"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-11 pl-10 rounded-xl border-border/80 bg-background text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Teléfono / WhatsApp
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+57 300 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 pl-10 rounded-xl border-border/80 bg-background text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Correo Electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="asesor@credilibranzas.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 pl-10 rounded-xl border-border/80 bg-background text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Contraseña
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
                    minLength={6}
                    className="h-11 pr-10 rounded-xl border-border/80 bg-background text-sm"
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
                    <UserPlus className="mr-2 h-4 w-4" />
                    Enviar Solicitud de Registro
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 border-t border-border/80 pt-4 text-center text-xs text-muted-foreground">
              <span>¿Ya posees una cuenta activa? </span>
              <Link
                href="/login"
                className="font-bold text-primary hover:underline"
              >
                Inicia sesión aquí
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

