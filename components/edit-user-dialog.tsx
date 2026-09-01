'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Save, KeyRound, Eye, EyeOff, Building2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import type { Profile, Role, Sede } from '@/lib/types';

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile | null;
  roles: Role[];
  sedes: Sede[];
  supervisors: Profile[];
  onSaved: () => void;
}

export function EditUserDialog({ open, onOpenChange, user, roles, sedes, supervisors, onSaved }: EditUserDialogProps) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'asesor' as Profile['role'],
    role_id: '',
    supervisor_id: '',
    sede_id: '',
    monthly_goal: '',
    commission_rate: '',
    status: 'activo' as Profile['status'],
  });
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetPwd, setResetPwd] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        email: (user as any).email || '',
        phone: user.phone || '',
        role: user.role,
        role_id: user.role_id || '',
        supervisor_id: user.supervisor_id || '',
        sede_id: user.sede_id || '',
        monthly_goal: String(user.monthly_goal ?? ''),
        commission_rate: String(user.commission_rate ?? ''),
        status: user.status,
      });
      setNewPassword('');
      setResetPwd(false);
    }
  }, [user]);

  if (!user) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (resetPwd && newPassword && newPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    setSaving(true);
    try {
      // 1. Actualizar en public.users (full_name, phone, email)
      const userUpdate: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
      };
      if (form.email.trim() && form.email.trim() !== (user as any).email) {
        userUpdate.email = form.email.trim().toLowerCase();
      }
      if (resetPwd && newPassword) {
        const pwdRes = await fetch(`/api/admin/users/${user!.id}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user!.id, newPassword, mustChangePassword: true }),
          credentials: 'include',
        });
        const pwdData = await pwdRes.json();
        if (!pwdRes.ok) throw new Error(pwdData.error || 'Error al cambiar contraseña');
      }
      const { error: userErr } = await supabase
        .from('users')
        .update(userUpdate)
        .eq('id', user!.id);
      if (userErr) throw userErr;

      // 2. Actualizar en public.profiles
      const profileUpdate: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
        role_id: form.role_id || null,
        supervisor_id: form.role === 'asesor' ? (form.supervisor_id || null) : null,
        sede_id: form.sede_id || null,
        monthly_goal: parseFloat(form.monthly_goal) || 0,
        commission_rate: parseFloat(form.commission_rate) || 0,
      };
      const { error: profErr } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user!.id);
      if (profErr) throw profErr;

      // 3. Si cambió el status, actualizar en users
      if (form.status !== user!.status) {
        const { error: statusErr } = await supabase
          .from('users')
          .update({ status: form.status })
          .eq('id', user!.id);
        if (statusErr) throw statusErr;
      }

      toast.success('Usuario actualizado');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Error al guardar', { description: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" />
            Editar usuario
          </DialogTitle>
          <DialogDescription>
            {(user as any).email || user.full_name} · Miembro desde {new Date(user.created_at).toLocaleDateString('es-CO')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nombre completo *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+57 300 123 4567"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as Profile['role'], role_id: roles.find((r) => r.slug === v)?.id || '' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.slug}>
                      {r.name}
                      {r.is_default && <span className="ml-1 text-[10px] text-slate-400">(por defecto)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Profile['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                  <SelectItem value="pendiente_aprobacion">Pendiente aprobación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === 'asesor' && (
              <>
                <div className="space-y-1.5">
                  <Label>Supervisor</Label>
                  <Select
                    value={form.supervisor_id || 'none'}
                    onValueChange={(v) => setForm({ ...form, supervisor_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar supervisor..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin supervisor</SelectItem>
                      {supervisors.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Comisión (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.commission_rate}
                    onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label>Sede</Label>
              <Select
                value={form.sede_id || 'none'}
                onValueChange={(v) => setForm({ ...form, sede_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar sede..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin sede</SelectItem>
                  {sedes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role === 'asesor' && (
              <div className="col-span-2 space-y-1.5">
                <Label>Meta mensual (COP)</Label>
                <Input
                  type="number"
                  value={form.monthly_goal}
                  onChange={(e) => setForm({ ...form, monthly_goal: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Reset password */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={resetPwd}
                onChange={(e) => setResetPwd(e.target.checked)}
                className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <KeyRound className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-900">Resetear contraseña</span>
            </label>
            {resetPwd && (
              <div className="mt-2 space-y-1.5">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nueva contraseña temporal (mín 8 caracteres)"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-amber-700">
                  ⚠ El usuario deberá cambiar esta contraseña en su primer login.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
              Guardar cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}