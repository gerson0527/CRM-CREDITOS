'use client';

import { useEffect, useRef, useState } from 'react';

const PREFIX = 'crm-draft:';

function draftKey(namespace: string, field: string): string {
  return `${PREFIX}${namespace}:${field}`;
}

/** Borra todos los campos persistidos de un formulario (por namespace). */
export function clearDraft(namespace: string): void {
  if (typeof window === 'undefined') return;
  try {
    const prefix = `${PREFIX}${namespace}:`;
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Almacenamiento no disponible.
  }
}

/**
 * useState que sobrevive recargas guardando el valor en sessionStorage.
 * El valor se restaura después del primer render para no romper la
 * hidratación de Next.js.
 */
export function usePersistedState<T>(
  namespace: string,
  field: string,
  initial: T
): readonly [T, React.Dispatch<React.SetStateAction<T>>, (next?: T) => void, boolean] {
  const key = draftKey(namespace, field);
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const skipNextSave = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Borrador corrupto: se ignora.
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Cuota agotada o almacenamiento bloqueado: se sigue sin persistencia.
    }
  }, [key, loaded, value]);

  const reset = (next: T = initial) => {
    skipNextSave.current = true;
    setValue(next);
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignoring
    }
  };

  return [value, setValue, reset, loaded] as const;
}
