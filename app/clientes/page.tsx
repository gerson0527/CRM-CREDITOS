'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Plus, Mail, Phone, User, Users as UsersIcon, RotateCcw, DollarSign } from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { KpiCard } from '@/components/kpi-card';
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
import { formatCurrency, formatDateShort } from '@/lib/constants';
import type { Client, Profile } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ClientRow extends Client {
  credits_count?: number;
  total_placed?: number;
  asesor?: Pick<Profile, 'id' | 'full_name'>;
}

export default function ClientesPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [asesores, setAsesores] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [asesorFilter, setAsesorFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    if (profile) loadData();
  }, [profile?.id, profile?.role]);

  async function loadData() {
    if (!profile) return;
    setLoading(true);

    if (profile.role === 'admin') {
      const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'asesor')
        .eq('status', 'activo');
      setAsesores((users as Profile[]) || []);
    } else if (profile.role === 'supervisor') {
      const { data: team } = await supabase
        .from('profiles')
        .select('*')
        .eq('supervisor_id', profile.id)
        .eq('status', 'activo');
      setAsesores((team as Profile[]) || []);
    }

    let query = supabase
      .from('clients')
      .select(`
        *,
        asesor:profiles!clients_created_by_fkey(id, full_name)
      `)
      .order('created_at', { ascending: false });

    const { data: clientsData } = await query;
    const clientList = (clientsData as ClientRow[]) || [];

    if (clientList.length > 0) {
      const ids = clientList.map((c) => c.id);
      const { data: creditsData } = await supabase
        .from('credits')
        .select('id, client_id, status, approved_amount, requested_amount')
        .in('client_id', ids);

      const stats = new Map<string, { count: number; total: number }>();
      (creditsData || []).forEach((c: any) => {
        const prev = stats.get(c.client_id) || { count: 0, total: 0 };
        stats.set(c.client_id, {
          count: prev.count + 1,
          total: prev.total + Number(c.approved_amount ?? c.requested_amount ?? 0),
        });
      });

      clientList.forEach((c) => {
        const s = stats.get(c.id);
        c.credits_count = s?.count ?? 0;
        c.total_placed = s?.total ?? 0;
      });
    }

    setClients(clientList);
    setLoading(false);
  }

  const cities = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => { if (c.city) set.add(c.city); });
    return Array.from(set).sort();
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (asesorFilter !== 'all' && c.created_by !== asesorFilter) return false;
      if (cityFilter !== 'all' && c.city !== cityFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
        const doc = (c.document_number || '').toLowerCase();
        if (!fullName.includes(s) && !doc.includes(s)) return false;
      }
      return true;
    });
  }, [clients, asesorFilter, cityFilter, search]);

  const pagedClients = filteredClients.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredClients.length / pageSize);

  const totalCredits = clients.reduce((s, c) => s + (c.credits_count ?? 0), 0);
  const totalPlaced = clients.reduce((s, c) => s + (c.total_placed ?? 0), 0);

  return (
    <AppLayout>
      <PageTransition>
        <PageHeader
          title="Directorio de Clientes"
          description={
            profile?.role === 'asesor'
              ? 'Tus clientes registrados y sus colocaciones activas.'
              : profile?.role === 'supervisor'
              ? 'Clientes registrados por tu equipo comercial.'
              : 'Base general de clientes registrados en el sistema.'
          }
          actions={
            <Link href="/clientes/nuevo">
              <Button className="rounded-xl bg-primary text-xs font-bold shadow-sm shadow-primary/25">
                <Plus className="mr-1.5 h-4 w-4" />
                Nuevo Cliente
              </Button>
            </Link>
          }
        />

        {/* Stats KPIs */}
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Total Clientes Registrados"
            value={clients.length}
            icon={<UsersIcon className="h-5 w-5" />}
            tone="blue"
            format={(n) => Math.round(n).toString()}
          />
          <KpiCard
            label="Créditos Tramitados"
            value={totalCredits}
            icon={<User className="h-5 w-5" />}
            tone="emerald"
            format={(n) => Math.round(n).toString()}
          />
          <KpiCard
            label="Monto Total Colocado"
            value={totalPlaced}
            icon={<DollarSign className="h-5 w-5" />}
            tone="violet"
            format={(n) => formatCurrency(n)}
          />
        </div>

        {/* Filters */}
        <Card className="mb-5 border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardContent className="p-4 sm:p-5">
            <div className={`grid grid-cols-1 gap-3.5 ${profile?.role !== 'asesor' ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Buscar Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Nombre o cédula..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    className="h-10 pl-9 rounded-xl border-border/80 bg-background text-xs"
                  />
                </div>
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
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ciudad / Municipio</Label>
                <Select value={cityFilter} onValueChange={(v) => { setCityFilter(v); setPage(0); }}>
                  <SelectTrigger className="h-10 rounded-xl border-border/80 bg-background text-xs">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las ciudades</SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
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
                    setAsesorFilter('all');
                    setCityFilter('all');
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

        {/* Table */}
        <Card className="overflow-hidden border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardContent className="overflow-x-auto p-0">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : pagedClients.length === 0 ? (
              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-muted-foreground">
                  <UsersIcon className="h-6 w-6" />
                </div>
                <p className="font-display text-base font-bold text-foreground">No se encontraron clientes coincidentes</p>
                <p className="text-xs text-muted-foreground mt-1">Registra un nuevo cliente comercial para comenzar.</p>
              </motion.div>
            ) : (
              <Table>
                <TableHeader className="bg-accent/40">
                  <TableRow className="border-border/70">
                    <TableHead className="font-display text-xs font-bold text-foreground">Cliente</TableHead>
                    <TableHead className="font-display text-xs font-bold text-foreground">Cédula</TableHead>
                    <TableHead className="font-display text-xs font-bold text-foreground">Canales de Contacto</TableHead>
                    <TableHead className="font-display text-xs font-bold text-foreground">Ciudad</TableHead>
                    {profile?.role !== 'asesor' && <TableHead className="font-display text-xs font-bold text-foreground">Asesor</TableHead>}
                    <TableHead className="font-display text-xs font-bold text-foreground text-center">Créditos</TableHead>
                    <TableHead className="font-display text-xs font-bold text-foreground">Colocado</TableHead>
                    <TableHead className="font-display text-xs font-bold text-foreground">Registrado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {pagedClients.map((client) => (
                          <TableRow key={client.id} className="cursor-pointer border-border/60 transition-colors hover:bg-accent/50">
                          <TableCell className="max-w-[180px] font-display text-xs font-bold text-foreground">
                            <Link href={`/clientes/${client.id}`} className="block truncate hover:text-primary transition-colors">
                              {client.first_name} {client.last_name}
                            </Link>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-medium">
                            CC {client.document_number}
                          </TableCell>
                          <TableCell className="min-w-[200px]">
                            <div className="space-y-1 text-xs">
                              {client.phone && (
                                <div className="flex items-center gap-1.5 whitespace-nowrap text-foreground font-medium">
                                  <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                                  {client.phone}
                                </div>
                              )}
                              {client.email && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                                  <span className="truncate">{client.email}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-foreground font-medium">
                            {client.city || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          {profile?.role !== 'asesor' && (
                            <TableCell className="max-w-[160px]">
                              {client.asesor ? (
                                <span className="block truncate text-xs text-muted-foreground font-medium">{client.asesor.full_name}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-center">
                            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-accent border border-border px-2 text-xs font-bold text-foreground">
                              {client.credits_count ?? 0}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-display text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(client.total_placed ?? 0)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDateShort(client.created_at)}
                          </TableCell>
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
          totalItems={filteredClients.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          itemLabel="clientes"
          className="mt-5"
        />
      </PageTransition>
    </AppLayout>
  );
}