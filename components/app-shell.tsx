'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/providers/auth-provider';
import { useNotifications } from '@/components/providers/notification-provider';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  LayoutDashboard,
  CreditCard,
  Trello,
  Users,
  UserPlus,
  FileBarChart,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  Shield,
  Building2,
  Landmark,
  Moon,
  Sun,
  Calendar as CalendarIcon,
  CheckCheck,
  Sparkles,
  MessageSquare,
  FileText,
  Clock,
  ExternalLink,
  UserCheck,
  PlusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, STATUS_STYLES } from '@/lib/constants';
import { useTheme } from 'next-themes';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  permission: string;
  badge?: number;
  section: 'principal' | 'operacion' | 'analisis' | 'admin';
}

const NAV_SECTIONS: { id: NavItem['section']; label: string }[] = [
  { id: 'principal', label: 'Principal' },
  { id: 'operacion', label: 'Operación' },
  { id: 'analisis', label: 'Análisis' },
  { id: 'admin', label: 'Administración' },
];

const NAV_ITEMS: NavItem[] = [
  // Principal
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4.5 w-4.5" />, permission: 'dashboard', section: 'principal' },

  // Operación
  { href: '/kanban', label: 'Kanban de Créditos', icon: <Trello className="h-4.5 w-4.5" />, permission: 'kanban', section: 'operacion' },
  { href: '/calendario', label: 'Calendario', icon: <CalendarIcon className="h-4.5 w-4.5" />, permission: 'calendario', section: 'operacion' },
  { href: '/clientes', label: 'Clientes', icon: <UserCheck className="h-4.5 w-4.5" />, permission: 'clientes', section: 'operacion' },
  { href: '/creditos', label: 'Tabla de Créditos', icon: <CreditCard className="h-4.5 w-4.5" />, permission: 'creditos', section: 'operacion' },
  { href: '/creditos/nuevo', label: 'Nuevo Crédito', icon: <PlusCircle className="h-4.5 w-4.5" />, permission: 'creditos.nuevo', section: 'operacion' },

  // Análisis
  { href: '/reportes', label: 'Reportes', icon: <FileBarChart className="h-4.5 w-4.5" />, permission: 'reportes', section: 'analisis' },

  // Administración
  { href: '/sedes', label: 'Sedes', icon: <Building2 className="h-4.5 w-4.5" />, permission: 'sedes', section: 'admin' },
  { href: '/entidades', label: 'Entidades Financieras', icon: <Landmark className="h-4.5 w-4.5" />, permission: 'entidades', section: 'admin' },
  { href: '/solicitudes', label: 'Solicitudes de Acceso', icon: <UserPlus className="h-4.5 w-4.5" />, permission: 'solicitudes', section: 'admin' },
  { href: '/usuarios', label: 'Gestión de Usuarios', icon: <Users className="h-4.5 w-4.5" />, permission: 'usuarios', section: 'admin' },
  { href: '/roles', label: 'Roles y Permisos', icon: <Shield className="h-4.5 w-4.5" />, permission: 'roles', section: 'admin' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, addNotification } = useNotifications();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  if (!profile) return null;

  const navItems = NAV_ITEMS.filter((item) => profile.permissions?.includes(item.permission));

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const handleSimulateAlert = () => {
    addNotification({
      title: '💬 Mensaje de Asesor en Vivo',
      message: 'Juan Pérez: "Cliente confirmó la documentación para el crédito #CR-920".',
      type: 'follow_up',
      sender_name: 'Juan Pérez',
      link: '/calendario',
    });
  };

  const Sidebar = (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground select-none">
      {/* Brand Header */}
      <div className="flex h-16 items-center border-b border-sidebar-border/80 px-5">
        <Logo showText={true} />
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => {
          const items = navItems.filter((n) => n.section === section.id);
          if (items.length === 0) return null;
          return (
            <div key={section.id} className="space-y-1">
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </p>
              <div className="space-y-1">
                {items.map((item) => {
                  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30 font-semibold'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <span className={cn('transition-transform duration-200 group-hover:scale-110', active ? 'text-white' : 'text-muted-foreground group-hover:text-primary')}>
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Footer Card */}
      <div className="border-t border-sidebar-border/80 p-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-accent/40 p-2.5 backdrop-blur-sm transition-all hover:bg-accent/70">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 font-display text-sm font-bold text-white shadow-xs">
            {profile.full_name.charAt(0).toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-xs font-bold text-foreground">{profile.full_name}</p>
            <p className="truncate text-[11px] font-medium text-muted-foreground">{ROLE_LABELS[profile.role]}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const activePageTitle =
    navItems.find((item) => {
      const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
      return active;
    })?.label || 'CRM';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">{Sidebar}</aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
            >
              {Sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header with glassmorphism */}
        <header className="flex h-16 items-center justify-between border-b border-border/80 bg-background/80 px-4 backdrop-blur-md lg:px-6 z-20">
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <Logo showText={false} />
            </div>
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium">Credilibranzas</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-bold text-foreground font-display">{activePageTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Action Button for Asesores / Admins */}
            {profile.permissions?.includes('creditos.nuevo') && (
              <Link
                href="/creditos/nuevo"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02]"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Nuevo Crédito</span>
              </Link>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
              title="Cambiar tema claro/oscuro"
            >
              <Sun className="h-4 w-4 dark:hidden text-amber-500" />
              <Moon className="hidden h-4 w-4 dark:block text-blue-400" />
            </button>

            {/* Realtime Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="relative rounded-xl p-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                  title="Notificaciones en tiempo real"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-background">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>

              <PopoverContent align="end" className="w-80 sm:w-96 p-0 shadow-2xl border border-border/80 rounded-2xl overflow-hidden backdrop-blur-xl bg-card/95">
                <div className="flex items-center justify-between border-b border-border/80 p-3.5 bg-accent/40">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bell className="h-4 w-4" />
                    </div>
                    <span className="font-display text-sm font-bold">Actividad en Tiempo Real</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                        {unreadCount} nuevas
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Leídas</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No tienes notificaciones recientes.
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          markAsRead(item.id);
                          if (item.link) router.push(item.link);
                        }}
                        className={cn(
                          'flex items-start gap-3 p-3.5 text-xs transition-colors cursor-pointer hover:bg-accent/50',
                          !item.read ? 'bg-primary/5 font-medium' : 'opacity-85'
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-primary mt-0.5 shadow-2xs">
                          {item.type === 'credit_status' ? (
                            <CreditCard className="h-4 w-4 text-blue-500" />
                          ) : item.type === 'follow_up' ? (
                            <MessageSquare className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <FileText className="h-4 w-4 text-amber-500" />
                          )}
                        </div>

                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-bold text-foreground truncate">{item.title}</p>
                            {!item.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                          </div>
                          <p className="mt-0.5 text-muted-foreground line-clamp-2 text-[11px]">{item.message}</p>
                          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/80">
                            <span className="font-semibold text-foreground/70">{item.sender_name || 'Sistema'}</span>
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="h-3 w-3" />
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-border/80 p-2.5 bg-accent/40 flex items-center justify-between text-xs">
                  <button
                    onClick={handleSimulateAlert}
                    className="flex items-center gap-1 text-primary hover:underline font-bold text-[11px]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Simular Alerta Realtime</span>
                  </button>
                  <Link href="/calendario" className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1 font-medium">
                    <span>Ver Calendario</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </PopoverContent>
            </Popover>

            {/* Role Chip */}
            <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-accent/40 px-2.5 py-1 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-foreground">
                {ROLE_LABELS[profile.role]}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-4 sm:p-6 lg:p-8 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
