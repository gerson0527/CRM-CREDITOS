'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { toast } from 'sonner';
import { Bell, Undo2, Upload } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'credit_status' | 'follow_up' | 'document' | 'system' | 'devolucion';
  link?: string;
  sender_name?: string;
  meta?: Record<string, unknown>;
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  addNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  removeNotification: () => {},
  clearNotifications: () => {},
  addNotification: () => {},
});

// ID estable para notificaciones de devolución: persistentes hasta que el crédito
// salga del estado 'devolucion' (se eliminan al re-cargar y leer la lista actualizada).
function devolucionNotifId(creditId: string) {
  return `devolucion-active::${creditId}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [visibleAsesorIds, setVisibleAsesorIds] = useState<string[] | null>(null);
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  // Set persistente de IDs descartados (solo aplica a notificaciones one-shot,
  // NO a las alertas activas de devolución).
  const storageKey = profile ? `notifications:dismissed:${profile.id}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) dismissedIdsRef.current = new Set(arr);
      }
    } catch {
      dismissedIdsRef.current = new Set();
    }
  }, [storageKey]);

  const persistDismissed = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(Array.from(dismissedIdsRef.current))
      );
    } catch {
      // sin espacio o sin permisos: continuar sin persistir
    }
  }, [storageKey]);

  // Refrescar la lista de asesores visibles cada vez que cambia el perfil.
  // Se hace vía /api/team/asesor-ids para no importar el cliente `pg`
  // (que requiere módulos nativos de Node) en un bundle de cliente.
  useEffect(() => {
    let cancelled = false;
    if (!profile) {
      setVisibleAsesorIds(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/team/asesor-ids', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setVisibleAsesorIds([profile.id]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setVisibleAsesorIds(Array.isArray(data.asesorIds) ? data.asesorIds : [profile.id]);
      } catch {
        if (!cancelled) setVisibleAsesorIds([profile.id]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  // ---------------------------------
  // Carga de actividad real desde DB
  // ---------------------------------
  const loadRealActivity = useCallback(async () => {
    if (!profile || !visibleAsesorIds) return;
    let isMounted = true;

    try {
      // 1) Alertas activas de devolución para créditos de mi scope
      const devolutionRes = await supabase
        .from('credits')
        .select('id, status, devolucion_reason, devolucion_requires_upload, updated_at, client:clients(first_name, last_name)')
        .eq('status', 'devolucion')
        .in('asesor_id', visibleAsesorIds)
        .order('updated_at', { ascending: false })
        .limit(5);

      // 2) Actividad reciente: últimos créditos actualizados en mi scope
      const creditsRes = await supabase
        .from('credits')
        .select('id, status, updated_at, created_at, requested_amount, asesor_id, client:clients(first_name, last_name)')
        .in('asesor_id', visibleAsesorIds)
        .order('updated_at', { ascending: false })
        .limit(8);

      // 3) Últimos seguimientos de créditos en mi scope
      const followUpsRes = await supabase
        .from('follow_ups')
        .select('id, comment, channel, created_at, credit_id, credit:credits(asesor_id)')
        .order('created_at', { ascending: false })
        .limit(8);

      if (!isMounted) return;

      const items: NotificationItem[] = [];

      if (devolutionRes.data) {
        for (const c of devolutionRes.data as any[]) {
          const clientName = c.client ? `${c.client.first_name} ${c.client.last_name}` : 'Cliente';
          items.push({
            id: devolucionNotifId(c.id),
            title: '⚠️ Crédito devuelto por la entidad',
            message: c.devolucion_reason?.trim()
              ? `${clientName}: ${c.devolucion_reason}`
              : `${clientName}: la entidad devolvió este crédito. Revisa los documentos solicitados.`,
            timestamp: c.updated_at || new Date().toISOString(),
            read: false,
            type: 'devolucion',
            sender_name: 'Sistema CRM',
            link: `/creditos/${c.id}`,
            meta: {
              creditId: c.id,
              requiresUpload: !!c.devolucion_requires_upload,
              reason: c.devolucion_reason ?? null,
            },
          });
        }
      }

      if (creditsRes.data) {
        for (const c of creditsRes.data as any[]) {
          const clientName = c.client ? `${c.client.first_name} ${c.client.last_name}` : 'Cliente';
          items.push({
            id: `credit-${c.id}`,
            title: `Crédito en etapa: ${(c.status || '').toUpperCase()}`,
            message: `Crédito de ${clientName} - Estado actual: ${c.status}.`,
            timestamp: c.updated_at || c.created_at || new Date().toISOString(),
            read: false,
            type: 'credit_status',
            sender_name: 'Sistema CRM',
            link: `/creditos/${c.id}`,
          });
        }
      }

      if (followUpsRes.data) {
        for (const f of followUpsRes.data as any[]) {
          if (f.credit && !visibleAsesorIds.includes(f.credit.asesor_id)) continue;
          items.push({
            id: `fu-${f.id}`,
            title: `Seguimiento: ${f.channel || 'actividad'}`,
            message: f.comment || 'Seguimiento registrado en el CRM.',
            timestamp: f.created_at || new Date().toISOString(),
            read: false,
            type: 'follow_up',
            sender_name: 'Asesor',
            link: f.credit_id ? `/creditos/${f.credit_id}` : '/calendario',
          });
        }
      }

      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      // Para items one-shot, respetamos el descarte persistente.
      // Para alertas activas de devolución, NUNCA se descartan de la lista
      // (se quitan solas cuando el crédito sale del estado devolucion).
      const filtered = items
        .filter((n) => {
          if (n.id.startsWith('devolucion-active::')) return true;
          return !dismissedIdsRef.current.has(n.id);
        })
        .slice(0, 12);
      setNotifications(filtered);
    } catch (err) {
      console.error('Error al cargar notificaciones reales:', err);
    } finally {
      isMounted = false;
    }
  }, [profile, visibleAsesorIds]);

  // Recarga inicial + polling cada 30s + al volver a foco de pestaña.
  useEffect(() => {
    if (!profile || !visibleAsesorIds) return;
    loadRealActivity();
    const interval = setInterval(loadRealActivity, 30_000);
    const onFocus = () => loadRealActivity();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [profile, visibleAsesorIds, loadRealActivity]);

  const removeNotification = useCallback((id: string) => {
    // Alertas de devolución no se descartan; solo se ocultan en memoria.
    if (!id.startsWith('devolucion-active::')) {
      dismissedIdsRef.current.add(id);
      persistDismissed();
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, [persistDismissed]);

  const addNotification = useCallback((item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newItem: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    if (dismissedIdsRef.current.has(newItem.id)) return;
    setNotifications((prev) => [newItem, ...prev]);

    // Toast — caso especial de devolución con CTA
    if (newItem.type === 'devolucion' && newItem.link) {
      toast.custom(
        (t) => (
          <div
            className="flex w-full max-w-sm cursor-pointer items-start gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 p-3.5 shadow-lg backdrop-blur-sm"
            onClick={() => {
              router.push(newItem.link!);
              toast.dismiss(t);
            }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-700 dark:text-orange-300">
              <Undo2 className="h-4 w-4 animate-pulse" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-foreground">{newItem.title}</p>
              <p className="mt-0.5 text-xs text-foreground/80 line-clamp-2">{newItem.message}</p>
              {Boolean(newItem.meta?.requiresUpload) && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-300">
                  <Upload className="h-3 w-3" /> Sube los archivos solicitados
                </p>
              )}
            </div>
          </div>
        ),
        { duration: 8000 }
      );
    } else {
      toast.custom((t) => (
        <div
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/20 bg-card p-3.5 shadow-lg max-w-sm"
          onClick={() => {
            if (newItem.link) {
              router.push(newItem.link);
              toast.dismiss(t);
            }
          }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-4 w-4 animate-bounce" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold text-foreground">{newItem.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{newItem.message}</p>
          </div>
        </div>
      ), { duration: 4000 });
    }
  }, [router]);

  const markAsRead = useCallback((id: string) => {
    if (!id.startsWith('devolucion-active::')) {
      dismissedIdsRef.current.add(id);
      persistDismissed();
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, [persistDismissed]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => {
        if (!n.id.startsWith('devolucion-active::')) {
          dismissedIdsRef.current.add(n.id);
        }
        return { ...n, read: true };
      });
      persistDismissed();
      return next;
    });
  }, [persistDismissed]);

  const clearNotifications = useCallback(() => {
    setNotifications((prev) => {
      prev.forEach((n) => {
        if (!n.id.startsWith('devolucion-active::')) {
          dismissedIdsRef.current.add(n.id);
        }
      });
      persistDismissed();
      return prev.filter((n) => n.id.startsWith('devolucion-active::'));
    });
  }, [persistDismissed]);

  // ---------------------------------
  // Supabase Realtime Subscription
  // ---------------------------------
  useEffect(() => {
    if (!profile || !visibleAsesorIds) return;

    const channel = supabase
      .channel('crm-realtime-events')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'credits' },
        (payload: any) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          if (oldStatus === newStatus) return;

          const targetAsesorId = payload.new?.asesor_id;
          if (targetAsesorId && !visibleAsesorIds.includes(targetAsesorId)) return;

          if (newStatus === 'devolucion') {
            const reason = payload.new?.devolucion_reason;
            const requiresUpload = !!payload.new?.devolucion_requires_upload;
            const clientName = payload.new?.client
              ? `${payload.new.client.first_name} ${payload.new.client.last_name}`
              : 'el cliente';
            addNotification({
              title: '⚠️ Crédito devuelto por la entidad',
              message: reason
                ? `${clientName}: ${reason}${requiresUpload ? ' — sube los archivos solicitados.' : ''}`
                : `${clientName}: la entidad devolvió este crédito.${requiresUpload ? ' Sube los archivos solicitados.' : ''}`,
              type: 'devolucion',
              sender_name: 'Sistema CRM',
              link: `/creditos/${payload.new?.id}`,
              meta: {
                creditId: payload.new?.id,
                requiresUpload,
                reason: reason ?? null,
              },
            });
          } else {
            addNotification({
              title: `⚡ Estado de Crédito Actualizado`,
              message: `El crédito cambió de ${oldStatus || 'prospecto'} a ${newStatus || 'actualizado'}.`,
              type: 'credit_status',
              sender_name: 'Realtime Supabase',
              link: `/creditos/${payload.new?.id}`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'follow_ups' },
        (payload: any) => {
          // Filtrar por asesor del crédito (join parcial incluido si RLS lo permite)
          const creditAsesor = payload.new?.asesor_id || payload.new?.credit?.asesor_id;
          if (creditAsesor && !visibleAsesorIds.includes(creditAsesor)) return;
          addNotification({
            title: `💬 Nuevo Seguimiento`,
            message: payload.new?.comment || 'Se registró una nueva actividad en el sistema.',
            type: 'follow_up',
            sender_name: 'Actividad en vivo',
            link: '/calendario',
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'documents' },
        (payload: any) => {
          addNotification({
            title: `📄 Documento Adjuntado`,
            message: `Nuevo archivo subido: ${payload.new?.document_type || 'Documento'}`,
            type: 'document',
            sender_name: 'Gestión Documental',
            link: '/creditos',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, visibleAsesorIds, addNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearNotifications,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
