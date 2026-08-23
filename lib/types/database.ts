export type UserRole = 'admin' | 'supervisor' | 'asesor';
export type UserStatus = 'pendiente_aprobacion' | 'activo' | 'rechazado' | 'inactivo';

export type CreditStatus =
  | 'lead'
  | 'documentacion'
  | 'enviado'
  | 'estudio'
  | 'aprobado'
  | 'desembolsado'
  | 'rechazado'
  | 'desistido';

export type DocumentStatus = 'pendiente' | 'validado' | 'rechazado';

export type FollowUpChannel = 'llamada' | 'whatsapp' | 'visita' | 'email';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  supervisor_id: string | null;
  monthly_goal: number;
  commission_rate: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialEntity {
  id: string;
  name: string;
  credit_types: string[];
  avg_response_days: number;
  contact_name: string | null;
  contact_phone: string | null;
  active: boolean;
  created_at: string;
}

export interface CreditType {
  id: string;
  name: string;
  min_amount: number;
  max_amount: number;
  default_rate: number;
  required_documents: string[];
  active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  reported_income: number;
  personal_refs: any[];
  created_by: string | null;
  created_at: string;
}

export interface Credit {
  id: string;
  client_id: string;
  asesor_id: string | null;
  entity_id: string | null;
  credit_type_id: string | null;
  status: CreditStatus;
  requested_amount: number;
  approved_amount: number | null;
  term_months: number | null;
  rate: number | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  status_changed_at: string;
  // Joined relations
  client?: Client;
  asesor?: Pick<Profile, 'id' | 'full_name'>;
  entity?: Pick<FinancialEntity, 'id' | 'name'>;
  credit_type?: Pick<CreditType, 'id' | 'name'>;
}

export interface CreditStatusHistory {
  id: string;
  credit_id: string;
  previous_status: CreditStatus | null;
  new_status: CreditStatus;
  changed_by: string | null;
  changed_at: string;
  comment: string | null;
  changed_by_profile?: Pick<Profile, 'id' | 'full_name'>;
}

export interface Document {
  id: string;
  credit_id: string;
  document_type: string;
  file_url: string;
  status: DocumentStatus;
  uploaded_by: string | null;
  uploaded_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface FollowUp {
  id: string;
  credit_id: string;
  asesor_id: string | null;
  channel: FollowUpChannel;
  comment: string;
  contact_date: string;
  next_action_date: string | null;
  next_action_note: string | null;
  completed: boolean;
  created_at: string;
  credit?: Pick<Credit, 'id' | 'status'> & {
    client?: Pick<Client, 'first_name' | 'last_name'>;
  };
}

// Database type for Supabase
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
      };
      financial_entities: {
        Row: FinancialEntity;
        Insert: Partial<FinancialEntity>;
        Update: Partial<FinancialEntity>;
      };
      credit_types: {
        Row: CreditType;
        Insert: Partial<CreditType>;
        Update: Partial<CreditType>;
      };
      clients: {
        Row: Client;
        Insert: Partial<Client>;
        Update: Partial<Client>;
      };
      credits: {
        Row: Credit;
        Insert: Partial<Credit>;
        Update: Partial<Credit>;
      };
      credit_status_history: {
        Row: CreditStatusHistory;
        Insert: Partial<CreditStatusHistory>;
        Update: Partial<CreditStatusHistory>;
      };
      documents: {
        Row: Document;
        Insert: Partial<Document>;
        Update: Partial<Document>;
      };
      follow_ups: {
        Row: FollowUp;
        Insert: Partial<FollowUp>;
        Update: Partial<FollowUp>;
      };
    };
  };
}
