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
    PostgrestVersion: "14.17"
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
      client_favorite_recipes: {
        Row: {
          client_id: number
          id: number
          recipe_id: number
          saved_at: string
          title: string
        }
        Insert: {
          client_id: number
          id?: never
          recipe_id: number
          saved_at?: string
          title: string
        }
        Update: {
          client_id?: number
          id?: never
          recipe_id?: number
          saved_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_favorite_recipes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_favorite_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pantry: {
        Row: {
          client_id: number
          created_at: string
          id: number
          item: string
        }
        Insert: {
          client_id: number
          created_at?: string
          id?: never
          item: string
        }
        Update: {
          client_id?: number
          created_at?: string
          id?: never
          item?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_pantry_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_preferences: {
        Row: {
          client_id: number
          created_at: string
          dietary_notes: string
          prefs: Json
          updated_at: string
        }
        Insert: {
          client_id: number
          created_at?: string
          dietary_notes: string
          prefs?: Json
          updated_at?: string
        }
        Update: {
          client_id?: number
          created_at?: string
          dietary_notes?: string
          prefs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_preferences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          auth_user_id: string | null
          chat_id: number | null
          created_at: string | null
          escalated_at: string | null
          escalation_status: string
          first_name: string | null
          id: number
          last_name: string | null
          platform: string
          setup_state: string | null
          status: string
          subscribed: boolean
          tags: string[]
          user_id: number | null
          username: string | null
        }
        Insert: {
          auth_user_id?: string | null
          chat_id?: number | null
          created_at?: string | null
          escalated_at?: string | null
          escalation_status?: string
          first_name?: string | null
          id?: never
          last_name?: string | null
          platform?: string
          setup_state?: string | null
          status?: string
          subscribed?: boolean
          tags?: string[]
          user_id?: number | null
          username?: string | null
        }
        Update: {
          auth_user_id?: string | null
          chat_id?: number | null
          created_at?: string | null
          escalated_at?: string | null
          escalation_status?: string
          first_name?: string | null
          id?: never
          last_name?: string | null
          platform?: string
          setup_state?: string | null
          status?: string
          subscribed?: boolean
          tags?: string[]
          user_id?: number | null
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
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          name: string
          position: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: never
          name?: string
          position?: string
          role?: string
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
          recipe_id: number | null
          sender_type: string
          telegram_message_id: number | null
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
          recipe_id?: number | null
          sender_type?: string
          telegram_message_id?: number | null
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
          recipe_id?: number | null
          sender_type?: string
          telegram_message_id?: number | null
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
          {
            foreignKeyName: "messages_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
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
      push_subscriptions: {
        Row: {
          auth: string
          client_id: number
          created_at: string
          endpoint: string
          id: number
          p256dh: string
        }
        Insert: {
          auth: string
          client_id: number
          created_at?: string
          endpoint: string
          id?: never
          p256dh: string
        }
        Update: {
          auth?: string
          client_id?: number
          created_at?: string
          endpoint?: string
          id?: never
          p256dh?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ratings: {
        Row: {
          client_id: number
          created_at: string
          id: number
          rating: number
          recipe_id: number
        }
        Insert: {
          client_id: number
          created_at?: string
          id?: never
          rating: number
          recipe_id: number
        }
        Update: {
          client_id?: number
          created_at?: string
          id?: never
          rating?: number
          recipe_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ratings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ratings_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          calories: number | null
          carbs: number | null
          category: string | null
          cook_time: string | null
          created_at: string
          description: string | null
          embedding: string | null
          fat: number | null
          id: number
          ingredients: string
          instructions: string
          protein: number | null
          servings: number | null
          title: string
        }
        Insert: {
          calories?: number | null
          carbs?: number | null
          category?: string | null
          cook_time?: string | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          fat?: number | null
          id?: never
          ingredients: string
          instructions: string
          protein?: number | null
          servings?: number | null
          title: string
        }
        Update: {
          calories?: number | null
          carbs?: number | null
          category?: string | null
          cook_time?: string | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          fat?: number | null
          id?: never
          ingredients?: string
          instructions?: string
          protein?: number | null
          servings?: number | null
          title?: string
        }
        Relationships: []
      }
      shopping_list_items: {
        Row: {
          checked: boolean
          client_id: number
          created_at: string
          id: number
          item: string
          recipe_id: number | null
        }
        Insert: {
          checked?: boolean
          client_id: number
          created_at?: string
          id?: never
          item: string
          recipe_id?: number | null
        }
        Update: {
          checked?: boolean
          client_id?: number
          created_at?: string
          id?: never
          item?: string
          recipe_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_pantry_item: { Args: { p_item: string }; Returns: undefined }
      add_shopping_items: {
        Args: { p_items: string[]; p_recipe_id?: number }
        Returns: undefined
      }
      clear_my_web_history: { Args: never; Returns: undefined }
      clear_shopping_list: {
        Args: { p_only_checked?: boolean }
        Returns: undefined
      }
      ensure_web_client: { Args: never; Returns: number }
      get_my_role: { Args: never; Returns: string }
      insert_recipe_dedup:
        | {
            Args: {
              p_calories?: number
              p_carbs?: number
              p_category: string
              p_cook_time?: string
              p_description: string
              p_embedding: string
              p_fat?: number
              p_ingredients: string
              p_instructions: string
              p_protein?: number
              p_servings?: number
              p_similarity_threshold?: number
              p_title: string
            }
            Returns: {
              description: string
              recipe_id: number
              reused: boolean
            }[]
          }
        | {
            Args: {
              p_category: string
              p_description: string
              p_embedding: string
              p_ingredients: string
              p_instructions: string
              p_similarity_threshold?: number
              p_title: string
            }
            Returns: {
              description: string
              recipe_id: number
              reused: boolean
            }[]
          }
      my_web_client_id: { Args: never; Returns: number }
      rate_recipe: {
        Args: { p_rating: number; p_recipe_id: number }
        Returns: undefined
      }
      remove_pantry_item: { Args: { p_item: string }; Returns: undefined }
      save_favorite: {
        Args: { p_recipe_id: number; p_title: string }
        Returns: undefined
      }
      save_push_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string }
        Returns: undefined
      }
      search_recipes: {
        Args: {
          match_count?: number
          query_embedding: string
          query_text?: string
        }
        Returns: {
          calories: number
          carbs: number
          category: string
          cook_time: string
          description: string
          fat: number
          id: number
          ingredients: string
          instructions: string
          protein: number
          servings: number
          similarity: number
          title: string
        }[]
      }
      set_preferences: { Args: { p_notes: string }; Returns: undefined }
      set_preferences_v2: {
        Args: { p_notes: string; p_prefs: Json }
        Returns: undefined
      }
      toggle_shopping_item: {
        Args: { p_checked: boolean; p_id: number }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
