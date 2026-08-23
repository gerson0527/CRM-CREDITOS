'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, DollarSign,
  Calendar, FileText, MessageSquare, Plus, Clock,
  CheckCircle2, XCircle, Upload, User, TrendingUp,
} from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import {
  CREDIT_STATUSES, PIPELINE_ORDER, formatCurrency, formatDateTime, formatDate,
  FOLLOW_UP_CHANNELS, daysSince,
} from '@/lib/constants';
import type { Credit, CreditStatus, Document, FollowUp, CreditStatusHistory } from '@/lib/types';

export default function CreditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [credit, setCredit] = useState<Credit | null>(null);
  const [history, setHistory] = useState<CreditStatusHistory[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState({
    channel: 'llamada', comment: '', next_action_date: '', next_action_note: '',
  });

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);

    const { data: creditData } = await supabase
      .from('credits')
      .select(`
        *,
        client:clients(*),
        asesor:profiles!credits_asesor_id_fkey(id, full_name, phone),
        entity:financial_entities(id, name, contact_name, contact_phone),
        credit_type:credit_types(id, name)
      `)
      .eq('id', id)
      .maybeSingle();

    const { data: histData } = await supabase
      .from('credit_status_history')
      .select(`*, changed_by_profile:profiles!credit_status_history_changed_by_fkey(id, full_name)`)
      .eq('credit_id', id)
      .order('changed_at', { ascending: false });

    const { data: docsData } = await supabase
      .from('documents')
      .select('*')
      .eq('credit_id', id)
      .order('uploaded_at', { ascending: false });

    const { data: fuData } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('credit_id', id)
      .order('created_at', { ascending: false });

    setCredit(creditData as Credit | null);
    setHistory(histData as CreditStatusHistory[] || []);
    setDocuments(docsData as Document[] || []);
    setFollowUps(fuData as FollowUp[] || []);
    setLoading(false);
  }

  async function changeStatus(newStatus: CreditStatus) {
    if (!credit || !profile) return;
    const oldStatus = credit.status;

    const { error } = await supabase
      .from('credits')
      .update({ status: newStatus })
      .eq('id', credit.id);

    if (error) {
      toast.error('Error al cambiar estado');
      return;
    }

    await supabase.from('credit_status_history').insert({
      credit_id: credit.id,
      previous_status: oldStatus,
      new_status: newStatus,
      changed_by: profile.id,
      comment: `Cambió de ${CREDIT_STATUSES.find((s) => s.value === oldStatus)?.label} a ${CREDIT_STATUSES.find((s) => s.value === newStatus)?.label}`,
    });

    setCredit({ ...credit, status: newStatus });
    toast.success('Estado actualizado');
    loadData();
  }

  async function addFollowUp() {
    if (!credit || !profile || !newFollowUp.comment) return;

    const { error } = await supabase.from('follow_ups').insert({
      credit_id: credit.id,
      asesor_id: profile.id,
      channel: newFollowUp.channel,
      comment: newFollowUp.comment,
      next_action_date: newFollowUp.next_action_date || null,
      next_action_note: newFollowUp.next_action_note || null,
    });

    if (error) {
      toast.error('Error al registrar seguimiento');
      return;
    }

    toast.success('Seguimiento registrado');
    setNewFollowUp({ channel: 'llamada', comment: '', next_action_date: '', next_action_note: '' });
    setShowFollowUpForm(false);
    loadData();
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

  if (!credit) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-lg font-medium">Crédito no encontrado</p>
          <Button className="mt-4" onClick={() => router.push('/creditos')}>Volver a créditos</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageTransition>
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/creditos')}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Button>
        </div>

        {/* Header card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold">
                    {credit.client?.first_name} {credit.client?.last_name}
                  </h1>
                  <StatusBadge status={credit.status} animate />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cédula: {credit.client?.document_number} · Creado: {formatDate(credit.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PIPELINE_ORDER.filter((s) => s !== credit.status && s !== 'rechazado' && s !== 'desistido').map((s) => {
                  const config = CREDIT_STATUSES.find((c) => c.value === s)!;
                  return (
                    <Button key={s} variant="outline" size="sm" onClick={() => changeStatus(s)}>
                      {config.label}
                    </Button>
                  );
                })}
                {credit.status !== 'rechazado' && (
                  <Button variant="outline" size="sm" className="text-red-600" onClick={() => changeStatus('rechazado')}>
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Rechazar
                  </Button>
                )}
                {credit.status !== 'desistido' && (
                  <Button variant="outline" size="sm" onClick={() => changeStatus('desistido')}>
                    Desistido
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Main info */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">Información</TabsTrigger>
                <TabsTrigger value="timeline">Historial</TabsTrigger>
                <TabsTrigger value="docs">Documentos</TabsTrigger>
                <TabsTrigger value="followups">Seguimientos</TabsTrigger>
              </TabsList>

              {/* Info tab */}
              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4 text-primary" /> Datos del crédito</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Monto solicitado</span><span className="font-semibold">{formatCurrency(credit.requested_amount)}</span></div>
                      {credit.approved_amount !== null && <div className="flex justify-between"><span className="text-muted-foreground">Monto aprobado</span><span className="font-semibold text-green-600">{formatCurrency(credit.approved_amount)}</span></div>}
                      <div className="flex justify-between"><span className="text-muted-foreground">Plazo</span><span>{credit.term_months ? `${credit.term_months} meses` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Tasa</span><span>{credit.rate ? `${credit.rate}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span>{credit.credit_type?.name || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Entidad</span><span>{credit.entity?.name || '—'}</span></div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-primary" /> Datos del cliente</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> <span>{credit.client?.phone || '—'}</span></div>
                      <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> <span>{credit.client?.email || '—'}</span></div>
                      <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> <span>{credit.client?.city || '—'}</span></div>
                      <div className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> <span>Ingresos: {formatCurrency(credit.client?.reported_income)}</span></div>
                      {credit.asesor && <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" /> <span>Asesor: {credit.asesor.full_name}</span></div>}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Timeline tab */}
              <TabsContent value="timeline">
                <Card>
                  <CardContent className="pt-6">
                    {history.length > 0 ? (
                      <div className="space-y-4">
                        {history.map((h, i) => (
                          <StaggerList key={h.id}>
                            <StaggerItem>
                              <div className="flex gap-4">
                                <div className="flex flex-col items-center">
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                    {h.new_status === 'rechazado' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                  </div>
                                  {i < history.length - 1 && <div className="h-full w-0.5 bg-border" />}
                                </div>
                                <div className="flex-1 pb-4">
                                  <div className="flex items-center gap-2">
                                    <StatusBadge status={h.new_status} />
                                    {h.previous_status && <span className="text-xs text-muted-foreground">desde <StatusBadge status={h.previous_status} /></span>}
                                  </div>
                                  <p className="mt-1 text-sm text-muted-foreground">{h.comment}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {h.changed_by_profile?.full_name || 'Sistema'} · {formatDateTime(h.changed_at)}
                                  </p>
                                </div>
                              </div>
                            </StaggerItem>
                          </StaggerList>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin historial de cambios.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Documents tab */}
              <TabsContent value="docs">
                <Card>
                  <CardContent className="pt-6">
                    {documents.length > 0 ? (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-sm font-medium capitalize">{doc.document_type.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(doc.uploaded_at)}</p>
                              </div>
                            </div>
                            <Badge className={doc.status === 'validado' ? 'bg-green-100 text-green-700' : doc.status === 'rechazado' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                              {doc.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 3, repeat: Infinity }} className="flex flex-col items-center py-8 text-center">
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">Sin documentos cargados</p>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Follow-ups tab */}
              <TabsContent value="followups">
                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-medium">Seguimientos ({followUps.length})</p>
                      <Button size="sm" onClick={() => setShowFollowUpForm(!showFollowUpForm)}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Nuevo seguimiento
                      </Button>
                    </div>

                    <AnimatePresence>
                      {showFollowUpForm && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-4 overflow-hidden"
                        >
                          <div className="space-y-3 rounded-lg border p-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Canal</Label>
                                <Select value={newFollowUp.channel} onValueChange={(v) => setNewFollowUp({ ...newFollowUp, channel: v })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {FOLLOW_UP_CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Próxima acción (fecha)</Label>
                                <Input type="date" value={newFollowUp.next_action_date} onChange={(e) => setNewFollowUp({ ...newFollowUp, next_action_date: e.target.value })} />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Comentario</Label>
                              <Textarea value={newFollowUp.comment} onChange={(e) => setNewFollowUp({ ...newFollowUp, comment: e.target.value })} placeholder="Resultado de la contacto..." rows={2} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Nota próxima acción</Label>
                              <Input value={newFollowUp.next_action_note} onChange={(e) => setNewFollowUp({ ...newFollowUp, next_action_note: e.target.value })} placeholder="Llamar para confirmar..." />
                            </div>
                            <Button onClick={addFollowUp} size="sm">Guardar seguimiento</Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {followUps.length > 0 ? (
                      <div className="space-y-2">
                        {followUps.map((fu) => (
                          <div key={fu.id} className={`rounded-lg border p-3 ${fu.completed ? 'opacity-60' : ''}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="capitalize">{fu.channel}</Badge>
                                {fu.next_action_date && !fu.completed && (
                                  <Badge className="bg-amber-100 text-amber-700">
                                    <Clock className="mr-1 h-3 w-3" />
                                    {formatDate(fu.next_action_date)}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{formatDateTime(fu.contact_date)}</span>
                            </div>
                            <p className="mt-2 text-sm">{fu.comment}</p>
                            {fu.next_action_note && <p className="mt-1 text-xs text-muted-foreground">→ {fu.next_action_note}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 3, repeat: Infinity }} className="flex flex-col items-center py-8 text-center">
                        <MessageSquare className="h-10 w-10 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">Sin seguimientos registrados</p>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Quick stats */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Resumen</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Días en proceso</span>
                  <span className="font-semibold">{daysSince(credit.created_at)} días</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Última actualización</span>
                  <span className="font-semibold">{daysSince(credit.status_changed_at)} días</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Documentos</span>
                  <span className="font-semibold">{documents.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Seguimientos</span>
                  <span className="font-semibold">{followUps.length}</span>
                </div>
              </CardContent>
            </Card>

            {credit.rejection_reason && (
              <Card className="border-red-300">
                <CardHeader><CardTitle className="text-sm text-red-700">Motivo de rechazo</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-red-600">{credit.rejection_reason}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageTransition>
    </AppLayout>
  );
}
