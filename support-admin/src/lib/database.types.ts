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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      chat_settings: {
        Row: {
          client_id: number
          max_tokens: number | null
          model: string
          system_prompt: string | null
          temperature: number | null
        }
        Insert: {
          client_id: number
          max_tokens?: number | null
          model?: string
          system_prompt?: string | null
          temperature?: number | null
        }
        Update: {
          client_id?: number
          max_tokens?: number | null
          model?: string
          system_prompt?: string | null
          temperature?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assignments: {
        Row: {
          assigned_by_manager_id: number | null
          assigned_manager_id: number | null
          client_id: number
          id: number
          updated_at: string | null
        }
        Insert: {
          assigned_by_manager_id?: number | null
          assigned_manager_id?: number | null
          client_id: number
          id?: never
          updated_at?: string | null
        }
        Update: {
          assigned_by_manager_id?: number | null
          assigned_manager_id?: number | null
          client_id?: number
          id?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_assignments_assigned_by_manager_id_fkey"
            columns: ["assigned_by_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_assigned_manager_id_fkey"
            columns: ["assigned_manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          chat_id: number
          created_at: string | null
          first_name: string | null
          id: number
          last_name: string | null
          status: string
          user_id: number
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string | null
          first_name?: string | null
          id?: never
          last_name?: string | null
          status?: string
          user_id: number
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string | null
          first_name?: string | null
          id?: never
          last_name?: string | null
          status?: string
          user_id?: number
          username?: string | null
        }
        Relationships: []
      }
      managers: {
        Row: {
          created_at: string | null
          id: number
          name: string
          position: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          name: string
          position: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: never
          name?: string
          position?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          client_id: number
          completion_tokens: number | null
          created_at: string
          id: number
          manager_id: number | null
          prompt_tokens: number | null
          sender_type: string
          text: string
          total_tokens: number | null
        }
        Insert: {
          client_id: number
          completion_tokens?: number | null
          created_at?: string
          id?: never
          manager_id?: number | null
          prompt_tokens?: number | null
          sender_type?: string
          text: string
          total_tokens?: number | null
        }
        Update: {
          client_id?: number
          completion_tokens?: number | null
          created_at?: string
          id?: never
          manager_id?: number | null
          prompt_tokens?: number | null
          sender_type?: string
          text?: string
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_managers: {
        Row: {
          action: string | null
          client_id: number | null
          created_at: string | null
          id: string
          manager_id: number | null
        }
        Insert: {
          action?: string | null
          client_id?: number | null
          created_at?: string | null
          id?: string
          manager_id?: number | null
        }
        Update: {
          action?: string | null
          client_id?: number | null
          created_at?: string | null
          id?: string
          manager_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_managers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_managers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          description: string | null
          embedding: string | null
          id: number
          ingredients: string
          instructions: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          embedding?: string | null
          id?: never
          ingredients: string
          instructions: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          embedding?: string | null
          id?: never
          ingredients?: string
          instructions?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_recipes: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          description: string
          id: number
          ingredients: string
          instructions: string
          similarity: number
          title: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
