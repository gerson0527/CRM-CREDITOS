'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, DollarSign,
  Calendar, FileText, MessageSquare, Plus, Clock,
  CheckCircle2, XCircle, Upload, User, TrendingUp, ArrowRightLeft, ShieldCheck,
  Undo2, Send,
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { usePersistedState, clearDraft } from '@/hooks/use-persisted-state';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import {
  CREDIT_STATUSES, PIPELINE_ORDER, formatCurrency, formatDateTime, formatDate,
  FOLLOW_UP_CHANNELS, daysSince,
} from '@/lib/constants';
import type { Credit, CreditStatus, Document, FollowUp, CreditStatusHistory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ImagePreview } from '@/components/image-preview';
import { FileUpload, type UploadedFile } from '@/components/file-upload';

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
  const draftNs = `credito-${id ?? 'new'}`;
  const [showFollowUpForm, setShowFollowUpForm] = usePersistedState(draftNs, 'showFollowUpForm', false);
  const [newFollowUp, setNewFollowUp] = usePersistedState(draftNs, 'newFollowUp', {
    channel: 'llamada', comment: '', next_action_date: '', next_action_note: '',
  });

  // Devolución: modales separados para admin (motivo + flag) y asesor (subida de archivos)
  const [requestModalOpen, setRequestModalOpen] = usePersistedState(draftNs, 'requestModalOpen', false);
  const [requestReason, setRequestReason] = usePersistedState(draftNs, 'requestReason', '');
  const [requestRequiresUpload, setRequestRequiresUpload] = usePersistedState(draftNs, 'requestRequiresUpload', true);

  const [uploadModalOpen, setUploadModalOpen] = usePersistedState(draftNs, 'uploadModalOpen', false);
  const [uploadFiles, setUploadFiles] = usePersistedState<Record<string, UploadedFile>>(draftNs, 'uploadFiles', {});
  const [savingUpload, setSavingUpload] = useState(false);

  const canManageStatus = profile?.role === 'admin' || profile?.role === 'supervisor';
  const isCreditAsesor = profile?.role === 'asesor' && credit?.asesor_id === profile.id;
  const hasDevolucionDocs = documents.some((d) =>
    d.document_type?.startsWith('devolucion_')
  );

  const loadData = useCallback(async () => {
    if (!id) return;
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
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function changeStatus(newStatus: CreditStatus, options?: { reason?: string; requiresUpload?: boolean }) {
    if (!credit || !profile) return;
    const oldStatus = credit.status;

    // Para devolucion: actualiza también los campos persistentes.
    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'devolucion') {
      updatePayload.devolucion_reason = options?.reason ?? null;
      updatePayload.devolucion_requires_upload = !!options?.requiresUpload;
    }
    if (newStatus !== 'devolucion') {
      // Al salir del estado, limpiamos los campos de devolución.
      updatePayload.devolucion_reason = null;
      updatePayload.devolucion_requires_upload = false;
    }

    const { error } = await supabase
      .from('credits')
      .update(updatePayload)
      .eq('id', credit.id);

    if (error) {
      toast.error('Error al cambiar estado');
      return;
    }

    const fromLabel = CREDIT_STATUSES.find((s) => s.value === oldStatus)?.label ?? oldStatus;
    const toLabel = CREDIT_STATUSES.find((s) => s.value === newStatus)?.label ?? newStatus;
    const baseComment = `Cambió de ${fromLabel} a ${toLabel}`;
    const comment = options?.reason
      ? `${baseComment}. Motivo: ${options.reason}`
      : baseComment;

    await supabase.from('credit_status_history').insert({
      credit_id: credit.id,
      previous_status: oldStatus,
      new_status: newStatus,
      changed_by: profile.id,
      comment,
    });

    setCredit({
      ...credit,
      status: newStatus,
      devolucion_reason: updatePayload.devolucion_reason as string | null,
      devolucion_requires_upload: updatePayload.devolucion_requires_upload as boolean,
    });
    toast.success('Estado actualizado', {
      description: newStatus === 'devolucion'
        ? options?.requiresUpload
          ? 'El asesor deberá subir los documentos solicitados.'
          : 'Devolución registrada (sin archivos pendientes).'
        : `Ahora en "${toLabel}"`,
    });
    loadData();
  }

  async function handleRequestDevolution() {
    if (!requestReason.trim()) {
      toast.error('Indica el motivo de la devolución');
      return;
    }
    const reason = requestReason.trim();
    const requiresUpload = requestRequiresUpload;
    await changeStatus('devolucion', { reason, requiresUpload });
    clearDraft(draftNs);
    setRequestModalOpen(false);
    setRequestReason('');
    setRequestRequiresUpload(true);
  }

  async function handleSubmitUpload() {
    if (!credit || !profile) return;
    const files = Object.values(uploadFiles);
    if (files.length === 0) {
      toast.error('Adjunta al menos un archivo');
      return;
    }
    setSavingUpload(true);
    try {
      const docsToInsert = files.map((f) => ({
        credit_id: credit.id,
        document_type: 'devolucion_soporte',
        file_url: JSON.stringify({ original: f.key, thumb: f.thumbKey }),
        status: 'pendiente',
        uploaded_by: profile.id,
      }));
      const { error } = await supabase.from('documents').insert(docsToInsert);
      if (error) throw error;
      toast.success('Archivos de devolución subidos', {
        description: `${files.length} archivo(s) registrados. El administrador revisará y continuará el flujo.`,
      });
      clearDraft(draftNs);
      setUploadFiles({});
      setUploadModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error('Error al guardar archivos', { description: err.message });
    } finally {
      setSavingUpload(false);
    }
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
    clearDraft(draftNs);
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

                {/* Status Transition Bar (Admin / Supervisor) */}
                {canManageStatus && (
                  <div className="mt-2 rounded-2xl border border-border/70 bg-accent/30 p-3.5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Transición Rápida de Estado (Admin / Supervisor)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CREDIT_STATUSES.filter((s) => s.value !== credit.status).map((s) => {
                        const isRejection = s.value === 'rechazado';
                        const isDesist = s.value === 'desistido';
                        const isDevolution = s.value === 'devolucion';
                        return (
                          <Button
                            key={s.value}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (isDevolution) {
                                setRequestReason('');
                                setRequestRequiresUpload(true);
                                setRequestModalOpen(true);
                                return;
                              }
                              changeStatus(s.value);
                            }}
                            className={cn(
                              'h-8 rounded-xl text-xs font-bold transition-all shadow-2xs',
                              isRejection
                                ? 'border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-500/10'
                                : isDesist
                                ? 'border-border/80 text-muted-foreground hover:bg-accent'
                                : isDevolution
                                ? 'border-orange-500/40 text-orange-700 dark:text-orange-300 hover:bg-orange-500/10'
                                : 'hover:border-primary/50 hover:bg-primary/5'
                            )}
                          >
                            {isRejection && <XCircle className="mr-1 h-3.5 w-3.5 text-red-500" />}
                            {isDevolution && <Undo2 className="mr-1 h-3.5 w-3.5 text-orange-500" />}
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
                  {documents.some((d) => d.document_type?.startsWith('devolucion_')) && (
                    <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500/20 px-1 text-[9px] font-bold text-orange-700 dark:text-orange-300">
                      ↩
                    </span>
                  )}
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
              <TabsContent value="docs" className="mt-4 space-y-4">
                {(() => {
                  const devolucionDocs = documents.filter((d) => d.document_type?.startsWith('devolucion_'));
                  const regularDocs = documents.filter((d) => !d.document_type?.startsWith('devolucion_'));
                  if (documents.length === 0) {
                    return (
                      <Card className="border border-border/80 bg-card/90 shadow-xs">
                        <CardContent className="p-5">
                          <div className="flex flex-col items-center py-8 text-center">
                            <Upload className="h-10 w-10 text-muted-foreground" />
                            <p className="mt-2 text-xs font-medium text-muted-foreground">Sin documentos adjuntos</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                  return (
                    <>
                      {devolucionDocs.length > 0 && (
                        <Card className="border border-orange-500/40 bg-orange-500/5 shadow-xs">
                          <CardContent className="p-5">
                            <div className="mb-3 flex items-center gap-2">
                              <Undo2 className="h-4 w-4 text-orange-600" />
                              <p className="font-display text-xs font-bold text-orange-700 dark:text-orange-300">
                                Documentos de Devolución ({devolucionDocs.length})
                              </p>
                            </div>
                            <div className="space-y-2.5">
                              {devolucionDocs.map((doc) => (
                                <div key={doc.id} className="rounded-2xl border border-orange-500/30 bg-background p-3">
                                  <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-700 dark:text-orange-300">
                                        <FileText className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold capitalize text-foreground">{doc.document_type.replace(/_/g, ' ')}</p>
                                        <p className="text-[11px] text-muted-foreground font-medium">
                                          Subido por {profile?.id === doc.uploaded_by ? 'ti' : 'asesor'} · {formatDate(doc.uploaded_at)}
                                        </p>
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
                          </CardContent>
                        </Card>
                      )}
                      <Card className="border border-border/80 bg-card/90 shadow-xs">
                        <CardContent className="p-5">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="font-display text-xs font-bold text-foreground">
                              Documentación general ({regularDocs.length})
                            </p>
                          </div>
                          {regularDocs.length > 0 ? (
                            <div className="space-y-2.5">
                              {regularDocs.map((doc) => (
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
                            <p className="text-xs text-muted-foreground text-center py-4">Sin documentación general adicional.</p>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
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
            {credit.status === 'devolucion' && (
              <Card className="border border-orange-500/40 bg-orange-500/5 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 font-display text-xs font-bold text-orange-700 dark:text-orange-300">
                    <Undo2 className="h-4 w-4" /> Crédito en Devolución
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                      Motivo de la devolución
                    </p>
                    <p className="mt-1 text-xs font-medium text-orange-900 dark:text-orange-100">
                      {credit.devolucion_reason?.trim()
                        ? credit.devolucion_reason
                        : 'La entidad financiera devolvió este crédito. Contacta al administrador si necesitas más detalles.'}
                    </p>
                  </div>
                  {isCreditAsesor && !hasDevolucionDocs && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setUploadFiles({});
                        setUploadModalOpen(true);
                      }}
                      className="w-full rounded-xl bg-orange-500 text-xs font-bold text-white shadow-sm hover:bg-orange-600"
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Subir archivo de soporte
                    </Button>
                  )}
                  {isCreditAsesor && hasDevolucionDocs && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Archivos subidos. Espera la revisión del administrador.
                    </div>
                  )}
                  {canManageStatus && (
                    <p className="text-[11px] text-orange-700/80 dark:text-orange-300/80">
                      {hasDevolucionDocs
                        ? 'El asesor ya subió los archivos. Revisa la pestaña Documentos.'
                        : credit.devolucion_requires_upload
                        ? 'Se notificó al asesor para que suba los archivos solicitados.'
                        : 'El campo "requiere archivos" quedó sin marcar — el asesor puede subir igual desde el botón de arriba.'}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
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

      {/* Modal Admin/Supervisor: registrar devolución (motivo + flag) */}
      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Undo2 className="h-5 w-5 text-orange-500" />
              Solicitar devolución del crédito
            </DialogTitle>
            <DialogDescription>
              Indica al asesor por qué la entidad financiera devuelve este crédito y si debe adjuntar documentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Motivo de la devolución *
              </Label>
              <Textarea
                rows={4}
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Ej. La entidad requiere cédula legible del codeudor y certificado laboral actualizado con fecha de este mes..."
                className="rounded-xl text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Este motivo quedará visible para el asesor en la página del crédito y en el historial.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-accent/20 p-3 transition-colors hover:bg-accent/40">
              <input
                type="checkbox"
                checked={requestRequiresUpload}
                onChange={(e) => setRequestRequiresUpload(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-orange-500 focus:ring-orange-500"
              />
              <div>
                <p className="text-xs font-bold text-foreground">
                  Requiere que el asesor suba archivos
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Si lo activas, el asesor verá una alerta naranja en este crédito con un botón para adjuntar los documentos faltantes.
                </p>
              </div>
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setRequestModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl bg-orange-500 text-white hover:bg-orange-600"
              onClick={handleRequestDevolution}
              disabled={!requestReason.trim()}
            >
              <Undo2 className="mr-1.5 h-4 w-4" />
              Marcar como devolución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Asesor: subir archivos de soporte para la devolución */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Upload className="h-5 w-5 text-orange-500" />
              Subir archivos de devolución
            </DialogTitle>
            <DialogDescription>
              Adjunta los documentos que la entidad financiera solicita para resolver la devolución.
            </DialogDescription>
          </DialogHeader>

          {credit?.devolucion_reason && (
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                Motivo de la devolución
              </p>
              <p className="mt-1 text-xs font-medium text-orange-900 dark:text-orange-100">
                {credit.devolucion_reason}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <FileUpload
              documentType="devolucion_soporte"
              documentLabel="Documento solicitado"
              required
              value={uploadFiles.principal || null}
              onChange={(f) => setUploadFiles((prev) => ({ ...prev, principal: f as UploadedFile }))}
              rootFolder="creditos"
            />
            <FileUpload
              documentType="devolucion_adicional"
              documentLabel="Documento adicional (opcional)"
              value={uploadFiles.adicional || null}
              onChange={(f) => setUploadFiles((prev) => {
                const next = { ...prev };
                if (f) next.adicional = f;
                else delete next.adicional;
                return next;
                })}
              rootFolder="creditos"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setUploadModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleSubmitUpload}
              disabled={savingUpload || Object.keys(uploadFiles).length === 0}
            >
              {savingUpload ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              Enviar archivos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
