/**
 * SHIM compatible con la API de @supabase/supabase-js para queries básicas.
 *
 * Patrones soportados:
 *   supabase.from('credits').select('*').eq('asesor_id', id).order('created_at', { ascending: false })
 *   supabase.from('credits').select('*').eq('id', x).maybeSingle()
 *   supabase.from('credits').select('*').single()
 *   supabase.from('credits').select('*').limit(10)
 *   supabase.from('credits').insert(payload)
 *   supabase.from('credits').update(payload).eq('id', x)
 *   supabase.from('credits').delete().eq('id', x)
 */

type Operator = 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'gte' | 'lte' | 'like' | 'ilike' | 'is';

class QueryBuilder<T = any> implements PromiseLike<{ data: T | T[] | null; error: { message: string } | null }> {
  filters: Array<{ col: string; op: Operator; val: unknown }>;
  selectCols: string;
  orderBy: { col: string; asc: boolean } | null;
  limitN: number | null;
  singleMode: 'single' | 'maybeSingle' | null;

  constructor(public table: string) {
    this.filters = [];
    this.selectCols = '*';
    this.orderBy = null;
    this.limitN = null;
    this.singleMode = null;
  }

  select(cols?: string): this {
    this.selectCols = cols || '*';
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ col, op: 'eq', val });
    return this;
  }

  neq(col: string, val: unknown): this { this.filters.push({ col, op: 'neq', val }); return this; }
  in(col: string, vals: unknown[]): this { this.filters.push({ col, op: 'in', val: vals }); return this; }
  gt(col: string, val: unknown): this { this.filters.push({ col, op: 'gt', val }); return this; }
  lt(col: string, val: unknown): this { this.filters.push({ col, op: 'lt', val }); return this; }
  gte(col: string, val: unknown): this { this.filters.push({ col, op: 'gte', val }); return this; }
  lte(col: string, val: unknown): this { this.filters.push({ col, op: 'lte', val }); return this; }
  like(col: string, val: unknown): this { this.filters.push({ col, op: 'like', val }); return this; }
  ilike(col: string, val: unknown): this { this.filters.push({ col, op: 'ilike', val }); return this; }
  is(col: string, val: unknown): this { this.filters.push({ col, op: 'is', val }); return this; }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orderBy = { col, asc: opts?.ascending !== false };
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  single(): this { this.singleMode = 'single'; this.limitN = 1; return this; }
  maybeSingle(): this { this.singleMode = 'maybeSingle'; this.limitN = 1; return this; }

  insert(payload: Partial<T> | Partial<T>[]): InsertResult<T> {
    return new InsertResult<T>(this.table, 'POST', payload);
  }

  update(payload: Partial<T>): InsertResult<T> {
    return new InsertResult<T>(this.table, 'PATCH', payload, [...this.filters]);
  }

  delete(): InsertResult<T> {
    return new InsertResult<T>(this.table, 'DELETE', undefined, [...this.filters]);
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
  ): PromiseLike<TResult1 | TResult2> {
    return this.runQuery().then(onfulfilled as any, onrejected as any);
  }

  buildUrl(): string {
    const params = new URLSearchParams();
    if (this.selectCols !== '*') params.set('select', this.selectCols);
    if (this.orderBy) {
      params.set('order_by', this.orderBy.col);
      params.set('order', this.orderBy.asc ? 'asc' : 'desc');
    }
    if (this.limitN != null) params.set('limit', String(this.limitN));
    for (const f of this.filters) {
      if (f.op === 'eq') params.set(`eq.${f.col}`, String(f.val));
      else if (f.op === 'in') params.set(`eq.${f.col}__in`, (f.val as unknown[]).join(','));
    }
    return `/api/db/${this.table}?${params.toString()}`;
  }

  async runQuery(): Promise<{ data: any; error: any }> {
    try {
      const res = await fetch(this.buildUrl(), { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.error || 'Error' } };
      if (this.singleMode === 'single') {
        if (!data.rows || data.rows.length === 0) return { data: null, error: { message: 'No rows' } };
        return { data: data.rows[0], error: null };
      }
      if (this.singleMode === 'maybeSingle') return { data: data.rows?.[0] ?? null, error: null };
      return { data: data.rows, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }
}

type Handler = { event: string; config: any; callback: (payload: any) => void };
const globalRealtimeHandlers = new Set<Handler>();

function broadcastLocalEvent(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', row: any) {
  globalRealtimeHandlers.forEach((handler) => {
    if (handler.config?.table === table && (handler.config?.event === '*' || handler.config?.event === eventType)) {
      try {
        handler.callback({
          eventType,
          schema: 'public',
          table,
          new: eventType !== 'DELETE' ? row : null,
          old: eventType !== 'INSERT' ? row : null,
        });
      } catch (err) {
        console.error('[RealtimeBus] Error dispatching handler:', err);
      }
    }
  });
}

class InsertResult<T = any> implements PromiseLike<{ data: any; error: any }> {
  selectCols: string;
  singleMode: 'single' | 'maybeSingle' | null;

  constructor(
    public table: string,
    public method: 'POST' | 'PATCH' | 'DELETE',
    public payload: Partial<T> | Partial<T>[] | undefined,
    public filters: Array<{ col: string; op: Operator; val: unknown }> = []
  ) {
    this.selectCols = '*';
    this.singleMode = null;
  }

  select(cols?: string): this {
    this.selectCols = cols || '*';
    return this;
  }

  single(): this { this.singleMode = 'single'; return this; }
  maybeSingle(): this { this.singleMode = 'maybeSingle'; return this; }
  eq(col: string, val: unknown): this { this.filters.push({ col, op: 'eq', val }); return this; }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
  ): PromiseLike<TResult1 | TResult2> {
    return this.exec().then(onfulfilled as any, onrejected as any);
  }

  async exec(): Promise<{ data: any; error: any }> {
    const params = new URLSearchParams();
    if (this.selectCols !== '*') params.set('select', this.selectCols);
    for (const f of this.filters) {
      if (f.op === 'eq') params.set(`eq.${f.col}`, String(f.val));
    }
    let url = `/api/db/${this.table}${params.toString() ? `?${params}` : ''}`;
    if (this.method === 'PATCH' || this.method === 'DELETE') {
      const id = this.filters.find((f) => f.col === 'id')?.val;
      if (id) url = `/api/db/${this.table}/${id}${params.toString() ? `?${params}` : ''}`;
    }
    try {
      const res = await fetch(url, {
        method: this.method,
        headers: { 'Content-Type': 'application/json' },
        body: this.payload !== undefined ? JSON.stringify(Array.isArray(this.payload) ? this.payload[0] : this.payload) : undefined,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.error || 'Error' } };
      let result = data.row ?? null;
      if (this.singleMode && Array.isArray(result)) result = result[0] ?? null;

      // Disparar evento en el Event Bus local para notificaciones en tiempo real
      if (result) {
        const eventType = this.method === 'POST' ? 'INSERT' : this.method === 'PATCH' ? 'UPDATE' : 'DELETE';
        broadcastLocalEvent(this.table, eventType, result);
      }

      return { data: result, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }
}

class AuthShim {
  async getSession() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (!data.user) return { data: { session: null }, error: null };
      return {
        data: { session: { access_token: 'cookie', user: data.user } },
        error: null,
      };
    } catch (err: any) {
      return { data: { session: null }, error: { message: err.message } };
    }
  }

  async signOut() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    return { error: null };
  }

  async signInWithPassword(_args: { email: string; password: string }) {
    return { data: null, error: { message: 'Use /api/auth/login directly' } };
  }

  async signUp(_args: any): Promise<{ data: { user: any; session: any } | null; error: any }> {
    return { data: { user: { id: 'pending' }, session: null }, error: null };
  }

  onAuthStateChange(_cb: any) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
}

class RealtimeChannel {
  private activeHandlers: Handler[] = [];

  on(event: string, config: any, callback: (payload: any) => void): this {
    const handler: Handler = { event, config, callback };
    this.activeHandlers.push(handler);
    globalRealtimeHandlers.add(handler);
    return this;
  }

  subscribe(callback?: (status: string) => void): { unsubscribe: () => void } {
    callback?.('SUBSCRIBED');
    return {
      unsubscribe: () => {
        this.unsubscribe();
      },
    };
  }

  unsubscribe(): void {
    for (const h of this.activeHandlers) {
      globalRealtimeHandlers.delete(h);
    }
    this.activeHandlers = [];
  }
}

class SupabaseShim {
  auth: AuthShim;

  constructor() {
    this.auth = new AuthShim();
  }

  from<T = any>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table);
  }

  channel(_name: string): RealtimeChannel {
    return new RealtimeChannel();
  }

  removeChannel(ch: any): Promise<void> {
    if (ch && typeof ch.unsubscribe === 'function') {
      ch.unsubscribe();
    }
    return Promise.resolve();
  }
}

export const supabase = new SupabaseShim();