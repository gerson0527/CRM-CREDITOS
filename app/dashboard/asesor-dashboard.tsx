'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Target, DollarSign, Clock, AlertTriangle, TrendingUp,
  Plus, Phone, MessageCircle, Mail, MapPin, CheckCircle2,
  FileWarning,
} from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { AnimatedCounter } from '@/components/animated-counter';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { CREDIT_STATUSES, formatCurrency, formatDate, FOLLOW_UP_CHANNELS, daysSince } from '@/lib/constants';
import type { Credit, FollowUp } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  const totalColocado = disbursedThisMonth.reduce((sum, c) => sum + (c.approved_amount || c.requested_amount), 0);
  const monthlyGoal = profile?.monthly_goal || 0;
  const metaProgress = monthlyGoal > 0 ? (totalColocado / monthlyGoal) * 100 : 0;
  const commissionRate = profile?.commission_rate || 0;
  const estimatedCommission = totalColocado * (commissionRate / 100);

  const activeStatuses = ['lead', 'documentacion', 'enviado', 'estudio', 'aprobado'];
  const activeCredits = credits.filter((c) => activeStatuses.includes(c.status));

  // Credits with incomplete docs
  const incompleteDocs = credits.filter((c) => c.status === 'documentacion' || c.status === 'lead');

  // Group by status
  const byStatus = CREDIT_STATUSES.filter((s) => activeStatuses.includes(s.value)).map((s) => ({
    ...s,
    count: credits.filter((c) => c.status === s.value).length,
  }));

  // Today's follow-ups
  const todayStr = now.toISOString().split('T')[0];
  const todayFollowUps = followUps.filter((f) => f.next_action_date === todayStr);
  const weekFollowUps = followUps.filter((f) => {
    if (!f.next_action_date) return false;
    const d = new Date(f.next_action_date);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return d >= now && d <= weekEnd;
  });

  const kpiCards = [
    {
      label: 'Meta del mes',
      value: monthlyGoal,
      icon: <Target className="h-5 w-5" />,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      format: (n: number) => formatCurrency(n),
    },
    {
      label: 'Colocado (mes)',
      value: totalColocado,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'text-green-600',
      bg: 'bg-green-100',
      format: (n: number) => formatCurrency(n),
    },
    {
      label: 'Comisión estimada',
      value: estimatedCommission,
      icon: <DollarSign className="h-5 w-5" />,
      color: 'text-violet-600',
      bg: 'bg-violet-100',
      format: (n: number) => formatCurrency(n),
    },
    {
      label: 'Seguimientos hoy',
      value: todayFollowUps.length,
      icon: <Clock className="h-5 w-5" />,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
      format: (n: number) => Math.round(n).toString(),
    },
  ];

  const channelIcons: Record<string, React.ReactNode> = {
    llamada: <Phone className="h-3.5 w-3.5" />,
    whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
    visita: <MapPin className="h-3.5 w-3.5" />,
    email: <Mail className="h-3.5 w-3.5" />,
  };

  return (
    <PageTransition>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi dashboard</h1>
          <p className="text-sm text-muted-foreground">Hola, {profile?.full_name}. Aquí está tu resumen.</p>
        </div>
        <Button onClick={() => router.push('/creditos/nuevo')} size="lg" className="h-11">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo crédito
        </Button>
      </div>

      {/* KPI Cards */}
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

      {/* Meta progress */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Progreso de meta del mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {formatCurrency(totalColocado)} de {formatCurrency(monthlyGoal)}
              </span>
              <span className="text-sm font-semibold">{metaProgress.toFixed(1)}%</span>
            </div>
            <Progress value={Math.min(metaProgress, 100)} className="h-3" />
            {metaProgress >= 100 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 text-sm text-green-600"
              >
                <CheckCircle2 className="h-4 w-4" />
                ¡Meta alcanzada!
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Mini kanban */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mis créditos activos</CardTitle>
          </CardHeader>
          <CardContent>
            {activeCredits.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {byStatus.filter((s) => s.count > 0).map((s, i) => (
                  <motion.div
                    key={s.value}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={`rounded-lg border-2 p-3 text-center ${s.borderColor} ${s.bgColor}`}
                  >
                    <div className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</div>
                    <div className={`text-xs ${s.textColor}`}>{s.label}</div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState text="No tienes créditos activos. ¡Crea uno nuevo!" />
            )}

            {activeCredits.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Créditos recientes</p>
                {activeCredits.slice(0, 4).map((credit) => (
                  <Link
                    key={credit.id}
                    href={`/creditos/${credit.id}`}
                    className="flex items-center justify-between rounded-lg border p-2.5 transition-colors hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium">{credit.client?.first_name} {credit.client?.last_name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(credit.requested_amount)}</p>
                    </div>
                    <StatusBadge status={credit.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Follow-ups today */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Seguimientos pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weekFollowUps.length > 0 ? (
              <div className="space-y-2">
                {weekFollowUps.slice(0, 6).map((fu) => {
                  const isToday = fu.next_action_date === todayStr;
                  return (
                    <Link
                      key={fu.id}
                      href={`/creditos/${fu.credit_id}`}
                      className={`flex items-start gap-2 rounded-lg border p-3 transition-colors hover:bg-accent ${
                        isToday ? 'border-amber-300 bg-amber-50' : ''
                      }`}
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {channelIcons[fu.channel]}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">
                          {fu.credit?.client?.first_name} {fu.credit?.client?.last_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{fu.next_action_note || fu.comment}</p>
                        <p className="text-xs text-muted-foreground">
                          {isToday ? (
                            <span className="font-medium text-amber-600">Hoy</span>
                          ) : (
                            formatDate(fu.next_action_date)
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

      {/* Incomplete docs */}
      {incompleteDocs.length > 0 && (
        <Card className="mt-6 border-amber-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <FileWarning className="h-5 w-5" />
              Créditos con documentación incompleta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {incompleteDocs.map((credit) => (
                <Link
                  key={credit.id}
                  href={`/creditos/${credit.id}`}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 transition-colors hover:bg-amber-100"
                >
                  <div>
                    <p className="text-sm font-medium">{credit.client?.first_name} {credit.client?.last_name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(credit.requested_amount)}</p>
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
      className="flex flex-col items-center justify-center py-8 text-center"
    >
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </motion.div>
  );
}
