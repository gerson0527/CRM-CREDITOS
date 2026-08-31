'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/app-layout';
import { PageTransition } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { Profile } from '@/lib/types';

export default function NuevoClientePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [asesores, setAsesores] = useState<Profile[]>([]);
  const [data, setData] = useState({
    first_name: '',
    last_name: '',
    document_number: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    reported_income: '',
    asesor_id: '',
  });

  // Cargar asesores disponibles (solo admin)
  useState(() => {
    if (profile?.role === 'admin') {
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'asesor')
        .eq('status', 'activo')
        .then(({ data }) => setAsesores((data as Profile[]) || []));
    }
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;

    if (!data.first_name || !data.last_name || !data.document_number) {
      toast.error('Completa los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      const assignedAsesor = data.asesor_id || profile.id;
      const { data: created, error } = await supabase
        .from('clients')
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          document_number: data.document_number,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          city: data.city || null,
          reported_income: parseFloat(data.reported_income) || 0,
          created_by: assignedAsesor,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Cliente creado', {
        description: `${data.first_name} ${data.last_name} fue registrado.`,
      });
      router.push(`/clientes/${created.id}`);
    } catch (err: any) {
      toast.error('Error al crear cliente', { description: err?.message });
    } finally {
      setLoading(false);
    }
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <AppLayout>
      <PageTransition>
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/clientes')}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        </div>

        <PageHeader
          title="Nuevo cliente"
          description="Registra un cliente y luego podrás asociarlo a créditos."
        />

        <Card className="mx-auto max-w-2xl">
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-5">
              {isAdmin && (
                <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Como administrador, puedes asignar este cliente a un asesor específico.
                    Si no eliges ninguno, quedará asignado a tu cuenta.
                  </span>
                </div>
              )}

              {isAdmin && (
                <div className="space-y-2">
                  <Label>Asesor asignado</Label>
                  <Select
                    value={data.asesor_id || 'self'}
                    onValueChange={(v) => setData({ ...data, asesor_id: v === 'self' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar asesor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Asignarme a mí</SelectItem>
                      {asesores.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={data.first_name}
                    onChange={(e) => setData({ ...data, first_name: e.target.value })}
                    placeholder="Andrea"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos *</Label>
                  <Input
                    value={data.last_name}
                    onChange={(e) => setData({ ...data, last_name: e.target.value })}
                    placeholder="López García"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cédula *</Label>
                  <Input
                    value={data.document_number}
                    onChange={(e) => setData({ ...data, document_number: e.target.value })}
                    placeholder="1034567890"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={data.phone}
                    onChange={(e) => setData({ ...data, phone: e.target.value })}
                    placeholder="+57 300 123 4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={data.email}
                    onChange={(e) => setData({ ...data, email: e.target.value })}
                    placeholder="cliente@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input
                    value={data.city}
                    onChange={(e) => setData({ ...data, city: e.target.value })}
                    placeholder="Bogotá"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Dirección</Label>
                  <Input
                    value={data.address}
                    onChange={(e) => setData({ ...data, address: e.target.value })}
                    placeholder="Calle 45 #23-10"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Ingresos reportados (COP)</Label>
                  <Input
                    type="number"
                    value={data.reported_income}
                    onChange={(e) => setData({ ...data, reported_income: e.target.value })}
                    placeholder="3500000"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/clientes')}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Crear cliente
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </PageTransition>
    </AppLayout>
  );
}