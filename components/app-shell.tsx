'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/providers/auth-provider';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
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
  Moon,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, STATUS_STYLES } from '@/lib/constants';
import { useTheme } from 'next-themes';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  roles: ('admin' | 'supervisor' | 'asesor')[];
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4.5 w-4.5" />, roles: ['admin', 'supervisor', 'asesor'] },
  { href: '/kanban', label: 'Kanban de Créditos', icon: <Trello className="h-4.5 w-4.5" />, roles: ['admin', 'supervisor', 'asesor'] },
  { href: '/creditos', label: 'Tabla de Créditos', icon: <CreditCard className="h-4.5 w-4.5" />, roles: ['admin', 'supervisor', 'asesor'] },
  { href: '/creditos/nuevo', label: 'Nuevo Crédito', icon: <FileBarChart className="h-4.5 w-4.5" />, roles: ['admin', 'supervisor', 'asesor'] },
  { href: '/solicitudes', label: 'Solicitudes de Acceso', icon: <UserPlus className="h-4.5 w-4.5" />, roles: ['admin'] },
  { href: '/usuarios', label: 'Gestión de Usuarios', icon: <Users className="h-4.5 w-4.5" />, roles: ['admin'] },
  { href: '/reportes', label: 'Reportes', icon: <FileBarChart className="h-4.5 w-4.5" />, roles: ['admin', 'supervisor'] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  if (!profile) return null;

  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(profile.role));

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const Sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Logo variant="light" showText={true} />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-sidebar-active text-white shadow-sm'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-white">{profile.full_name}</p>
            <p className="text-xs text-white/60">{ROLE_LABELS[profile.role]}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
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
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
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
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <Logo showText={false} />
            </div>
            <div className="hidden lg:block">
              <h2 className="text-sm font-medium text-muted-foreground">
                {navItems.find((item) => {
                  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return active;
                })?.label || 'CRM'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
              title="Cambiar tema"
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </button>
            <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent" title="Notificaciones">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-secondary" />
            </button>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[profile.status].bgColor, STATUS_STYLES[profile.status].textColor)}>
                {ROLE_LABELS[profile.role]}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
