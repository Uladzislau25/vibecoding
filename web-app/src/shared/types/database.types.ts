// Minimal hand-written types for the tables the PWA touches directly.
// Everything else goes through the web-chat edge function.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      messages: {
        Row: {
          id: number;
          client_id: number;
          text: string;
          sender_type: string;
          recipe_id: number | null;
          created_at: string;
        };
        Insert: {
          client_id: number;
          text: string;
          sender_type?: string;
          recipe_id?: number | null;
        };
        Update: {
          text?: string;
          sender_type?: string;
          recipe_id?: number | null;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: number;
          auth_user_id: string | null;
          platform: string;
          subscribed: boolean;
        };
        Insert: {
          auth_user_id?: string | null;
          platform?: string;
          subscribed?: boolean;
        };
        Update: {
          subscribed?: boolean;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: number;
          client_id: number;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          client_id: number;
          endpoint: string;
          p256dh: string;
          auth: string;
        };
        Update: {
          endpoint?: string;
          p256dh?: string;
          auth?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_push_subscription: {
        Args: { p_endpoint: string; p_p256dh: string; p_auth: string };
        Returns: undefined;
      };
      clear_my_web_history: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
