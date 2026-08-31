'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Building2, Plus, Save, Trash2, Phone, MapPin, Edit2, BarChart3, CreditCard } from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { RouteGuard } from '@/components/providers/route-guard';
import { PageTransition } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/constants';
import type { FinancialEntity } from '@/lib/types';

export default function EntidadesPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <AppLayout>
        <EntitiesManagement />
      </AppLayout>
    </RouteGuard>
  );
}

function EntitiesManagement() {
  const [entities, setEntities] = useState<FinancialEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialEntity | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState({
    name: '',
    contact_name: '',
    contact_phone: '',
    avg_response_days: '7',
    active: true,
    credit_min_amount: '',
    credit_max_amount: '',
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('financial_entities')
      .select('*')
      .order('name', { ascending: true });
    setEntities((data as FinancialEntity[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setForm({ name: '', contact_name: '', contact_phone: '', avg_response_days: '7', active: true, credit_min_amount: '', credit_max_amount: '' });
    setEditing(null);
    setCreateOpen(true);
  }

  function openEdit(e: FinancialEntity) {
    setForm({
      name: e.name,
      contact_name: e.contact_name || '',
      contact_phone: e.contact_phone || '',
      avg_response_days: String(e.avg_response_days ?? 7),
      active: e.active,
      credit_min_amount: e.credit_min_amount ? String(e.credit_min_amount) : '',
      credit_max_amount: e.credit_max_amount ? String(e.credit_max_amount) : '',
    });
    setEditing(e);
  }

  async function handleCreate(ev: FormEvent) {
    ev.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    try {
      const res = await fetch('/api/db/financial_entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          contact_name: form.contact_name || null,
          contact_phone: form.contact_phone || null,
          avg_response_days: Number(form.avg_response_days) || 7,
          active: form.active,
          credit_min_amount: form.credit_min_amount ? Number(form.credit_min_amount) : null,
          credit_max_amount: form.credit_max_amount ? Number(form.credit_max_amount) : null,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Entidad creada', { description: form.name });
      setCreateOpen(false);
      load();
    } catch (err: any) {
      toast.error('Error', { description: err.message });
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    try {
      const res = await fetch(`/api/db/financial_entities/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          contact_name: form.contact_name || null,
          contact_phone: form.contact_phone || null,
          avg_response_days: Number(form.avg_response_days) || 7,
          active: form.active,
          credit_min_amount: form.credit_min_amount ? Number(form.credit_min_amount) : null,
          credit_max_amount: form.credit_max_amount ? Number(form.credit_max_amount) : null,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Entidad actualizada');
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error('Error', { description: err.message });
    }
  }

  async function handleDelete(e: FinancialEntity) {
    if (!confirm(`¿Eliminar "${e.name}"? Los créditos asignados quedarán sin entidad.`)) return;
    try {
      const res = await fetch(`/api/db/financial_entities/${e.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Entidad eliminada');
      load();
    } catch (err: any) {
      toast.error('Error', { description: err.message });
    }
  }

  async function toggleActive(e: FinancialEntity) {
    try {
      const res = await fetch(`/api/db/financial_entities/${e.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !e.active }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      load();
    } catch (err: any) {
      toast.error('Error', { description: err.message });
    }
  }

  return (
    <PageTransition>
      <PageHeader
        title="Entidades financieras"
        description="Bancos y financieras con las que trabajas. Se usan al crear créditos."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva entidad
          </Button>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : entities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium text-slate-900">No hay entidades registradas</p>
            <p className="mt-1 text-sm text-slate-500">Agrega bancos y financieras con las que operas.</p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Crear entidad
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold">Contacto</th>
                <th className="px-4 py-3 text-left font-semibold">Teléfono</th>
                <th className="px-4 py-3 text-center font-semibold">Tiempo</th>
                <th className="px-4 py-3 text-center font-semibold">Monto crédito</th>
                <th className="px-4 py-3 text-center font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entities.slice(page * pageSize, (page + 1) * pageSize).map((e, idx) => (
                <motion.tr
                  key={e.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-slate-900">{e.name}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{e.contact_name || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{e.contact_phone || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-center text-slate-700">
                    {e.avg_response_days ?? '—'}d
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center text-xs text-slate-700">
                    {e.credit_min_amount ? `${formatCurrency(Number(e.credit_min_amount))} – ${formatCurrency(Number(e.credit_max_amount ?? 0))}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={e.active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'}>
                      {e.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(e)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(e)}>
                        {e.active ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(e)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen || !!editing} onOpenChange={(open) => {
        if (!open) {
          setCreateOpen(false);
          setEditing(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editing ? 'Editar entidad' : 'Nueva entidad financiera'}
            </DialogTitle>
            <DialogDescription>
              Bancos y financieras con las que operas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={editing ? (e) => { e.preventDefault(); handleSaveEdit(); } : handleCreate} className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Banco de Bogotá" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contacto</Label>
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="María Cárdenas" />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="6013320000" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tiempo de respuesta promedio (días)</Label>
              <Input type="number" min="1" max="60" value={form.avg_response_days} onChange={(e) => setForm({ ...form, avg_response_days: e.target.value })} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                Condiciones comerciales
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Monto crédito (mín)</Label>
                  <Input type="number" min="0" value={form.credit_min_amount} onChange={(e) => setForm({ ...form, credit_min_amount: e.target.value })} placeholder="1000000" />
                </div>
                <div className="space-y-1">
                  <Label>Monto crédito (máx)</Label>
                  <Input type="number" min="0" value={form.credit_max_amount} onChange={(e) => setForm({ ...form, credit_max_amount: e.target.value })} placeholder="100000000" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setEditing(null); }}>
                Cancelar
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4" />
                {editing ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Pagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(entities.length / pageSize))}
        totalItems={entities.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
        itemLabel="entidades"
        className="mt-4"
      />
    </PageTransition>
  );
}