'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, Mail, MapPin, DollarSign, FileText, Plus,
  Building2, Calendar,
} from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { PageTransition } from '@/components/transitions';
import { UserAvatar } from '@/components/user-avatar';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/constants';
import type { Client, Credit } from '@/lib/types';

interface ClientDetail extends Client {
  asesor?: { id: string; full_name: string } | null;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);

    const { data: clientData } = await supabase
      .from('clients')
      .select(`
        *,
        asesor:profiles!clients_created_by_fkey(id, full_name)
      `)
      .eq('id', id)
      .maybeSingle();

    setClient((clientData as ClientDetail) || null);

    const { data: creditsData } = await supabase
      .from('credits')
      .select(`
        *,
        entity:financial_entities(id, name),
        credit_type:credit_types(id, name),
        asesor:profiles!credits_asesor_id_fkey(id, full_name)
      `)
      .eq('client_id', id)
      .order('created_at', { ascending: false });

    setCredits((creditsData as Credit[]) || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-lg font-medium text-slate-900">Cliente no encontrado</p>
          <p className="mt-1 text-sm text-slate-500">No tienes acceso a este cliente o no existe.</p>
          <Button className="mt-4" onClick={() => router.push('/clientes')}>
            Volver a clientes
          </Button>
        </div>
      </AppLayout>
    );
  }

  const totalPlaced = credits.reduce(
    (s, c) => s + Number(c.approved_amount ?? c.requested_amount ?? 0),
    0
  );
  const activeCount = credits.filter((c) =>
    ['lead', 'documentacion', 'enviado', 'estudio', 'aprobado'].includes(c.status)
  ).length;
  const disbursedCount = credits.filter((c) => c.status === 'desembolsado').length;

  return (
    <AppLayout>
      <PageTransition>
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/clientes')}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        </div>

        {/* Header card */}
        <Card className="mb-6">
          <CardContent className="pt-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <UserAvatar
                  name={`${client.first_name} ${client.last_name}`}
                  size="lg"
                  className="!h-14 !w-14 !text-lg"
                />
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900">
                    {client.first_name} {client.last_name}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Cédula: <span className="font-mono">{client.document_number}</span>
                    {' · '}
                    Registrado: {formatDate(client.created_at)}
                  </p>
                  {client.asesor && (
                    <p className="mt-1 text-xs text-slate-500">
                      Asesor responsable: <span className="font-medium text-slate-700">{client.asesor.full_name}</span>
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={() => router.push('/creditos/nuevo')}>
                <Plus className="h-4 w-4" />
                Nuevo crédito para este cliente
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Info del cliente */}
          <div className="space-y-4 lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Datos de contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-900">{client.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-900 break-all">{client.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-900">{client.city || '—'}</span>
                </div>
                {client.address && (
                  <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {client.address}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Información financiera</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Ingresos reportados</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(client.reported_income)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total colocado</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(totalPlaced)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Créditos totales</span>
                  <span className="font-semibold text-slate-900">{credits.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Créditos activos</span>
                  <span className="font-semibold text-blue-600">{activeCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Desembolsados</span>
                  <span className="font-semibold text-emerald-600">{disbursedCount}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Historial de créditos */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Historial de créditos ({credits.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {credits.length === 0 ? (
                  <motion.div
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="flex flex-col items-center justify-center py-10 text-center"
                  >
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <DollarSign className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">Este cliente aún no tiene créditos registrados.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => router.push('/creditos/nuevo')}
                    >
                      <Plus className="h-4 w-4" />
                      Crear primer crédito
                    </Button>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    {credits.map((credit, i) => (
                      <motion.div
                        key={credit.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <button
                          onClick={() => router.push(`/creditos/${credit.id}`)}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-primary/40 hover:bg-slate-50"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={credit.status} />
                              <span className="font-semibold text-slate-900">
                                {formatCurrency(credit.requested_amount)}
                              </span>
                              {credit.approved_amount !== null && credit.approved_amount !== credit.requested_amount && (
                                <span className="text-xs text-slate-500">
                                  (aprobado: {formatCurrency(credit.approved_amount)})
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              {credit.entity && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {credit.entity.name}
                                </span>
                              )}
                              {credit.credit_type && <span>{credit.credit_type.name}</span>}
                              {credit.term_months && <span>{credit.term_months} meses</span>}
                              {credit.rate && <span>{credit.rate}%</span>}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(credit.created_at)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-3 shrink-0 text-right text-xs">
                            <p className="text-slate-400">Última actualización</p>
                            <p className="font-medium text-slate-700">
                              {formatDate(credit.status_changed_at)}
                            </p>
                          </div>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageTransition>
    </AppLayout>
  );
}