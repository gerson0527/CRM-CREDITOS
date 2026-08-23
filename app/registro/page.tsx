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
import { Eye, EyeOff, UserPlus, CheckCircle2, Phone, Mail, User, ArrowLeft } from 'lucide-react';

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
          toast.error('Este email ya está registrado', {
            description: 'Intenta iniciar sesión o usa otro email.',
          });
        } else {
          toast.error('Error al registrarse', { description: error.message });
        }
        return;
      }

      if (data.user) {
        setSuccess(true);
        toast.success('Cuenta creada', {
          description: 'Tu solicitud está pendiente de aprobación.',
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl border bg-card p-8 text-center shadow-lg">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100"
            >
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </motion.div>

            <h2 className="text-2xl font-semibold">¡Cuenta creada!</h2>
            <p className="mt-2 text-muted-foreground">
              Tu cuenta fue creada y está <strong>pendiente de aprobación</strong> por
              un administrador. Recibirás acceso al sistema una vez sea aprobada.
            </p>

            <div className="mt-6 rounded-lg bg-accent p-4 text-left">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Datos de tu registro:</strong>
                <br />
                Nombre: {fullName}
                <br />
                Email: {email}
                <br />
                Teléfono: {phone || 'No proporcionado'}
              </p>
            </div>

            <Button
              onClick={() => router.push('/login')}
              className="mt-6 w-full"
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio de sesión
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left brand panel */}
      <div className="relative hidden flex-col justify-between bg-gradient-to-br from-primary to-primary/80 p-12 text-white lg:flex lg:w-1/2">
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
            Únete a nuestro equipo
          </h1>
          <p className="mt-3 text-white/80">
            Regístrate como asesor y comienza a gestionar tus créditos de
            manera profesional. Tu cuenta será revisada por un administrador.
          </p>

          <div className="mt-8 space-y-3">
            {[
              'Gestiona tus clientes y solicitudes',
              'Visualiza tu pipeline de créditos',
              'Controla tus comisiones y metas',
              'Mantén un seguimiento profesional',
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
          <div className="mb-6 lg:hidden">
            <Logo showText={true} />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Crear cuenta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Regístrate como asesor. Tu cuenta será revisada por un administrador.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+57 300 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
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
                  <UserPlus className="mr-2 h-4 w-4" />
                  Registrarme
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t pt-4 text-center text-sm">
            <span className="text-muted-foreground">¿Ya tienes cuenta? </span>
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Inicia sesión
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
