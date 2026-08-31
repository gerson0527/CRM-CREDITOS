'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'credit_status' | 'follow_up' | 'document' | 'system';
  link?: string;
  sender_name?: string;
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  addNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
  addNotification: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Cargar notificaciones iniciales de demostración tipo actividad en tiempo real
  useEffect(() => {
    const initialItems: NotificationItem[] = [
      {
        id: 'init-1',
        title: 'Crédito Aprobado 🎉',
        message: 'El crédito de Carlos Ruiz por $25.000.000 fue Aprobado por Banco de Bogotá.',
        timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        read: false,
        type: 'credit_status',
        sender_name: 'Sistema CRM',
        link: '/kanban',
      },
      {
        id: 'init-2',
        title: '💬 Nuevo Seguimiento Agendado',
        message: 'Juan Pérez: "Llamada de confirmación de extractos bancarios agendada".',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        read: false,
        type: 'follow_up',
        sender_name: 'Juan Pérez',
        link: '/calendario',
      },
      {
        id: 'init-3',
        title: 'Documento Validado',
        message: 'Cédula de ciudadanía validada correctamente para María Fernández.',
        timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        read: true,
        type: 'document',
        sender_name: 'Supervisor de Ventas',
        link: '/creditos',
      },
    ];
    setNotifications(initialItems);
  }, []);

  const addNotification = useCallback((item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newItem: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications((prev) => [newItem, ...prev]);

    // Toast flotante animado tipo chat/alerta
    toast.custom((t) => (
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-card p-3.5 shadow-lg max-w-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bell className="h-4 w-4 animate-bounce" />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-xs font-bold text-foreground">{newItem.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{newItem.message}</p>
        </div>
      </div>
    ), { duration: 4000 });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Supabase Realtime Subscription
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('crm-realtime-events')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'credits' },
        (payload: any) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          if (oldStatus !== newStatus) {
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
  }, [profile?.id, addNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
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
