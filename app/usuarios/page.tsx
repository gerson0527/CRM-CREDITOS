'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Search, UserCog, Shield, Users as UsersIcon, Plus, Eye, EyeOff, Copy, Check, Pencil } from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { RouteGuard } from '@/components/providers/route-guard';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { KpiCard } from '@/components/kpi-card';
import { UserAvatar } from '@/components/user-avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { EditUserDialog } from '@/components/edit-user-dialog';
import { supabase } from '@/lib/supabase/client';
import { ROLE_LABELS, STATUS_LABELS, STATUS_STYLES, formatDateShort, formatCurrency } from '@/lib/constants';
import type { Profile, Role, UserRole, UserStatus, Sede } from '@/lib/types';

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
  const [roles, setRoles] = useState<Role[]>([]);
  const [defaultRole, setDefaultRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userPage, setUserPage] = useState(0);
  const [userPageSize, setUserPageSize] = useState(10);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ email: string; password: string; full_name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'admin' as UserRole,
    role_id: '',
    supervisor_id: '',
    monthly_goal: '',
    commission_rate: '',
    phone: '',
    sede_id: '',
  });
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [usersRes, supsRes, rolesRes, sedesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'supervisor').eq('status', 'activo'),
      supabase.from('roles').select('*').order('name', { ascending: true }),
      supabase.from('sedes').select('id, name').eq('active', true).order('name'),
    ]);
    const roleList = (rolesRes.data as Role[]) || [];
    setUsers(usersRes.data as Profile[] || []);
    setSupervisors(supsRes.data as Profile[] || []);
    setRoles(roleList);
    setSedes((sedesRes.data as Sede[]) || []);
    setDefaultRole(roleList.find((r) => r.is_default) || roleList.find((r) => r.slug === 'admin') || null);
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

  function randomPassword(): string {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd + '!1';
  }

  function openCreate() {
    setForm({
      email: '',
      password: randomPassword(),
      full_name: '',
      role: (defaultRole?.slug as UserRole) || 'admin',
      role_id: defaultRole?.id || '',
      supervisor_id: '',
      monthly_goal: '',
      commission_rate: '',
      phone: '',
      sede_id: '',
    });
    setCreatedResult(null);
    setShowPassword(false);
    setCopied(false);
    setCreateOpen(true);
  }

  function copyCredentials() {
    if (!createdResult) return;
    const text = `Credenciales Credilibranzas JG\nNombre: ${createdResult.full_name}\nEmail: ${createdResult.email}\nContraseña temporal: ${createdResult.password}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.full_name) {
      toast.error('Completa nombre, email y contraseña');
      return;
    }
    if (form.role === 'asesor' && !form.supervisor_id) {
      toast.error('Los asesores deben tener un supervisor asignado');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
          role_id: form.role_id || null,
          supervisor_id: form.role === 'asesor' ? form.supervisor_id : null,
          monthly_goal: parseFloat(form.monthly_goal) || 0,
          commission_rate: parseFloat(form.commission_rate) || 0,
          phone: form.phone || null,
          sede_id: form.sede_id || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario');

      setCreatedResult({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
      });
      toast.success('Usuario creado', { description: `${form.full_name} ya puede iniciar sesión.` });
      loadData();
    } catch (err: any) {
      toast.error('Error al crear usuario', { description: err?.message });
    } finally {
      setCreating(false);
    }
  }

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const userTotalPages = Math.max(1, Math.ceil(filtered.length / userPageSize));
  const pagedUsers = filtered.slice(userPage * userPageSize, (userPage + 1) * userPageSize);

  return (
    <PageTransition>
      <PageHeader
        title="Administración de Usuarios"
        description={`${filtered.length} usuarios registrados en la plataforma.`}
        actions={
          <Button onClick={openCreate} className="rounded-xl bg-primary text-xs font-bold shadow-sm shadow-primary/25">
            <Plus className="mr-1.5 h-4 w-4" />
            Crear Usuario
          </Button>
        }
      />

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Usuarios', value: users.length, icon: <UsersIcon className="h-5 w-5" />, tone: 'blue' as const },
          { label: 'Activos', value: users.filter((u) => u.status === 'activo').length, icon: <Shield className="h-5 w-5" />, tone: 'emerald' as const },
          { label: 'Pendientes', value: users.filter((u) => u.status === 'pendiente_aprobacion').length, icon: <UserCog className="h-5 w-5" />, tone: 'amber' as const },
          { label: 'Inactivos', value: users.filter((u) => u.status === 'inactivo').length, icon: <UserCog className="h-5 w-5" />, tone: 'slate' as const },
        ].map((s) => (
          <KpiCard
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            tone={s.tone}
            format={(n: number) => Math.round(n).toString()}
          />
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-5 border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Buscar Usuario</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 pl-9 rounded-xl border-border/80 bg-background text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rol</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-10 rounded-xl border-border/80 bg-background text-xs"><SelectValue placeholder="Todos los roles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="asesor">Asesor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 rounded-xl border-border/80 bg-background text-xs"><SelectValue placeholder="Todos los estados" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="pendiente_aprobacion">Pendiente</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-accent/40">
                <TableRow className="border-border/70">
                  <TableHead className="font-display text-xs font-bold text-foreground">Usuario</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground">Rol</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground">Estado</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground">Supervisor</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground">Sede</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground">Meta Mensual</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground">Comisión</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground">Creado</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {pagedUsers.map((user) => (
                      <TableRow key={user.id} className="border-border/60 transition-colors hover:bg-accent/50">
                        <TableCell className="font-display text-xs font-bold text-foreground">
                          {user.full_name}
                        </TableCell>
                        <TableCell>
                          <Select value={user.role} onValueChange={(v: UserRole) => updateRole(user, v)}>
                            <SelectTrigger className="h-8 w-32 rounded-xl bg-background text-xs font-semibold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="supervisor">Supervisor</SelectItem>
                              <SelectItem value="asesor">Asesor</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge className={`border-0 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-none ${STATUS_STYLES[user.status].bgColor} ${STATUS_STYLES[user.status].textColor}`}>
                            {STATUS_LABELS[user.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.role === 'asesor' ? (
                            <Select value={user.supervisor_id || 'none'} onValueChange={(v) => updateSupervisor(user, v === 'none' ? '' : v)}>
                              <SelectTrigger className="h-8 w-36 rounded-xl bg-background text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin supervisor</SelectItem>
                                {supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.sede_id || 'none'}
                            onValueChange={async (v) => {
                              const newSedeId = v === 'none' ? null : v;
                              await supabase.from('profiles').update({ sede_id: newSedeId }).eq('id', user.id);
                              setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, sede_id: newSedeId } : u)));
                              toast.success('Sede actualizada');
                            }}
                          >
                            <SelectTrigger className="h-8 w-36 rounded-xl bg-background text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin sede</SelectItem>
                              {sedes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {user.role === 'asesor' ? (
                            <div className="flex flex-col gap-0.5">
                              <Input
                                type="number"
                                defaultValue={user.monthly_goal}
                                onBlur={(e) => updateGoal(user, parseFloat(e.target.value) || 0)}
                                className="h-8 w-28 rounded-xl bg-background text-xs tabular-nums"
                              />
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {formatCurrency(Number(user.monthly_goal ?? 0))}
                              </span>
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-foreground font-semibold tabular-nums">{user.commission_rate}%</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateShort(user.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 rounded-xl"
                              onClick={() => {
                                setEditingUser(user);
                                setEditOpen(true);
                              }}
                              title="Editar usuario completo"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {user.status === 'activo' ? (
                              <Button size="sm" variant="outline" className="h-7 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => updateStatus(user, 'inactivo')}>
                                Desactivar
                              </Button>
                            ) : user.status === 'inactivo' || user.status === 'rechazado' ? (
                              <Button size="sm" variant="outline" className="h-7 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" onClick={() => updateStatus(user, 'activo')}>
                                Activar
                              </Button>
                            ) : user.status === 'pendiente_aprobacion' ? (
                              <Button size="sm" className="h-7 rounded-xl text-xs font-bold" onClick={() => updateStatus(user, 'activo')}>
                                Aprobar
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                        </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Pagination
        currentPage={userPage}
        totalPages={userTotalPages}
        totalItems={filtered.length}
        pageSize={userPageSize}
        onPageChange={setUserPage}
        onPageSizeChange={(s) => { setUserPageSize(s); setUserPage(0); }}
        itemLabel="usuarios"
        className="mt-5"
      />

      {/* Dialog: editar usuario */}
      <EditUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        user={editingUser}
        roles={roles}
        sedes={sedes}
        supervisors={supervisors}
        onSaved={() => {
          setEditingUser(null);
          setEditOpen(false);
          loadData();
        }}
      />

      {/* Dialog: crear usuario */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) { setCreatedResult(null); setCopied(false); }
      }}>
        <DialogContent className="sm:max-w-lg">
          {!createdResult ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Crear nuevo usuario
                </DialogTitle>
                <DialogDescription>
                  Crea una cuenta activa. El usuario podrá iniciar sesión inmediatamente con las credenciales generadas.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2 col-span-2">
                    <Label>Nombre completo *</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="Juan Pérez"
                      required
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="usuario@credilibranzas.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rol *</Label>
                    <Select
                      value={form.role_id || form.role}
                      onValueChange={(v) => {
                        const r = roles.find((rl) => rl.id === v);
                        if (r) {
                          setForm({
                            ...form,
                            role: r.slug as UserRole,
                            role_id: r.id,
                            supervisor_id: r.slug === 'asesor' ? form.supervisor_id : '',
                          });
                        } else {
                          setForm({ ...form, role: v as UserRole, role_id: '' });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Seleccionar rol..." /></SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            <span className="flex items-center gap-2">
                              {r.name}
                              {r.is_default && <span className="text-[10px] uppercase tracking-wider text-slate-400">por defecto</span>}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+57 300 123 4567"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Sede</Label>
                    <Select
                      value={form.sede_id || 'none'}
                      onValueChange={(v) => setForm({ ...form, sede_id: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar sede (opcional)..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin sede asignada</SelectItem>
                        {sedes.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-slate-500">
                      Solo se muestra a partir de admin. Asesores y supervisores normalmente pertenecen a una sola sede.
                    </p>
                  </div>
                  {form.role === 'asesor' && (
                    <div className="space-y-2 col-span-2">
                      <Label>Supervisor asignado *</Label>
                      <Select value={form.supervisor_id || 'none'} onValueChange={(v) => setForm({ ...form, supervisor_id: v === 'none' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar supervisor..." /></SelectTrigger>
                        <SelectContent>
                          {supervisors.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {form.role === 'asesor' && (
                    <>
                      <div className="space-y-2">
                        <Label>Meta mensual (COP)</Label>
                        <Input
                          type="number"
                          value={form.monthly_goal}
                          onChange={(e) => setForm({ ...form, monthly_goal: e.target.value })}
                          placeholder="5000000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Comisión (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={form.commission_rate}
                          onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                          placeholder="1.5"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-2 col-span-2">
                    <Label>Contraseña temporal *</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          required
                          className="font-mono pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setForm({ ...form, password: randomPassword() })}
                      >
                        Generar
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Comparte esta contraseña con el usuario. Puede cambiarla después desde su perfil.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Crear usuario
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700">
                  <Check className="h-5 w-5" />
                  Usuario creado correctamente
                </DialogTitle>
                <DialogDescription>
                  Comparte estas credenciales con <strong>{createdResult.full_name}</strong>. Se han enviado (en este caso, no, cópialas y envíalas tú).
                </DialogDescription>
              </DialogHeader>

              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Nombre</span>
                    <p className="font-medium text-slate-900">{createdResult.full_name}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Email</span>
                    <p className="font-mono text-slate-900">{createdResult.email}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Contraseña temporal</span>
                    <p className="font-mono text-slate-900 select-all">{createdResult.password}</p>
                  </div>
                </div>

                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={copyCredentials}>
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copiar credenciales
                      </>
                    )}
                  </Button>
                  <Button onClick={() => setCreateOpen(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
