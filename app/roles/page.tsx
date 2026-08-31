'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Shield, Plus, Trash2, Save, X, Star, Lock, ChevronRight,
  LayoutDashboard, Trello, Calendar as CalendarIcon, UserCheck,
  CreditCard, FileBarChart, Users as UsersIcon, UserPlus, Database, Terminal,
} from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { RouteGuard } from '@/components/providers/route-guard';
import { PageTransition } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import type { Role } from '@/lib/types';

const ALL_PERMISSIONS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Principal' },
  { key: 'kanban', label: 'Kanban de Créditos', icon: Trello, section: 'Operación' },
  { key: 'calendario', label: 'Calendario', icon: CalendarIcon, section: 'Operación' },
  { key: 'clientes', label: 'Clientes', icon: UserCheck, section: 'Operación' },
  { key: 'creditos', label: 'Tabla de Créditos', icon: CreditCard, section: 'Operación' },
  { key: 'creditos.nuevo', label: 'Nuevo Crédito', icon: FileBarChart, section: 'Operación' },
  { key: 'reportes', label: 'Reportes', icon: FileBarChart, section: 'Análisis' },
  { key: 'solicitudes', label: 'Solicitudes de Acceso', icon: UserPlus, section: 'Administración' },
  { key: 'usuarios', label: 'Gestión de Usuarios', icon: UsersIcon, section: 'Administración' },
  { key: 'roles', label: 'Roles y Permisos', icon: Shield, section: 'Administración' },
];

export default function RolesPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <AppLayout>
        <RolesManagement />
      </AppLayout>
    </RouteGuard>
  );
}

function RolesManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [createForm, setCreateForm] = useState({
    slug: '',
    name: '',
    description: '',
    permissions: [] as string[],
    is_default: false,
  });

  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    setLoading(true);
    const { data } = await supabase.from('roles').select('*').order('is_default', { ascending: false }).order('name', { ascending: true });
    setRoles((data as Role[]) || []);
    setLoading(false);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!createForm.slug || !createForm.name) {
      toast.error('Slug y nombre son obligatorios');
      return;
    }
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('No hay sesión');

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear');

      toast.success('Rol creado', { description: `${createForm.name} ya está disponible.` });
      setCreateOpen(false);
      setCreateForm({ slug: '', name: '', description: '', permissions: [], is_default: false });
      loadRoles();
    } catch (err: any) {
      toast.error('Error al crear rol', { description: err.message });
    }
  }

  async function handleSaveEdit(role: Role, newPermissions: string[], newName: string, newDescription: string, newIsDefault: boolean) {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('No hay sesión');

      const res = await fetch(`/api/roles/${role.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          permissions: newPermissions,
          is_default: newIsDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      toast.success('Rol actualizado', { description: `${newName} ahora tiene ${newPermissions.length} permiso(s).` });
      setEditingRole(null);
      loadRoles();
    } catch (err: any) {
      toast.error('Error al guardar', { description: err.message });
    }
  }

  async function handleDelete(role: Role) {
    if (role.is_system) {
      toast.error('Los roles del sistema no se pueden eliminar');
      return;
    }
    if (!confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('No hay sesión');

      const res = await fetch(`/api/roles/${role.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');

      toast.success('Rol eliminado');
      loadRoles();
    } catch (err: any) {
      toast.error('Error al eliminar', { description: err.message });
    }
  }

  function togglePermission(set: string[], key: string): string[] {
    return set.includes(key ? key : '') ? set.filter((k) => k !== key) : [...set, key];
  }

  return (
    <PageTransition>
      <PageHeader
        title="Roles y permisos"
        description="Define qué vistas ve cada rol en el sistema."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Crear rol
          </Button>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : roles.length === 0 ? (
        <EmptyRolesState />
      ) : (
        <div className="space-y-3">
          {roles.slice(page * pageSize, (page + 1) * pageSize).map((role, idx) => (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{role.name}</h3>
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{role.slug}</code>
                          {role.is_default && (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                              <Star className="mr-1 h-3 w-3" />
                              Por defecto
                            </Badge>
                          )}
                          {role.is_system && (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100">
                              <Lock className="mr-1 h-3 w-3" />
                              Sistema
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-slate-600">
                            {role.permissions.length} permiso{role.permissions.length === 1 ? '' : 's'}
                          </Badge>
                        </div>
                        {role.description && (
                          <p className="mt-1 text-sm text-slate-500">{role.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {role.permissions.slice(0, 6).map((p) => {
                            const perm = ALL_PERMISSIONS.find((ap) => ap.key === p);
                            return (
                              <span key={p} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                <ChevronRight className="h-3 w-3 text-slate-400" />
                                {perm?.label || p}
                              </span>
                            );
                          })}
                          {role.permissions.length > 6 && (
                            <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                              +{role.permissions.length - 6} más
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingRole({ ...role })}>
                        Editar permisos
                      </Button>
                      {!role.is_system && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(role)}
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(roles.length / pageSize))}
        totalItems={roles.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
        itemLabel="roles"
        className="mt-4"
      />

      {/* Dialog: Crear rol */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Crear nuevo rol
            </DialogTitle>
            <DialogDescription>
              Define el slug, nombre y a qué vistas tendrá acceso.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                  placeholder="gerente-comercial"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Gerente Comercial"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="¿Qué hace este rol?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Permisos iniciales</Label>
              <PermissionMatrix
                selected={createForm.permissions}
                onToggle={(key) => setCreateForm({ ...createForm, permissions: togglePermission(createForm.permissions, key) })}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <Checkbox
                checked={createForm.is_default}
                onCheckedChange={(checked) => setCreateForm({ ...createForm, is_default: !!checked })}
              />
              <span className="text-slate-700">Marcar como rol por defecto al crear usuarios</span>
            </label>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Crear rol
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar rol */}
      {editingRole && (
        <EditRoleDialog
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSave={handleSaveEdit}
        />
      )}
    </PageTransition>
  );
}

function PermissionMatrix({ selected, onToggle }: { selected: string[]; onToggle: (key: string) => void }) {
  const sections = ['Principal', 'Operación', 'Análisis', 'Administración'] as const;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      {sections.map((section) => {
        const perms = ALL_PERMISSIONS.filter((p) => p.section === section);
        return (
          <div key={section}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{section}</p>
            <div className="grid grid-cols-2 gap-2">
              {perms.map((perm) => {
                const Icon = perm.icon;
                const isOn = selected.includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-all ${
                      isOn
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Checkbox checked={isOn} onCheckedChange={() => onToggle(perm.key)} />
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-xs font-medium">{perm.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EditRoleDialog({
  role, onClose, onSave,
}: {
  role: Role;
  onClose: () => void;
  onSave: (role: Role, perms: string[], name: string, description: string, isDefault: boolean) => Promise<void>;
}) {
  const [perms, setPerms] = useState<string[]>(role.permissions);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description || '');
  const [isDefault, setIsDefault] = useState(role.is_default);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(role, perms, name, description, isDefault);
    setSaving(false);
  }

  function toggle(key: string) {
    setPerms((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Editar rol: {role.name}
          </DialogTitle>
          <DialogDescription>
            {role.is_system
              ? 'Este es un rol del sistema. No puedes cambiar su slug.'
              : 'Modifica el nombre, descripción y permisos del rol.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={role.slug} disabled={role.is_system} className="bg-slate-50 font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={role.is_system} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Permisos</Label>
            <PermissionMatrix selected={perms} onToggle={toggle} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <Checkbox checked={isDefault} onCheckedChange={(checked) => setIsDefault(!!checked)} />
            <span className="text-slate-700">Rol por defecto al crear usuarios</span>
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyRolesState() {
  const [copied, setCopied] = useState(false);
  const [details, setDetails] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; hint?: string } | null>(null);

  const sql = `-- Tabla roles
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_authenticated" ON public.roles;
CREATE POLICY "roles_select_authenticated" ON public.roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "roles_admin_insert" ON public.roles;
CREATE POLICY "roles_admin_insert" ON public.roles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "roles_admin_update" ON public.roles;
CREATE POLICY "roles_admin_update" ON public.roles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "roles_admin_delete" ON public.roles;
CREATE POLICY "roles_admin_delete" ON public.roles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

INSERT INTO public.roles (slug, name, description, permissions, is_system, is_default) VALUES
  ('admin','Administrador','Acceso total al sistema. Es el rol por defecto al crear usuarios nuevos.','["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes","solicitudes","usuarios","roles"]'::jsonb,true,true),
  ('supervisor','Supervisor','Gestiona el equipo de asesores a su cargo.','["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes"]'::jsonb,true,false),
  ('asesor','Asesor','Asesor comercial. Solo ve sus propios clientes, créditos y seguimientos.','["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes"]'::jsonb,true,false)
ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, permissions=EXCLUDED.permissions;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;
UPDATE public.profiles p SET role_id = r.id FROM public.roles r WHERE r.slug = p.role AND p.role_id IS NULL;`;

  function copySql() {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function runMigration() {
    setRunning(true);
    setResult(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('No hay sesión activa');

      const res = await fetch('/api/migrate/run', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error || 'Error desconocido', hint: data.hint });
      } else {
        setResult({ ok: true, message: data.message });
        // Recargar la lista tras 1.5s
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err: any) {
      setResult({ ok: false, message: err.message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardContent className="p-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Database className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            La tabla <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">roles</code> no existe en Supabase
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-600">
            Crea la tabla, las políticas RLS y los 3 roles semilla automáticamente, o ejecuta el SQL a mano.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button
              size="sm"
              onClick={runMigration}
              disabled={running}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {running ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Ejecutando…
                </>
              ) : (
                <>
                  <Database className="h-3.5 w-3.5" />
                  Ejecutar migración
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetails(!details)}
              className="border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
            >
              <Terminal className="h-3.5 w-3.5" />
              {details ? 'Ocultar SQL' : 'Ver SQL'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copySql}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              {copied ? '✓ Copiado' : 'Copiar SQL'}
            </Button>
          </div>

          {result && (
            <div
              className={`mt-4 w-full max-w-2xl rounded-xl border p-3 text-left text-sm ${
                result.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              <p className="font-semibold">{result.ok ? '✓ Éxito' : '✕ Error'}</p>
              <p className="mt-1">{result.message}</p>
              {result.hint && (
                <p className="mt-1 text-xs opacity-80">{result.hint}</p>
              )}
              {result.ok && (
                <p className="mt-1 text-xs opacity-80">Recargando la página…</p>
              )}
            </div>
          )}

          {details && (
            <pre className="mt-5 max-h-80 w-full max-w-3xl overflow-auto rounded-xl bg-slate-900 p-4 text-left text-xs leading-relaxed text-slate-100">
              <code>{sql}</code>
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}