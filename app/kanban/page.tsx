'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { AppLayout } from '@/components/app-layout';
import { PageTransition } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { CREDIT_STATUSES, PIPELINE_ORDER, formatCurrency, formatDate, daysSince } from '@/lib/constants';
import type { Credit, CreditStatus } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Plus, GripVertical, Building2, User, Clock, Layers, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function KanbanPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCredit, setActiveCredit] = useState<Credit | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    loadCredits();
  }, [profile?.id]);

  async function loadCredits() {
    if (!profile) return;
    setLoading(true);

    let query = supabase
      .from('credits')
      .select(`
        *,
        client:clients(*),
        asesor:profiles!credits_asesor_id_fkey(id, full_name),
        entity:financial_entities(id, name)
      `);

    if (profile.role === 'asesor') {
      query = query.eq('asesor_id', profile.id);
    } else if (profile.role === 'supervisor') {
      const { data: team } = await supabase
        .from('profiles')
        .select('id')
        .eq('supervisor_id', profile.id);
      const teamIds = (team || []).map((t: { id: string }) => t.id);
      if (teamIds.length > 0) {
        query = query.in('asesor_id', teamIds);
      }
    }

    const { data } = await query.order('updated_at', { ascending: false });
    setCredits(data as Credit[] || []);
    setLoading(false);
  }

  function scrollColumnIntoView(status: CreditStatus) {
    const el = columnRefs.current[status];
    const container = scrollRef.current;
    if (!el || !container) return;
    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const credit = credits.find((c) => c.id === active.id);
    if (credit) setActiveCredit(credit);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCredit(null);

    if (!over) return;

    const creditId = active.id as string;
    let targetStatus: CreditStatus | null = null;

    if (CREDIT_STATUSES.some((s) => s.value === over.id)) {
      targetStatus = over.id as CreditStatus;
    } else {
      const overCredit = credits.find((c) => c.id === over.id);
      if (overCredit) {
        targetStatus = overCredit.status;
      }
    }

    if (!targetStatus) return;

    const currentCredit = credits.find((c) => c.id === creditId);
    if (!currentCredit || currentCredit.status === targetStatus) return;

    const oldStatus = currentCredit.status;
    const newStatus = targetStatus;

    setCredits((prev) =>
      prev.map((c) => (c.id === creditId ? { ...c, status: newStatus } : c))
    );

    const { error } = await supabase
      .from('credits')
      .update({ status: newStatus })
      .eq('id', creditId);

    if (error) {
      toast.error('Error al mover crédito', { description: error.message });
      setCredits((prev) =>
        prev.map((c) => (c.id === creditId ? { ...c, status: oldStatus } : c))
      );
      return;
    }

    if (profile) {
      await supabase.from('credit_status_history').insert({
        credit_id: creditId,
        previous_status: oldStatus,
        new_status: newStatus,
        changed_by: profile.id,
        comment: `Movido en tablero Kanban de ${CREDIT_STATUSES.find((s) => s.value === oldStatus)?.label} a ${CREDIT_STATUSES.find((s) => s.value === newStatus)?.label}`,
      });
    }

    toast.success('Estado actualizado', {
      description: `Ahora en "${CREDIT_STATUSES.find((s) => s.value === newStatus)?.label}"`,
    });
  }

  const activeColumns = PIPELINE_ORDER;
  const creditsByStatus = activeColumns.map((status) => {
    const items = credits.filter((c) => c.status === status);
    const totalAmount = items.reduce((sum, c) => sum + Number(c.requested_amount || 0), 0);
    return {
      status,
      items,
      totalAmount,
    };
  });

  const totalPipelineAmount = credits.reduce((sum, c) => sum + Number(c.requested_amount || 0), 0);

  return (
    <AppLayout>
      <PageTransition>
        <div className="flex h-full min-h-0 flex-col">
          {/* Header Bar */}
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Tablero Kanban
                </h1>
                <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {credits.length} créditos
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Mueve tarjetas entre columnas para actualizar el estado operativo de cada solicitud.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-2xl border border-border/80 bg-card/80 px-3.5 py-2 sm:flex items-center gap-2 text-xs shadow-2xs">
                <span className="text-muted-foreground font-medium">Volumen en Pipeline:</span>
                <span className="font-display font-bold text-foreground tabular-nums">{formatCurrency(totalPipelineAmount)}</span>
              </div>

              <Link href="/creditos/nuevo">
                <Button className="rounded-xl bg-primary text-xs font-bold shadow-sm shadow-primary/25">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nuevo Crédito
                </Button>
              </Link>
            </div>
          </div>

          {credits.length === 0 && !loading ? (
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 p-12 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Layers className="h-8 w-8" />
              </div>
              <p className="font-display text-lg font-bold text-foreground">No hay créditos registrados</p>
              <p className="mt-1 text-xs text-muted-foreground">Comienza radicando tu primera solicitud de crédito.</p>
              <Link href="/creditos/nuevo" className="mt-4">
                <Button size="sm" className="rounded-xl">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Radicar Crédito
                </Button>
              </Link>
            </motion.div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div
                ref={scrollRef}
                className="grid flex-1 gap-4 overflow-y-auto pb-4"
                style={{
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gridAutoRows: 'minmax(300px, auto)',
                }}
              >
                {creditsByStatus.map(({ status, items, totalAmount }) => (
                  <KanbanColumn
                    key={status}
                    status={status}
                    items={items}
                    totalAmount={totalAmount}
                    onCardClick={(id) => router.push(`/creditos/${id}`)}
                    registerRef={(el) => { columnRefs.current[status] = el; }}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeCredit ? (
                  <KanbanCard credit={activeCredit} isDragOverlay />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </PageTransition>
    </AppLayout>
  );
}

function KanbanColumn({
  status,
  items,
  totalAmount,
  onCardClick,
  registerRef,
}: {
  status: CreditStatus;
  items: Credit[];
  totalAmount: number;
  onCardClick: (id: string) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const config = CREDIT_STATUSES.find((s) => s.value === status)!;
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        registerRef(el);
      }}
      className="flex h-full min-h-[320px] flex-col rounded-3xl border border-border/80 bg-card/80 shadow-xs backdrop-blur-sm transition-all"
    >
      {/* Column Header */}
      <div className="flex items-center justify-between border-b border-border/70 p-3.5 bg-accent/20 rounded-t-3xl">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: config.color }} />
          <span className="font-display text-xs font-bold text-foreground">{config.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[11px] font-bold text-muted-foreground tabular-nums">
            {formatCurrency(totalAmount)}
          </span>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-background border border-border px-1.5 text-[10px] font-bold text-foreground">
            {items.length}
          </span>
        </div>
      </div>

      {/* Cards Drop Area */}
      <div
        className={cn(
          'flex-1 space-y-2.5 p-2.5 transition-colors rounded-b-3xl',
          isOver ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset' : 'bg-transparent'
        )}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((credit) => (
            <SortableCard key={credit.id} credit={credit} onCardClick={onCardClick} />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border/60 text-xs font-medium text-muted-foreground/60">
            Sin créditos
          </div>
        )}
      </div>
    </div>
  );
}

function SortableCard({ credit, onCardClick }: { credit: Credit; onCardClick: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: credit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="cursor-pointer"
      onClick={() => !isDragging && onCardClick(credit.id)}
    >
      <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-background/90 p-3.5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-md">
        {/* Grip Handle */}
        <button
          {...attributes}
          {...listeners}
          className="absolute right-2.5 top-2.5 rounded-lg p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastrar tarjeta"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Client Name & ID */}
        <div className="mb-2 pr-6">
          <p className="truncate font-display text-xs font-bold text-foreground">
            {credit.client?.first_name} {credit.client?.last_name}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium">CC {credit.client?.document_number}</p>
        </div>

        {/* Amount */}
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-display text-sm font-extrabold text-primary tabular-nums">
            {formatCurrency(credit.requested_amount)}
          </span>
          {credit.term_months && (
            <span className="text-[10px] font-bold text-muted-foreground">
              {credit.term_months} meses
            </span>
          )}
        </div>

        {/* Entity Tag */}
        {credit.entity && (
          <div className="mb-2.5 flex items-center gap-1.5 rounded-lg bg-accent/40 px-2 py-1 text-[11px] font-medium text-foreground">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <span className="truncate">{credit.entity.name}</span>
          </div>
        )}

        {/* Footer Status & Age */}
        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[10px]">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{daysSince(credit.status_changed_at || credit.created_at)}d en etapa</span>
          </div>
          {credit.asesor && (
            <span className="truncate max-w-[100px] text-muted-foreground font-medium">
              {credit.asesor.full_name?.split(' ')[0]}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function KanbanCard({ credit, isDragOverlay }: { credit: Credit; isDragOverlay?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-primary bg-card p-3.5 shadow-2xl backdrop-blur-md',
        isDragOverlay ? 'rotate-2 scale-105' : ''
      )}
    >
      <div className="mb-2">
        <p className="truncate font-display text-xs font-bold text-foreground">
          {credit.client?.first_name} {credit.client?.last_name}
        </p>
        <p className="text-[11px] text-muted-foreground">CC {credit.client?.document_number}</p>
      </div>
      <div className="mb-2">
        <span className="font-display text-sm font-extrabold text-primary tabular-nums">
          {formatCurrency(credit.requested_amount)}
        </span>
      </div>
      {credit.entity && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span>{credit.entity.name}</span>
        </div>
      )}
    </div>
  );
}
