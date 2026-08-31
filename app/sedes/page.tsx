'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Building2, Plus, Save, Trash2, Star, MapPin, Phone, Hash, Edit2 } from 'lucide-react';
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
import { supabase } from '@/lib/supabase/client';
import type { Sede } from '@/lib/types';

export default function SedesPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <AppLayout>
        <SedesManagement />
      </AppLayout>
    </RouteGuard>
  );
}

function SedesManagement() {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSede, setEditingSede] = useState<Sede | null>(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', city: '', phone: '' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(9);

  useEffect(() => {
    loadSedes();
  }, []);

  async function loadSedes() {
    setLoading(true);
    const { data } = await supabase
      .from('sedes')
      .select('*')
      .order('name', { ascending: true });
    setSedes((data as Sede[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setForm({ name: '', code: '', address: '', city: '', phone: '' });
    setEditingSede(null);
    setCreateOpen(true);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    try {
      const res = await fetch('/api/sedes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Sede creada', { description: form.name });
      setCreateOpen(false);
      loadSedes();
    } catch (err: any) {
      toast.error('Error', { description: err.message });
    }
  }

  async function handleEdit(sede: Sede) {
    setEditingSede({ ...sede });
    setForm({
      name: sede.name,
      code: sede.code || '',
      address: sede.address || '',
      city: sede.city || '',
      phone: sede.phone || '',
    });
  }

  async function handleSaveEdit() {
    if (!editingSede) return;
    try {
      const res = await fetch(`/api/sedes/${editingSede.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Sede actualizada');
      setEditingSede(null);
      loadSedes();
    } catch (err: any) {
      toast.error('Error', { description: err.message });
    }
  }

  async function handleDelete(sede: Sede) {
    if (!confirm(`¿Eliminar la sede "${sede.name}"? Los usuarios asignados quedarán sin sede.`)) return;
    try {
      const res = await fetch(`/api/sedes/${sede.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Sede eliminada');
      loadSedes();
    } catch (err: any) {
      toast.error('Error', { description: err.message });
    }
  }

  async function toggleActive(sede: Sede) {
    try {
      const res = await fetch(`/api/sedes/${sede.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !sede.active }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success(sede.active ? 'Sede desactivada' : 'Sede activada');
      loadSedes();
    } catch (err: any) {
      toast.error('Error', { description: err.message });
    }
  }

  return (
    <PageTransition>
      <PageHeader
        title="Sedes"
        description="Gestiona las oficinas / sucursales de la organización."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva sede
          </Button>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : sedes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium text-slate-900">No hay sedes registradas</p>
            <p className="mt-1 text-sm text-slate-500">Crea la primera sede para empezar.</p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Crear sede
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sedes.slice(page * pageSize, (page + 1) * pageSize).map((sede, idx) => (
            <motion.div
              key={sede.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Card className="relative">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{sede.name}</h3>
                        {sede.code && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <Hash className="h-3 w-3" />
                            {sede.code}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge className={sede.active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'}>
                      {sede.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>

                  {(sede.address || sede.city) && (
                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      {sede.address && (
                        <p className="flex items-start gap-1.5">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                          <span>{sede.address}{sede.city ? `, ${sede.city}` : ''}</span>
                        </p>
                      )}
                      {sede.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{sede.phone}</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(sede)}>
                      <Edit2 className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(sede)}>
                      {sede.active ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(sede)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={createOpen || !!editingSede} onOpenChange={(open) => {
        if (!open) {
          setCreateOpen(false);
          setEditingSede(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editingSede ? 'Editar sede' : 'Nueva sede'}
            </DialogTitle>
            <DialogDescription>
              {editingSede ? 'Modifica los datos de la sede.' : 'Registra una nueva oficina/sucursal.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={editingSede ? (e) => { e.preventDefault(); handleSaveEdit(); } : handleCreate} className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sede Centro" required />
              </div>
              <div className="space-y-1">
                <Label>Código</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="BOG-CENT" />
              </div>
              <div className="space-y-1">
                <Label>Ciudad</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Bogotá" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Dirección</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Cra 7 #32-15" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="6017432100" />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setEditingSede(null); }}>
                Cancelar
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4" />
                {editingSede ? 'Guardar cambios' : 'Crear sede'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Pagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(sedes.length / pageSize))}
        totalItems={sedes.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
        itemLabel="sedes"
        className="mt-4"
      />
    </PageTransition>
  );
}