'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Target, DollarSign, Clock, AlertTriangle, TrendingUp,
  Plus, Phone, MessageCircle, Mail, MapPin, CheckCircle2,
  FileWarning, Calendar, UserPlus,
} from 'lucide-react';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { RoleBanner, AttentionSection } from '@/components/role-banner';
import { KpiCard } from '@/components/kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { CREDIT_STATUSES, formatCurrency, formatDate } from '@/lib/constants';
import type { Credit, FollowUp } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function AsesorDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [credits, setCredits] = useState<Credit[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadDashboard();
    }
  }, [profile?.id]);

  async function loadDashboard() {
    setLoading(true);

    const { data: creditsData } = await supabase
      .from('credits')
      .select(`
        *,
        client:clients(*),
        entity:financial_entities(id, name),
        credit_type:credit_types(id, name)
      `)
      .eq('asesor_id', profile!.id)
      .order('created_at', { ascending: false });

    const { data: followUpsData } = await supabase
      .from('follow_ups')
      .select(`
        *,
        credit:credits(
          id, status,
          client:clients(first_name, last_name)
        )
      `)
      .eq('asesor_id', profile!.id)
      .eq('completed', false)
      .order('next_action_date', { ascending: true, nullsFirst: false })
      .limit(10);

    setCredits(creditsData as Credit[] || []);
    setFollowUps(followUpsData as FollowUp[] || []);
    setLoading(false);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const disbursedThisMonth = credits.filter(
    (c) => c.status === 'desembolsado' && c.status_changed_at && new Date(c.status_changed_at) >= monthStart
  );
  const totalColocado = disbursedThisMonth.reduce(
    (sum, c) => sum + Number(c.approved_amount ?? c.requested_amount ?? 0),
    0
  );
  const monthlyGoal = Number(profile?.monthly_goal ?? 0);
  const metaProgress = monthlyGoal > 0 ? (totalColocado / monthlyGoal) * 100 : 0;
  const commissionRate = Number(profile?.commission_rate ?? 0);
  const estimatedCommission = totalColocado * (commissionRate / 100);

  const activeStatuses = ['lead', 'documentacion', 'enviado', 'estudio', 'aprobado'];
  const activeCredits = credits.filter((c) => activeStatuses.includes(c.status));

  const incompleteDocs = credits.filter((c) => c.status === 'documentacion' || c.status === 'lead');

  const byStatus = CREDIT_STATUSES.filter((s) => activeStatuses.includes(s.value)).map((s) => ({
    ...s,
    count: credits.filter((c) => c.status === s.value).length,
  }));

  const todayStr = now.toISOString().split('T')[0];
  const todayFollowUps = followUps.filter((f) => f.next_action_date === todayStr);
  const weekFollowUps = followUps.filter((f) => {
    if (!f.next_action_date) return false;
    const d = new Date(f.next_action_date);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return d >= now && d <= weekEnd;
  });
  const overdueFollowUps = followUps.filter((f) =>
    !f.completed && f.next_action_date && f.next_action_date.split('T')[0] < todayStr
  );

  const kpiCards = [
    {
      label: 'Meta del mes',
      value: monthlyGoal,
      icon: <Target className="h-5 w-5" />,
      tone: 'blue' as const,
      format: (n: number) => formatCurrency(n),
      footer: `${metaProgress.toFixed(1)}% avance`,
    },
    {
      label: 'Colocado (mes)',
      value: totalColocado,
      icon: <TrendingUp className="h-5 w-5" />,
      tone: 'green' as const,
      format: (n: number) => formatCurrency(n),
      footer: `${disbursedThisMonth.length} créditos`,
    },
    {
      label: 'Comisión estimada',
      value: estimatedCommission,
      icon: <DollarSign className="h-5 w-5" />,
      tone: 'violet' as const,
      format: (n: number) => formatCurrency(n),
      footer: `${commissionRate}% tasa`,
    },
    {
      label: 'Seguimientos hoy',
      value: todayFollowUps.length,
      icon: <Clock className="h-5 w-5" />,
      tone: 'amber' as const,
      format: (n: number) => Math.round(n).toString(),
      footer: `${weekFollowUps.length} esta semana`,
    },
  ];

  const channelIcons: Record<string, React.ReactNode> = {
    llamada: <Phone className="h-3.5 w-3.5" />,
    whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
    visita: <MapPin className="h-3.5 w-3.5" />,
    email: <Mail className="h-3.5 w-3.5" />,
  };

  const channelStyles: Record<string, string> = {
    llamada: 'bg-blue-50 text-blue-700',
    whatsapp: 'bg-emerald-50 text-emerald-700',
    visita: 'bg-violet-50 text-violet-700',
    email: 'bg-amber-50 text-amber-700',
  };

  return (
    <PageTransition>
      <RoleBanner
        roleLabel="Asesor"
        tone="violet"
        greeting={`Hola, ${profile?.full_name?.split(' ')[0] || ''}`}
        subtitle="Aquí está tu día a día: tareas, seguimientos y cómo vas con tu meta."
        actions={[
          { label: 'Nuevo crédito', href: '/creditos/nuevo', icon: <Plus className="h-3.5 w-3.5" /> },
          { label: 'Mi agenda', href: '/calendario', icon: <Calendar className="h-3.5 w-3.5" /> },
          { label: 'Mis clientes', href: '/clientes', icon: <UserPlus className="h-3.5 w-3.5" /> },
        ]}
      />

      <div className="mt-6">
        <AttentionSection
          title="Hoy"
          subtitle="Lo que tienes que hacer ahora"
          items={[
            {
              label: 'Seguimientos hoy',
              value: todayFollowUps.length,
              href: '/calendario',
              tone: 'amber',
              description: todayFollowUps[0] ? `${todayFollowUps[0].credit?.client?.first_name || ''} ${todayFollowUps[0].credit?.client?.last_name || ''}` : 'Sin tareas hoy',
            },
            {
              label: 'Vencidos',
              value: overdueFollowUps.length,
              href: '/calendario',
              tone: 'red',
              description: overdueFollowUps.length > 0 ? 'requieren reagendar' : 'Todo al día',
            },
            {
              label: 'Docs incompletas',
              value: incompleteDocs.length,
              href: '/kanban',
              tone: 'blue',
              description: 'créditos que necesitan documentación',
            },
          ]}
        />
      </div>

      <PageHeader
        title="Mis Indicadores Clave"
        description="Seguimiento en tiempo real de tu avance mensual y comisiones."
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
              footer={kpi.footer}
            />
          </StaggerItem>
        ))}
      </StaggerList>

      <Card className="mt-6 border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <Target className="h-4 w-4 text-primary" />
            Progreso de Meta del Mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                {formatCurrency(totalColocado)} de {formatCurrency(monthlyGoal)}
              </span>
              <span className="font-display text-sm font-bold text-foreground tabular-nums">{metaProgress.toFixed(1)}%</span>
            </div>
            <Progress value={Math.min(metaProgress, 100)} className="h-3 rounded-full bg-accent" />
            {metaProgress >= 100 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300"
              >
                <CheckCircle2 className="h-4 w-4" />
                ¡Felicitaciones! Has superado tu meta mensual de colocación.
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-base font-bold text-foreground">Mis Créditos en Curso</CardTitle>
          </CardHeader>
          <CardContent>
            {activeCredits.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {byStatus.filter((s) => s.count > 0).map((s, i) => (
                    <motion.div
                      key={s.value}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="rounded-2xl border border-border/70 p-3 text-center bg-accent/20"
                    >
                      <div className="font-display text-2xl font-bold" style={{ color: s.color }}>{s.count}</div>
                      <div className="text-xs font-bold text-foreground mt-0.5">{s.label}</div>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-5 space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Créditos Recientes</p>
                  {activeCredits.slice(0, 4).map((credit) => (
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
                      <StatusBadge status={credit.status} />
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState text="No tienes créditos activos. ¡Crea uno nuevo!" />
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Clock className="h-4 w-4 text-amber-500" />
              Seguimientos Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weekFollowUps.length > 0 ? (
              <div className="space-y-2.5">
                {weekFollowUps.slice(0, 6).map((fu) => {
                  const isToday = fu.next_action_date === todayStr;
                  const isOverdue = fu.next_action_date && fu.next_action_date.split('T')[0] < todayStr;
                  return (
                    <Link
                      key={fu.id}
                      href={`/creditos/${fu.credit_id}`}
                      className={cn(
                        'flex items-start gap-3 rounded-2xl border p-3 transition-all hover:shadow-2xs',
                        isOverdue
                          ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
                          : isToday
                          ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
                          : 'border-border/70 bg-accent/20 hover:bg-accent/50'
                      )}
                    >
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', channelStyles[fu.channel] || 'bg-muted text-muted-foreground')}>
                        {channelIcons[fu.channel]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-foreground">
                          {fu.credit?.client?.first_name} {fu.credit?.client?.last_name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{fu.next_action_note || fu.comment}</p>
                        <p className="mt-0.5 text-[11px]">
                          {isOverdue ? (
                            <span className="font-bold text-red-600 dark:text-red-400">Vencido</span>
                          ) : isToday ? (
                            <span className="font-bold text-amber-600 dark:text-amber-400">Hoy</span>
                          ) : (
                            <span className="text-muted-foreground font-medium">{formatDate(fu.next_action_date)}</span>
                          )}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="No tienes seguimientos pendientes" />
            )}
          </CardContent>
        </Card>
      </div>

      {incompleteDocs.length > 0 && (
        <Card className="mt-6 border border-amber-500/30 bg-amber-500/5 shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-amber-700 dark:text-amber-300">
              <FileWarning className="h-4 w-4" />
              Créditos con Documentación Incompleta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {incompleteDocs.map((credit) => (
                <Link
                  key={credit.id}
                  href={`/creditos/${credit.id}`}
                  className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-background/80 p-3 transition-all hover:bg-background hover:shadow-2xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-xs font-bold text-foreground">
                      {credit.client?.first_name} {credit.client?.last_name}
                    </p>
                    <p className="text-[11px] font-semibold text-muted-foreground tabular-nums">{formatCurrency(credit.requested_amount)}</p>
                  </div>
                  <StatusBadge status={credit.status} />
                </Link>
              ))}
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
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-muted-foreground">
        <TrendingUp className="h-5 w-5" />
      </div>
      <p className="text-xs font-medium text-muted-foreground">{text}</p>
    </motion.div>
  );
}