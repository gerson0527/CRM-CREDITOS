'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Download, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { CREDIT_STATUSES, formatCurrency, formatDate, ROLE_LABELS } from '@/lib/constants';
import type { Credit, CreditStatus, Profile, FinancialEntity } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreditsTablePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [credits, setCredits] = useState<Credit[]>([]);
  const [asesores, setAsesores] = useState<Profile[]>([]);
  const [entities, setEntities] = useState<FinancialEntity[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [asesorFilter, setAsesorFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const pageSize = 15;

  useEffect(() => {
    loadData();
  }, [profile?.id]);

  async function loadData() {
    if (!profile) return;
    setLoading(true);

    // Load entities
    const { data: ents } = await supabase.from('financial_entities').select('*').eq('active', true);
    setEntities(ents as FinancialEntity[] || []);

    // Load asesores (for admin/supervisor filter)
    if (profile.role === 'admin') {
      const { data: users } = await supabase.from('profiles').select('*').eq('role', 'asesor').eq('status', 'activo');
      setAsesores(users as Profile[] || []);
    } else if (profile.role === 'supervisor') {
      const { data: team } = await supabase.from('profiles').select('*').eq('supervisor_id', profile.id).eq('status', 'activo');
      setAsesores(team as Profile[] || []);
    }

    await loadCredits();
  }

  async function loadCredits() {
    if (!profile) return;

    let query = supabase
      .from('credits')
      .select(`
        *,
        client:clients(*),
        asesor:profiles!credits_asesor_id_fkey(id, full_name),
        entity:financial_entities(id, name)
      `);

    if (profile.role === 'asesor') {
      query = query.eq('asesor_id', profile.id);
    } else if (profile.role === 'supervisor') {
      const { data: team } = await supabase.from('profiles').select('id').eq('supervisor_id', profile.id);
      const teamIds = (team || []).map((t) => t.id);
      if (teamIds.length > 0) {
        query = query.in('asesor_id', teamIds);
      }
    }

    const { data } = await query.order('created_at', { ascending: false });
    setCredits(data as Credit[] || []);
    setLoading(false);
  }

  const filteredCredits = useMemo(() => {
    return credits.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (asesorFilter !== 'all' && c.asesor_id !== asesorFilter) return false;
      if (entityFilter !== 'all' && c.entity_id !== entityFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const fullName = `${c.client?.first_name || ''} ${c.client?.last_name || ''}`.toLowerCase();
        const doc = c.client?.document_number?.toLowerCase() || '';
        if (!fullName.includes(s) && !doc.includes(s)) return false;
      }
      return true;
    });
  }, [credits, statusFilter, asesorFilter, entityFilter, search]);

  const pagedCredits = filteredCredits.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredCredits.length / pageSize);

  return (
    <AppLayout>
      <PageTransition>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tabla de créditos</h1>
            <p className="text-sm text-muted-foreground">{filteredCredits.length} créditos encontrados.</p>
          </div>
          <Button onClick={() => router.push('/creditos/nuevo')}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo crédito
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-xs">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Nombre o cédula..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {CREDIT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {profile?.role !== 'asesor' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Asesor</Label>
                  <Select value={asesorFilter} onValueChange={(v) => { setAsesorFilter(v); setPage(0); }}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {asesores.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Entidad</Label>
                <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {entities.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                    setAsesorFilter('all');
                    setEntityFilter('all');
                    setPage(0);
                  }}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Limpiar
                </Button>
              </div>
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
            ) : pagedCredits.length === 0 ? (
              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No se encontraron créditos</p>
                <p className="text-sm text-muted-foreground">Ajusta los filtros o crea un nuevo crédito.</p>
              </motion.div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    {profile?.role !== 'asesor' && <TableHead>Asesor</TableHead>}
                    <TableHead>Entidad</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead>Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <StaggerList>
                    {pagedCredits.map((credit) => (
                      <StaggerItem key={credit.id}>
                        <TableRow
                          className="cursor-pointer transition-colors hover:bg-accent"
                          onClick={() => router.push(`/creditos/${credit.id}`)}
                        >
                          <TableCell className="font-medium">
                            {credit.client?.first_name} {credit.client?.last_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {credit.client?.document_number}
                          </TableCell>
                          <TableCell>{formatCurrency(credit.requested_amount)}</TableCell>
                          <TableCell><StatusBadge status={credit.status} /></TableCell>
                          {profile?.role !== 'asesor' && (
                            <TableCell className="text-muted-foreground">
                              {credit.asesor?.full_name || '—'}
                            </TableCell>
                          )}
                          <TableCell className="text-muted-foreground">
                            {credit.entity?.name || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(credit.created_at)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(credit.status_changed_at)}</TableCell>
                        </TableRow>
                      </StaggerItem>
                    ))}
                  </StaggerList>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </PageTransition>
    </AppLayout>
  );
}
