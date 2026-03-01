export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      basecamp_tokens: {
        Row: {
          access_token: string
          account_id: string | null
          connected_by: string
          created_at: string
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id?: string | null
          connected_by: string
          created_at?: string
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string | null
          connected_by?: string
          created_at?: string
          id?: string
          refresh_token?: string
          token_expiry?: string
          updated_at?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          allocated_amount: number
          category: Database["public"]["Enums"]["po_category"]
          created_at: string
          department_id: string
          fiscal_year: number
          id: string
          spent_amount: number
          updated_at: string
        }
        Insert: {
          allocated_amount?: number
          category: Database["public"]["Enums"]["po_category"]
          created_at?: string
          department_id: string
          fiscal_year?: number
          id?: string
          spent_amount?: number
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          category?: Database["public"]["Enums"]["po_category"]
          created_at?: string
          department_id?: string
          fiscal_year?: number
          id?: string
          spent_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          competency_score: number | null
          created_at: string
          cv_storage_path: string | null
          cv_text: string | null
          email: string | null
          email_subject: string | null
          gmail_message_id: string | null
          hireflix_interview_url: string | null
          hireflix_invited_at: string | null
          hireflix_status: string | null
          id: string
          job_role_id: string | null
          name: string
          scoring_details: Json | null
          status: string
          total_score: number | null
          updated_at: string
          values_score: number | null
        }
        Insert: {
          competency_score?: number | null
          created_at?: string
          cv_storage_path?: string | null
          cv_text?: string | null
          email?: string | null
          email_subject?: string | null
          gmail_message_id?: string | null
          hireflix_interview_url?: string | null
          hireflix_invited_at?: string | null
          hireflix_status?: string | null
          id?: string
          job_role_id?: string | null
          name: string
          scoring_details?: Json | null
          status?: string
          total_score?: number | null
          updated_at?: string
          values_score?: number | null
        }
        Update: {
          competency_score?: number | null
          created_at?: string
          cv_storage_path?: string | null
          cv_text?: string | null
          email?: string | null
          email_subject?: string | null
          gmail_message_id?: string | null
          hireflix_interview_url?: string | null
          hireflix_invited_at?: string | null
          hireflix_status?: string | null
          id?: string
          job_role_id?: string | null
          name?: string
          scoring_details?: Json | null
          status?: string
          total_score?: number | null
          updated_at?: string
          values_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_integrations: {
        Row: {
          created_at: string
          documents_ingested: number | null
          encrypted_api_key: string | null
          id: string
          integration_id: string
          last_sync: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          documents_ingested?: number | null
          encrypted_api_key?: string | null
          id?: string
          integration_id: string
          last_sync?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          documents_ingested?: number | null
          encrypted_api_key?: string | null
          id?: string
          integration_id?: string
          last_sync?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gmail_tokens: {
        Row: {
          access_token: string
          connected_by: string
          created_at: string
          email_address: string | null
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string
        }
        Insert: {
          access_token: string
          connected_by: string
          created_at?: string
          email_address?: string | null
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          connected_by?: string
          created_at?: string
          email_address?: string | null
          id?: string
          refresh_token?: string
          token_expiry?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          refresh_token?: string
          token_expiry?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_drive_tokens: {
        Row: {
          access_token: string
          connected_by: string
          created_at: string
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string
        }
        Insert: {
          access_token: string
          connected_by: string
          created_at?: string
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          connected_by?: string
          created_at?: string
          id?: string
          refresh_token?: string
          token_expiry?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_forms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json
          form_action_url: string
          form_url: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          form_action_url: string
          form_url: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          form_action_url?: string
          form_url?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_roles: {
        Row: {
          company_values: Json
          competencies: Json
          created_at: string
          created_by: string
          description: string | null
          hireflix_position_id: string | null
          id: string
          jd_storage_path: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_values?: Json
          competencies?: Json
          created_at?: string
          created_by: string
          description?: string | null
          hireflix_position_id?: string | null
          id?: string
          jd_storage_path?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_values?: Json
          competencies?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          hireflix_position_id?: string | null
          id?: string
          jd_storage_path?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      nda_submissions: {
        Row: {
          created_at: string
          date_of_agreement: string
          docusign_envelope_id: string | null
          google_doc_id: string | null
          google_doc_url: string | null
          id: string
          internal_signer_email: string | null
          internal_signer_name: string | null
          last_error: string | null
          notion_page_id: string | null
          notion_page_url: string | null
          purpose: string
          receiving_party_entity: string
          receiving_party_name: string
          recipient_email: string
          recipient_name: string
          registered_address: string
          status: string
          submitter_email: string | null
          submitter_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_agreement: string
          docusign_envelope_id?: string | null
          google_doc_id?: string | null
          google_doc_url?: string | null
          id?: string
          internal_signer_email?: string | null
          internal_signer_name?: string | null
          last_error?: string | null
          notion_page_id?: string | null
          notion_page_url?: string | null
          purpose: string
          receiving_party_entity: string
          receiving_party_name: string
          recipient_email: string
          recipient_name: string
          registered_address: string
          status?: string
          submitter_email?: string | null
          submitter_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_agreement?: string
          docusign_envelope_id?: string | null
          google_doc_id?: string | null
          google_doc_url?: string | null
          id?: string
          internal_signer_email?: string | null
          internal_signer_name?: string | null
          last_error?: string | null
          notion_page_id?: string | null
          notion_page_url?: string | null
          purpose?: string
          receiving_party_entity?: string
          receiving_party_name?: string
          recipient_email?: string
          recipient_name?: string
          registered_address?: string
          status?: string
          submitter_email?: string | null
          submitter_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          department: string | null
          display_name: string | null
          id: string
          norman_context: string | null
          preferences: Json | null
          role_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          id?: string
          norman_context?: string | null
          preferences?: Json | null
          role_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          id?: string
          norman_context?: string | null
          preferences?: Json | null
          role_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          approval_tier: string | null
          approved_at: string | null
          approved_by: string | null
          attachment_path: string | null
          category: Database["public"]["Enums"]["po_category"]
          created_at: string
          delivery_date: string | null
          department_id: string
          description: string
          id: string
          notes: string | null
          po_number: string
          quantity: number
          rejection_reason: string | null
          requester_id: string
          status: Database["public"]["Enums"]["po_status"]
          total_amount: number
          unit_price: number
          updated_at: string
          vendor_name: string
        }
        Insert: {
          approval_tier?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_path?: string | null
          category?: Database["public"]["Enums"]["po_category"]
          created_at?: string
          delivery_date?: string | null
          department_id: string
          description: string
          id?: string
          notes?: string | null
          po_number: string
          quantity?: number
          rejection_reason?: string | null
          requester_id: string
          status?: Database["public"]["Enums"]["po_status"]
          total_amount: number
          unit_price: number
          updated_at?: string
          vendor_name: string
        }
        Update: {
          approval_tier?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_path?: string | null
          category?: Database["public"]["Enums"]["po_category"]
          created_at?: string
          delivery_date?: string | null
          department_id?: string
          description?: string
          id?: string
          notes?: string | null
          po_number?: string
          quantity?: number
          rejection_reason?: string | null
          requester_id?: string
          status?: Database["public"]["Enums"]["po_status"]
          total_amount?: number
          unit_price?: number
          updated_at?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          created_at: string
          documents_ingested: number | null
          encrypted_api_key: string
          id: string
          integration_id: string
          last_sync: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          documents_ingested?: number | null
          encrypted_api_key: string
          id?: string
          integration_id: string
          last_sync?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          documents_ingested?: number | null
          encrypted_api_key?: string
          id?: string
          integration_id?: string
          last_sync?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wiki_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      wiki_pages: {
        Row: {
          category_id: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          is_published: boolean
          sort_order: number
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          updated_by: string | null
          view_count: number
        }
        Insert: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by: string
          id?: string
          is_published?: boolean
          sort_order?: number
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          updated_by?: string | null
          view_count?: number
        }
        Update: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_published?: boolean
          sort_order?: number
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "wiki_pages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "wiki_categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      po_category:
        | "software"
        | "hardware"
        | "services"
        | "marketing"
        | "travel"
        | "office_supplies"
        | "other"
      po_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      po_category: [
        "software",
        "hardware",
        "services",
        "marketing",
        "travel",
        "office_supplies",
        "other",
      ],
      po_status: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "cancelled",
      ],
    },
  },
} as const
