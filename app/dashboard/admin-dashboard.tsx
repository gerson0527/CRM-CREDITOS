'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp, DollarSign, Clock, AlertTriangle, FileText,
  Award, ArrowUpRight, Building2, Activity, UserPlus,
  Users, UserCheck, Download, Plus,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { RoleBanner, AttentionSection } from '@/components/role-banner';
import { KpiCard } from '@/components/kpi-card';
import { UserAvatar } from '@/components/user-avatar';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { CREDIT_STATUSES, formatCurrency, daysSince } from '@/lib/constants';
import type { Profile, Credit } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalColocado: 0,
    creditosActivos: 0,
    tasaConversion: 0,
    pendientesAprobacion: 0,
  });
  const [changes, setChanges] = useState({
    totalColocado: null as number | null,
  });
  const [creditsByStatus, setCreditsByStatus] = useState<{ name: string; value: number; color: string }[]>([]);
  const [rankingAsesores, setRankingAsesores] = useState<{ name: string; total: number; count: number }[]>([]);
  const [stagnantCredits, setStagnantCredits] = useState<Credit[]>([]);
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [entityComparison, setEntityComparison] = useState<{ name: string; aprobados: number; rechazados: number; avg_days: number }[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    const { data: credits } = await supabase
      .from('credits')
      .select(`
        *,
        client:clients(*),
        asesor:profiles!credits_asesor_id_fkey(id, full_name),
        entity:financial_entities(id, name),
        credit_type:credit_types(id, name)
      `)
      .order('created_at', { ascending: false });

    const { data: pending } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'pendiente_aprobacion')
      .order('created_at', { ascending: false });

    const { data: asesores } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'asesor')
      .eq('status', 'activo');

    if (credits) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const sumAmount = (list: Credit[]) =>
        list.reduce((s, c) => s + Number(c.approved_amount ?? c.requested_amount ?? 0), 0);

      const disbursedThisMonth = credits.filter(
        (c: Credit) => c.status === 'desembolsado' && c.status_changed_at && new Date(c.status_changed_at) >= monthStart
      );
      const disbursedLastMonth = credits.filter(
        (c: Credit) => c.status === 'desembolsado' && c.status_changed_at &&
          new Date(c.status_changed_at) >= prevMonthStart &&
          new Date(c.status_changed_at) < monthStart
      );

      const totalColocado = sumAmount(disbursedThisMonth);
      const lastTotal = sumAmount(disbursedLastMonth);
      const totalChange = lastTotal > 0 ? ((totalColocado - lastTotal) / lastTotal) * 100 : null;

      const activeStatuses = ['lead', 'documentacion', 'enviado', 'estudio', 'aprobado'];
      const creditosActivos = credits.filter((c: Credit) => activeStatuses.includes(c.status)).length;

      const totalLeads = credits.length;
      const totalDisbursed = credits.filter((c: Credit) => c.status === 'desembolsado').length;
      const tasaConversion = totalLeads > 0 ? (totalDisbursed / totalLeads) * 100 : 0;

      const stagnant = credits
        .filter((c: Credit) => activeStatuses.includes(c.status) && daysSince(c.status_changed_at || c.created_at) >= 7)
        .slice(0, 5);

      const byStatus = CREDIT_STATUSES.map((s) => ({
        name: s.label,
        value: credits.filter((c: Credit) => c.status === s.value).length,
        color: s.color,
      })).filter((s) => s.value > 0);

      const ranking = (asesores || [])
        .map((a: Profile) => {
          const asesorCredits = disbursedThisMonth.filter((c: Credit) => c.asesor_id === a.id);
          return {
            name: a.full_name,
            total: sumAmount(asesorCredits),
            count: asesorCredits.length,
          };
        })
        .sort((a: { total: number }, b: { total: number }) => b.total - a.total)
        .slice(0, 5);

      const entityMap = new Map<string, { aprobados: number; rechazados: number; total_days: number; count: number }>();
      credits.forEach((c: Credit) => {
        if (!c.entity) return;
        const name = c.entity.name;
        if (!entityMap.has(name)) entityMap.set(name, { aprobados: 0, rechazados: 0, total_days: 0, count: 0 });
        const entry = entityMap.get(name)!;
        if (c.status === 'aprobado' || c.status === 'desembolsado') entry.aprobados++;
        if (c.status === 'rechazado') entry.rechazados++;
        if (c.status_changed_at && c.created_at) {
          const days = (new Date(c.status_changed_at).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
          entry.total_days += days;
          entry.count++;
        }
      });
      const entityComp = Array.from(entityMap.entries()).map(([name, e]) => ({
        name,
        aprobados: e.aprobados,
        rechazados: e.rechazados,
        avg_days: e.count > 0 ? Math.round(e.total_days / e.count) : 0,
      }));

      setStats({
        totalColocado,
        creditosActivos,
        tasaConversion,
        pendientesAprobacion: pending?.length || 0,
      });
      setChanges({ totalColocado: totalChange });
      setCreditsByStatus(byStatus);
      setRankingAsesores(ranking);
      setStagnantCredits(stagnant);
      setPendingUsers((pending as Profile[]) || []);
      setEntityComparison(entityComp);
    }
  }

  const kpiCards = [
    {
      label: 'Total colocado (mes)',
      value: stats.totalColocado,
      icon: <DollarSign className="h-5 w-5" />,
      tone: 'green' as const,
      format: (n: number) => formatCurrency(n),
      change: changes.totalColocado,
      changeLabel: 'vs mes anterior',
    },
    {
      label: 'Créditos activos',
      value: stats.creditosActivos,
      icon: <Activity className="h-5 w-5" />,
      tone: 'blue' as const,
      format: (n: number) => Math.round(n).toString(),
      footer: `${stats.tasaConversion.toFixed(1)}% conversión`,
    },
    {
      label: 'Tasa de conversión',
      value: stats.tasaConversion,
      icon: <TrendingUp className="h-5 w-5" />,
      tone: 'violet' as const,
      format: (n: number) => `${n.toFixed(1)}%`,
      footer: 'histórico total',
    },
    {
      label: 'Solicitudes pendientes',
      value: stats.pendientesAprobacion,
      icon: <UserPlus className="h-5 w-5" />,
      tone: 'amber' as const,
      format: (n: number) => Math.round(n).toString(),
      footer: 'por aprobar',
    },
  ];

  return (
    <PageTransition>
      <RoleBanner
        roleLabel="Administrador"
        tone="blue"
        greeting={`Hola, ${profile?.full_name?.split(' ')[0] || 'Admin'}`}
        subtitle="Aquí está el pulso general de toda la operación."
        actions={[
          { label: 'Nuevo crédito', href: '/creditos/nuevo', icon: <Plus className="h-3.5 w-3.5" /> },
          { label: 'Crear usuario', href: '/usuarios', icon: <UserCheck className="h-3.5 w-3.5" /> },
          { label: 'Reportes', href: '/reportes', icon: <Download className="h-3.5 w-3.5" /> },
        ]}
      />

      <div className="mt-6">
        <AttentionSection
          title="Requiere tu atención"
          subtitle="Cosas que solo tú puedes resolver como administrador"
          items={[
            {
              label: 'Solicitudes por aprobar',
              value: pendingUsers.length,
              href: '/solicitudes',
              tone: 'amber',
              description: pendingUsers[0] ? `${pendingUsers[0].full_name}${pendingUsers.length > 1 ? ` y ${pendingUsers.length - 1} más` : ''}` : 'Sin pendientes',
            },
            {
              label: 'Créditos estancados',
              value: stagnantCredits.length,
              href: '/creditos',
              tone: 'red',
              description: '7+ días sin cambio de estado',
            },
            {
              label: 'Top del mes',
              value: rankingAsesores[0]?.name.split(' ')[0] || '—',
              href: '/usuarios',
              tone: 'blue',
              description: rankingAsesores[0] ? `${formatCurrency(rankingAsesores[0].total)} este mes` : '',
            },
          ]}
        />
      </div>

      <PageHeader
        title="Indicadores principales"
        description="Resumen de la operación en cifras."
        className="mt-6 mb-3"
      />

      <StaggerList className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <StaggerItem key={kpi.label}>
            <KpiCard
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              tone={kpi.tone}
              format={kpi.format}
              change={kpi.change}
              changeLabel={kpi.changeLabel}
              footer={kpi.footer}
            />
          </StaggerItem>
        ))}
      </StaggerList>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base font-bold text-foreground">Créditos por Estado en Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {creditsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={creditsByStatus} margin={{ top: 15, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/60" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {creditsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="Sin datos para mostrar" />
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base font-bold text-foreground">Distribución de Pipeline</CardTitle>
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
                      innerRadius={52}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {creditsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
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
                  {creditsByStatus.map((s) => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full ring-2 ring-background" style={{ backgroundColor: s.color }} />
                      <span className="font-medium">{s.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState text="Sin datos para mostrar" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Award className="h-4 w-4 text-amber-500" />
              Ranking de Asesores (Mes Vigente)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingAsesores.length > 0 ? (
              <div className="space-y-2.5">
                {rankingAsesores.map((asesor, i) => (
                  <motion.div
                    key={asesor.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-accent/30 p-2.5 transition-all hover:bg-accent/70 hover:shadow-2xs"
                  >
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-display text-xs font-black shadow-2xs',
                      i === 0 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
                        : i === 1 ? 'bg-slate-500/20 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/30'
                        : i === 2 ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/30'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      #{i + 1}
                    </div>
                    <UserAvatar name={asesor.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground">{asesor.name}</p>
                      <p className="text-[11px] font-medium text-muted-foreground">{asesor.count} créditos colocados</p>
                    </div>
                    <span className="font-display text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatCurrency(asesor.total)}
                    </span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState text="Aún no hay colocaciones este mes" />
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <UserPlus className="h-4 w-4 text-amber-500" />
              Solicitudes de Acceso Pendientes
            </CardTitle>
            {pendingUsers.length > 0 && (
              <Link href="/solicitudes" className="text-xs font-bold text-primary hover:underline">
                Ver todas ({pendingUsers.length})
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {pendingUsers.length > 0 ? (
              <div className="space-y-2.5">
                {pendingUsers.slice(0, 4).map((user) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-accent/30 p-2.5 transition-all hover:bg-accent/70"
                  >
                    <UserAvatar name={user.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground">{user.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{user.phone || 'Sin teléfono'}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Pendiente
                    </span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState text="No hay solicitudes pendientes" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Créditos Estancados (7+ días sin avance)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stagnantCredits.length > 0 ? (
              <div className="space-y-2.5">
                {stagnantCredits.map((credit) => (
                  <Link
                    key={credit.id}
                    href={`/creditos/${credit.id}`}
                    className="flex items-center justify-between rounded-2xl border border-border/70 p-3 transition-all hover:bg-accent/60 hover:shadow-2xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs font-bold text-foreground">
                        {credit.client?.first_name} {credit.client?.last_name}
                      </p>
                      <p className="text-[11px] font-semibold text-muted-foreground tabular-nums">{formatCurrency(credit.requested_amount)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={credit.status} />
                      <span className="inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300 tabular-nums">
                        {daysSince(credit.status_changed_at || credit.created_at)}d
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState text="No hay créditos estancados" />
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              Comparativo por Entidad Financiera
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entityComparison.length > 0 ? (
              <div className="space-y-2.5">
                {entityComparison.map((entity, i) => (
                  <motion.div
                    key={entity.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-2xl border border-border/70 p-3 bg-accent/20"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">{entity.name}</p>
                      <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{entity.avg_days}d prom.</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {entity.aprobados} aprobados
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
                        <TrendingUp className="h-3.5 w-3.5 rotate-180" />
                        {entity.rechazados} rechazados
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState text="Sin datos de entidades" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            Equipo Comercial Activo
          </CardTitle>
          <Link href="/usuarios" className="text-xs font-bold text-primary hover:underline">
            Gestionar usuarios
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {rankingAsesores.slice(0, 4).map((a) => (
              <div key={a.name} className="flex items-center gap-3 rounded-2xl border border-border/70 p-3 bg-accent/20">
                <UserAvatar name={a.name} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-foreground">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">{a.count} créditos</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 3, repeat: Infinity }}
      className="flex flex-col items-center justify-center py-10 text-center"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-muted-foreground">
        <Activity className="h-5 w-5" />
      </div>
      <p className="text-xs font-medium text-muted-foreground">{text}</p>
    </motion.div>
  );
}