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
    PostgrestVersion: "14.18"
  }
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
      accepted_agreements: {
        Row: {
          accepted_at: string
          agreement_text_sha256: string
          agreement_version_id: number
          evidence: Json
          id: number
          listing_id: number | null
          listing_title: string
          rule_id: number
          rule_snapshot: Json
          user_id: string
        }
        Insert: {
          accepted_at?: string
          agreement_text_sha256: string
          agreement_version_id: number
          evidence?: Json
          id?: never
          listing_id?: number | null
          listing_title: string
          rule_id: number
          rule_snapshot: Json
          user_id: string
        }
        Update: {
          accepted_at?: string
          agreement_text_sha256?: string
          agreement_version_id?: number
          evidence?: Json
          id?: never
          listing_id?: number | null
          listing_title?: string
          rule_id?: number
          rule_snapshot?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accepted_agreements_agreement_version_id_fkey"
            columns: ["agreement_version_id"]
            isOneToOne: false
            referencedRelation: "agreement_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accepted_agreements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accepted_agreements_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accepted_agreements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_versions: {
        Row: {
          body_ar: string
          body_en: string
          created_at: string
          created_by: string | null
          id: number
          is_current: boolean
          is_draft: boolean
          legal_review_note: string | null
          title_ar: string
          title_en: string
          version_label: string
        }
        Insert: {
          body_ar: string
          body_en: string
          created_at?: string
          created_by?: string | null
          id?: never
          is_current?: boolean
          is_draft?: boolean
          legal_review_note?: string | null
          title_ar: string
          title_en: string
          version_label: string
        }
        Update: {
          body_ar?: string
          body_en?: string
          created_at?: string
          created_by?: string | null
          id?: never
          is_current?: boolean
          is_draft?: boolean
          legal_review_note?: string | null
          title_ar?: string
          title_en?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_identifiers: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          kind: string
          reason: string
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: never
          kind: string
          reason: string
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: never
          kind?: string
          reason?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_identifiers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country_code: string
          created_at: string
          id: number
          is_active: boolean
          name_ar: string
          name_en: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          id?: never
          is_active?: boolean
          name_ar: string
          name_en: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: never
          is_active?: boolean
          name_ar?: string
          name_en?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      commission_events: {
        Row: {
          actor_id: string | null
          amount: number | null
          commission_id: number
          created_at: string
          event: string
          from_status: Database["public"]["Enums"]["commission_status"] | null
          id: number
          note: string | null
          to_status: Database["public"]["Enums"]["commission_status"] | null
        }
        Insert: {
          actor_id?: string | null
          amount?: number | null
          commission_id: number
          created_at?: string
          event: string
          from_status?: Database["public"]["Enums"]["commission_status"] | null
          id?: never
          note?: string | null
          to_status?: Database["public"]["Enums"]["commission_status"] | null
        }
        Update: {
          actor_id?: string | null
          amount?: number | null
          commission_id?: number
          created_at?: string
          event?: string
          from_status?: Database["public"]["Enums"]["commission_status"] | null
          id?: never
          note?: string | null
          to_status?: Database["public"]["Enums"]["commission_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_events_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commission_records"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_records: {
        Row: {
          accepted_agreement_id: number
          admin_note: string | null
          amount_due: number
          amount_verified: number
          basis: Database["public"]["Enums"]["commission_basis"]
          calculated_amount: number
          created_at: string
          currency: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          dispute_reason: string | null
          due_date: string
          id: number
          listing_id: number
          percentage: number | null
          reference: string
          rule_id: number
          seller_confirmed_at: string
          seller_id: string
          status: Database["public"]["Enums"]["commission_status"]
          transaction_date: string
          transaction_value: number | null
          updated_at: string
        }
        Insert: {
          accepted_agreement_id: number
          admin_note?: string | null
          amount_due: number
          amount_verified?: number
          basis: Database["public"]["Enums"]["commission_basis"]
          calculated_amount: number
          created_at?: string
          currency?: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          dispute_reason?: string | null
          due_date: string
          id?: never
          listing_id: number
          percentage?: number | null
          reference: string
          rule_id: number
          seller_confirmed_at: string
          seller_id: string
          status?: Database["public"]["Enums"]["commission_status"]
          transaction_date: string
          transaction_value?: number | null
          updated_at?: string
        }
        Update: {
          accepted_agreement_id?: number
          admin_note?: string | null
          amount_due?: number
          amount_verified?: number
          basis?: Database["public"]["Enums"]["commission_basis"]
          calculated_amount?: number
          created_at?: string
          currency?: string
          deal_type?: Database["public"]["Enums"]["deal_type"]
          dispute_reason?: string | null
          due_date?: string
          id?: never
          listing_id?: number
          percentage?: number | null
          reference?: string
          rule_id?: number
          seller_confirmed_at?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["commission_status"]
          transaction_date?: string
          transaction_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_records_accepted_agreement_id_fkey"
            columns: ["accepted_agreement_id"]
            isOneToOne: false
            referencedRelation: "accepted_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          agreement_version_id: number
          basis: Database["public"]["Enums"]["commission_basis"]
          created_at: string
          created_by: string | null
          currency: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          due_days: number
          effective_from: string
          fixed_amount: number | null
          id: number
          is_active: boolean
          max_amount: number | null
          min_amount: number | null
          percentage: number | null
          trigger_event: string
        }
        Insert: {
          agreement_version_id: number
          basis: Database["public"]["Enums"]["commission_basis"]
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          due_days?: number
          effective_from?: string
          fixed_amount?: number | null
          id?: never
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          percentage?: number | null
          trigger_event?: string
        }
        Update: {
          agreement_version_id?: number
          basis?: Database["public"]["Enums"]["commission_basis"]
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_type?: Database["public"]["Enums"]["deal_type"]
          due_days?: number
          effective_from?: string
          fixed_amount?: number | null
          id?: never
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          percentage?: number | null
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_agreement_version_id_fkey"
            columns: ["agreement_version_id"]
            isOneToOne: false
            referencedRelation: "agreement_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string | null
          id: number
          message: string
          name: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          topic: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          message: string
          name?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          topic: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          message?: string
          name?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          topic?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favourites: {
        Row: {
          created_at: string
          listing_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: number
          user_id?: string
        }
        Update: {
          created_at?: string
          listing_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favourites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_contacts: {
        Row: {
          allow_calls: boolean
          allow_whatsapp: boolean
          created_at: string
          listing_id: number
          phone: string
          updated_at: string
        }
        Insert: {
          allow_calls?: boolean
          allow_whatsapp?: boolean
          created_at?: string
          listing_id: number
          phone: string
          updated_at?: string
        }
        Update: {
          allow_calls?: boolean
          allow_whatsapp?: boolean
          created_at?: string
          listing_id?: number
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_contacts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_declarations: {
        Row: {
          created_at: string
          evidence: Json
          id: number
          listing_id: number
          seller_id: string
          version: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          id?: never
          listing_id: number
          seller_id: string
          version: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          id?: never
          listing_id?: number
          seller_id?: string
          version?: string
        }
        Relationships: []
      }
      listing_images: {
        Row: {
          created_at: string
          files_removed_at: string | null
          height: number | null
          id: string
          listing_id: number
          phash: unknown
          position: number
          public_copied_at: string | null
          storage_path: string
          thumb_path: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          files_removed_at?: string | null
          height?: number | null
          id?: string
          listing_id: number
          phash?: unknown
          position?: number
          public_copied_at?: string | null
          storage_path: string
          thumb_path?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          files_removed_at?: string | null
          height?: number | null
          id?: string
          listing_id?: number
          phash?: unknown
          position?: number
          public_copied_at?: string | null
          storage_path?: string
          thumb_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reports: {
        Row: {
          created_at: string
          details: string | null
          id: number
          listing_id: number
          reason: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: never
          listing_id: number
          reason: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: never
          listing_id?: number
          reason?: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "listing_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_risk: {
        Row: {
          checked_at: string
          flags: string[]
          listing_id: number
        }
        Insert: {
          checked_at?: string
          flags?: string[]
          listing_id: number
        }
        Update: {
          checked_at?: string
          flags?: string[]
          listing_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_risk_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["listing_status"] | null
          id: number
          listing_id: number
          reason: string | null
          to_status: Database["public"]["Enums"]["listing_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["listing_status"] | null
          id?: never
          listing_id: number
          reason?: string | null
          to_status: Database["public"]["Enums"]["listing_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["listing_status"] | null
          id?: never
          listing_id?: number
          reason?: string | null
          to_status?: Database["public"]["Enums"]["listing_status"]
        }
        Relationships: [
          {
            foreignKeyName: "listing_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_versions: {
        Row: {
          changed_by: string | null
          created_at: string
          data: Json
          id: number
          kind: string
          listing_id: number
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          data: Json
          id?: never
          kind: string
          listing_id: number
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          data?: Json
          id?: never
          kind?: string
          listing_id?: number
        }
        Relationships: []
      }
      listings: {
        Row: {
          approx_latitude: number | null
          approx_longitude: number | null
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          city_id: number
          created_at: string
          currency: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          description: string
          details: Json
          expires_at: string | null
          floor_level: Database["public"]["Enums"]["floor_level"] | null
          floors_count: number | null
          id: number
          latitude: number | null
          longitude: number | null
          neighborhood_id: number | null
          poster_type: Database["public"]["Enums"]["poster_type"]
          price: number
          property_type_id: number
          published_at: string | null
          rejection_reason: string | null
          seller_id: string
          status: Database["public"]["Enums"]["listing_status"]
          status_changed_at: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approx_latitude?: number | null
          approx_longitude?: number | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city_id: number
          created_at?: string
          currency?: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          description?: string
          details?: Json
          expires_at?: string | null
          floor_level?: Database["public"]["Enums"]["floor_level"] | null
          floors_count?: number | null
          id?: never
          latitude?: number | null
          longitude?: number | null
          neighborhood_id?: number | null
          poster_type?: Database["public"]["Enums"]["poster_type"]
          price: number
          property_type_id: number
          published_at?: string | null
          rejection_reason?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["listing_status"]
          status_changed_at?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approx_latitude?: number | null
          approx_longitude?: number | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city_id?: number
          created_at?: string
          currency?: string
          deal_type?: Database["public"]["Enums"]["deal_type"]
          description?: string
          details?: Json
          expires_at?: string | null
          floor_level?: Database["public"]["Enums"]["floor_level"] | null
          floors_count?: number | null
          id?: never
          latitude?: number | null
          longitude?: number | null
          neighborhood_id?: number | null
          poster_type?: Database["public"]["Enums"]["poster_type"]
          price?: number
          property_type_id?: number
          published_at?: string | null
          rejection_reason?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["listing_status"]
          status_changed_at?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_neighborhood_id_city_id_fkey"
            columns: ["neighborhood_id", "city_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id", "city_id"]
          },
          {
            foreignKeyName: "listings_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          city_id: number
          created_at: string
          id: number
          is_active: boolean
          name_ar: string
          name_en: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          city_id: number
          created_at?: string
          id?: never
          is_active?: boolean
          name_ar: string
          name_en: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          city_id?: number
          created_at?: string
          id?: never
          is_active?: boolean
          name_ar?: string
          name_en?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: number
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: never
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: never
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount_reported: number
          bank_reference: string | null
          commission_id: number
          created_at: string
          id: number
          method: string
          paid_on: string
          payer_reference: string | null
          rejection_reason: string | null
          reported_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          verified_amount: number | null
          verified_at: string | null
          verified_by: string | null
          verified_on: string | null
        }
        Insert: {
          amount_reported: number
          bank_reference?: string | null
          commission_id: number
          created_at?: string
          id?: never
          method: string
          paid_on: string
          payer_reference?: string | null
          rejection_reason?: string | null
          reported_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          verified_amount?: number | null
          verified_at?: string | null
          verified_by?: string | null
          verified_on?: string | null
        }
        Update: {
          amount_reported?: number
          bank_reference?: string | null
          commission_id?: number
          created_at?: string
          id?: never
          method?: string
          paid_on?: string
          payer_reference?: string | null
          rejection_reason?: string | null
          reported_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          verified_amount?: number | null
          verified_at?: string | null
          verified_by?: string | null
          verified_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commission_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deletion_requested_at: string | null
          display_name: string
          id: string
          phone: string | null
          preferred_language: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["account_status"]
          status_changed_at: string | null
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deletion_requested_at?: string | null
          display_name: string
          id: string
          phone?: string | null
          preferred_language?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["account_status"]
          status_changed_at?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string
          id?: string
          phone?: string | null
          preferred_language?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["account_status"]
          status_changed_at?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      property_types: {
        Row: {
          allowed_deals: Database["public"]["Enums"]["deal_type"][]
          created_at: string
          has_bathrooms: boolean
          has_bedrooms: boolean
          has_floor: boolean
          has_floors_count: boolean
          has_furnished: boolean
          id: number
          is_active: boolean
          name_ar: string
          name_en: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          allowed_deals?: Database["public"]["Enums"]["deal_type"][]
          created_at?: string
          has_bathrooms?: boolean
          has_bedrooms?: boolean
          has_floor?: boolean
          has_floors_count?: boolean
          has_furnished?: boolean
          id?: never
          is_active?: boolean
          name_ar: string
          name_en: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allowed_deals?: Database["public"]["Enums"]["deal_type"][]
          created_at?: string
          has_bathrooms?: boolean
          has_bedrooms?: boolean
          has_floor?: boolean
          has_floors_count?: boolean
          has_furnished?: boolean
          id?: never
          is_active?: boolean
          name_ar?: string
          name_en?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          accepted_at: string
          document: string
          id: number
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          document: string
          id?: never
          user_id?: string
          version: string
        }
        Update: {
          accepted_at?: string
          document?: string
          id?: never
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          created_at: string
          details: string | null
          id: number
          reason: string
          reported_user_id: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: never
          reason: string
          reported_user_id: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: never
          reason?: string
          reported_user_id?: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_agreement: {
        Args: { p_evidence?: Json; p_listing_id: number }
        Returns: number
      }
      admin_anonymize_user: {
        Args: { p_reason: string; p_user_id: string }
        Returns: undefined
      }
      admin_commission_action: {
        Args: {
          p_action: string
          p_amount?: number
          p_commission_id: number
          p_note?: string
        }
        Returns: Database["public"]["Enums"]["commission_status"]
      }
      admin_commission_totals: { Args: never; Returns: Json }
      admin_create_commission_rule: {
        Args: {
          p_basis: Database["public"]["Enums"]["commission_basis"]
          p_deal_type: Database["public"]["Enums"]["deal_type"]
          p_due_days: number
          p_fixed_amount: number
          p_max_amount: number
          p_min_amount: number
          p_percentage: number
          p_trigger_event: string
        }
        Returns: number
      }
      admin_overview: { Args: never; Returns: Json }
      admin_publish_agreement: {
        Args: {
          p_body_ar: string
          p_body_en: string
          p_is_draft: boolean
          p_legal_review_note: string
          p_title_ar: string
          p_title_en: string
          p_version_label: string
        }
        Returns: number
      }
      admin_recheck_listing_risk: {
        Args: { p_listing_id: number }
        Returns: string[]
      }
      admin_retire_commission_rule: {
        Args: { p_rule_id: number }
        Returns: undefined
      }
      admin_review_payment: {
        Args: {
          p_bank_reference?: string
          p_decision: string
          p_payment_id: number
          p_reason?: string
          p_verified_amount?: number
          p_verified_on?: string
        }
        Returns: Database["public"]["Enums"]["commission_status"]
      }
      admin_search_users: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_status?: Database["public"]["Enums"]["account_status"]
        }
        Returns: {
          created_at: string
          deletion_requested_at: string
          display_name: string
          email: string
          id: string
          last_sign_in_at: string
          listing_count: number
          phone: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["account_status"]
          status_reason: string
          total_count: number
        }[]
      }
      admin_set_listing_expiry: {
        Args: { p_expires_at: string; p_listing_id: number }
        Returns: Database["public"]["Enums"]["listing_status"]
      }
      admin_set_user_status: {
        Args: {
          p_reason: string
          p_status: Database["public"]["Enums"]["account_status"]
          p_user_id: string
        }
        Returns: undefined
      }
      advance_due_commissions: { Args: never; Returns: number }
      can_upload_listing_photo: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      change_listing_status: {
        Args: {
          p_listing_id: number
          p_new_status: Database["public"]["Enums"]["listing_status"]
          p_reason?: string
        }
        Returns: Database["public"]["Enums"]["listing_status"]
      }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      commission_amount: {
        Args: {
          p_basis: Database["public"]["Enums"]["commission_basis"]
          p_fixed: number
          p_max: number
          p_min: number
          p_percentage: number
          p_value: number
        }
        Returns: number
      }
      commission_due_status: {
        Args: { p_due_date: string }
        Returns: Database["public"]["Enums"]["commission_status"]
      }
      declare_listing: {
        Args: { p_evidence?: Json; p_listing_id: number }
        Returns: number
      }
      expire_listings: { Args: never; Returns: number }
      get_listing_contact: {
        Args: { p_listing_id: number }
        Returns: {
          allow_calls: boolean
          allow_whatsapp: boolean
          phone: string
        }[]
      }
      get_listing_location: {
        Args: { p_listing_id: number }
        Returns: {
          latitude: number
          longitude: number
        }[]
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_blocked: {
        Args: { p_kind: string; p_value: string }
        Returns: boolean
      }
      listing_area_facets: {
        Args: never
        Returns: {
          city_id: number
          deal_type: Database["public"]["Enums"]["deal_type"]
          listings: number
          neighborhood_id: number
          property_type_id: number
        }[]
      }
      listing_is_editable_by_owner: {
        Args: { p_listing_id: number }
        Returns: boolean
      }
      listing_is_public: { Args: { p_listing_id: number }; Returns: boolean }
      listing_risk_flags: { Args: { p_listing_id: number }; Returns: string[] }
      log_commission_event: {
        Args: {
          p_amount: number
          p_commission_id: number
          p_event: string
          p_from: Database["public"]["Enums"]["commission_status"]
          p_note: string
          p_to: Database["public"]["Enums"]["commission_status"]
        }
        Returns: undefined
      }
      notify_admins: {
        Args: { p_data: Json; p_type: string }
        Returns: undefined
      }
      notify_expiring_listings: { Args: never; Returns: number }
      open_commission_dispute: {
        Args: { p_commission_id: number; p_reason: string }
        Returns: undefined
      }
      owns_listing: { Args: { p_listing_id: number }; Returns: boolean }
      photo_cleanup_candidates: {
        Args: { p_limit?: number }
        Returns: {
          bucket: string
          image_id: string
          path: string
          reason: string
        }[]
      }
      public_seller_info: {
        Args: { p_seller_id: string }
        Returns: {
          display_name: string
          member_since: string
        }[]
      }
      record_admin_action: {
        Args: {
          p_action: string
          p_actor: string
          p_details: Json
          p_entity_id: string
          p_entity_type: string
        }
        Returns: undefined
      }
      renew_listing: { Args: { p_listing_id: number }; Returns: string }
      report_payment: {
        Args: {
          p_amount: number
          p_commission_id: number
          p_method: string
          p_paid_on: string
          p_reference: string
        }
        Returns: number
      }
      report_transaction: {
        Args: {
          p_completed_on: string
          p_confirm: boolean
          p_listing_id: number
          p_transaction_value: number
        }
        Returns: number
      }
      request_account_deletion: { Args: never; Returns: undefined }
      setting_bool: {
        Args: { p_default: boolean; p_key: string }
        Returns: boolean
      }
      setting_int: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      text_risk_flags: { Args: { p_text: string }; Returns: string[] }
    }
    Enums: {
      account_status: "active" | "suspended" | "deletion_requested" | "deleted"
      app_role: "user" | "admin"
      commission_basis:
        | "sale_price"
        | "annual_rent"
        | "monthly_rent"
        | "fixed_amount"
      commission_status:
        | "reported"
        | "not_yet_due"
        | "pending"
        | "payment_reported"
        | "payment_verified"
        | "disputed"
        | "waived"
      deal_type: "sale" | "rent"
      floor_level:
        | "basement"
        | "ground"
        | "first"
        | "second"
        | "third"
        | "fourth"
        | "fifth_plus"
        | "last"
        | "last_with_roof"
      listing_status:
        | "draft"
        | "pending_approval"
        | "published"
        | "on_hold"
        | "rejected"
        | "expired"
        | "sold"
        | "rented"
        | "withdrawn"
        | "archived"
      payment_status: "reported" | "verified" | "rejected"
      poster_type: "owner" | "agent"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["active", "suspended", "deletion_requested", "deleted"],
      app_role: ["user", "admin"],
      commission_basis: [
        "sale_price",
        "annual_rent",
        "monthly_rent",
        "fixed_amount",
      ],
      commission_status: [
        "reported",
        "not_yet_due",
        "pending",
        "payment_reported",
        "payment_verified",
        "disputed",
        "waived",
      ],
      deal_type: ["sale", "rent"],
      floor_level: [
        "basement",
        "ground",
        "first",
        "second",
        "third",
        "fourth",
        "fifth_plus",
        "last",
        "last_with_roof",
      ],
      listing_status: [
        "draft",
        "pending_approval",
        "published",
        "on_hold",
        "rejected",
        "expired",
        "sold",
        "rented",
        "withdrawn",
        "archived",
      ],
      payment_status: ["reported", "verified", "rejected"],
      poster_type: ["owner", "agent"],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
    },
  },
} as const
