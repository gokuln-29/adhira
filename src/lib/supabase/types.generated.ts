export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          name: string
          role: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          name: string
          role?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          body: string | null
          category: string | null
          cover: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          cover?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: string | null
          cover?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image: string | null
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image?: string | null
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image?: string | null
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          auth_user_id: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          trn: string | null
          type: string
        }
        Insert: {
          auth_user_id?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          trn?: string | null
          type?: string
        }
        Update: {
          auth_user_id?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          trn?: string | null
          type?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          budget: string | null
          company: string | null
          contact: string
          created_at: string
          email: string | null
          emirate: string | null
          frequency: string | null
          id: string
          message: string | null
          owner: string | null
          phone: string | null
          requirement: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          budget?: string | null
          company?: string | null
          contact: string
          created_at?: string
          email?: string | null
          emirate?: string | null
          frequency?: string | null
          id?: string
          message?: string | null
          owner?: string | null
          phone?: string | null
          requirement?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          budget?: string | null
          company?: string | null
          contact?: string
          created_at?: string
          email?: string | null
          emirate?: string | null
          frequency?: string | null
          id?: string
          message?: string | null
          owner?: string | null
          phone?: string | null
          requirement?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          ends: string | null
          id: string
          scope: string
          starts: string | null
          title: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          ends?: string | null
          id?: string
          scope?: string
          starts?: string | null
          title: string
          type: string
          updated_at?: string
          value: number
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          ends?: string | null
          id?: string
          scope?: string
          starts?: string | null
          title?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          line_total: number
          name: string
          order_id: string
          product_id: string | null
          qty: number
          unit_price: number
          vessel: boolean
          vessel_fee: number
          deposit: number
          rental_months: number | null
        }
        Insert: {
          id?: string
          line_total: number
          name: string
          order_id: string
          product_id?: string | null
          qty: number
          unit_price: number
          vessel?: boolean
          vessel_fee?: number
          deposit?: number
          rental_months?: number | null
        }
        Update: {
          id?: string
          line_total?: number
          name?: string
          order_id?: string
          product_id?: string | null
          qty?: number
          unit_price?: number
          vessel?: boolean
          vessel_fee?: number
          deposit?: number
          rental_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: Json
          channel: string
          created_at: string
          currency: string
          customer_id: string | null
          delivery_date: string | null
          delivery_fee: number
          emirate: string | null
          id: string
          notes: string | null
          number: string
          public_token: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          total: number
          updated_at: string
          vat: number
          deposit_total: number
          deposit_status: string
        }
        Insert: {
          address?: Json
          channel?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          delivery_date?: string | null
          delivery_fee?: number
          emirate?: string | null
          id?: string
          notes?: string | null
          number: string
          public_token?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          vat?: number
          deposit_total?: number
          deposit_status?: string
        }
        Update: {
          address?: Json
          channel?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          delivery_date?: string | null
          delivery_fee?: number
          emirate?: string | null
          id?: string
          notes?: string | null
          number?: string
          public_token?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          vat?: number
          deposit_total?: number
          deposit_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          description: string | null
          expires_at: string | null
          id: string
          paid_at: string | null
          provider_ref: string | null
          status: string
          url: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          provider_ref?: string | null
          status?: string
          url?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          provider_ref?: string | null
          status?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string
          created_at: string
          id: string
          is_primary: boolean
          position: number
          product_id: string
          url: string
        }
        Insert: {
          alt?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          position?: number
          product_id: string
          url: string
        }
        Update: {
          alt?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          position?: number
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string
          details: Json
          discount_type: string | null
          discount_value: number | null
          id: string
          name: string
          sale_end: string | null
          sale_start: string | null
          short_description: string | null
          slug: string
          status: string
          tags: string[]
          updated_at: string
          vat_rate: number
          min_order_qty: number
          min_order_value: number
          allows_vessel: boolean
          vessel_price: number
          vessel_deposit: number
          is_rental: boolean
          rental_monthly_price: number | null
          rental_min_months: number
          rental_deposit: number
        }
        Insert: {
          base_price: number
          category_id?: string | null
          created_at?: string
          details?: Json
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          name: string
          sale_end?: string | null
          sale_start?: string | null
          short_description?: string | null
          slug: string
          status?: string
          tags?: string[]
          updated_at?: string
          vat_rate?: number
          min_order_qty?: number
          min_order_value?: number
          allows_vessel?: boolean
          vessel_price?: number
          vessel_deposit?: number
          is_rental?: boolean
          rental_monthly_price?: number | null
          rental_min_months?: number
          rental_deposit?: number
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          details?: Json
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          name?: string
          sale_end?: string | null
          sale_start?: string | null
          short_description?: string | null
          slug?: string
          status?: string
          tags?: string[]
          updated_at?: string
          vat_rate?: number
          min_order_qty?: number
          min_order_value?: number
          allows_vessel?: boolean
          vessel_price?: number
          vessel_deposit?: number
          is_rental?: boolean
          rental_monthly_price?: number | null
          rental_min_months?: number
          rental_deposit?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start?: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_role: { Args: never; Returns: string }
      create_order_tx: { Args: { p: Json }; Returns: Json }
      has_admin_role: { Args: { roles: string[] }; Returns: boolean }
      hit_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

