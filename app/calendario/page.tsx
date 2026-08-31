'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  addDays,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone,
  MessageSquare,
  MapPin,
  Mail,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Search,
  Check,
  CalendarDays,
  User,
  CreditCard,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/app-layout';
import { PageTransition } from '@/components/transitions';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import { FOLLOW_UP_CHANNELS, formatCurrency, formatDate } from '@/lib/constants';

interface CalendarEvent {
  id: string;
  credit_id?: string;
  client_name?: string;
  channel: 'llamada' | 'whatsapp' | 'visita' | 'email';
  comment: string;
  contact_date: string;
  next_action_date: string;
  next_action_note?: string;
  completed: boolean;
  credit_status?: string;
  asesor_name?: string;
}

const CHANNEL_ICONS = {
  llamada: Phone,
  whatsapp: MessageSquare,
  visita: MapPin,
  email: Mail,
};

const CHANNEL_COLORS = {
  llamada: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  whatsapp: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  visita: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  email: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
};

const CHANNEL_DOT_COLORS: Record<keyof typeof CHANNEL_ICONS, string> = {
  llamada: '#1D5FA8',
  whatsapp: '#3AA655',
  visita: '#8B5CF6',
  email: '#F59E0B',
};

const CHANNEL_PILL_COLORS: Record<keyof typeof CHANNEL_ICONS, string> = {
  llamada: '#1D5FA8',
  whatsapp: '#3AA655',
  visita: '#8B5CF6',
  email: '#F59E0B',
};

function isAllDayEvent(dateStr: string | undefined | null): boolean {
  if (!dateStr) return true;
  if (!dateStr.includes('T')) return true;
  const timePart = dateStr.split('T')[1] ?? '';
  return timePart.startsWith('00:00');
}

function formatHour12(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

export default function CalendarioPage() {
  const { profile } = useAuth();
  const router = useRouter();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [creditsList, setCreditsList] = useState<{ id: string; client_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filterChannel, setFilterChannel] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendientes' | 'completados'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Formulario nuevo seguimiento
  const [newCreditId, setNewCreditId] = useState<string>('');
  const [newChannel, setNewChannel] = useState<'llamada' | 'whatsapp' | 'visita' | 'email'>('llamada');
  const [newComment, setNewComment] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newTime, setNewTime] = useState('09:00');
  const [newAllDay, setNewAllDay] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCalendarData();
  }, [profile?.id]);

  async function loadCalendarData() {
    setLoading(true);

    try {
      // Cargar lista de créditos para vincular
      const { data: creditsData } = await supabase
        .from('credits')
        .select('id, clients(first_name, last_name)');

      const formattedCredits = (creditsData || []).map((c: any) => ({
        id: c.id,
        client_name: c.clients ? `${c.clients.first_name} ${c.clients.last_name}` : 'Crédito Sin Cliente',
      }));
      setCreditsList(formattedCredits);

      // Cargar seguimientos
      const { data: followUpsData } = await supabase
        .from('follow_ups')
        .select(`
          *,
          credit:credits(
            id,
            status,
            client:clients(first_name, last_name),
            asesor:profiles!credits_asesor_id_fkey(full_name)
          )
        `)
        .order('next_action_date', { ascending: true });

      let loadedEvents: CalendarEvent[] = [];

      if (followUpsData && followUpsData.length > 0) {
        loadedEvents = followUpsData.map((f: any) => ({
          id: f.id,
          credit_id: f.credit_id,
          client_name: f.credit?.client
            ? `${f.credit.client.first_name} ${f.credit.client.last_name}`
            : 'Cliente CRM',
          channel: (f.channel as any) || 'llamada',
          comment: f.comment || f.next_action_note || 'Seguimiento agendado',
          contact_date: f.contact_date,
          next_action_date: f.next_action_date || f.contact_date,
          completed: !!f.completed,
          credit_status: f.credit?.status,
          asesor_name: f.credit?.asesor?.full_name,
        }));
      } else {
        // Generar tareas de demostración si la base de datos no tiene seguimientos aún
        loadedEvents = generateDemoEvents();
      }

      setEvents(loadedEvents);
    } catch (err) {
      console.error('Error al cargar datos del calendario:', err);
      setEvents(generateDemoEvents());
    } finally {
      setLoading(false);
    }
  }

  function generateDemoEvents(): CalendarEvent[] {
    const today = new Date();
    return [
      {
        id: 'demo-1',
        client_name: 'Carlos Ruiz',
        channel: 'llamada',
        comment: 'Llamada de confirmación para radicación de pagaré',
        contact_date: today.toISOString(),
        next_action_date: format(today, 'yyyy-MM-dd'),
        completed: false,
        credit_status: 'documentacion',
        asesor_name: 'Juan Pérez',
      },
      {
        id: 'demo-2',
        client_name: 'María Fernández',
        channel: 'whatsapp',
        comment: 'Enviar estado del estudio del Banco de Bogotá',
        contact_date: today.toISOString(),
        next_action_date: format(addDays(today, 1), 'yyyy-MM-dd'),
        completed: false,
        credit_status: 'estudio',
        asesor_name: 'María Rodríguez',
      },
      {
        id: 'demo-3',
        client_name: 'Empresa Inversiones Global',
        channel: 'visita',
        comment: 'Visita para firma de contrato de librería',
        contact_date: today.toISOString(),
        next_action_date: format(addDays(today, 2), 'yyyy-MM-dd'),
        completed: false,
        credit_status: 'aprobado',
        asesor_name: 'Juan Pérez',
      },
      {
        id: 'demo-4',
        client_name: 'Jorge Mendoza',
        channel: 'email',
        comment: 'Enviar propuesta de refinanciación y tasación',
        contact_date: today.toISOString(),
        next_action_date: format(subDays(today, 1), 'yyyy-MM-dd'),
        completed: true,
        credit_status: 'lead',
        asesor_name: 'María Rodríguez',
      },
      {
        id: 'demo-5',
        client_name: 'Beatriz Gómez',
        channel: 'llamada',
        comment: 'Verificar desembolso en cuenta bancaria',
        contact_date: today.toISOString(),
        next_action_date: format(addDays(today, 4), 'yyyy-MM-dd'),
        completed: false,
        credit_status: 'desembolsado',
        asesor_name: 'Administrador',
      },
    ];
  }

  function subDays(date: Date, amount: number) {
    const res = new Date(date);
    res.setDate(res.getDate() - amount);
    return res;
  }

  // Eventos filtrados
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Filtro por canal
      if (filterChannel !== 'todos' && ev.channel !== filterChannel) return false;

      // Filtro por estado
      if (filterStatus === 'pendientes' && ev.completed) return false;
      if (filterStatus === 'completados' && !ev.completed) return false;

      // Buscador
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesClient = ev.client_name?.toLowerCase().includes(term);
        const matchesComment = ev.comment.toLowerCase();
        if (!matchesClient && !matchesComment) return false;
      }

      return true;
    });
  }, [events, filterChannel, filterStatus, searchTerm]);

  // Generar cuadrícula de días del mes
  const daysInGrid = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Eventos por día
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach((ev) => {
      if (!ev.next_action_date) return;
      const dateKey = ev.next_action_date.split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(ev);
    });
    return map;
  }, [filteredEvents]);

  // Crear nuevo seguimiento
  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast.error('Por favor ingresa una nota o descripción');
      return;
    }

    setSubmitting(true);

    try {
      const selectedCredit = creditsList.find((c) => c.id === newCreditId);
      const clientName = selectedCredit ? selectedCredit.client_name : 'Cliente CRM';

      const payload = {
        credit_id: newCreditId || null,
        channel: newChannel,
        comment: newComment,
        next_action_date: newAllDay ? `${newDate}T00:00:00` : `${newDate}T${newTime}:00`,
        completed: false,
        asesor_id: profile?.id || null,
      };

      const { data, error } = await supabase.from('follow_ups').insert([payload]).select().single();

      const createdEvent: CalendarEvent = {
        id: data?.id || `local-${Date.now()}`,
        credit_id: newCreditId || undefined,
        client_name: clientName,
        channel: newChannel,
        comment: newComment,
        contact_date: new Date().toISOString(),
        next_action_date: newDate,
        completed: false,
        asesor_name: profile?.full_name || 'Asesor',
      };

      setEvents((prev) => [createdEvent, ...prev]);
      toast.success('Seguimiento agendado con éxito', {
        description: `Fecha: ${formatDate(newDate)}`,
      });

      setIsCreateOpen(false);
      setNewComment('');
      setNewCreditId('');
      setNewAllDay(false);
    } catch (err: any) {
      toast.error('Error al agendar', { description: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Marcar como completado
  const toggleEventCompleted = async (ev: CalendarEvent) => {
    const updatedStatus = !ev.completed;

    try {
      if (!ev.id.startsWith('demo-') && !ev.id.startsWith('local-')) {
        await supabase
          .from('follow_ups')
          .update({ completed: updatedStatus })
          .eq('id', ev.id);
      }

      setEvents((prev) =>
        prev.map((item) => (item.id === ev.id ? { ...item, completed: updatedStatus } : item))
      );

      if (selectedEvent && selectedEvent.id === ev.id) {
        setSelectedEvent((prev) => (prev ? { ...prev, completed: updatedStatus } : null));
      }

      toast.success(updatedStatus ? 'Tarea marcada como completada' : 'Tarea reabierta');
    } catch (err) {
      toast.error('No se pudo actualizar la tarea');
    }
  };

  // Estadísticas rápidas
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayTasksCount = (eventsByDate[todayKey] || []).filter((e) => !e.completed).length;
  const overdueCount = events.filter(
    (e) => !e.completed && e.next_action_date && e.next_action_date.split('T')[0] < todayKey
  ).length;
  const completedCount = events.filter((e) => e.completed).length;

  return (
    <AppLayout>
      <PageTransition>
        <div className="space-y-6">
          <PageHeader
            title="Calendario de Seguimientos"
            description="Planifica recordatorios, llamadas a clientes y fechas clave de desembolso."
            actions={
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Nuevo Seguimiento
              </Button>
            }
          />

          {/* Cards de Métricas */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="flex items-center gap-4 p-4 border-l-4 border-l-amber-500 shadow-xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tareas para Hoy</p>
                <p className="text-2xl font-bold">{todayTasksCount}</p>
              </div>
            </Card>

            <Card className="flex items-center gap-4 p-4 border-l-4 border-l-red-500 shadow-xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vencidos o Pendientes</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overdueCount}</p>
              </div>
            </Card>

            <Card className="flex items-center gap-4 p-4 border-l-4 border-l-emerald-500 shadow-xs">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completados</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</p>
              </div>
            </Card>
          </div>

          {/* Barra de Filtros y Navegación */}
          <Card className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Controles del Mes */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  title="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="min-w-[180px] text-center text-lg font-bold capitalize text-slate-900">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </h2>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  title="Mes siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setSelectedDate(new Date());
                  }}
                  className="font-semibold text-primary hover:text-primary"
                >
                  Hoy
                </Button>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Buscar cliente o nota..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 pl-8 text-xs"
                  />
                </div>

                <Select value={filterChannel} onValueChange={setFilterChannel}>
                  <SelectTrigger className="h-9 text-xs w-[130px]">
                    <SelectValue placeholder="Canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los Canales</SelectItem>
                    <SelectItem value="llamada">Llamadas</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="visita">Visitas</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)}>
                  <SelectTrigger className="h-9 text-xs w-[130px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendientes">Pendientes</SelectItem>
                    <SelectItem value="completados">Completados</SelectItem>
                  </SelectContent>
                </Select>

                {/* Modos de vista */}
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    onClick={() => setViewMode('month')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                      viewMode === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Mes
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                      viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Agenda
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* VISTA DEL CALENDARIO */}
          {loading ? (
            <div className="flex h-72 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : viewMode === 'month' ? (
            <Card className="overflow-hidden">
              {/* Encabezados de días */}
              <div className="grid grid-cols-7 border-b border-slate-200 bg-white text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 py-3">
                <span>Dom</span>
                <span>Lun</span>
                <span>Mar</span>
                <span>Mié</span>
                <span>Jue</span>
                <span>Vie</span>
                <span>Sáb</span>
              </div>

              {/* Cuadrícula de Días */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
                {daysInGrid.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayEvents = eventsByDate[dateStr] || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isDayToday = isToday(day);
                  const isSelected = isSameDay(day, selectedDate);

                  const allDayEvents = dayEvents.filter((e) => isAllDayEvent(e.next_action_date));
                  const timedEvents = dayEvents.filter((e) => !isAllDayEvent(e.next_action_date));
                  const sortedTimed = [...timedEvents].sort(
                    (a, b) => new Date(a.next_action_date).getTime() - new Date(b.next_action_date).getTime()
                  );
                  const visibleTimed = sortedTimed.slice(0, 4);
                  const overflowTimed = sortedTimed.length - visibleTimed.length;

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`min-h-[140px] p-3 transition-colors cursor-pointer group ${
                        !isCurrentMonth ? 'bg-slate-50/40' : 'bg-white hover:bg-slate-50/60'
                      } ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}`}
                    >
                      {/* Day number */}
                      <div className="mb-2 flex items-start justify-between">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                            isDayToday
                              ? 'bg-primary text-white shadow-sm'
                              : isCurrentMonth
                              ? 'text-slate-900'
                              : 'text-slate-400'
                          }`}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>

                      {/* All-day events as colored pills */}
                      {allDayEvents.length > 0 && (
                        <div className="mb-1.5 space-y-1">
                          {allDayEvents.slice(0, 2).map((ev) => (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(ev);
                              }}
                              className="cursor-pointer truncate rounded-md px-2 py-1 text-xs font-semibold text-white shadow-sm hover:opacity-90"
                              style={{ backgroundColor: CHANNEL_PILL_COLORS[ev.channel] || '#64748B' }}
                              title={ev.client_name}
                            >
                              {ev.client_name}
                            </div>
                          ))}
                          {allDayEvents.length > 2 && (
                            <p className="pl-1 text-[10px] font-medium text-slate-500">
                              +{allDayEvents.length - 2} más
                            </p>
                          )}
                        </div>
                      )}

                      {/* Timed events: dot + time + title */}
                      {visibleTimed.length > 0 && (
                        <div className="space-y-1">
                          {visibleTimed.map((ev) => (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(ev);
                              }}
                              className={`flex w-full items-center gap-1.5 text-left text-xs hover:opacity-80 ${
                                ev.completed ? 'opacity-50 line-through' : ''
                              }`}
                              title={ev.client_name}
                            >
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: CHANNEL_DOT_COLORS[ev.channel] || '#64748B' }}
                              />
                              <span className="shrink-0 font-medium text-slate-500">
                                {formatHour12(ev.next_action_date)}
                              </span>
                              <span className="truncate font-medium text-slate-900">
                                {ev.client_name}
                              </span>
                            </button>
                          ))}
                          {overflowTimed > 0 && (
                            <p className="pl-1 text-[10px] font-medium text-slate-500">
                              +{overflowTimed} más
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            /* VISTA DE AGENDA / LISTA */
            <Card className="p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Próximos Seguimientos Registrados
              </h3>
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                  <CalendarDays className="h-10 w-10 mb-2 stroke-1" />
                  <p className="text-base font-semibold text-slate-900">No hay actividades agendadas</p>
                  <p className="text-xs mt-1">Crea un nuevo seguimiento o ajusta los filtros.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map((ev) => {
                    const ChannelIcon = CHANNEL_ICONS[ev.channel] || Phone;
                    const allDay = isAllDayEvent(ev.next_action_date);
                    const dotColor = CHANNEL_DOT_COLORS[ev.channel] || '#64748B';

                    return (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                          ev.completed
                            ? 'border-slate-200 bg-slate-50/50'
                            : 'border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <button
                            onClick={() => toggleEventCompleted(ev)}
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                              ev.completed
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-slate-300 hover:border-primary'
                            }`}
                          >
                            {ev.completed && <Check className="h-3 w-3" />}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: dotColor }}
                              />
                              <span className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${CHANNEL_COLORS[ev.channel]}`}>
                                <ChannelIcon className="h-3.5 w-3.5" />
                                <span className="capitalize">{ev.channel}</span>
                              </span>
                              <h4 className={`truncate text-sm font-bold text-slate-900 ${ev.completed ? 'line-through opacity-60' : ''}`}>
                                {ev.client_name}
                              </h4>
                            </div>
                            <p className="mt-1 truncate text-xs text-slate-500">{ev.comment}</p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0">
                          <div className="text-right text-xs">
                            <p className="font-semibold text-slate-900">
                              {formatDate(ev.next_action_date)}
                            </p>
                            <p className="font-medium text-slate-500">
                              {allDay ? 'Todo el día' : formatHour12(ev.next_action_date)}
                            </p>
                            <p className="text-slate-400">{ev.asesor_name || 'Asesor'}</p>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEvent(ev)}
                            className="h-8 text-xs"
                          >
                            Detalles
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* MODAL NUEVO SEGUIMIENTO */}
          <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) setNewAllDay(false); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  <span>Nuevo Seguimiento / Recordatorio</span>
                </DialogTitle>
                <DialogDescription>
                  Agenda una llamada, reunión o tarea vinculada a tus créditos.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateFollowUp} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="creditSelect">Seleccionar Crédito (Opcional)</Label>
                  <Select value={newCreditId} onValueChange={setNewCreditId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un cliente o crédito..." />
                    </SelectTrigger>
                    <SelectContent>
                      {creditsList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.client_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Canal de Contacto</Label>
                    <Select value={newChannel} onValueChange={(val: any) => setNewChannel(val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FOLLOW_UP_CHANNELS.map((ch) => (
                          <SelectItem key={ch.value} value={ch.value}>
                            {ch.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newDate">Fecha</Label>
                    <Input
                      id="newDate"
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex cursor-pointer items-center gap-2 self-end rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={newAllDay}
                      onChange={(e) => setNewAllDay(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-slate-700">Todo el día</span>
                  </label>

                  <div className="space-y-2">
                    <Label htmlFor="newTime">Hora</Label>
                    <Input
                      id="newTime"
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      disabled={newAllDay}
                      className={newAllDay ? 'bg-slate-50 text-slate-400' : ''}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newComment">Descripción / Nota</Label>
                  <Textarea
                    id="newComment"
                    placeholder="Ej. Llamar para solicitar extractos bancarios adicionales..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    required
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); setNewAllDay(false); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Guardando...' : 'Agendar Tarea'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* MODAL DETALLES DEL EVENTO */}
          <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
            {selectedEvent && (
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <Badge className={CHANNEL_COLORS[selectedEvent.channel]}>
                      <span className="capitalize">{selectedEvent.channel}</span>
                    </Badge>
                    {selectedEvent.completed && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                        Completado
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="mt-2 text-lg font-bold text-slate-900">
                    {selectedEvent.client_name}
                  </DialogTitle>
                  <DialogDescription>
                    {formatDate(selectedEvent.next_action_date)}
                    {' · '}
                    {isAllDayEvent(selectedEvent.next_action_date)
                      ? <span className="font-medium text-slate-700">Todo el día</span>
                      : <span className="font-semibold text-slate-900">{formatHour12(selectedEvent.next_action_date)}</span>}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p className="font-semibold text-foreground mb-1">Nota del seguimiento:</p>
                    <p className="text-muted-foreground">{selectedEvent.comment}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Asesor encargado:</span>
                      <p className="font-semibold">{selectedEvent.asesor_name || 'Asesor'}</p>
                    </div>
                    {selectedEvent.credit_status && (
                      <div>
                        <span className="text-muted-foreground">Estado del Crédito:</span>
                        <p className="font-semibold capitalize">{selectedEvent.credit_status}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <Button
                    variant={selectedEvent.completed ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => toggleEventCompleted(selectedEvent)}
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{selectedEvent.completed ? 'Marcar como Pendiente' : 'Marcar Completado'}</span>
                  </Button>

                  {selectedEvent.credit_id && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        router.push(`/creditos/${selectedEvent.credit_id}`);
                        setSelectedEvent(null);
                      }}
                      className="gap-1.5"
                    >
                      <span>Ver Crédito</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </DialogContent>
            )}
          </Dialog>
        </div>
      </PageTransition>
    </AppLayout>
  );
}
