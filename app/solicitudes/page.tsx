'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Check, X, Clock, UserPlus, Mail, Phone } from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { RouteGuard } from '@/components/providers/route-guard';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { STATUS_LABELS } from '@/lib/constants';
import type { Profile, UserStatus } from '@/lib/types';

export default function PendingRequestsPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <AppLayout>
        <PendingRequests />
      </AppLayout>
    </RouteGuard>
  );
}

function PendingRequests() {
  const { refreshProfile } = useAuth();
  const [pending, setPending] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [supervisors, setSupervisors] = useState<Profile[]>([]);
  const [assignModal, setAssignModal] = useState<Profile | null>(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: pendingData } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'pendiente_aprobacion')
      .order('created_at', { ascending: false });

    const { data: sups } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'supervisor')
      .eq('status', 'activo');

    setPending(pendingData as Profile[] || []);
    setSupervisors(sups as Profile[] || []);
    setLoading(false);
  }

  async function approve(user: Profile) {
    setProcessing(user.id);
    const update: Partial<Profile> = { status: 'activo' as UserStatus };
    if (selectedSupervisor) update.supervisor_id = selectedSupervisor;

    const { error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', user.id);

    if (error) {
      toast.error('Error al aprobar usuario');
      setProcessing(null);
      return;
    }

    toast.success('Usuario aprobado', { description: `${user.full_name} ya puede iniciar sesión.` });
    setAssignModal(null);
    setSelectedSupervisor('');
    setProcessing(null);
    loadData();
  }

  async function reject(user: Profile) {
    setProcessing(user.id);
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'rechazado' as UserStatus })
      .eq('id', user.id);

    if (error) {
      toast.error('Error al rechazar usuario');
      setProcessing(null);
      return;
    }

    toast.success('Solicitud rechazada');
    setProcessing(null);
    loadData();
  }

  return (
    <PageTransition>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Solicitudes de acceso</h1>
        <p className="text-sm text-muted-foreground">Asesores pendientes de aprobación.</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : pending.length === 0 ? (
        <motion.div
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-lg font-medium">No hay solicitudes pendientes</p>
          <p className="text-sm text-muted-foreground">Todos los registros han sido revisados.</p>
        </motion.div>
      ) : (
        <StaggerList className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {pending.map((user) => (
            <StaggerItem key={user.id}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user.full_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{user.full_name}</p>
                      <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" />
                          {/* We don't have email in profiles, show phone */}
                          <Phone className="h-3.5 w-3.5" />
                          <span>{user.phone || 'Sin teléfono'}</span>
                        </div>
                      </div>
                      <Badge className="mt-2 bg-amber-100 text-amber-700 hover:bg-amber-100">
                        <Clock className="mr-1 h-3 w-3" />
                        {STATUS_LABELS[user.status]}
                      </Badge>
                    </div>
                  </div>

                  {/* Assign supervisor + approve */}
                  {assignModal?.id === user.id ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 space-y-3 border-t pt-4"
                    >
                      <div className="space-y-1.5">
                        <Label className="text-xs">Asignar a supervisor (opcional)</Label>
                        <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                          <SelectTrigger><SelectValue placeholder="Sin supervisor" /></SelectTrigger>
                          <SelectContent>
                            {supervisors.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approve(user)} disabled={processing === user.id}>
                          {processing === user.id ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                          Confirmar aprobación
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAssignModal(null); setSelectedSupervisor(''); }}>
                          Cancelar
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" onClick={() => setAssignModal(user)}>
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Aprobar
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => reject(user)} disabled={processing === user.id}>
                        <X className="mr-1 h-3.5 w-3.5" />
                        Rechazar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </PageTransition>
  );
}
