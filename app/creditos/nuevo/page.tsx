'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, User, CreditCard, FileText, Upload, CheckCircle2 } from 'lucide-react';
import { AppLayout } from '@/components/app-layout';
import { PageTransition } from '@/components/transitions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { formatCurrency } from '@/lib/constants';
import type { FinancialEntity, CreditType } from '@/lib/types';

export default function NewCreditPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<FinancialEntity[]>([]);
  const [creditTypes, setCreditTypes] = useState<CreditType[]>([]);

  // Form data
  const [clientData, setClientData] = useState({
    first_name: '', last_name: '', document_number: '', phone: '', email: '', address: '', city: '', reported_income: '',
  });
  const [creditData, setCreditData] = useState({
    entity_id: '', credit_type_id: '', requested_amount: '', term_months: '36', rate: '',
  });
  const [documents, setDocuments] = useState<{ type: string; fileName: string }[]>([]);

  useEffect(() => {
    supabase.from('financial_entities').select('*').eq('active', true).then(({ data }) => setEntities(data || []));
    supabase.from('credit_types').select('*').eq('active', true).then(({ data }) => setCreditTypes(data || []));
  }, []);

  const steps = [
    { label: 'Datos del cliente', icon: <User className="h-4 w-4" /> },
    { label: 'Datos del crédito', icon: <CreditCard className="h-4 w-4" /> },
    { label: 'Documentación', icon: <FileText className="h-4 w-4" /> },
  ];

  const selectedCreditType = creditTypes.find((ct) => ct.id === creditData.credit_type_id);

  function handleNext() {
    if (step === 0) {
      if (!clientData.first_name || !clientData.last_name || !clientData.document_number) {
        toast.error('Completa los campos requeridos');
        return;
      }
    }
    if (step === 1) {
      if (!creditData.entity_id || !creditData.credit_type_id || !creditData.requested_amount) {
        toast.error('Completa los campos requeridos');
        return;
      }
    }
    setStep((s) => Math.min(s + 1, 2));
  }

  function handleFileUpload(docType: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setDocuments((prev) => [...prev.filter((d) => d.type !== docType), { type: docType, fileName: file.name }]);
      toast.success(`${docType} cargado`);
    }
  }

  async function handleSubmit() {
    if (!profile) return;
    setLoading(true);

    try {
      // 1. Create client
      const { data: client, error: clientErr } = await supabase
        .from('clients')
        .insert({
          first_name: clientData.first_name,
          last_name: clientData.last_name,
          document_number: clientData.document_number,
          phone: clientData.phone || null,
          email: clientData.email || null,
          address: clientData.address || null,
          city: clientData.city || null,
          reported_income: parseFloat(clientData.reported_income) || 0,
          created_by: profile.id,
        })
        .select()
        .single();

      if (clientErr) throw clientErr;

      // 2. Create credit
      const { data: credit, error: creditErr } = await supabase
        .from('credits')
        .insert({
          client_id: client.id,
          asesor_id: profile.id,
          entity_id: creditData.entity_id,
          credit_type_id: creditData.credit_type_id,
          status: 'lead',
          requested_amount: parseFloat(creditData.requested_amount),
          term_months: parseInt(creditData.term_months) || null,
          rate: parseFloat(creditData.rate) || null,
        })
        .select()
        .single();

      if (creditErr) throw creditErr;

      // 3. Create status history
      await supabase.from('credit_status_history').insert({
        credit_id: credit.id,
        previous_status: null,
        new_status: 'lead',
        changed_by: profile.id,
        comment: 'Crédito creado',
      });

      toast.success('Crédito creado', { description: 'El cliente y crédito fueron registrados.' });
      router.push(`/creditos/${credit.id}`);
    } catch (err: any) {
      toast.error('Error al crear crédito', { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <PageTransition>
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/creditos')}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Button>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Nuevo crédito</h1>
        <p className="text-sm text-muted-foreground">Registra un nuevo cliente y solicitud de crédito.</p>

        {/* Stepper */}
        <div className="mt-6 flex items-center justify-center">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors ${
                  i === step ? 'bg-primary text-primary-foreground' :
                  i < step ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {i < step ? <Check className="h-4 w-4" /> : s.icon}
                  <span className="hidden text-sm font-medium sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && <div className="h-0.5 w-6 bg-border" />}
              </div>
            ))}
          </div>
        </div>

        <Card className="mx-auto mt-6 max-w-2xl">
          <CardContent className="pt-6">
            <AnimatePresence mode="wait">
              {/* Step 0: Client data */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nombre *</Label>
                      <Input value={clientData.first_name} onChange={(e) => setClientData({ ...clientData, first_name: e.target.value })} placeholder="Andrea" />
                    </div>
                    <div className="space-y-2">
                      <Label>Apellidos *</Label>
                      <Input value={clientData.last_name} onChange={(e) => setClientData({ ...clientData, last_name: e.target.value })} placeholder="Lopez" />
                    </div>
                    <div className="space-y-2">
                      <Label>Cédula *</Label>
                      <Input value={clientData.document_number} onChange={(e) => setClientData({ ...clientData, document_number: e.target.value })} placeholder="1034567890" />
                    </div>
                    <div className="space-y-2">
                      <Label>Teléfono</Label>
                      <Input value={clientData.phone} onChange={(e) => setClientData({ ...clientData, phone: e.target.value })} placeholder="+57 300 123 4567" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={clientData.email} onChange={(e) => setClientData({ ...clientData, email: e.target.value })} placeholder="cliente@email.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Ingresos reportados</Label>
                      <Input type="number" value={clientData.reported_income} onChange={(e) => setClientData({ ...clientData, reported_income: e.target.value })} placeholder="3500000" />
                    </div>
                    <div className="space-y-2">
                      <Label>Dirección</Label>
                      <Input value={clientData.address} onChange={(e) => setClientData({ ...clientData, address: e.target.value })} placeholder="Calle 45 #23-10" />
                    </div>
                    <div className="space-y-2">
                      <Label>Ciudad</Label>
                      <Input value={clientData.city} onChange={(e) => setClientData({ ...clientData, city: e.target.value })} placeholder="Bogotá" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 1: Credit data */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Entidad financiera *</Label>
                      <Select value={creditData.entity_id} onValueChange={(v) => setCreditData({ ...creditData, entity_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                          {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de crédito *</Label>
                      <Select value={creditData.credit_type_id} onValueChange={(v) => setCreditData({ ...creditData, credit_type_id: v, rate: String(creditTypes.find((ct) => ct.id === v)?.default_rate || '') })}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                          {creditTypes.map((ct) => <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Monto solicitado *</Label>
                      <Input type="number" value={creditData.requested_amount} onChange={(e) => setCreditData({ ...creditData, requested_amount: e.target.value })} placeholder="5000000" />
                      {selectedCreditType && (
                        <p className="text-xs text-muted-foreground">
                          Rango: {formatCurrency(selectedCreditType.min_amount)} - {formatCurrency(selectedCreditType.max_amount)}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Plazo (meses)</Label>
                      <Input type="number" value={creditData.term_months} onChange={(e) => setCreditData({ ...creditData, term_months: e.target.value })} placeholder="36" />
                    </div>
                    <div className="space-y-2">
                      <Label>Tasa (%)</Label>
                      <Input type="number" step="0.1" value={creditData.rate} onChange={(e) => setCreditData({ ...creditData, rate: e.target.value })} placeholder="18.5" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Documents */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-muted-foreground">
                    Sube los documentos requeridos para este tipo de crédito. Puedes saltar este paso y subirlos después.
                  </p>
                  {selectedCreditType?.required_documents.map((doc) => {
                    const uploaded = documents.find((d) => d.type === doc);
                    return (
                      <div key={doc} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${uploaded ? 'bg-green-100' : 'bg-muted'}`}>
                            {uploaded ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                          </div>
                          <span className="text-sm font-medium capitalize">{doc.replace(/_/g, ' ')}</span>
                        </div>
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" onChange={(e) => handleFileUpload(doc, e)} />
                          <span className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent">
                            {uploaded ? uploaded.fileName : 'Subir'}
                          </span>
                        </label>
                      </div>
                    );
                  }) || (
                    <p className="text-sm text-muted-foreground">Selecciona un tipo de crédito para ver los documentos requeridos.</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              {step < 2 ? (
                <Button onClick={handleNext}>
                  Siguiente
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check className="mr-1 h-4 w-4" />}
                  Crear crédito
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </PageTransition>
    </AppLayout>
  );
}
