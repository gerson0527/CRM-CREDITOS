'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Download, TrendingUp, DollarSign, Award, Target,
  BarChart3, Building2, Clock, AlertTriangle, Users,
  Activity, PieChart as PieIcon, Calendar, Filter, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { AppLayout } from '@/components/app-layout';
import { RouteGuard } from '@/components/providers/route-guard';
import { PageTransition } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { KpiCard } from '@/components/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase/client';
import { CREDIT_STATUSES, formatCompactCurrency, formatCurrency, formatDate, formatDateShort } from '@/lib/constants';
import type { Credit, Profile } from '@/lib/types';
import { cn } from '@/lib/utils';

const CHART_COLORS = ['#1D5FA8', '#3AA655', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#94A3B8'];

export default function ReportsPage() {
  return (
    <RouteGuard allowedRoles={['admin', 'supervisor']}>
      <AppLayout>
        <Reports />
      </AppLayout>
    </RouteGuard>
  );
}

function Reports() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [asesores, setAsesores] = useState<Profile[]>([]);
  const [asesorPage, setAsesorPage] = useState(0);
  const [asesorPageSize, setAsesorPageSize] = useState(10);
  const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // ==== Filtro de fechas ====
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [activeRange, setActiveRange] = useState<string>('all');

  const filteredCredits = useMemo(() => {
    if (!dateFrom && !dateTo) return credits;
    return credits.filter((c) => {
      const d = new Date(c.created_at);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        if (d > endDate) return false;
      }
      return true;
    });
  }, [credits, dateFrom, dateTo]);

  function applyRange(range: string) {
    setActiveRange(range);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    if (range === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (range === 'today') {
      setDateFrom(fmt(today));
      setDateTo(fmt(today));
    } else if (range === 'week') {
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      setDateFrom(fmt(start));
      setDateTo(fmt(today));
    } else if (range === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setDateFrom(fmt(start));
      setDateTo(fmt(end));
    } else if (range === 'quarter') {
      const q = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), q * 3, 1);
      const end = new Date(today.getFullYear(), q * 3 + 3, 0);
      setDateFrom(fmt(start));
      setDateTo(fmt(end));
    } else if (range === 'year') {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear() + 1, 0, 0);
      setDateFrom(fmt(start));
      setDateTo(fmt(end));
    } else if (range === 'custom') {
      // No aplicar, dejar que el usuario edite los inputs
    }
  }

  function resetFilters() {
    applyRange('all');
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [creditsRes, usersRes, entitiesRes] = await Promise.all([
      supabase
        .from('credits')
        .select(`*, client:clients(*), asesor:profiles!credits_asesor_id_fkey(id, full_name), entity:financial_entities(id, name)`)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'asesor').eq('status', 'activo'),
      supabase.from('financial_entities').select('id, name').eq('active', true),
    ]);
    setCredits((creditsRes.data as Credit[]) || []);
    setAsesores((usersRes.data as Profile[]) || []);
    setEntities((entitiesRes.data as { id: string; name: string }[]) || []);
    setLoading(false);
  }

  // ==== Métricas globales ====
  const totalSolicitados = credits.reduce((s, c) => s + Number(c.requested_amount ?? 0), 0);
  const totalAprobados = credits
    .filter((c) => c.status === 'aprobado' || c.status === 'desembolsado')
    .reduce((s, c) => s + Number(c.approved_amount ?? c.requested_amount ?? 0), 0);
  const totalDesembolsado = credits
    .filter((c) => c.status === 'desembolsado')
    .reduce((s, c) => s + Number(c.approved_amount ?? c.requested_amount ?? 0), 0);
  const tasaAprobacion = credits.length > 0
    ? (credits.filter((c) => ['aprobado', 'desembolsado'].includes(c.status)).length / credits.length) * 100
    : 0;
  const ticketPromedio = credits.length > 0 ? totalSolicitados / credits.length : 0;
  const metaTotal = asesores.reduce((s, a) => s + Number(a.monthly_goal ?? 0), 0);
  const cumplimientoMeta = metaTotal > 0 ? (totalDesembolsado / metaTotal) * 100 : 0;

  // ==== Créditos por estado (donut) ====
  const creditsByStatus = useMemo(() => {
    return CREDIT_STATUSES.map((s) => ({
      name: s.label,
      value: credits.filter((c) => c.status === s.value).length,
      color: s.color,
    })).filter((s) => s.value > 0);
  }, [credits]);

  // ==== Créditos por entidad ====
  const creditsByEntity = useMemo(() => {
    const map = new Map<string, { entity: string; count: number; amount: number; disbursed: number }>();
    credits.forEach((c) => {
      const name = c.entity?.name || 'Sin entidad';
      const e = map.get(name) || { entity: name, count: 0, amount: 0, disbursed: 0 };
      e.count++;
      e.amount += Number(c.requested_amount ?? 0);
      if (c.status === 'desembolsado') e.disbursed += Number(c.approved_amount ?? c.requested_amount ?? 0);
      map.set(name, e);
    });
    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [credits]);

  // ==== Tendencia mensual (12 meses) ====
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { month: string; count: number; amount: number; disbursed: number; sortKey: string }>();
    credits.forEach((c) => {
      const d = new Date(c.created_at);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
      const e = map.get(sortKey) || { month: label, count: 0, amount: 0, disbursed: 0, sortKey };
      e.count++;
      e.amount += Number(c.requested_amount ?? 0);
      if (c.status === 'desembolsado') e.disbursed += Number(c.approved_amount ?? c.requested_amount ?? 0);
      map.set(sortKey, e);
    });
    return Array.from(map.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);
  }, [credits]);

  // ==== Desempeño por asesor ====
  const asesorPerf = useMemo(() => {
    return asesores.map((a) => {
      const asesorCredits = credits.filter((c) => c.asesor_id === a.id);
      const disbursed = asesorCredits.filter((c) => c.status === 'desembolsado');
      const totalDisbursed = disbursed.reduce(
        (s, c) => s + Number(c.approved_amount ?? c.requested_amount ?? 0),
        0
      );
      const approved = asesorCredits.filter((c) =>
        ['aprobado', 'desembolsado'].includes(c.status)
      ).length;
      const goal = Number(a.monthly_goal ?? 0);
      const goalPct = goal > 0 ? (totalDisbursed / goal) * 100 : 0;
      const tasaAprob = asesorCredits.length > 0 ? (approved / asesorCredits.length) * 100 : 0;
      return {
        id: a.id,
        name: a.full_name,
        credits: asesorCredits.length,
        approved,
        disbursed: disbursed.length,
        totalDisbursed,
        goal,
        goalPct,
        tasaAprob,
        commissionRate: Number(a.commission_rate ?? 0),
        commission: totalDisbursed * (Number(a.commission_rate ?? 0) / 100),
      };
    }).sort((a, b) => b.totalDisbursed - a.totalDisbursed);
  }, [asesores, credits]);

  // ==== Pipeline / estado actual ====
  const pipelineSnapshot = useMemo(() => {
    return CREDIT_STATUSES.map((s) => {
      const items = credits.filter((c) => c.status === s.value);
      const oldest = items.length > 0
        ? items.reduce((a, b) => (new Date(a.status_changed_at || a.created_at).getTime() < new Date(b.status_changed_at || b.created_at).getTime() ? a : b))
        : null;
      const daysOld = oldest ? Math.floor((Date.now() - new Date(oldest.status_changed_at || oldest.created_at).getTime()) / 86400000) : 0;
      return {
        status: s.value,
        label: s.label,
        color: s.color,
        count: items.length,
        amount: items.reduce((s, c) => s + Number(c.requested_amount ?? 0), 0),
        oldest: daysOld,
      };
    });
  }, [credits]);

  // ==== Top clientes por monto ====
  const topClients = useMemo(() => {
    const map = new Map<string, { id: string; name: string; total: number; credits: number }>();
    credits.forEach((c) => {
      if (!c.client) return;
      const name = `${c.client.first_name} ${c.client.last_name}`;
      const e = map.get(c.client.id) || { id: c.client.id, name, total: 0, credits: 0 };
      e.total += Number(c.requested_amount ?? 0);
      e.credits++;
      map.set(c.client.id, e);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [credits]);

  function exportCSV() {
    const headers = [
      'Cliente', 'Cédula', 'Estado', 'Monto solicitado', 'Monto aprobado',
      'Tasa', 'Plazo (meses)', 'Asesor', 'Entidad', 'Tipo crédito',
      'Fecha creación', 'Último cambio', 'Estado días',
    ];
    const rows = credits.map((c) => [
      `${c.client?.first_name} ${c.client?.last_name}`,
      c.client?.document_number || '',
      CREDIT_STATUSES.find((s) => s.value === c.status)?.label || c.status,
      c.requested_amount,
      c.approved_amount ?? '',
      c.rate ?? '',
      c.term_months ?? '',
      c.asesor?.full_name || '',
      c.entity?.name || '',
      formatDate(c.created_at),
      formatDate(c.status_changed_at),
      Math.floor((Date.now() - new Date(c.status_changed_at || c.created_at).getTime()) / 86400000),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_creditos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <PageTransition>
        <PageHeader title="Reportes" description="Análisis de desempeño y colocación." />
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </PageTransition>
    );
  }

  const creditsActivos = credits.filter((c) =>
    ['lead', 'documentacion', 'enviado', 'estudio', 'aprobado'].includes(c.status)
  ).length;
  const estancados = credits.filter((c) => {
    const last = c.status_changed_at || c.created_at;
    const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    return ['lead', 'documentacion', 'enviado', 'estudio', 'aprobado'].includes(c.status) && days >= 7;
  });

  return (
    <PageTransition>
      <PageHeader
        title="Centro de Analítica y Reportes"
        description="Métricas consolidadas de colocación, efectividad de embudo, desempeño por asesor y alertas operativas."
        actions={
          <Button onClick={exportCSV} className="rounded-xl bg-primary text-xs font-bold shadow-sm shadow-primary/25">
            <Download className="mr-1.5 h-4 w-4" />
            Exportar Reporte CSV
          </Button>
        }
      />

      <div className="space-y-6">
        {/* KPIs principales */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Desembolsado"
            value={totalDesembolsado}
            icon={<DollarSign className="h-5 w-5" />}
            tone="emerald"
            format={formatCurrency}
            footer={`${credits.filter((c) => c.status === 'desembolsado').length} operaciones exitosas`}
          />
          <KpiCard
            label="Volumen Total Solicitado"
            value={totalSolicitados}
            icon={<BarChart3 className="h-5 w-5" />}
            tone="blue"
            format={formatCurrency}
            footer={`${credits.length} solicitudes radicadas`}
          />
          <KpiCard
            label="Tasa Global de Aprobación"
            value={tasaAprobacion}
            icon={<TrendingUp className="h-5 w-5" />}
            tone="violet"
            format={(n) => `${n.toFixed(1)}%`}
            footer="Efectividad de radicación"
          />
          <KpiCard
            label="Operaciones en Tránsito"
            value={creditsActivos}
            icon={<Activity className="h-5 w-5" />}
            tone="amber"
            format={(n) => Math.round(n).toString()}
            footer={`${estancados.length} en riesgo de retraso`}
          />
        </div>

        {/* Segunda fila: KPIs operativos */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ticket Promedio
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold text-foreground tabular-nums">
                    {formatCurrency(ticketPromedio)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Promedio por operación</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Cumplimiento de Meta
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold text-foreground tabular-nums">
                    {cumplimientoMeta.toFixed(1)}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatCurrency(totalDesembolsado)} / {formatCurrency(metaTotal)}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Target className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Aprobado por Desembolsar
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold text-primary tabular-nums">
                    {formatCurrency(totalAprobados - totalDesembolsado)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">En espera de desembolso bancario</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos: tendencia + distribución */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                Tendencia Mensual de Colocación (12 Meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrend} margin={{ top: 15, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/60" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Solicitudes" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="disbursed" stroke="#10b981" name="Desembolsado ($)" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="amount" stroke="#f59e0b" name="Solicitado ($)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground py-10 text-center">Sin datos históricos suficientes.</p>}
            </CardContent>
          </Card>

          <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <PieIcon className="h-4 w-4 text-primary" />
                Distribución por Estado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creditsByStatus.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={creditsByStatus}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        innerRadius={48}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {creditsByStatus.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: '14px',
                          border: '1px solid hsl(var(--border))',
                          background: 'hsl(var(--card))',
                          color: 'hsl(var(--foreground))',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                    {creditsByStatus.slice(0, 6).map((s) => (
                      <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full ring-2 ring-background" style={{ backgroundColor: s.color }} />
                        <span className="font-medium">{s.name} ({s.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-xs text-muted-foreground py-10 text-center">Sin datos registrados.</p>}
            </CardContent>
          </Card>
        </div>

        {/* Pipeline snapshot */}
        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Activity className="h-4 w-4 text-primary" />
              Estado Instantáneo del Pipeline Operativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {pipelineSnapshot.map((s) => (
                <div key={s.status} className="rounded-2xl border border-border/70 bg-accent/20 p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full ring-1 ring-background" style={{ backgroundColor: s.color }} />
                    <span className="truncate text-[11px] font-bold text-foreground">{s.label}</span>
                  </div>
                  <p className="mt-1.5 font-display text-xl font-black text-foreground tabular-nums">{s.count}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground tabular-nums">{formatCurrency(s.amount)}</p>
                  {s.oldest > 0 && (
                    <p className={`mt-1 text-[10px] font-bold ${s.oldest >= 7 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      máx {s.oldest}d
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Por entidad y top clientes */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                Créditos por Entidad Financiera
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creditsByEntity.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(260, creditsByEntity.length * 54)}>
                  <BarChart
                    data={creditsByEntity}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                    barCategoryGap="30%"
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/60" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                      className="text-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatCompactCurrency(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="entity"
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                      className="text-muted-foreground"
                      width={150}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '14px',
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                      }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" iconSize={8} />
                    <Bar dataKey="amount" fill="#1D5FA8" name="Solicitado" radius={[0, 6, 6, 0]} barSize={11} />
                    <Bar dataKey="disbursed" fill="#3AA655" name="Desembolsado" radius={[0, 6, 6, 0]} barSize={11} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground py-10 text-center">Sin datos de entidades.</p>}
            </CardContent>
          </Card>

          <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                Top 5 Clientes por Volumen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topClients.length > 0 ? (
                <div className="space-y-2.5">
                  {topClients.map((c, i) => (
                    <div key={c.id} className="flex items-center justify-between rounded-2xl border border-border/70 bg-accent/20 p-3">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-xl font-display text-xs font-black shadow-2xs',
                          i === 0 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
                            : i === 1 ? 'bg-slate-500/20 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/30'
                            : i === 2 ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/30'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          #{i + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-foreground">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground font-medium">{c.credits} crédito{c.credits !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <span className="font-display text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(c.total)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground py-10 text-center">Sin datos de clientes.</p>}
            </CardContent>
          </Card>
        </div>

        {/* Desempeño por asesor */}
        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Award className="h-4 w-4 text-amber-500" />
              Desempeño y Liquidación Comercial por Asesor
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader className="bg-accent/40">
                <TableRow className="border-border/70">
                  <TableHead className="font-display text-xs font-bold text-foreground">Asesor</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground text-center">Solicitudes</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground text-center">Aprobados</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground text-center">Desembolsados</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground text-right">Colocado Total</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground text-center">% Meta</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground text-center">Efectividad</TableHead>
                  <TableHead className="font-display text-xs font-bold text-foreground text-right">Comisión Estimada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asesorPerf.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-8">
                      Sin asesores activos en el período
                    </TableCell>
                  </TableRow>
                ) : asesorPerf.slice(asesorPage * asesorPageSize, (asesorPage + 1) * asesorPageSize).map((a, i) => (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border/60 transition-colors hover:bg-accent/50 last:border-0"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-display text-[10px] font-bold shadow-2xs',
                          i === 0 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            : i === 1 ? 'bg-slate-500/20 text-slate-700 dark:text-slate-300'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          #{i + 1}
                        </span>
                        <span className="font-display text-xs font-bold text-foreground">{a.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs text-foreground font-medium">{a.credits}</TableCell>
                    <TableCell className="text-center text-xs text-foreground font-medium">{a.approved}</TableCell>
                    <TableCell className="text-center text-xs text-foreground font-medium">{a.disbursed}</TableCell>
                    <TableCell className="text-right font-display text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatCurrency(a.totalDisbursed)}
                    </TableCell>
                    <TableCell className="text-center">
                      {a.goal > 0 ? (
                        <Badge className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold shadow-none',
                          a.goalPct >= 100 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                            : a.goalPct >= 50 ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                        )}>
                          {a.goalPct.toFixed(0)}%
                        </Badge>
                      ) : <span className="text-[11px] text-muted-foreground">sin meta</span>}
                    </TableCell>
                    <TableCell className="text-center text-xs text-foreground font-semibold">
                      {a.tasaAprob.toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right font-display text-xs font-bold text-primary tabular-nums">
                      {formatCurrency(a.commission)}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-border/60 p-4">
              <Pagination
                currentPage={asesorPage}
                totalPages={Math.max(1, Math.ceil(asesorPerf.length / asesorPageSize))}
                totalItems={asesorPerf.length}
                pageSize={asesorPageSize}
                onPageChange={setAsesorPage}
                onPageSizeChange={(s) => { setAsesorPageSize(s); setAsesorPage(0); }}
                itemLabel="asesores"
              />
            </div>
          </CardContent>
        </Card>

        {/* Alertas de riesgo */}
        {estancados.length > 0 && (
          <Card className="border border-red-500/30 bg-red-500/5 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                Alertas Operativas: {estancados.length} crédito{estancados.length !== 1 ? 's' : ''} estancado{estancados.length !== 1 ? 's' : ''} (+7 días sin avance)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {estancados.slice(0, 5).map((c) => {
                  const days = Math.floor(
                    (Date.now() - new Date(c.status_changed_at || c.created_at).getTime()) / 86400000
                  );
                  return (
                    <div key={c.id} className="flex items-center justify-between rounded-2xl border border-red-500/20 bg-background/80 p-3">
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-xs font-bold text-foreground">
                          {c.client?.first_name} {c.client?.last_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-medium">
                          {c.asesor?.full_name} · {formatCurrency(c.requested_amount)}
                        </p>
                      </div>
                      <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20 text-[10px] font-bold shadow-none">
                        {days} días
                      </Badge>
                    </div>
                  );
                })}
                {estancados.length > 5 && (
                  <p className="text-center text-xs text-muted-foreground font-medium">
                    +{estancados.length - 5} operaciones adicionales requieren intervención
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}