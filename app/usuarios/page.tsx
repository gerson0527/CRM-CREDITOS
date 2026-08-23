'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Search, UserCog, Shield, Users as UsersIcon } from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { RouteGuard } from '@/components/providers/route-guard';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase/client';
import { ROLE_LABELS, STATUS_LABELS, STATUS_STYLES, formatDate, formatCurrency } from '@/lib/constants';
import type { Profile, UserRole, UserStatus } from '@/lib/types';

export default function UsersPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <AppLayout>
        <UserManagement />
      </AppLayout>
    </RouteGuard>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [supervisors, setSupervisors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { data: sups } = await supabase.from('profiles').select('*').eq('role', 'supervisor').eq('status', 'activo');
    setUsers(data as Profile[] || []);
    setSupervisors(sups as Profile[] || []);
    setLoading(false);
  }

  async function updateStatus(user: Profile, newStatus: UserStatus) {
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id);
    if (error) { toast.error('Error al actualizar'); return; }
    toast.success('Usuario actualizado');
    loadData();
  }

  async function updateRole(user: Profile, newRole: UserRole) {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id);
    if (error) { toast.error('Error al actualizar rol'); return; }
    toast.success('Rol actualizado');
    loadData();
  }

  async function updateSupervisor(user: Profile, supervisorId: string) {
    const { error } = await supabase.from('profiles').update({ supervisor_id: supervisorId || null }).eq('id', user.id);
    if (error) { toast.error('Error'); return; }
    toast.success('Supervisor asignado');
    loadData();
  }

  async function updateGoal(user: Profile, goal: number) {
    const { error } = await supabase.from('profiles').update({ monthly_goal: goal }).eq('id', user.id);
    if (error) { toast.error('Error'); return; }
    toast.success('Meta actualizada');
    loadData();
  }

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <PageTransition>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Gestión de usuarios</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} usuarios en total.</p>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: users.length, icon: <UsersIcon className="h-4 w-4" />, color: 'text-blue-600' },
          { label: 'Activos', value: users.filter((u) => u.status === 'activo').length, icon: <Shield className="h-4 w-4" />, color: 'text-green-600' },
          { label: 'Pendientes', value: users.filter((u) => u.status === 'pendiente_aprobacion').length, icon: <UserCog className="h-4 w-4" />, color: 'text-amber-600' },
          { label: 'Inactivos', value: users.filter((u) => u.status === 'inactivo').length, icon: <UserCog className="h-4 w-4" />, color: 'text-gray-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted ${s.color}`}>{s.icon}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue placeholder="Todos los roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="asesor">Asesor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Todos los estados" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="pendiente_aprobacion">Pendiente</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Meta mensual</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <StaggerList>
                  {filtered.map((user) => (
                    <StaggerItem key={user.id}>
                      <TableRow>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs">{user.full_name.charAt(0)}</AvatarFallback></Avatar>
                            <span className="font-medium">{user.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select value={user.role} onValueChange={(v: UserRole) => updateRole(user, v)}>
                            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="supervisor">Supervisor</SelectItem>
                              <SelectItem value="asesor">Asesor</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_STYLES[user.status].bgColor} ${STATUS_STYLES[user.status].textColor}`}>
                            {STATUS_LABELS[user.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.role === 'asesor' ? (
                            <Select value={user.supervisor_id || 'none'} onValueChange={(v) => updateSupervisor(user, v === 'none' ? '' : v)}>
                              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin supervisor</SelectItem>
                                {supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {user.role === 'asesor' ? (
                            <Input
                              type="number"
                              defaultValue={user.monthly_goal}
                              onBlur={(e) => updateGoal(user, parseFloat(e.target.value) || 0)}
                              className="h-8 w-28 text-xs"
                            />
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">{user.commission_rate}%</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(user.created_at)}</TableCell>
                        <TableCell>
                          {user.status === 'activo' ? (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => updateStatus(user, 'inactivo')}>
                              Desactivar
                            </Button>
                          ) : user.status === 'inactivo' || user.status === 'rechazado' ? (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" onClick={() => updateStatus(user, 'activo')}>
                              Activar
                            </Button>
                          ) : user.status === 'pendiente_aprobacion' ? (
                            <Button size="sm" className="h-7 text-xs" onClick={() => updateStatus(user, 'activo')}>
                              Aprobar
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    </StaggerItem>
                  ))}
                </StaggerList>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
