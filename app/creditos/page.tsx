'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Plus, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { CREDIT_STATUSES, formatCurrency, formatDateShort } from '@/lib/constants';
import type { Credit, Profile, FinancialEntity } from '@/lib/types';
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
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    loadData();
  }, [profile?.id]);

  async function loadData() {
    if (!profile) return;
    setLoading(true);

    const { data: ents } = await supabase.from('financial_entities').select('*').eq('active', true);
    setEntities(ents as FinancialEntity[] || []);

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
      const teamIds = (team || []).map((t: { id: string }) => t.id);
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
        <PageHeader
          title="Directorio de Créditos"
          description={`${filteredCredits.length} créditos registrados bajo tus permisos.`}
          actions={
            <Link href="/creditos/nuevo">
              <Button className="rounded-xl bg-primary text-xs font-bold shadow-sm shadow-primary/25">
                <Plus className="mr-1.5 h-4 w-4" />
                Nuevo Crédito
              </Button>
            </Link>
          }
        />

        {/* Filters Card */}
        <Card className="mb-5 border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Buscar Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Nombre o documento..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    className="h-10 pl-9 rounded-xl border-border/80 bg-background text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado Operativo</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                  <SelectTrigger className="h-10 rounded-xl border-border/80 bg-background text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {CREDIT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {profile?.role !== 'asesor' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Asesor Comercial</Label>
                  <Select value={asesorFilter} onValueChange={(v) => { setAsesorFilter(v); setPage(0); }}>
                    <SelectTrigger className="h-10 rounded-xl border-border/80 bg-background text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los asesores</SelectItem>
                      {asesores.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Entidad Bancaria</Label>
                <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
                  <SelectTrigger className="h-10 rounded-xl border-border/80 bg-background text-xs">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las entidades</SelectItem>
                    {entities.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="h-10 w-full rounded-xl border-border/80 text-xs font-bold hover:bg-accent"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                    setAsesorFilter('all');
                    setEntityFilter('all');
                    setPage(0);
                  }}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Container */}
        <Card className="overflow-hidden border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardContent className="overflow-x-auto p-0">
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
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-muted-foreground">
                  <Search className="h-6 w-6" />
                </div>
                <p className="font-display text-base font-bold text-foreground">No se encontraron créditos coincidentes</p>
                <p className="text-xs text-muted-foreground mt-1">Ajusta los filtros de búsqueda o radica un nuevo crédito.</p>
              </motion.div>
            ) : (
              <Table>
                <TableHeader className="bg-accent/40">
                  <TableRow className="border-border/70">
                    <TableHead className="font-display text-xs font-bold text-foreground">Cliente</TableHead>
                    <TableHead className="font-display text-xs font-bold text-foreground">Documento</TableHead>
                    <TableHead className="font-display text-xs font-bold text-foreground">Monto Radicado</TableHead>
                    <TableHead className="font-display text-xs font-bold text-foreground">Estado Operativo</TableHead>
                    {profile?.role !== 'asesor' && <TableHead className="font-display text-xs font-bold text-foreground">Asesor</TableHead>}
                    <TableHead className="font-display text-xs font-bold text-foreground">Entidad</TableHead>
                    <TableHead className="font-display text-xs font-bold text-foreground">Radicado</TableHead>
                    <TableHead className="font-display text-xs font-bold text-foreground">Último Cambio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {pagedCredits.map((credit) => (
                        <TableRow key={credit.id}
                          className="cursor-pointer border-border/60 transition-colors hover:bg-accent/50"
                          onClick={() => router.push(`/creditos/${credit.id}`)}
                        >
                          <TableCell className="max-w-[200px] font-display text-xs font-bold text-foreground">
                            <span className="block truncate">{credit.client?.first_name} {credit.client?.last_name}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-medium">
                            CC {credit.client?.document_number}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-display text-xs font-bold text-primary tabular-nums">
                            {formatCurrency(credit.requested_amount)}
                          </TableCell>
                          <TableCell><StatusBadge status={credit.status} /></TableCell>
                          {profile?.role !== 'asesor' && (
                            <TableCell className="max-w-[160px]">
                              <span className="block truncate text-xs text-muted-foreground font-medium">
                                {credit.asesor?.full_name || '—'}
                              </span>
                            </TableCell>
                          )}
                          <TableCell className="max-w-[140px]">
                            <span className="block truncate text-xs text-foreground font-semibold">
                              {credit.entity?.name || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateShort(credit.created_at)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateShort(credit.status_changed_at)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filteredCredits.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          itemLabel="créditos"
          className="mt-5"
        />
      </PageTransition>
    </AppLayout>
  );
}
