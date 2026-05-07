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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      batch_delivery_settings: {
        Row: {
          additional_delivery_base_price: number
          additional_delivery_price_per_km: number
          created_at: string
          id: string
          is_active: boolean
          max_deliveries: number
          time_window_minutes: number
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          additional_delivery_base_price?: number
          additional_delivery_price_per_km?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_deliveries?: number
          time_window_minutes?: number
          updated_at?: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          additional_delivery_base_price?: number
          additional_delivery_price_per_km?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_deliveries?: number
          time_window_minutes?: number
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      delivery_messages: {
        Row: {
          id: string
          delivery_id: string
          sender_id: string
          sender_role: string
          message: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          delivery_id: string
          sender_id: string
          sender_role: string
          message: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          delivery_id?: string
          sender_id?: string
          sender_role?: string
          message?: string
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_messages_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          }
        ]
      }
      deliveries: {
        Row: {
          accepted_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          delivered_at: string | null
          scheduled_at: string | null
          delivery_address: string
          delivery_latitude: number
          delivery_longitude: number
          delivery_photo_url: string | null
          delivery_sequence: number | null
          description: string | null
          distance_km: number
          driver_id: string | null
          financial_status:
            | Database["public"]["Enums"]["financial_status"]
            | null
          id: string
          is_additional_delivery: boolean | null
          parent_delivery_id: string | null
          picked_up_at: string | null
          pickup_address: string
          pickup_latitude: number
          pickup_longitude: number
          pickup_photo_url: string | null
          price: number
          price_adjusted: number
          product_note: string | null
          product_type: string | null
          recipient_name: string | null
          recipient_phone: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
          vehicle_category: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Insert: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          scheduled_at?: string | null
          delivery_address: string
          delivery_latitude: number
          delivery_longitude: number
          delivery_photo_url?: string | null
          delivery_sequence?: number | null
          description?: string | null
          distance_km: number
          driver_id?: string | null
          financial_status?:
            | Database["public"]["Enums"]["financial_status"]
            | null
          id?: string
          is_additional_delivery?: boolean | null
          parent_delivery_id?: string | null
          picked_up_at?: string | null
          pickup_address: string
          pickup_latitude: number
          pickup_longitude: number
          pickup_photo_url?: string | null
          price: number
          price_adjusted?: number
          product_note?: string | null
          product_type?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          vehicle_category?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Update: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          scheduled_at?: string | null
          delivery_address?: string
          delivery_latitude?: number
          delivery_longitude?: number
          delivery_photo_url?: string | null
          delivery_sequence?: number | null
          description?: string | null
          distance_km?: number
          driver_id?: string | null
          financial_status?:
            | Database["public"]["Enums"]["financial_status"]
            | null
          id?: string
          is_additional_delivery?: boolean | null
          parent_delivery_id?: string | null
          picked_up_at?: string | null
          pickup_address?: string
          pickup_latitude?: number
          pickup_longitude?: number
          pickup_photo_url?: string | null
          price?: number
          price_adjusted?: number
          product_note?: string | null
          product_type?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          vehicle_category?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_parent_delivery_id_fkey"
            columns: ["parent_delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_categories: {
        Row: {
          base_price: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          price_per_km: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price_per_km?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price_per_km?: number
          updated_at?: string
        }
        Relationships: []
      }
      delivery_radius_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_radius_km: number
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_radius_km?: number
          updated_at?: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_radius_km?: number
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string
          delivery_id: string
          description: string
          id: string
          reason: string
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          description: string
          id?: string
          reason: string
          reported_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          description?: string
          id?: string
          reason?: string
          reported_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          created_at: string
          delivery_id: string | null
          driver_id: string
          id: string
          latitude: number
          longitude: number
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          driver_id: string
          id?: string
          latitude: number
          longitude: number
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          driver_id?: string
          id?: string
          latitude?: number
          longitude?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          accepted_product_types: string[]
          created_at: string
          drivers_license_url: string | null
          earnings_balance: number
          id: string
          is_approved: boolean
          is_available: boolean
          last_location_update: string | null
          latitude: number | null
          license_plate: string | null
          longitude: number | null
          pending_balance: number
          points: number
          rating: number | null
          referral_code: string | null
          referred_by: string | null
          total_deliveries: number | null
          updated_at: string
          user_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          accepted_product_types?: string[]
          created_at?: string
          drivers_license_url?: string | null
          earnings_balance?: number
          id?: string
          is_approved?: boolean
          is_available?: boolean
          last_location_update?: string | null
          latitude?: number | null
          license_plate?: string | null
          longitude?: number | null
          pending_balance?: number
          points?: number
          rating?: number | null
          referral_code?: string | null
          referred_by?: string | null
          total_deliveries?: number | null
          updated_at?: string
          user_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          accepted_product_types?: string[]
          created_at?: string
          drivers_license_url?: string | null
          earnings_balance?: number
          id?: string
          is_approved?: boolean
          is_available?: boolean
          last_location_update?: string | null
          latitude?: number | null
          license_plate?: string | null
          longitude?: number | null
          pending_balance?: number
          points?: number
          rating?: number | null
          referral_code?: string | null
          referred_by?: string | null
          total_deliveries?: number | null
          updated_at?: string
          user_id?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      referrals: {
        Row: {
          id: string
          referrer_driver_id: string
          referred_driver_id: string
          referral_code: string
          status: 'pending' | 'validated' | 'rewarded'
          referred_deliveries: number
          created_at: string
          validated_at: string | null
          rewarded_at: string | null
        }
        Insert: {
          id?: string
          referrer_driver_id: string
          referred_driver_id: string
          referral_code: string
          status?: 'pending' | 'validated' | 'rewarded'
          referred_deliveries?: number
          created_at?: string
          validated_at?: string | null
          rewarded_at?: string | null
        }
        Update: {
          id?: string
          referrer_driver_id?: string
          referred_driver_id?: string
          referral_code?: string
          status?: 'pending' | 'validated' | 'rewarded'
          referred_deliveries?: number
          created_at?: string
          validated_at?: string | null
          rewarded_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          delivery_id: string | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fees: {
        Row: {
          amount: number
          created_at: string
          delivery_id: string | null
          id: string
        }
        Insert: {
          amount: number
          created_at?: string
          delivery_id?: string | null
          id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          delivery_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_fees_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      product_type_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          percentage_increase: number
          product_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          percentage_increase?: number
          product_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          percentage_increase?: number
          product_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          delivery_id: string
          id: string
          is_hidden: boolean
          negative_reasons: string[] | null
          rater_role: string | null
          rated_by: string
          rated_user: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          delivery_id: string
          id?: string
          is_hidden?: boolean
          negative_reasons?: string[] | null
          rater_role?: string | null
          rated_by: string
          rated_user: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          delivery_id?: string
          id?: string
          is_hidden?: boolean
          negative_reasons?: string[] | null
          rater_role?: string | null
          rated_by?: string
          rated_user?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string
          blocked_balance: number
          business_name: string
          cnpj: string | null
          created_at: string
          id: string
          is_approved: boolean
          latitude: number
          logo_url: string | null
          longitude: number
          rating: number | null
          total_deliveries: number | null
          updated_at: string
          user_id: string
          wallet_balance: number
        }
        Insert: {
          address: string
          blocked_balance?: number
          business_name: string
          cnpj?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          latitude: number
          logo_url?: string | null
          longitude: number
          rating?: number | null
          total_deliveries?: number | null
          updated_at?: string
          user_id: string
          wallet_balance?: number
        }
        Update: {
          address?: string
          blocked_balance?: number
          business_name?: string
          cnpj?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          latitude?: number
          logo_url?: string | null
          longitude?: number
          rating?: number | null
          total_deliveries?: number | null
          updated_at?: string
          user_id?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      pricing_distance_ranges: {
        Row: {
          id: string
          min_km: number
          max_km: number
          price: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          min_km: number
          max_km: number
          price: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          min_km?: number
          max_km?: number
          price?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_product_addons: {
        Row: {
          id: string
          product_type: string
          addon_type: string
          addon_value: number
          updated_at: string
        }
        Insert: {
          id?: string
          product_type: string
          addon_type?: string
          addon_value?: number
          updated_at?: string
        }
        Update: {
          id?: string
          product_type?: string
          addon_type?: string
          addon_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          id: string
          return_percentage: number
          dynamic_enabled: boolean
          dynamic_multiplier: number
          dynamic_description: string
          platform_commission_percentage: number
          updated_at: string
        }
        Insert: {
          id?: string
          return_percentage?: number
          dynamic_enabled?: boolean
          dynamic_multiplier?: number
          dynamic_description?: string
          platform_commission_percentage?: number
          updated_at?: string
        }
        Update: {
          id?: string
          return_percentage?: number
          dynamic_enabled?: boolean
          dynamic_multiplier?: number
          dynamic_description?: string
          platform_commission_percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      store_items: {
        Row: {
          id: string
          name: string
          description: string
          category: string
          image_url: string | null
          points_cost: number
          stock: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          category: string
          image_url?: string | null
          points_cost: number
          stock?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          category?: string
          image_url?: string | null
          points_cost?: number
          stock?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_redemptions: {
        Row: {
          id: string
          driver_id: string
          item_id: string
          points_used: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          item_id: string
          points_used: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          item_id?: string
          points_used?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_redemptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_redemptions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          delivery_id: string | null
          description: string | null
          driver_earnings: number | null
          driver_id: string | null
          id: string
          platform_fee: number | null
          restaurant_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          delivery_id?: string | null
          description?: string | null
          driver_earnings?: number | null
          driver_id?: string | null
          id?: string
          platform_fee?: number | null
          restaurant_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          delivery_id?: string | null
          description?: string | null
          driver_earnings?: number | null
          driver_id?: string | null
          id?: string
          platform_fee?: number | null
          restaurant_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_delivery_atomic: {
        Args: { p_delivery_id: string; p_driver_id: string }
        Returns: Json
      }
      add_restaurant_funds: {
        Args: { p_amount: number; p_restaurant_id: string }
        Returns: Json
      }
      block_delivery_funds: {
        Args: {
          p_amount: number
          p_delivery_id: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      calculate_additional_delivery_price: {
        Args: {
          p_distance_km: number
          p_vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Returns: number
      }
      calculate_cancellation_penalty: {
        Args: { p_delivery_id: string }
        Returns: Json
      }
      check_driver_available_for_batch: {
        Args: { p_driver_id: string; p_restaurant_id: string }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_delivery_id?: string
          p_message: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      finalize_delivery_transaction: {
        Args: { p_delivery_id: string; p_driver_id: string }
        Returns: Json
      }
      get_next_delivery_sequence: {
        Args: { p_parent_delivery_id: string }
        Returns: number
      }
      get_route_financial_summary: {
        Args: { p_driver_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refund_delivery_funds:
        | { Args: { p_delivery_id: string }; Returns: Json }
        | {
            Args: { p_cancellation_reason?: string; p_delivery_id: string }
            Returns: Json
          }
    }
    Enums: {
      app_role: "admin" | "restaurant" | "driver"
      delivery_status:
        | "scheduled"
        | "pending"
        | "accepted"
        | "picking_up"
        | "picked_up"
        | "delivering"
        | "delivered"
        | "returning"
        | "cancelled"
      financial_status: "blocked" | "refunded" | "transferring" | "paid"
      transaction_type:
        | "delivery_payment"
        | "withdrawal"
        | "platform_fee"
        | "escrow_block"
        | "escrow_release"
        | "escrow_refund"
      vehicle_type:
        | "motorcycle"
        | "bicycle"
        | "car"
        | "van"
        | "truck"
        | "hourly_service"
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
      app_role: ["admin", "restaurant", "driver"],
      delivery_status: [
        "scheduled",
        "pending",
        "accepted",
        "picking_up",
        "picked_up",
        "delivering",
        "delivered",
        "returning",
        "cancelled",
      ],
      financial_status: ["blocked", "refunded", "transferring", "paid"],
      transaction_type: [
        "delivery_payment",
        "withdrawal",
        "platform_fee",
        "escrow_block",
        "escrow_release",
        "escrow_refund",
      ],
      vehicle_type: [
        "motorcycle",
        "bicycle",
        "car",
        "van",
        "truck",
        "hourly_service",
      ],
    },
  },
} as const
