'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, DollarSign,
  Calendar, FileText, MessageSquare, Plus, Clock,
  CheckCircle2, XCircle, Upload, User, TrendingUp, ArrowRightLeft, ShieldCheck,
} from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { PageTransition, StaggerList, StaggerItem } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { ImagePreview } from '@/components/image-preview';

function getDocumentPreview(doc: Document) {
  try {
    const stored = JSON.parse(doc.file_url) as { original?: string; thumb?: string };
    const mainKey = stored.original || doc.file_url;
    const extension = mainKey.split('.').pop()?.toLowerCase() || '';
    const contentType = extension === 'pdf' ? 'application/pdf' : `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    return { mainKey, thumbKey: stored.thumb, contentType, filename: `${doc.document_type}.${extension || 'archivo'}` };
  } catch {
    const extension = doc.file_url.split('.').pop()?.toLowerCase() || '';
    return {
      mainKey: doc.file_url,
      contentType: extension === 'pdf' ? 'application/pdf' : `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      filename: `${doc.document_type}.${extension || 'archivo'}`,
    };
  }
}

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
          <p className="font-display text-lg font-bold">Crédito no encontrado</p>
          <Button className="mt-4 rounded-xl" onClick={() => router.push('/creditos')}>Volver a créditos</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageTransition>
        <div className="mb-5 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push('/creditos')} className="rounded-xl font-bold text-xs">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver a Créditos
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">ID Radicación:</span>
            <span className="font-mono text-xs font-bold text-foreground bg-accent/60 px-2 py-0.5 rounded-md">
              {credit.id.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Header Hero Card */}
        <Card className="mb-6 border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      {credit.client?.first_name} {credit.client?.last_name}
                    </h1>
                    <StatusBadge status={credit.status} animate />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cédula: <strong className="text-foreground">CC {credit.client?.document_number}</strong> · Radicado el {formatDate(credit.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Monto Solicitado</p>
                    <p className="font-display text-xl font-extrabold text-primary tabular-nums">
                      {formatCurrency(credit.requested_amount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Transition Bar (Admins) */}
              {profile?.role === 'admin' && (
                <div className="mt-2 rounded-2xl border border-border/70 bg-accent/30 p-3.5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Transición Rápida de Estado (Admin)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CREDIT_STATUSES.filter((s) => s.value !== credit.status).map((s) => {
                      const isRejection = s.value === 'rechazado';
                      const isDesist = s.value === 'desistido';
                      return (
                        <Button
                          key={s.value}
                          variant="outline"
                          size="sm"
                          onClick={() => changeStatus(s.value)}
                          className={cn(
                            'h-8 rounded-xl text-xs font-bold transition-all shadow-2xs',
                            isRejection
                              ? 'border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-500/10'
                              : isDesist
                              ? 'border-border/80 text-muted-foreground hover:bg-accent'
                              : 'hover:border-primary/50 hover:bg-primary/5'
                          )}
                        >
                          {isRejection && <XCircle className="mr-1 h-3.5 w-3.5 text-red-500" />}
                          {s.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs & Sidebar */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="h-11 w-full justify-start rounded-2xl border border-border/80 bg-accent/30 p-1">
                <TabsTrigger value="info" className="rounded-xl text-xs font-bold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                  Información
                </TabsTrigger>
                <TabsTrigger value="timeline" className="rounded-xl text-xs font-bold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                  Historial ({history.length})
                </TabsTrigger>
                <TabsTrigger value="docs" className="rounded-xl text-xs font-bold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                  Documentos ({documents.length})
                </TabsTrigger>
                <TabsTrigger value="followups" className="rounded-xl text-xs font-bold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                  Seguimientos ({followUps.length})
                </TabsTrigger>
              </TabsList>

              {/* Info tab */}
              <TabsContent value="info" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Card className="border border-border/80 bg-card/90 shadow-xs">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                        <DollarSign className="h-4 w-4 text-primary" /> Datos de la Solicitud
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Monto Solicitado</span>
                        <span className="font-display font-bold text-foreground tabular-nums">{formatCurrency(credit.requested_amount)}</span>
                      </div>
                      {credit.approved_amount !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground font-medium">Monto Aprobado</span>
                          <span className="font-display font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(credit.approved_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Plazo</span>
                        <span className="font-bold text-foreground">{credit.term_months ? `${credit.term_months} meses` : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Tasa Estimada</span>
                        <span className="font-bold text-foreground">{credit.rate ? `${credit.rate}% M.V.` : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Línea de Crédito</span>
                        <span className="font-bold text-foreground">{credit.credit_type?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Entidad Financiera</span>
                        <span className="font-bold text-foreground">{credit.entity?.name || '—'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-border/80 bg-card/90 shadow-xs">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                        <User className="h-4 w-4 text-primary" /> Perfil del Cliente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Teléfono</span>
                        <span className="font-bold text-foreground">{credit.client?.phone || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Correo</span>
                        <span className="font-bold text-foreground">{credit.client?.email || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Ciudad</span>
                        <span className="font-bold text-foreground">{credit.client?.city || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Ingresos</span>
                        <span className="font-bold text-foreground tabular-nums">{formatCurrency(credit.client?.reported_income)}</span>
                      </div>
                      {credit.asesor && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-medium flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Asesor</span>
                          <span className="font-bold text-foreground">{credit.asesor.full_name}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Timeline tab */}
              <TabsContent value="timeline" className="mt-4">
                <Card className="border border-border/80 bg-card/90 shadow-xs">
                  <CardContent className="p-5">
                    {history.length > 0 ? (
                      <div className="space-y-4">
                        {history.map((h, i) => (
                          <div key={h.id} className="flex gap-3.5">
                            <div className="flex flex-col items-center">
                              <div className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-xl font-bold shadow-2xs',
                                i === 0 ? 'bg-primary text-primary-foreground shadow-primary/20' : 'bg-accent text-muted-foreground'
                              )}>
                                {h.new_status === 'rechazado' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                              </div>
                              {i < history.length - 1 && <div className="h-full w-0.5 bg-border/80 my-1" />}
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={h.new_status} />
                                {h.previous_status && <span className="text-[11px] text-muted-foreground">desde <StatusBadge status={h.previous_status} /></span>}
                              </div>
                              <p className="mt-1 text-xs text-foreground font-medium">{h.comment}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {h.changed_by_profile?.full_name || 'Sistema'} · {formatDateTime(h.changed_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-4 text-center">Sin historial de cambios registrado.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Documents tab */}
              <TabsContent value="docs" className="mt-4">
                <Card className="border border-border/80 bg-card/90 shadow-xs">
                  <CardContent className="p-5">
                    {documents.length > 0 ? (
                      <div className="space-y-2.5">
                        {documents.map((doc) => (
                          <div key={doc.id} className="rounded-2xl border border-border/70 bg-accent/20 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold capitalize text-foreground">{doc.document_type.replace(/_/g, ' ')}</p>
                                  <p className="text-[11px] text-muted-foreground font-medium">{formatDate(doc.uploaded_at)}</p>
                                </div>
                              </div>
                              <Badge className={cn(
                                'rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-none',
                                doc.status === 'validado' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                  : doc.status === 'rechazado' ? 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                              )}>
                                {doc.status}
                              </Badge>
                            </div>
                            <ImagePreview {...getDocumentPreview(doc)} canDownload={profile?.role === 'admin'} variant="inline" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-8 text-center">
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <p className="mt-2 text-xs font-medium text-muted-foreground">Sin documentos adjuntos</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Follow-ups tab */}
              <TabsContent value="followups" className="mt-4">
                <Card className="border border-border/80 bg-card/90 shadow-xs">
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="font-display text-xs font-bold text-foreground">Bitácora de Contacto ({followUps.length})</p>
                      <Button size="sm" onClick={() => setShowFollowUpForm(!showFollowUpForm)} className="rounded-xl text-xs font-bold">
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Nuevo Seguimiento
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
                          <div className="space-y-3 rounded-2xl border border-border/80 bg-accent/30 p-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Canal</Label>
                                <Select value={newFollowUp.channel} onValueChange={(v) => setNewFollowUp({ ...newFollowUp, channel: v })}>
                                  <SelectTrigger className="h-10 rounded-xl bg-background text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {FOLLOW_UP_CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Próxima Acción (Fecha)</Label>
                                <Input type="date" value={newFollowUp.next_action_date} onChange={(e) => setNewFollowUp({ ...newFollowUp, next_action_date: e.target.value })} className="h-10 rounded-xl bg-background text-xs" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">Comentario del Contacto</Label>
                              <Textarea value={newFollowUp.comment} onChange={(e) => setNewFollowUp({ ...newFollowUp, comment: e.target.value })} placeholder="Resumen de la llamada o reunión..." rows={2} className="rounded-xl bg-background text-xs" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">Nota de Próxima Tarea</Label>
                              <Input value={newFollowUp.next_action_note} onChange={(e) => setNewFollowUp({ ...newFollowUp, next_action_note: e.target.value })} placeholder="Ej. Confirmar envío de extracto..." className="h-10 rounded-xl bg-background text-xs" />
                            </div>
                            <Button onClick={addFollowUp} size="sm" className="rounded-xl font-bold">Guardar Seguimiento</Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {followUps.length > 0 ? (
                      <div className="space-y-2.5">
                        {followUps.map((fu) => (
                          <div key={fu.id} className={cn('rounded-2xl border border-border/70 bg-accent/20 p-3.5', fu.completed && 'opacity-60')}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="capitalize text-[10px] font-bold rounded-lg">{fu.channel}</Badge>
                                {fu.next_action_date && !fu.completed && (
                                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px] font-bold rounded-lg shadow-none">
                                    <Clock className="mr-1 h-3 w-3" />
                                    {formatDate(fu.next_action_date)}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground font-medium">{formatDateTime(fu.contact_date)}</span>
                            </div>
                            <p className="mt-2 text-xs font-semibold text-foreground">{fu.comment}</p>
                            {fu.next_action_note && <p className="mt-1 text-[11px] text-muted-foreground">→ Tarea: {fu.next_action_note}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-8 text-center">
                        <MessageSquare className="h-10 w-10 text-muted-foreground" />
                        <p className="mt-2 text-xs font-medium text-muted-foreground">Sin seguimientos registrados</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar Stats */}
          <div className="space-y-4">
            <Card className="border border-border/80 bg-card/90 shadow-xs backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-sm font-bold text-foreground">Resumen de Operación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Días en Proceso</span>
                  <span className="font-bold text-foreground tabular-nums">{daysSince(credit.created_at)} días</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Último Avance</span>
                  <span className="font-bold text-foreground tabular-nums">{daysSince(credit.status_changed_at)} días</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Documentos Adjuntos</span>
                  <span className="font-bold text-foreground tabular-nums">{documents.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Contactos Registrados</span>
                  <span className="font-bold text-foreground tabular-nums">{followUps.length}</span>
                </div>
              </CardContent>
            </Card>

            {credit.rejection_reason && (
              <Card className="border border-red-500/30 bg-red-500/5 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-xs font-bold text-red-700 dark:text-red-400">Motivo de Rechazo</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-red-600 dark:text-red-300 font-medium">{credit.rejection_reason}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageTransition>
    </AppLayout>
  );
}
