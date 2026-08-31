import './globals.css';
import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from '@/components/providers/auth-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { NotificationProvider } from '@/components/providers/notification-provider';
import { Toaster } from 'sonner';
import { ChatWidget } from '@/components/chat-widget';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Credilibranzas JG — CRM de Gestión de Créditos',
  description: 'Tu aliado financiero. CRM premium para gestión de créditos, libranzas y outsourcing financiero.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${plusJakarta.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased selection:bg-primary/20 selection:text-primary" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              {children}
              <ChatWidget />
              <Toaster
                position="top-right"
                richColors
                closeButton
                toastOptions={{
                  classNames: {
                    toast: 'rounded-xl shadow-xl border border-border/80 backdrop-blur-md',
                  },
                }}
              />
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
