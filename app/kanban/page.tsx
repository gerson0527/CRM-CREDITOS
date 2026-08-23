'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { AppLayout } from '@/components/app-layout';
import { PageTransition } from '@/components/transitions';
import { StatusBadge } from '@/components/status-badge';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { CREDIT_STATUSES, PIPELINE_ORDER, formatCurrency, formatDate, daysSince } from '@/lib/constants';
import type { Credit, CreditStatus } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Plus, GripVertical } from 'lucide-react';

export default function KanbanPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCredit, setActiveCredit] = useState<Credit | null>(null);

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
      const teamIds = (team || []).map((t) => t.id);
      if (teamIds.length > 0) {
        query = query.in('asesor_id', teamIds);
      }
    }

    const { data } = await query.order('updated_at', { ascending: false });
    setCredits(data as Credit[] || []);
    setLoading(false);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    const credit = credits.find((c) => c.id === id);
    setActiveId(id);
    setActiveCredit(credit || null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setActiveCredit(null);

    const { active, over } = event;
    if (!over) return;

    const creditId = active.id as string;
    const newStatus = over.id as CreditStatus;

    const credit = credits.find((c) => c.id === creditId);
    if (!credit || credit.status === newStatus) return;

    const oldStatus = credit.status;

    // Optimistic update
    setCredits((prev) =>
      prev.map((c) => (c.id === creditId ? { ...c, status: newStatus } : c))
    );

    // Update in DB
    const { error } = await supabase
      .from('credits')
      .update({ status: newStatus })
      .eq('id', creditId);

    if (error) {
      // Revert on error
      setCredits((prev) =>
        prev.map((c) => (c.id === creditId ? { ...c, status: oldStatus } : c))
      );
      toast.error('Error al cambiar estado');
      return;
    }

    // Insert history
    await supabase.from('credit_status_history').insert({
      credit_id: creditId,
      previous_status: oldStatus,
      new_status: newStatus,
      changed_by: profile!.id,
      comment: `Cambió de ${oldStatus} a ${newStatus}`,
    });

    toast.success('Estado actualizado', {
      description: `El crédito ahora está en "${CREDIT_STATUSES.find((s) => s.value === newStatus)?.label}"`,
    });
  }

  const activeColumns = PIPELINE_ORDER;
  const creditsByStatus = activeColumns.map((status) => ({
    status,
    items: credits.filter((c) => c.status === status),
  }));

  return (
    <AppLayout>
      <PageTransition>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kanban de créditos</h1>
            <p className="text-sm text-muted-foreground">Arrastra las tarjetas para cambiar el estado.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : credits.length === 0 ? (
          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Plus className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">No hay créditos para mostrar</p>
            <p className="text-sm text-muted-foreground">Crea un nuevo crédito para verlo aquí.</p>
          </motion.div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="kanban-scroll flex gap-3 overflow-x-auto pb-4">
              {creditsByStatus.map(({ status, items }) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  items={items}
                  onCardClick={(id) => router.push(`/creditos/${id}`)}
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
      </PageTransition>
    </AppLayout>
  );
}

function KanbanColumn({ status, items, onCardClick }: { status: CreditStatus; items: Credit[]; onCardClick: (id: string) => void }) {
  const config = CREDIT_STATUSES.find((s) => s.value === status)!;
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: config.color }} />
          <span className="text-sm font-medium">{config.label}</span>
        </div>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-lg border-2 border-dashed p-2 transition-colors min-h-[200px] ${
          isOver ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/30'
        }`}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence>
            {items.map((credit) => (
              <SortableCard key={credit.id} credit={credit} onCardClick={onCardClick} />
            ))}
          </AnimatePresence>
        </SortableContext>

        {items.length === 0 && (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
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
    opacity: isDragging ? 0.4 : 1,
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
      <Card className="group relative overflow-hidden border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
        <button
          {...attributes}
          {...listeners}
          className="absolute right-2 top-2 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="mb-2">
          <p className="text-sm font-semibold">
            {credit.client?.first_name} {credit.client?.last_name}
          </p>
          <p className="text-xs text-muted-foreground">{credit.client?.document_number}</p>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-primary">{formatCurrency(credit.requested_amount)}</span>
        </div>

        {credit.entity && (
          <p className="mb-2 text-xs text-muted-foreground">{credit.entity.name}</p>
        )}

        <div className="flex items-center justify-between">
          <StatusBadge status={credit.status} />
          <span className="text-xs text-muted-foreground">
            {daysSince(credit.status_changed_at || credit.created_at)}d
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

function KanbanCard({ credit, isDragOverlay }: { credit: Credit; isDragOverlay?: boolean }) {
  return (
    <Card
      className={`border-primary/20 bg-card p-3 shadow-lg ${
        isDragOverlay ? 'rotate-2' : ''
      }`}
    >
      <div className="mb-2">
        <p className="text-sm font-semibold">
          {credit.client?.first_name} {credit.client?.last_name}
        </p>
        <p className="text-xs text-muted-foreground">{credit.client?.document_number}</p>
      </div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-primary">{formatCurrency(credit.requested_amount)}</span>
      </div>
      {credit.entity && (
        <p className="mb-2 text-xs text-muted-foreground">{credit.entity.name}</p>
      )}
      <StatusBadge status={credit.status} />
    </Card>
  );
}
