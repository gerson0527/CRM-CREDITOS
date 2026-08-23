'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Target, DollarSign, Clock, AlertTriangle, TrendingUp,
  Award, Phone, MessageCircle, Mail, MapPin, Plus,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AppLayout } from '@/components/app-layout';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { AnimatedCounter } from '@/components/animated-counter';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { CREDIT_STATUSES, formatCurrency, formatDate, daysSince, FOLLOW_UP_CHANNELS } from '@/lib/constants';
import type { Credit, Profile, FollowUp } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

  useEffect(() => {
    if (profile?.id) {
      loadDashboard();
    }
  }, [profile?.id]);

  async function loadDashboard() {
    setLoading(true);

    // Get team members
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

    // Get team credits
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

      const disbursedThisMonth = credits.filter(
        (c: Credit) => c.status === 'desembolsado' && c.status_changed_at && new Date(c.status_changed_at) >= monthStart
      );
      const teamColocado = disbursedThisMonth.reduce((sum: number, c: Credit) => sum + (c.approved_amount || c.requested_amount), 0);

      const activeStatuses = ['lead', 'documentacion', 'enviado', 'estudio', 'aprobado'];
      const teamActivos = credits.filter((c: Credit) => activeStatuses.includes(c.status)).length;

      const teamMeta = (team || []).reduce((sum: number, t: Profile) => sum + (t.monthly_goal || 0), 0);

      // Pending approvals (credits in 'enviado' that need supervisor review)
      const pending = credits.filter((c: Credit) => c.status === 'enviado' || c.status === 'documentacion').slice(0, 5);

      // Stagnant
      const stagnant = credits
        .filter((c: Credit) => activeStatuses.includes(c.status) && daysSince(c.status_changed_at || c.created_at) >= 7)
        .slice(0, 5);

      // Ranking
      const rank = (team || [])
        .map((t: Profile) => {
          const asesorCredits = disbursedThisMonth.filter((c: Credit) => c.asesor_id === t.id);
          return {
            name: t.full_name,
            total: asesorCredits.reduce((sum: number, c: Credit) => sum + (c.approved_amount || c.requested_amount), 0),
            count: asesorCredits.length,
          };
        })
        .sort((a, b) => b.total - a.total);

      setTeamCredits(credits);
      setTeamMembers(team as Profile[]);
      setPendingApprovals(pending);
      setStagnantCredits(stagnant);
      setRanking(rank);
      setStats({ teamColocado, teamActivos, teamMeta });
    }

    setLoading(false);
  }

  const metaProgress = stats.teamMeta > 0 ? (stats.teamColocado / stats.teamMeta) * 100 : 0;

  const kpiCards = [
    {
      label: 'Colocación del equipo (mes)',
      value: stats.teamColocado,
      icon: <DollarSign className="h-5 w-5" />,
      color: 'text-green-600',
      bg: 'bg-green-100',
      format: (n: number) => formatCurrency(n),
    },
    {
      label: 'Créditos activos del equipo',
      value: stats.teamActivos,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      format: (n: number) => Math.round(n).toString(),
    },
    {
      label: 'Meta del equipo',
      value: stats.teamMeta,
      icon: <Target className="h-5 w-5" />,
      color: 'text-violet-600',
      bg: 'bg-violet-100',
      format: (n: number) => formatCurrency(n),
    },
    {
      label: 'Pendientes de revisión',
      value: pendingApprovals.length,
      icon: <Clock className="h-5 w-5" />,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
      format: (n: number) => Math.round(n).toString(),
    },
  ];

  return (
    <PageTransition>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard de supervisor</h1>
          <p className="text-sm text-muted-foreground">Gestión de tu equipo de asesores.</p>
        </div>
        <Button onClick={() => router.push('/creditos/nuevo')}>
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
            Cumplimiento de meta del equipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {formatCurrency(stats.teamColocado)} de {formatCurrency(stats.teamMeta)}
              </span>
              <span className="text-sm font-semibold">{metaProgress.toFixed(1)}%</span>
            </div>
            <Progress value={metaProgress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Ranking interno del equipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ranking.length > 0 ? (
              <div className="space-y-3">
                {ranking.map((asesor, i) => (
                  <motion.div
                    key={asesor.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-3"
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'
                    }`}>
                      {i + 1}
                    </div>
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{asesor.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{asesor.name}</p>
                      <p className="text-xs text-muted-foreground">{asesor.count} créditos</p>
                    </div>
                    <span className="text-sm font-semibold text-green-600">{formatCurrency(asesor.total)}</span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState text="Sin colocaciones este mes" />
            )}
          </CardContent>
        </Card>

        {/* Pending approvals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Créditos para revisión
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length > 0 ? (
              <div className="space-y-2">
                {pendingApprovals.map((credit) => (
                  <Link
                    key={credit.id}
                    href={`/creditos/${credit.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium">{credit.client?.first_name} {credit.client?.last_name}</p>
                      <p className="text-xs text-muted-foreground">{credit.asesor?.full_name}</p>
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

      {/* Stagnant credits */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Créditos estancados del equipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stagnantCredits.length > 0 ? (
            <div className="space-y-2">
              {stagnantCredits.map((credit) => (
                <Link
                  key={credit.id}
                  href={`/creditos/${credit.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <div>
                    <p className="text-sm font-medium">{credit.client?.first_name} {credit.client?.last_name}</p>
                    <p className="text-xs text-muted-foreground">{credit.asesor?.full_name} · {formatCurrency(credit.requested_amount)}</p>
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
