'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileText, TrendingUp, DollarSign, Award } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { AppLayout } from '@/components/app-layout';
import { RouteGuard } from '@/components/providers/route-guard';
import { PageTransition } from '@/components/transitions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase/client';
import { CREDIT_STATUSES, formatCurrency, formatDate } from '@/lib/constants';
import type { Credit, Profile } from '@/lib/types';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: creditsData } = await supabase
      .from('credits')
      .select(`*, client:clients(*), asesor:profiles!credits_asesor_id_fkey(id, full_name), entity:financial_entities(id, name)`)
      .order('created_at', { ascending: false });
    const { data: usersData } = await supabase.from('profiles').select('*').eq('role', 'asesor').eq('status', 'activo');
    setCredits(creditsData as Credit[] || []);
    setAsesores(usersData as Profile[] || []);
    setLoading(false);
  }

  function exportCSV() {
    const headers = ['Cliente', 'Cédula', 'Monto', 'Estado', 'Asesor', 'Entidad', 'Creado'];
    const rows = credits.map((c) => [
      `${c.client?.first_name} ${c.client?.last_name}`,
      c.client?.document_number || '',
      c.requested_amount,
      CREDIT_STATUSES.find((s) => s.value === c.status)?.label || c.status,
      c.asesor?.full_name || '',
      c.entity?.name || '',
      formatDate(c.created_at),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_creditos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Monthly trend
  const monthlyData = (() => {
    const months: { [key: string]: { month: string; count: number; amount: number } } = {};
    credits.forEach((c) => {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
      if (!months[key]) months[key] = { month: label, count: 0, amount: 0 };
      months[key].count++;
      months[key].amount += c.requested_amount;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  })();

  // Asesor performance
  const asesorPerf = asesores.map((a) => {
    const asesorCredits = credits.filter((c) => c.asesor_id === a.id);
    const disbursed = asesorCredits.filter((c) => c.status === 'desembolsado');
    const total = disbursed.reduce((sum, c) => sum + (c.approved_amount || c.requested_amount), 0);
    return { name: a.full_name, credits: asesorCredits.length, disbursed: disbursed.length, total };
  }).sort((a, b) => b.total - a.total);

  return (
    <PageTransition>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
          <p className="text-sm text-muted-foreground">Análisis de desempeño y colocación.</p>
        </div>
        <Button onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Monthly trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Tendencia mensual (6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" name="Créditos" strokeWidth={2} />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--secondary))" name="Monto" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground">Sin datos suficientes.</p>}
            </CardContent>
          </Card>

          {/* Asesor performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                Desempeño por asesor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asesor</TableHead>
                    <TableHead>Total créditos</TableHead>
                    <TableHead>Desembolsados</TableHead>
                    <TableHead>Monto colocado</TableHead>
                    <TableHead>Tasa conversión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asesorPerf.map((a, i) => (
                    <motion.tr
                      key={a.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.credits}</TableCell>
                      <TableCell>{a.disbursed}</TableCell>
                      <TableCell className="text-green-600 font-semibold">{formatCurrency(a.total)}</TableCell>
                      <TableCell>{a.credits > 0 ? ((a.disbursed / a.credits) * 100).toFixed(1) : 0}%</TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}
