'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Check, X, Clock, UserPlus, Mail, Phone } from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { RouteGuard } from '@/components/providers/route-guard';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { UserAvatar } from '@/components/user-avatar';
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
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(9);

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
      toast.error('Error al aprobar usuario', { description: error.message });
      setProcessing(null);
      return;
    }

    toast.success('Usuario aprobado', { description: `${user.full_name} ya puede iniciar sesión.` });
    setAssignModal(null);
    setSelectedSupervisor('');
    setProcessing(null);
    loadData();
    await refreshProfile();
  }

  async function reject(user: Profile) {
    setProcessing(user.id);
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'rechazado' })
      .eq('id', user.id);

    if (error) {
      toast.error('Error al rechazar usuario', { description: error.message });
      setProcessing(null);
      return;
    }

    toast.success('Solicitud rechazada');
    setProcessing(null);
    loadData();
  }

  return (
    <PageTransition>
      <PageHeader
        title="Solicitudes de Acceso y Registro"
        description="Gestión y aprobación de nuevos asesores comerciales pendientes de activación."
      />

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
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Check className="h-8 w-8" />
          </div>
          <p className="font-display text-lg font-bold text-foreground">No hay solicitudes pendientes</p>
          <p className="text-xs text-muted-foreground mt-1">Todos los registros han sido evaluados y procesados.</p>
        </motion.div>
      ) : (
        <>
          <StaggerList className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pending.slice(page * pageSize, (page + 1) * pageSize).map((user) => (
              <StaggerItem key={user.id}>
                <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3.5">
                      <UserAvatar name={user.full_name} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-sm font-bold text-foreground truncate">{user.full_name}</p>
                        <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{user.phone || 'Sin teléfono registrado'}</span>
                          </div>
                        </div>
                        <Badge className="mt-2.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px] font-bold shadow-none">
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
                        className="mt-4 space-y-3 border-t border-border/70 pt-4"
                      >
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Asignar Supervisor</Label>
                          <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                            <SelectTrigger className="h-10 rounded-xl bg-background text-xs"><SelectValue placeholder="Sin supervisor" /></SelectTrigger>
                            <SelectContent>
                              {supervisors.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => approve(user)} disabled={processing === user.id} className="rounded-xl text-xs font-bold">
                            {processing === user.id ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              <Check className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Confirmar Aprobación
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setAssignModal(null); setSelectedSupervisor(''); }} className="rounded-xl text-xs font-bold">
                            Cancelar
                          </Button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="mt-4 flex gap-2 border-t border-border/60 pt-3">
                        <Button size="sm" onClick={() => setAssignModal(user)} className="rounded-xl text-xs font-bold">
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs font-bold text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => reject(user)}
                          disabled={processing === user.id}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerList>
          <Pagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(pending.length / pageSize))}
            totalItems={pending.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            itemLabel="solicitudes"
            className="mt-5"
          />
        </>
      )}
    </PageTransition>
  );
}