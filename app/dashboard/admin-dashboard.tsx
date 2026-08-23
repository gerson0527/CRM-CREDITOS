'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, DollarSign, Clock, AlertTriangle, FileText,
  Award, ArrowUpRight, Building2, Activity, UserPlus,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { AnimatedCounter } from '@/components/animated-counter';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase/client';
import { CREDIT_STATUSES, formatCurrency, daysSince } from '@/lib/constants';
import type { Profile, Credit } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalColocado: 0,
    creditosActivos: 0,
    tasaConversion: 0,
    pendientesAprobacion: 0,
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

      const disbursedThisMonth = credits.filter(
        (c: Credit) => c.status === 'desembolsado' && c.status_changed_at && new Date(c.status_changed_at) >= monthStart
      );
      const totalColocado = disbursedThisMonth.reduce((sum: number, c: Credit) => sum + (c.approved_amount || c.requested_amount), 0);

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
            total: asesorCredits.reduce((sum: number, c: Credit) => sum + (c.approved_amount || c.requested_amount), 0),
            count: asesorCredits.length,
          };
        })
        .sort((a, b) => b.total - a.total)
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
      setCreditsByStatus(byStatus);
      setRankingAsesores(ranking);
      setStagnantCredits(stagnant);
      setPendingUsers((pending as Profile[]) || []);
      setEntityComparison(entityComp);
    }
  }

  const kpiCards = [
    { label: 'Total colocado (mes)', value: stats.totalColocado, icon: <DollarSign className="h-5 w-5" />, color: 'text-green-600', bg: 'bg-green-100', format: (n: number) => formatCurrency(n) },
    { label: 'Créditos activos', value: stats.creditosActivos, icon: <Activity className="h-5 w-5" />, color: 'text-blue-600', bg: 'bg-blue-100', format: (n: number) => Math.round(n).toString() },
    { label: 'Tasa de conversión', value: stats.tasaConversion, icon: <TrendingUp className="h-5 w-5" />, color: 'text-violet-600', bg: 'bg-violet-100', format: (n: number) => `${n.toFixed(1)}%` },
    { label: 'Pendientes de aprobación', value: stats.pendientesAprobacion, icon: <Clock className="h-5 w-5" />, color: 'text-amber-600', bg: 'bg-amber-100', format: (n: number) => Math.round(n).toString() },
  ];

  return (
    <PageTransition>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard administrativo</h1>
          <p className="text-sm text-muted-foreground">Vista general de la operación de créditos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/reportes')}>
            <FileText className="mr-2 h-4 w-4" />
            Exportar reporte
          </Button>
          <Button onClick={() => router.push('/creditos/nuevo')}>
            <FileText className="mr-2 h-4 w-4" />
            Nuevo crédito
          </Button>
        </div>
      </div>

      <StaggerList className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <StaggerItem key={kpi.label}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bg} ${kpi.color}`}>{kpi.icon}</div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                  <AnimatedCounter value={kpi.value} format={kpi.format} />
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerList>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Créditos por estado</CardTitle></CardHeader>
          <CardContent>
            {creditsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={creditsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
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

        <Card>
          <CardHeader><CardTitle>Distribución de pipeline</CardTitle></CardHeader>
          <CardContent>
            {creditsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={creditsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
                    {creditsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="Sin datos para mostrar" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Ranking de asesores (mes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingAsesores.length > 0 ? (
              <div className="space-y-3">
                {rankingAsesores.map((asesor, i) => (
                  <motion.div key={asesor.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'
                    }`}>{i + 1}</div>
                    <Avatar className="h-9 w-9"><AvatarFallback>{asesor.name.charAt(0)}</AvatarFallback></Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{asesor.name}</p>
                      <p className="text-xs text-muted-foreground">{asesor.count} créditos colocados</p>
                    </div>
                    <span className="text-sm font-semibold text-green-600">{formatCurrency(asesor.total)}</span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState text="Aún no hay colocaciones este mes" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-500" />
              Solicitudes de acceso pendientes
            </CardTitle>
            {pendingUsers.length > 0 && (
              <Link href="/solicitudes" className="text-xs text-primary hover:underline">Ver todas</Link>
            )}
          </CardHeader>
          <CardContent>
            {pendingUsers.length > 0 ? (
              <div className="space-y-3">
                {pendingUsers.slice(0, 4).map((user) => (
                  <motion.div key={user.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback></Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user.phone || 'Sin teléfono'}</p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pendiente</Badge>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState text="No hay solicitudes pendientes" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Créditos estancados (7+ días sin cambio)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stagnantCredits.length > 0 ? (
              <div className="space-y-2">
                {stagnantCredits.map((credit) => (
                  <Link key={credit.id} href={`/creditos/${credit.id}`} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent">
                    <div>
                      <p className="text-sm font-medium">{credit.client?.first_name} {credit.client?.last_name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(credit.requested_amount)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={credit.status} />
                      <Badge variant="outline" className="text-amber-600">{daysSince(credit.status_changed_at || credit.created_at)} días</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState text="No hay créditos estancados" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Comparativo por entidad financiera
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entityComparison.length > 0 ? (
              <div className="space-y-3">
                {entityComparison.map((entity, i) => (
                  <motion.div key={entity.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{entity.name}</p>
                      <span className="text-xs text-muted-foreground">{entity.avg_days}d prom.</span>
                    </div>
                    <div className="mt-2 flex gap-4">
                      <span className="flex items-center gap-1 text-xs text-green-600"><ArrowUpRight className="h-3 w-3" />{entity.aprobados} aprobados</span>
                      <span className="flex items-center gap-1 text-xs text-red-600"><ArrowUpRight className="h-3 w-3" />{entity.rechazados} rechazados</span>
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
    </PageTransition>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 3, repeat: Infinity }} className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Activity className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </motion.div>
  );
}
