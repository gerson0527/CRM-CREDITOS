'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Target, DollarSign, Clock, AlertTriangle, TrendingUp,
  Award, Phone, MessageCircle, Mail, MapPin, Plus,
  Users, UserCheck,
} from 'lucide-react';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { RoleBanner, AttentionSection } from '@/components/role-banner';
import { KpiCard } from '@/components/kpi-card';
import { UserAvatar } from '@/components/user-avatar';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { formatCurrency, formatDate, daysSince } from '@/lib/constants';
import type { Credit, Profile } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function SupervisorDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [teamCredits, setTeamCredits] = useState<Credit[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Credit[]>([]);
  const [stagnantCredits, setStagnantCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    teamColocado: 0,
    teamActivos: 0,
    teamMeta: 0,
  });
  const [ranking, setRanking] = useState<{ name: string; total: number; count: number }[]>([]);
  const [change, setChange] = useState<number | null>(null);

  useEffect(() => {
    if (profile?.id) {
      loadDashboard();
    }
  }, [profile?.id]);

  async function loadDashboard() {
    setLoading(true);

    const { data: team } = await supabase
      .from('profiles')
      .select('*')
      .eq('supervisor_id', profile!.id)
      .eq('status', 'activo');

    const teamIds = (team || []).map((t: Profile) => t.id);

    if (teamIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data: credits } = await supabase
      .from('credits')
      .select(`
        *,
        client:clients(*),
        asesor:profiles!credits_asesor_id_fkey(id, full_name),
        entity:financial_entities(id, name),
        credit_type:credit_types(id, name)
      `)
      .in('asesor_id', teamIds)
      .order('created_at', { ascending: false });

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

      const teamColocado = sumAmount(disbursedThisMonth);
      const lastTotal = sumAmount(disbursedLastMonth);
      const teamChange = lastTotal > 0 ? ((teamColocado - lastTotal) / lastTotal) * 100 : null;

      const activeStatuses = ['lead', 'documentacion', 'enviado', 'estudio', 'aprobado'];
      const teamActivos = credits.filter((c: Credit) => activeStatuses.includes(c.status)).length;

      const teamMeta = (team || []).reduce((sum: number, t: Profile) => sum + Number(t.monthly_goal ?? 0), 0);

      const pending = credits.filter((c: Credit) => c.status === 'enviado' || c.status === 'documentacion').slice(0, 5);

      const stagnant = credits
        .filter((c: Credit) => activeStatuses.includes(c.status) && daysSince(c.status_changed_at || c.created_at) >= 7)
        .slice(0, 5);

      const rank = (team || [])
        .map((t: Profile) => {
          const asesorCredits = disbursedThisMonth.filter((c: Credit) => c.asesor_id === t.id);
          return {
            name: t.full_name,
            total: sumAmount(asesorCredits),
            count: asesorCredits.length,
          };
        })
        .sort((a: { total: number }, b: { total: number }) => b.total - a.total);

      setTeamCredits(credits);
      setTeamMembers(team as Profile[]);
      setPendingApprovals(pending);
      setStagnantCredits(stagnant);
      setRanking(rank);
      setStats({ teamColocado, teamActivos, teamMeta });
      setChange(teamChange);
    }

    setLoading(false);
  }

  const metaProgress = stats.teamMeta > 0 ? (stats.teamColocado / stats.teamMeta) * 100 : 0;
  const asesorTop = ranking[0];
  const asesorBottom = ranking[ranking.length - 1];

  const kpiCards = [
    {
      label: 'Colocación del equipo (mes)',
      value: stats.teamColocado,
      icon: <DollarSign className="h-5 w-5" />,
      tone: 'green' as const,
      format: (n: number) => formatCurrency(n),
      change,
      changeLabel: 'vs mes anterior',
    },
    {
      label: 'Créditos activos',
      value: stats.teamActivos,
      icon: <TrendingUp className="h-5 w-5" />,
      tone: 'blue' as const,
      format: (n: number) => Math.round(n).toString(),
      footer: `${teamMembers.length} asesores`,
    },
    {
      label: 'Meta del equipo',
      value: stats.teamMeta,
      icon: <Target className="h-5 w-5" />,
      tone: 'violet' as const,
      format: (n: number) => formatCurrency(n),
      footer: `${metaProgress.toFixed(1)}% cumplimiento`,
    },
    {
      label: 'Por revisar',
      value: pendingApprovals.length,
      icon: <Clock className="h-5 w-5" />,
      tone: 'amber' as const,
      format: (n: number) => Math.round(n).toString(),
      footer: 'créditos en estudio',
    },
  ];

  return (
    <PageTransition>
      <RoleBanner
        roleLabel="Supervisor"
        tone="green"
        greeting={`Hola, ${profile?.full_name?.split(' ')[0] || ''}`}
        subtitle="Tu equipo en cifras, qué necesitan y cómo van."
        actions={[
          { label: 'Nuevo crédito', href: '/creditos/nuevo', icon: <Plus className="h-3.5 w-3.5" /> },
          { label: 'Revisar pendientes', href: '/creditos', icon: <Clock className="h-3.5 w-3.5" /> },
          { label: 'Reporte del equipo', href: '/reportes', icon: <TrendingUp className="h-3.5 w-3.5" /> },
        ]}
      />

      <div className="mt-6">
        <AttentionSection
          title="Tu equipo necesita"
          subtitle="Lo que requiere tu intervención esta semana"
          items={[
            {
              label: 'Por revisar',
              value: pendingApprovals.length,
              href: '/creditos',
              tone: 'amber',
              description: 'créditos esperando tu aprobación',
            },
            {
              label: 'Estancados',
              value: stagnantCredits.length,
              href: '/creditos',
              tone: 'red',
              description: '7+ días sin movimiento',
            },
            {
              label: 'Asesor destacado',
              value: asesorTop ? asesorTop.name.split(' ')[0] : '—',
              href: '/dashboard',
              tone: 'green',
              description: asesorTop ? `${formatCurrency(asesorTop.total)} este mes` : '',
            },
            {
              label: 'Asesor con menor avance',
              value: asesorBottom && asesorTop && asesorBottom.name !== asesorTop.name ? asesorBottom.name.split(' ')[0] : '—',
              href: '/dashboard',
              tone: 'blue',
              description: asesorBottom ? `${asesorBottom.count} créditos` : '',
            },
          ]}
        />
      </div>

      <PageHeader
        title="Indicadores del Equipo"
        description="Resumen de colocación y metas del equipo comercial."
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

      <Card className="mt-6 border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <Target className="h-4 w-4 text-primary" />
            Cumplimiento de Meta del Equipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                {formatCurrency(stats.teamColocado)} de {formatCurrency(stats.teamMeta)}
              </span>
              <span className="font-display text-sm font-bold text-foreground tabular-nums">{metaProgress.toFixed(1)}%</span>
            </div>
            <Progress value={Math.min(metaProgress, 100)} className="h-3 rounded-full bg-accent" />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Award className="h-4 w-4 text-amber-500" />
              Ranking Interno del Equipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ranking.length > 0 ? (
              <div className="space-y-2.5">
                {ranking.map((asesor, i) => {
                  const goal = Number(teamMembers.find((m) => m.full_name === asesor.name)?.monthly_goal ?? 0);
                  const pct = goal > 0 ? (asesor.total / goal) * 100 : 0;
                  return (
                    <motion.div
                      key={asesor.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-accent/30 p-2.5 transition-all hover:bg-accent/70"
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
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                          <span>{asesor.count} créditos</span>
                          {goal > 0 && (
                            <span className={pct >= 100 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                              · {pct.toFixed(0)}% meta
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-display text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(asesor.total)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="Sin colocaciones este mes" />
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Clock className="h-4 w-4 text-amber-500" />
              Créditos para Revisión
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length > 0 ? (
              <div className="space-y-2.5">
                {pendingApprovals.map((credit) => (
                  <Link
                    key={credit.id}
                    href={`/creditos/${credit.id}`}
                    className="flex items-center justify-between rounded-2xl border border-border/70 p-3 transition-all hover:bg-accent/60 hover:shadow-2xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs font-bold text-foreground">
                        {credit.client?.first_name} {credit.client?.last_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium">{credit.asesor?.full_name}</p>
                    </div>
                    <StatusBadge status={credit.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState text="No hay créditos pendientes de revisión" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Créditos Estancados del Equipo (7+ días sin avance)
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
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {credit.asesor?.full_name} · {formatCurrency(credit.requested_amount)}
                    </p>
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
            <EmptyState text="No hay créditos estancados en el equipo" />
          )}
        </CardContent>
      </Card>

      {teamMembers.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Equipo a cargo ({teamMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {teamMembers.map((member) => {
                const r = ranking.find((x) => x.name === member.full_name);
                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                    <UserAvatar name={member.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{member.full_name}</p>
                      <p className="text-xs text-slate-500">
                        Meta: {formatCurrency(member.monthly_goal)}
                        {r && ` · ${r.count} créd.`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
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
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <TrendingUp className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500">{text}</p>
    </motion.div>
  );
}