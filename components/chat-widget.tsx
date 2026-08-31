'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, Bot, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'bot' | 'user';
  content: string;
  timestamp: Date;
}

const QUICK_REPLIES = [
  '¿Cómo radicar un crédito?',
  'Ver mis solicitudes',
  'Estado del pipeline',
  'Hablar con soporte',
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'bot',
    content: '¡Hola! 👋 Soy tu asistente inteligente de Credilibranzas JG. ¿En qué puedo apoyarte hoy?',
    timestamp: new Date(),
  },
];

const BOT_REPLIES: Record<string, string> = {
  credito: 'Para radicar un nuevo crédito, presiona el botón "+ Nuevo Crédito" en la barra superior o en el menú lateral. Necesitarás documento de identidad, volante de pago y datos del cliente.',
  solicitudes: 'Puedes gestionar y aprobar solicitudes de acceso en la sección "Solicitudes de Acceso" del menú de administración.',
  estado: 'Puedes consultar el estado detallado de tus operaciones en el tablero Kanban o en la sección de Reportes analíticos.',
  asesor: '¡Con gusto! Nuestro equipo de soporte comercial está disponible de Lunes a Viernes de 8:00 AM a 6:00 PM.',
  default: 'Entendido. Estoy procesando tu consulta con el sistema comercial...',
};

function getBotReply(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('crédit') || lower.includes('credit') || lower.includes('crear') || lower.includes('radicar')) return BOT_REPLIES.credito;
  if (lower.includes('solicitud') || lower.includes('acceso')) return BOT_REPLIES.solicitudes;
  if (lower.includes('estado') || lower.includes('pipeline') || lower.includes('reporte')) return BOT_REPLIES.estado;
  if (lower.includes('asesor') || lower.includes('soporte') || lower.includes('humano')) return BOT_REPLIES.asesor;
  return BOT_REPLIES.default;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(1);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: getBotReply(trimmed),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setTyping(false);
    }, 900);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="mb-4 flex h-[500px] w-80 sm:w-96 flex-col overflow-hidden rounded-3xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-border/80 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/25">
                  <Bot className="h-5 w-5" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-foreground">Asistente Virtual</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">En línea</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="Cerrar chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages body */}
            <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2.5 text-xs',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'bot' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-2xs leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground font-medium rounded-tr-xs'
                        : 'border border-border/70 bg-accent/60 text-foreground rounded-tl-xs'
                    )}
                  >
                    <p>{msg.content}</p>
                    <span
                      className={cn(
                        'mt-1 block text-[9px] text-right font-medium',
                        msg.role === 'user' ? 'text-primary-foreground/75' : 'text-muted-foreground'
                      )}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {typing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-border/70 bg-accent/60 px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick replies */}
            <div className="border-t border-border/60 bg-accent/20 px-3 py-2">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => sendMessage(reply)}
                    className="shrink-0 rounded-full border border-border/80 bg-card/80 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border/80 p-3 bg-card/90">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu mensaje..."
                className="h-10 flex-1 rounded-xl border-border/80 bg-background text-xs"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary via-blue-600 to-indigo-600 text-white shadow-xl shadow-primary/30 ring-4 ring-primary/15 transition-all"
        aria-label="Abrir asistente de soporte"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative flex items-center justify-center"
            >
              <MessageCircle className="h-6 w-6" />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                  {unread}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
