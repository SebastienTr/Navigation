export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          onboarding_completed: boolean
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          onboarding_completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          onboarding_completed?: boolean
          created_at?: string
        }
        Relationships: []
      }
      boats: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string | null
          length_m: number | null
          draft_m: number | null
          air_draft_m: number | null
          engine_type: string | null
          fuel_capacity_hours: number | null
          avg_speed_kn: number | null
          has_ais_tx: boolean
          has_autopilot: boolean
          has_radar: boolean
          has_watermaker: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: string | null
          length_m?: number | null
          draft_m?: number | null
          air_draft_m?: number | null
          engine_type?: string | null
          fuel_capacity_hours?: number | null
          avg_speed_kn?: number | null
          has_ais_tx?: boolean
          has_autopilot?: boolean
          has_radar?: boolean
          has_watermaker?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string | null
          length_m?: number | null
          draft_m?: number | null
          air_draft_m?: number | null
          engine_type?: string | null
          fuel_capacity_hours?: number | null
          avg_speed_kn?: number | null
          has_ais_tx?: boolean
          has_autopilot?: boolean
          has_radar?: boolean
          has_watermaker?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      nav_profiles: {
        Row: {
          id: string
          user_id: string
          boat_id: string | null
          experience: 'Beginner' | 'Intermediate' | 'Experienced' | 'Pro' | null
          crew_mode: 'Solo' | 'Duo' | 'Family' | 'Full crew' | null
          risk_tolerance: 'Cautious' | 'Moderate' | 'Bold' | null
          night_sailing: 'No' | 'Yes' | 'Only if necessary' | null
          max_continuous_hours: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          boat_id?: string | null
          experience?: 'Beginner' | 'Intermediate' | 'Experienced' | 'Pro' | null
          crew_mode?: 'Solo' | 'Duo' | 'Family' | 'Full crew' | null
          risk_tolerance?: 'Cautious' | 'Moderate' | 'Bold' | null
          night_sailing?: 'No' | 'Yes' | 'Only if necessary' | null
          max_continuous_hours?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          boat_id?: string | null
          experience?: 'Beginner' | 'Intermediate' | 'Experienced' | 'Pro' | null
          crew_mode?: 'Solo' | 'Duo' | 'Family' | 'Full crew' | null
          risk_tolerance?: 'Cautious' | 'Moderate' | 'Bold' | null
          night_sailing?: 'No' | 'Yes' | 'Only if necessary' | null
          max_continuous_hours?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nav_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nav_profiles_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          }
        ]
      }
      voyages: {
        Row: {
          id: string
          user_id: string
          boat_id: string
          nav_profile_id: string | null
          name: string
          status: 'planning' | 'active' | 'completed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          boat_id: string
          nav_profile_id?: string | null
          name: string
          status?: 'planning' | 'active' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          boat_id?: string
          nav_profile_id?: string | null
          name?: string
          status?: 'planning' | 'active' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyages_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          }
        ]
      }
      briefings: {
        Row: {
          id: string
          created_at: string
          user_id: string
          voyage_id: string
          date: string
          position: string
          destination: string | null
          verdict: 'GO' | 'STANDBY' | 'NO-GO' | null
          confidence: 'high' | 'medium' | 'low' | null
          wind: string | null
          sea: string | null
          content: string
          weather_data: Json | null
          tide_data: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          voyage_id: string
          date: string
          position: string
          destination?: string | null
          verdict?: 'GO' | 'STANDBY' | 'NO-GO' | null
          confidence?: 'high' | 'medium' | 'low' | null
          wind?: string | null
          sea?: string | null
          content: string
          weather_data?: Json | null
          tide_data?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          voyage_id?: string
          date?: string
          position?: string
          destination?: string | null
          verdict?: 'GO' | 'STANDBY' | 'NO-GO' | null
          confidence?: 'high' | 'medium' | 'low' | null
          wind?: string | null
          sea?: string | null
          content?: string
          weather_data?: Json | null
          tide_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "briefings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefings_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          }
        ]
      }
      logs: {
        Row: {
          id: string
          created_at: string
          user_id: string
          voyage_id: string
          position: string
          latitude: number | null
          longitude: number | null
          entry_type: 'navigation' | 'arrival' | 'departure' | 'maintenance' | 'incident' | null
          fuel_tank: 'full' | '3/4' | 'half' | '1/4' | 'reserve' | 'empty' | null
          jerricans: number
          water: 'full' | '3/4' | 'half' | '1/4' | 'reserve' | 'empty' | null
          problems: string | null
          problem_tags: string[] | null
          notes: string | null
          photo_url: string | null
          photo_urls: string[] | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          voyage_id: string
          position: string
          latitude?: number | null
          longitude?: number | null
          entry_type?: 'navigation' | 'arrival' | 'departure' | 'maintenance' | 'incident' | null
          fuel_tank?: 'full' | '3/4' | 'half' | '1/4' | 'reserve' | 'empty' | null
          jerricans?: number
          water?: 'full' | '3/4' | 'half' | '1/4' | 'reserve' | 'empty' | null
          problems?: string | null
          problem_tags?: string[] | null
          notes?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          voyage_id?: string
          position?: string
          latitude?: number | null
          longitude?: number | null
          entry_type?: 'navigation' | 'arrival' | 'departure' | 'maintenance' | 'incident' | null
          fuel_tank?: 'full' | '3/4' | 'half' | '1/4' | 'reserve' | 'empty' | null
          jerricans?: number
          water?: 'full' | '3/4' | 'half' | '1/4' | 'reserve' | 'empty' | null
          problems?: string | null
          problem_tags?: string[] | null
          notes?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          }
        ]
      }
      route_steps: {
        Row: {
          id: string
          voyage_id: string
          order_num: number
          name: string
          from_port: string
          to_port: string
          distance_nm: number | null
          distance_km: number | null
          phase: string | null
          status: 'done' | 'in_progress' | 'to_do'
          notes: string | null
          from_lat: number | null
          from_lon: number | null
          to_lat: number | null
          to_lon: number | null
        }
        Insert: {
          id?: string
          voyage_id: string
          order_num: number
          name: string
          from_port: string
          to_port: string
          distance_nm?: number | null
          distance_km?: number | null
          phase?: string | null
          status?: 'done' | 'in_progress' | 'to_do'
          notes?: string | null
          from_lat?: number | null
          from_lon?: number | null
          to_lat?: number | null
          to_lon?: number | null
        }
        Update: {
          id?: string
          voyage_id?: string
          order_num?: number
          name?: string
          from_port?: string
          to_port?: string
          distance_nm?: number | null
          distance_km?: number | null
          phase?: string | null
          status?: 'done' | 'in_progress' | 'to_do'
          notes?: string | null
          from_lat?: number | null
          from_lon?: number | null
          to_lat?: number | null
          to_lon?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "route_steps_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          }
        ]
      }
      checklist: {
        Row: {
          id: string
          voyage_id: string
          task: string
          category: 'Safety' | 'Propulsion' | 'Navigation' | 'Rigging' | 'Comfort' | 'Admin' | null
          priority: 'Critical' | 'High' | 'Normal' | 'Low' | null
          status: 'to_do' | 'in_progress' | 'done' | 'na'
          notes: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          voyage_id: string
          task: string
          category?: 'Safety' | 'Propulsion' | 'Navigation' | 'Rigging' | 'Comfort' | 'Admin' | null
          priority?: 'Critical' | 'High' | 'Normal' | 'Low' | null
          status?: 'to_do' | 'in_progress' | 'done' | 'na'
          notes?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          voyage_id?: string
          task?: string
          category?: 'Safety' | 'Propulsion' | 'Navigation' | 'Rigging' | 'Comfort' | 'Admin' | null
          priority?: 'Critical' | 'High' | 'Normal' | 'Low' | null
          status?: 'to_do' | 'in_progress' | 'done' | 'na'
          notes?: string | null
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_history: {
        Row: {
          id: string
          created_at: string
          user_id: string
          voyage_id: string
          role: 'user' | 'assistant'
          content: string
          context_snapshot: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          voyage_id: string
          role: 'user' | 'assistant'
          content: string
          context_snapshot?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          voyage_id?: string
          role?: 'user' | 'assistant'
          content?: string
          context_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_history_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          }
        ]
      }
      boat_status: {
        Row: {
          id: string
          voyage_id: string
          updated_at: string
          current_position: string | null
          current_lat: number | null
          current_lon: number | null
          fuel_tank: string | null
          jerricans: number | null
          water: string | null
          active_problems: string[] | null
          current_phase: string | null
          current_step_id: string | null
          nav_status: 'in_port' | 'sailing' | 'at_anchor' | 'in_canal' | null
        }
        Insert: {
          id?: string
          voyage_id: string
          updated_at?: string
          current_position?: string | null
          current_lat?: number | null
          current_lon?: number | null
          fuel_tank?: string | null
          jerricans?: number | null
          water?: string | null
          active_problems?: string[] | null
          current_phase?: string | null
          current_step_id?: string | null
          nav_status?: 'in_port' | 'sailing' | 'at_anchor' | 'in_canal' | null
        }
        Update: {
          id?: string
          voyage_id?: string
          updated_at?: string
          current_position?: string | null
          current_lat?: number | null
          current_lon?: number | null
          fuel_tank?: string | null
          jerricans?: number | null
          water?: string | null
          active_problems?: string[] | null
          current_phase?: string | null
          current_step_id?: string | null
          nav_status?: 'in_port' | 'sailing' | 'at_anchor' | 'in_canal' | null
        }
        Relationships: [
          {
            foreignKeyName: "boat_status_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: true
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          }
        ]
      }
      reminders: {
        Row: {
          id: string
          created_at: string
          user_id: string
          voyage_id: string
          message: string
          remind_at: string
          category: 'navigation' | 'safety' | 'maintenance' | 'provisions' | 'general'
          priority: 'high' | 'medium' | 'low'
          status: 'pending' | 'fired' | 'dismissed'
          fired_at: string | null
          created_by: 'ai' | 'user'
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          voyage_id: string
          message: string
          remind_at: string
          category?: 'navigation' | 'safety' | 'maintenance' | 'provisions' | 'general'
          priority?: 'high' | 'medium' | 'low'
          status?: 'pending' | 'fired' | 'dismissed'
          fired_at?: string | null
          created_by?: 'ai' | 'user'
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          voyage_id?: string
          message?: string
          remind_at?: string
          category?: 'navigation' | 'safety' | 'maintenance' | 'provisions' | 'general'
          priority?: 'high' | 'medium' | 'low'
          status?: 'pending' | 'fired' | 'dismissed'
          fired_at?: string | null
          created_by?: 'ai' | 'user'
        }
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          }
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          keys: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          keys: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          keys?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
