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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cgu_acceptance: {
        Row: {
          accepted_at: string
          document_type: string
          id: string
          ip_address: unknown
          profile_id: string
          user_agent: string | null
          version: string
        }
        Insert: {
          accepted_at?: string
          document_type: string
          id?: string
          ip_address?: unknown
          profile_id: string
          user_agent?: string | null
          version: string
        }
        Update: {
          accepted_at?: string
          document_type?: string
          id?: string
          ip_address?: unknown
          profile_id?: string
          user_agent?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "cgu_acceptance_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_items: {
        Row: {
          archive: boolean
          archive_at: string | null
          created_at: string
          created_by: string | null
          document_url: string | null
          entity_id: string | null
          entity_type: string
          expires_at: string | null
          id: string
          issued_at: string | null
          kind: string
          label: string | null
          organization_id: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          archive?: boolean
          archive_at?: string | null
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          entity_id?: string | null
          entity_type: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          kind: string
          label?: string | null
          organization_id: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          archive?: boolean
          archive_at?: string | null
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          entity_id?: string | null
          entity_type?: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          kind?: string
          label?: string | null
          organization_id?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cookie_consent_log: {
        Row: {
          choices: Json
          created_at: string
          id: string
          session_token_hash: string
          user_agent_hash: string | null
        }
        Insert: {
          choices: Json
          created_at?: string
          id?: string
          session_token_hash: string
          user_agent_hash?: string | null
        }
        Update: {
          choices?: Json
          created_at?: string
          id?: string
          session_token_hash?: string
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      data_breach_incident: {
        Row: {
          affected_data_categories: string[]
          affected_subjects_count: number | null
          closed_at: string | null
          closed_by: string | null
          cnil_notification_at: string | null
          cnil_notification_reference: string | null
          cnil_notification_required: boolean
          created_at: string
          created_by: string | null
          description: string
          detected_at: string
          id: string
          immediate_measures: string
          nature: string
          organization_id: string
          severity: string
          subjects_notification_required: boolean
          subjects_notified_at: string | null
          updated_at: string
        }
        Insert: {
          affected_data_categories: string[]
          affected_subjects_count?: number | null
          closed_at?: string | null
          closed_by?: string | null
          cnil_notification_at?: string | null
          cnil_notification_reference?: string | null
          cnil_notification_required?: boolean
          created_at?: string
          created_by?: string | null
          description: string
          detected_at: string
          id?: string
          immediate_measures: string
          nature: string
          organization_id: string
          severity: string
          subjects_notification_required?: boolean
          subjects_notified_at?: string | null
          updated_at?: string
        }
        Update: {
          affected_data_categories?: string[]
          affected_subjects_count?: number | null
          closed_at?: string | null
          closed_by?: string | null
          cnil_notification_at?: string | null
          cnil_notification_reference?: string | null
          cnil_notification_required?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          detected_at?: string
          id?: string
          immediate_measures?: string
          nature?: string
          organization_id?: string
          severity?: string
          subjects_notification_required?: boolean
          subjects_notified_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_breach_incident_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_processing_register: {
        Row: {
          created_at: string
          created_by: string | null
          data_categories: string[]
          data_subjects: string[]
          id: string
          international_transfer: boolean
          international_transfer_safeguards: string | null
          legal_basis: string
          organization_id: string
          purpose: string
          recipients: string[]
          retention_period_days: number
          security_measures: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_categories: string[]
          data_subjects: string[]
          id?: string
          international_transfer?: boolean
          international_transfer_safeguards?: string | null
          legal_basis: string
          organization_id: string
          purpose: string
          recipients: string[]
          retention_period_days: number
          security_measures: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_categories?: string[]
          data_subjects?: string[]
          id?: string
          international_transfer?: boolean
          international_transfer_safeguards?: string | null
          legal_basis?: string
          organization_id?: string
          purpose?: string
          recipients?: string[]
          retention_period_days?: number
          security_measures?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_processing_register_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dpa_record: {
        Row: {
          created_at: string
          created_by: string | null
          dpa_document_url: string | null
          dpa_version: string
          expires_at: string | null
          id: string
          notes: string | null
          organization_id: string
          signed_at: string
          subprocessor_name: string
          subprocessor_role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dpa_document_url?: string | null
          dpa_version: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          signed_at: string
          subprocessor_name: string
          subprocessor_role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dpa_document_url?: string | null
          dpa_version?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          signed_at?: string
          subprocessor_name?: string
          subprocessor_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dpa_record_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dpia_record: {
        Row: {
          cnil_consultation_date: string | null
          cnil_consultation_required: boolean
          created_at: string
          created_by: string | null
          data_flow_diagram: string | null
          id: string
          mitigations: Json
          next_review_at: string
          organization_id: string
          residual_risk_level: string | null
          reviewed_at: string
          risks_identified: Json
          scope: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cnil_consultation_date?: string | null
          cnil_consultation_required?: boolean
          created_at?: string
          created_by?: string | null
          data_flow_diagram?: string | null
          id?: string
          mitigations?: Json
          next_review_at: string
          organization_id: string
          residual_risk_level?: string | null
          reviewed_at: string
          risks_identified?: Json
          scope: string
          status: string
          title: string
          updated_at?: string
        }
        Update: {
          cnil_consultation_date?: string | null
          cnil_consultation_required?: boolean
          created_at?: string
          created_by?: string | null
          data_flow_diagram?: string | null
          id?: string
          mitigations?: Json
          next_review_at?: string
          organization_id?: string
          residual_risk_level?: string | null
          reviewed_at?: string
          risks_identified?: Json
          scope?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dpia_record_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_daily_mileage: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          jour: string
          km_end: number | null
          km_start: number | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          jour: string
          km_end?: number | null
          km_start?: number | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          jour?: string
          km_end?: number | null
          km_start?: number | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_daily_mileage_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_daily_mileage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_incidents: {
        Row: {
          created_at: string
          created_by: string
          driver_id: string
          id: string
          lieu: string | null
          nature: string | null
          organization_id: string
          resolved_at: string | null
          started_at: string
          type: Database["public"]["Enums"]["driver_incident_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          driver_id: string
          id?: string
          lieu?: string | null
          nature?: string | null
          organization_id: string
          resolved_at?: string | null
          started_at?: string
          type: Database["public"]["Enums"]["driver_incident_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          driver_id?: string
          id?: string
          lieu?: string | null
          nature?: string | null
          organization_id?: string
          resolved_at?: string | null
          started_at?: string
          type?: Database["public"]["Enums"]["driver_incident_type"]
        }
        Relationships: [
          {
            foreignKeyName: "driver_incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          driver_id: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          driver_id?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          driver_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_invitations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_positions: {
        Row: {
          accuracy: number | null
          captured_at: string
          created_at: string
          driver_id: string
          id: string
          lat: number
          lng: number
          organization_id: string
          ride_id: string | null
          source: string
        }
        Insert: {
          accuracy?: number | null
          captured_at?: string
          created_at?: string
          driver_id: string
          id?: string
          lat: number
          lng: number
          organization_id: string
          ride_id?: string | null
          source: string
        }
        Update: {
          accuracy?: number | null
          captured_at?: string
          created_at?: string
          driver_id?: string
          id?: string
          lat?: number
          lng?: number
          organization_id?: string
          ride_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_positions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_positions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          actif: boolean
          archive: boolean
          archive_at: string | null
          archive_motif: string | null
          competences: string[]
          created_at: string
          created_by: string | null
          id: string
          langues: string[]
          nom_affichage: string
          numero_licence: string | null
          organization_id: string
          profile_id: string | null
          status: Database["public"]["Enums"]["driver_status"]
          telephone: string | null
          type_permis: string[]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          archive?: boolean
          archive_at?: string | null
          archive_motif?: string | null
          competences?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          langues?: string[]
          nom_affichage: string
          numero_licence?: string | null
          organization_id: string
          profile_id?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          telephone?: string | null
          type_permis?: string[]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          archive?: boolean
          archive_at?: string | null
          archive_motif?: string | null
          competences?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          langues?: string[]
          nom_affichage?: string
          numero_licence?: string | null
          organization_id?: string
          profile_id?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          telephone?: string | null
          type_permis?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays_974: {
        Row: {
          date: string
          label: string
        }
        Insert: {
          date: string
          label: string
        }
        Update: {
          date?: string
          label?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          mutation_type: string
          resource_id: string
          response_json: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          mutation_type: string
          resource_id: string
          response_json: Json
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          mutation_type?: string
          resource_id?: string
          response_json?: Json
          user_id?: string
        }
        Relationships: []
      }
      internal_message: {
        Row: {
          body: string
          created_at: string
          id: string
          organization_id: string
          ride_id: string
          sender_profile_id: string
          sender_role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          organization_id: string
          ride_id: string
          sender_profile_id: string
          sender_role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          organization_id?: string
          ride_id?: string
          sender_profile_id?: string
          sender_role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "internal_message_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_message_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_message_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_request_attempts: {
        Row: {
          attempted_at: string
          id: string
          success: boolean
          token_hash: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          success?: boolean
          token_hash: string
        }
        Update: {
          attempted_at?: string
          id?: string
          success?: boolean
          token_hash?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          id: string
          identifier_hash: string
          ip_hash: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: string
          identifier_hash: string
          ip_hash: string
          success?: boolean
        }
        Update: {
          attempted_at?: string
          id?: string
          identifier_hash?: string
          ip_hash?: string
          success?: boolean
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          alert_patient_no_show: boolean
          alert_ride_delayed: boolean
          alert_sms_failed: boolean
          created_at: string
          organization_id: string
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_patient_no_show?: boolean
          alert_ride_delayed?: boolean
          alert_sms_failed?: boolean
          created_at?: string
          organization_id: string
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_patient_no_show?: boolean
          alert_ride_delayed?: boolean
          alert_sms_failed?: boolean
          created_at?: string
          organization_id?: string
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ordering_parties: {
        Row: {
          actif: boolean
          archive: boolean
          archive_at: string | null
          contact_principal_email: string | null
          contact_principal_nom: string | null
          contact_principal_telephone: string | null
          created_at: string
          created_by: string | null
          id: string
          modalite_facturation: Database["public"]["Enums"]["ordering_party_billing_modality"]
          organization_id: string
          raison_sociale: string
          siret: string | null
          tariff_mode: Database["public"]["Enums"]["ordering_party_tariff_mode"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          archive?: boolean
          archive_at?: string | null
          contact_principal_email?: string | null
          contact_principal_nom?: string | null
          contact_principal_telephone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          modalite_facturation?: Database["public"]["Enums"]["ordering_party_billing_modality"]
          organization_id: string
          raison_sociale: string
          siret?: string | null
          tariff_mode?: Database["public"]["Enums"]["ordering_party_tariff_mode"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          archive?: boolean
          archive_at?: string | null
          contact_principal_email?: string | null
          contact_principal_nom?: string | null
          contact_principal_telephone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          modalite_facturation?: Database["public"]["Enums"]["ordering_party_billing_modality"]
          organization_id?: string
          raison_sociale?: string
          siret?: string | null
          tariff_mode?: Database["public"]["Enums"]["ordering_party_tariff_mode"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordering_parties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ordering_party_tariff_grids: {
        Row: {
          arrondi_eur: number
          created_at: string
          created_by: string | null
          date_effet: string
          facteur_correction_routier: number
          forfait_eur: number
          id: string
          km_inclus: number
          majoration_pct: number
          ordering_party_id: string
          organization_id: string
          prix_km_eur: number
          supplement_drom_eur: number
          supplement_tpmr_eur: number
        }
        Insert: {
          arrondi_eur?: number
          created_at?: string
          created_by?: string | null
          date_effet: string
          facteur_correction_routier: number
          forfait_eur: number
          id?: string
          km_inclus: number
          majoration_pct: number
          ordering_party_id: string
          organization_id: string
          prix_km_eur: number
          supplement_drom_eur: number
          supplement_tpmr_eur: number
        }
        Update: {
          arrondi_eur?: number
          created_at?: string
          created_by?: string | null
          date_effet?: string
          facteur_correction_routier?: number
          forfait_eur?: number
          id?: string
          km_inclus?: number
          majoration_pct?: number
          ordering_party_id?: string
          organization_id?: string
          prix_km_eur?: number
          supplement_drom_eur?: number
          supplement_tpmr_eur?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordering_party_tariff_grids_ordering_party_id_fkey"
            columns: ["ordering_party_id"]
            isOneToOne: false
            referencedRelation: "ordering_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordering_party_tariff_grids_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          adresse: string | null
          code_postal: string | null
          compliance_blocking_mode: string
          created_at: string
          date_archivage: string | null
          date_creation: string
          dpo_contact_address: string | null
          dpo_contact_email: string | null
          dpo_contact_phone: string | null
          dpo_external: boolean
          dpo_updated_at: string | null
          email: string | null
          id: string
          nom: string
          numero_agrement_cgss: string | null
          siret: string | null
          telephone: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          compliance_blocking_mode?: string
          created_at?: string
          date_archivage?: string | null
          date_creation?: string
          dpo_contact_address?: string | null
          dpo_contact_email?: string | null
          dpo_contact_phone?: string | null
          dpo_external?: boolean
          dpo_updated_at?: string | null
          email?: string | null
          id?: string
          nom: string
          numero_agrement_cgss?: string | null
          siret?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          compliance_blocking_mode?: string
          created_at?: string
          date_archivage?: string | null
          date_creation?: string
          dpo_contact_address?: string | null
          dpo_contact_email?: string | null
          dpo_contact_phone?: string | null
          dpo_external?: boolean
          dpo_updated_at?: string | null
          email?: string | null
          id?: string
          nom?: string
          numero_agrement_cgss?: string | null
          siret?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      patient_constraint: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string | null
          organization_id: string
          patient_id: string
          type: Database["public"]["Enums"]["patient_constraint_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          organization_id: string
          patient_id: string
          type: Database["public"]["Enums"]["patient_constraint_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          organization_id?: string
          patient_id?: string
          type?: Database["public"]["Enums"]["patient_constraint_type"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_constraint_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_constraint_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_constraint_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_data_request: {
        Row: {
          created_at: string
          deadline_at: string
          id: string
          organization_id: string
          patient_id: string | null
          request_token: string
          request_token_expires_at: string
          request_type: string
          requested_at: string
          requester_email: string | null
          requester_proof_of_identity_url: string | null
          response: string | null
          response_at: string | null
          response_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline_at: string
          id?: string
          organization_id: string
          patient_id?: string | null
          request_token: string
          request_token_expires_at: string
          request_type: string
          requested_at?: string
          requester_email?: string | null
          requester_proof_of_identity_url?: string | null
          response?: string | null
          response_at?: string | null
          response_by?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline_at?: string
          id?: string
          organization_id?: string
          patient_id?: string | null
          request_token?: string
          request_token_expires_at?: string
          request_type?: string
          requested_at?: string
          requester_email?: string | null
          requester_proof_of_identity_url?: string | null
          response?: string | null
          response_at?: string | null
          response_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_data_request_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_data_request_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_data_request_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_driver_preference: {
        Row: {
          created_at: string
          created_by: string
          driver_id: string
          id: string
          kind: Database["public"]["Enums"]["patient_driver_preference_kind"]
          organization_id: string
          origin: Database["public"]["Enums"]["driver_preference_origin"]
          patient_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          driver_id: string
          id?: string
          kind: Database["public"]["Enums"]["patient_driver_preference_kind"]
          organization_id: string
          origin?: Database["public"]["Enums"]["driver_preference_origin"]
          patient_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          driver_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["patient_driver_preference_kind"]
          organization_id?: string
          origin?: Database["public"]["Enums"]["driver_preference_origin"]
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_driver_preference_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_driver_preference_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_driver_preference_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_driver_preference_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_incidents: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string | null
          occurred_at: string
          organization_id: string
          patient_id: string
          ride_id: string | null
          type: Database["public"]["Enums"]["patient_incident_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          occurred_at?: string
          organization_id: string
          patient_id: string
          ride_id?: string | null
          type: Database["public"]["Enums"]["patient_incident_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          occurred_at?: string
          organization_id?: string
          patient_id?: string
          ride_id?: string | null
          type?: Database["public"]["Enums"]["patient_incident_type"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_incidents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_incidents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_incidents_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_operational_note: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          organization_id: string
          patient_id: string
          replaced_by_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          organization_id: string
          patient_id: string
          replaced_by_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          patient_id?: string
          replaced_by_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_operational_note_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_operational_note_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_operational_note_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_operational_note_replaced_by_id_fkey"
            columns: ["replaced_by_id"]
            isOneToOne: false
            referencedRelation: "patient_operational_note"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          adresse_ligne1: string | null
          adresse_ligne2: string | null
          archive: boolean
          archive_at: string | null
          archive_reason: string | null
          canal_contact_prefere: Database["public"]["Enums"]["canal_contact_prefere"]
          code_postal: string | null
          consentement_sms: boolean
          consentement_sms_at: string | null
          contact_urgence_nom: string | null
          contact_urgence_telephone: string | null
          created_at: string
          created_by: string | null
          date_naissance: string | null
          genre: string | null
          id: string
          nir_encrypted: string | null
          nir_last4: string | null
          nir_search_hash: string | null
          nom: string | null
          organization_id: string
          prenom: string | null
          referent_document_url: string | null
          referent_lien: string | null
          referent_nom: string | null
          referent_telephone: string | null
          referent_type: string | null
          search_text: string | null
          telephone: string | null
          telephone_normalized: string | null
          updated_at: string
          updated_by: string | null
          ville: string | null
        }
        Insert: {
          adresse_ligne1?: string | null
          adresse_ligne2?: string | null
          archive?: boolean
          archive_at?: string | null
          archive_reason?: string | null
          canal_contact_prefere?: Database["public"]["Enums"]["canal_contact_prefere"]
          code_postal?: string | null
          consentement_sms?: boolean
          consentement_sms_at?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string
          created_by?: string | null
          date_naissance?: string | null
          genre?: string | null
          id?: string
          nir_encrypted?: string | null
          nir_last4?: string | null
          nir_search_hash?: string | null
          nom?: string | null
          organization_id: string
          prenom?: string | null
          referent_document_url?: string | null
          referent_lien?: string | null
          referent_nom?: string | null
          referent_telephone?: string | null
          referent_type?: string | null
          search_text?: string | null
          telephone?: string | null
          telephone_normalized?: string | null
          updated_at?: string
          updated_by?: string | null
          ville?: string | null
        }
        Update: {
          adresse_ligne1?: string | null
          adresse_ligne2?: string | null
          archive?: boolean
          archive_at?: string | null
          archive_reason?: string | null
          canal_contact_prefere?: Database["public"]["Enums"]["canal_contact_prefere"]
          code_postal?: string | null
          consentement_sms?: boolean
          consentement_sms_at?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string
          created_by?: string | null
          date_naissance?: string | null
          genre?: string | null
          id?: string
          nir_encrypted?: string | null
          nir_last4?: string | null
          nir_search_hash?: string | null
          nom?: string | null
          organization_id?: string
          prenom?: string | null
          referent_document_url?: string | null
          referent_lien?: string | null
          referent_nom?: string | null
          referent_telephone?: string | null
          referent_type?: string | null
          search_text?: string | null
          telephone?: string | null
          telephone_normalized?: string | null
          updated_at?: string
          updated_by?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pois_metier: {
        Row: {
          actif: boolean
          adresse: string
          code_postal: string
          created_at: string
          created_by: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nom_court: string
          nom_long: string | null
          notes_acces: string | null
          organization_id: string
          telephone: string | null
          type_poi: string
          updated_at: string
          ville: string
        }
        Insert: {
          actif?: boolean
          adresse: string
          code_postal: string
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom_court: string
          nom_long?: string | null
          notes_acces?: string | null
          organization_id: string
          telephone?: string | null
          type_poi: string
          updated_at?: string
          ville: string
        }
        Update: {
          actif?: boolean
          adresse?: string
          code_postal?: string
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom_court?: string
          nom_long?: string | null
          notes_acces?: string | null
          organization_id?: string
          telephone?: string | null
          type_poi?: string
          updated_at?: string
          ville?: string
        }
        Relationships: [
          {
            foreignKeyName: "pois_metier_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prescribers: {
        Row: {
          actif: boolean
          adeli: string | null
          adresse: string | null
          archive: boolean
          archive_at: string | null
          contact_email: string | null
          contact_telephone: string | null
          created_at: string
          created_by: string | null
          finess: string | null
          id: string
          nom: string
          organization_id: string
          prenom: string | null
          rpps: string | null
          specialite: string | null
          type: Database["public"]["Enums"]["prescriber_type"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          adeli?: string | null
          adresse?: string | null
          archive?: boolean
          archive_at?: string | null
          contact_email?: string | null
          contact_telephone?: string | null
          created_at?: string
          created_by?: string | null
          finess?: string | null
          id?: string
          nom: string
          organization_id: string
          prenom?: string | null
          rpps?: string | null
          specialite?: string | null
          type?: Database["public"]["Enums"]["prescriber_type"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          adeli?: string | null
          adresse?: string | null
          archive?: boolean
          archive_at?: string | null
          contact_email?: string | null
          contact_telephone?: string | null
          created_at?: string
          created_by?: string | null
          finess?: string | null
          id?: string
          nom?: string
          organization_id?: string
          prenom?: string | null
          rpps?: string | null
          specialite?: string | null
          type?: Database["public"]["Enums"]["prescriber_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescribers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          created_by: string | null
          date_expiration: string | null
          date_prescription: string
          document_url: string | null
          finess: string | null
          id: string
          motif: string | null
          numero: string
          organization_id: string
          patient_id: string
          prescriber_id: string | null
          statut: Database["public"]["Enums"]["prescription_status"]
          trajets_autorises: number
          trajets_consommes: number
          type_transport: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_expiration?: string | null
          date_prescription: string
          document_url?: string | null
          finess?: string | null
          id?: string
          motif?: string | null
          numero: string
          organization_id: string
          patient_id: string
          prescriber_id?: string | null
          statut?: Database["public"]["Enums"]["prescription_status"]
          trajets_autorises: number
          trajets_consommes?: number
          type_transport?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_expiration?: string | null
          date_prescription?: string
          document_url?: string | null
          finess?: string | null
          id?: string
          motif?: string | null
          numero?: string
          organization_id?: string
          patient_id?: string
          prescriber_id?: string | null
          statut?: Database["public"]["Enums"]["prescription_status"]
          trajets_autorises?: number
          trajets_consommes?: number
          type_transport?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_prescriber_id_fkey"
            columns: ["prescriber_id"]
            isOneToOne: false
            referencedRelation: "prescribers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          actif: boolean
          cgu_accepted_at: string | null
          cgu_version_accepted: string | null
          created_at: string
          date_archivage: string | null
          email: string
          id: string
          nom: string
          organization_id: string
          prenom: string
          role: Database["public"]["Enums"]["user_role"]
          telephone: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          cgu_accepted_at?: string | null
          cgu_version_accepted?: string | null
          created_at?: string
          date_archivage?: string | null
          email: string
          id: string
          nom: string
          organization_id: string
          prenom: string
          role: Database["public"]["Enums"]["user_role"]
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          cgu_accepted_at?: string | null
          cgu_version_accepted?: string | null
          created_at?: string
          date_archivage?: string | null
          email?: string
          id?: string
          nom?: string
          organization_id?: string
          prenom?: string
          role?: Database["public"]["Enums"]["user_role"]
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          organization_id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          organization_id: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          organization_id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_cgss_invoice_events: {
        Row: {
          complementaire_en_attente: boolean
          created_at: string
          created_by: string | null
          event_date: string
          event_type: string
          id: string
          motif: string | null
          motif_famille: string | null
          organization_id: string
          ride_id: string
        }
        Insert: {
          complementaire_en_attente?: boolean
          created_at?: string
          created_by?: string | null
          event_date: string
          event_type: string
          id?: string
          motif?: string | null
          motif_famille?: string | null
          organization_id: string
          ride_id: string
        }
        Update: {
          complementaire_en_attente?: boolean
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_type?: string
          id?: string
          motif?: string | null
          motif_famille?: string | null
          organization_id?: string
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_cgss_invoice_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_cgss_invoice_events_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_draft: {
        Row: {
          author_id: string
          created_at: string
          id: string
          organization_id: string
          patient_id: string | null
          payload: Json
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          organization_id: string
          patient_id?: string | null
          payload: Json
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          patient_id?: string | null
          payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_draft_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_draft_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_draft_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          organization_id: string
          payload: Json | null
          ride_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          organization_id: string
          payload?: Json | null
          ride_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json | null
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_events_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          motif_refus: string | null
          ordering_party_id: string
          organization_id: string
          status: Database["public"]["Enums"]["ride_group_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          motif_refus?: string | null
          ordering_party_id: string
          organization_id: string
          status?: Database["public"]["Enums"]["ride_group_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          motif_refus?: string | null
          ordering_party_id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["ride_group_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_groups_ordering_party_id_fkey"
            columns: ["ordering_party_id"]
            isOneToOne: false
            referencedRelation: "ordering_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_recurrence_exceptions: {
        Row: {
          created_at: string
          created_by: string
          excluded_date: string
          id: string
          reason: string | null
          replaced_by_ride_id: string | null
          ride_recurrence_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          excluded_date: string
          id?: string
          reason?: string | null
          replaced_by_ride_id?: string | null
          ride_recurrence_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          excluded_date?: string
          id?: string
          reason?: string | null
          replaced_by_ride_id?: string | null
          ride_recurrence_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_recurrence_exceptions_replaced_by_ride_id_fkey"
            columns: ["replaced_by_ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_recurrence_exceptions_ride_recurrence_id_fkey"
            columns: ["ride_recurrence_id"]
            isOneToOne: false
            referencedRelation: "ride_recurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_recurrences: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          dropoff_address: string
          dropoff_citycode: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          end_date: string | null
          id: string
          organization_id: string
          patient_id: string
          pickup_address: string
          pickup_citycode: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          prescription_id: string | null
          rrule_str: string
          start_date: string
          transport_mode: string
          urgency: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          dropoff_address: string
          dropoff_citycode?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          end_date?: string | null
          id?: string
          organization_id: string
          patient_id: string
          pickup_address: string
          pickup_citycode?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          prescription_id?: string | null
          rrule_str: string
          start_date: string
          transport_mode: string
          urgency?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          dropoff_address?: string
          dropoff_citycode?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          end_date?: string | null
          id?: string
          organization_id?: string
          patient_id?: string
          pickup_address?: string
          pickup_citycode?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          prescription_id?: string | null
          rrule_str?: string
          start_date?: string
          transport_mode?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_recurrences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_recurrences_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_recurrences_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_recurrences_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          accompagnant: boolean
          accompagnant_identite: string | null
          accompagnant_payant: boolean
          archive: boolean
          cancel_motif: string | null
          cgss_invoice_status: string | null
          created_at: string
          created_by: string
          driver_id: string | null
          dropoff_address: string
          dropoff_city: string | null
          dropoff_citycode: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_postal_code: string | null
          ended_at: string | null
          exoneration_motif: string | null
          id: string
          no_show_at: string | null
          no_show_motif: string | null
          notes_regulateur: string | null
          ordering_party_id: string | null
          organization_id: string
          original_ride_id: string | null
          patient_id: string
          payment_method: string | null
          payment_received_at: string | null
          payment_reminded_at: string | null
          payment_status: string
          pickup_address: string
          pickup_city: string | null
          pickup_citycode: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_postal_code: string | null
          prescription_id: string | null
          prise_en_charge_taux: number | null
          ride_group_id: string | null
          ride_recurrence_id: string | null
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          tarif_amount_eur: number | null
          tarif_source: string | null
          transport_mode: Database["public"]["Enums"]["ride_transport_mode"]
          transport_partage_refuse: boolean
          updated_at: string
          updated_by: string
          urgency: Database["public"]["Enums"]["ride_urgency"]
          vehicle_id: string | null
        }
        Insert: {
          accompagnant?: boolean
          accompagnant_identite?: string | null
          accompagnant_payant?: boolean
          archive?: boolean
          cancel_motif?: string | null
          cgss_invoice_status?: string | null
          created_at?: string
          created_by: string
          driver_id?: string | null
          dropoff_address: string
          dropoff_city?: string | null
          dropoff_citycode?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_postal_code?: string | null
          ended_at?: string | null
          exoneration_motif?: string | null
          id?: string
          no_show_at?: string | null
          no_show_motif?: string | null
          notes_regulateur?: string | null
          ordering_party_id?: string | null
          organization_id: string
          original_ride_id?: string | null
          patient_id: string
          payment_method?: string | null
          payment_received_at?: string | null
          payment_reminded_at?: string | null
          payment_status?: string
          pickup_address: string
          pickup_city?: string | null
          pickup_citycode?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_postal_code?: string | null
          prescription_id?: string | null
          prise_en_charge_taux?: number | null
          ride_group_id?: string | null
          ride_recurrence_id?: string | null
          scheduled_at: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          tarif_amount_eur?: number | null
          tarif_source?: string | null
          transport_mode?: Database["public"]["Enums"]["ride_transport_mode"]
          transport_partage_refuse?: boolean
          updated_at?: string
          updated_by: string
          urgency?: Database["public"]["Enums"]["ride_urgency"]
          vehicle_id?: string | null
        }
        Update: {
          accompagnant?: boolean
          accompagnant_identite?: string | null
          accompagnant_payant?: boolean
          archive?: boolean
          cancel_motif?: string | null
          cgss_invoice_status?: string | null
          created_at?: string
          created_by?: string
          driver_id?: string | null
          dropoff_address?: string
          dropoff_city?: string | null
          dropoff_citycode?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_postal_code?: string | null
          ended_at?: string | null
          exoneration_motif?: string | null
          id?: string
          no_show_at?: string | null
          no_show_motif?: string | null
          notes_regulateur?: string | null
          ordering_party_id?: string | null
          organization_id?: string
          original_ride_id?: string | null
          patient_id?: string
          payment_method?: string | null
          payment_received_at?: string | null
          payment_reminded_at?: string | null
          payment_status?: string
          pickup_address?: string
          pickup_city?: string | null
          pickup_citycode?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_postal_code?: string | null
          prescription_id?: string | null
          prise_en_charge_taux?: number | null
          ride_group_id?: string | null
          ride_recurrence_id?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          tarif_amount_eur?: number | null
          tarif_source?: string | null
          transport_mode?: Database["public"]["Enums"]["ride_transport_mode"]
          transport_partage_refuse?: boolean
          updated_at?: string
          updated_by?: string
          urgency?: Database["public"]["Enums"]["ride_urgency"]
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_ordering_party_id_fkey"
            columns: ["ordering_party_id"]
            isOneToOne: false
            referencedRelation: "ordering_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_original_ride_id_fkey"
            columns: ["original_ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_ride_group_id_fkey"
            columns: ["ride_group_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_ride_recurrence_id_fkey"
            columns: ["ride_recurrence_id"]
            isOneToOne: false
            referencedRelation: "ride_recurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          body_rendered: string
          created_at: string
          delivered_at: string | null
          delivery_error: string | null
          delivery_status: string
          id: string
          organization_id: string
          patient_id: string | null
          ride_id: string | null
          sent_at: string | null
          template_key: string
          to_phone: string
          twilio_message_sid: string | null
        }
        Insert: {
          body_rendered: string
          created_at?: string
          delivered_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          id?: string
          organization_id: string
          patient_id?: string | null
          ride_id?: string | null
          sent_at?: string | null
          template_key: string
          to_phone: string
          twilio_message_sid?: string | null
        }
        Update: {
          body_rendered?: string
          created_at?: string
          delivered_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          id?: string
          organization_id?: string
          patient_id?: string | null
          ride_id?: string | null
          sent_at?: string | null
          template_key?: string
          to_phone?: string
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          body: string
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tariff_grids: {
        Row: {
          arrondi_eur: number
          created_at: string
          created_by: string | null
          date_effet: string
          facteur_correction_routier: number
          forfait_eur: number
          id: string
          km_inclus: number
          majoration_pct: number
          organization_id: string
          prix_km_eur: number
          supplement_accompagnant_eur: number
          supplement_drom_eur: number
          supplement_tpmr_eur: number
        }
        Insert: {
          arrondi_eur?: number
          created_at?: string
          created_by?: string | null
          date_effet: string
          facteur_correction_routier: number
          forfait_eur: number
          id?: string
          km_inclus: number
          majoration_pct: number
          organization_id: string
          prix_km_eur: number
          supplement_accompagnant_eur?: number
          supplement_drom_eur: number
          supplement_tpmr_eur: number
        }
        Update: {
          arrondi_eur?: number
          created_at?: string
          created_by?: string | null
          date_effet?: string
          facteur_correction_routier?: number
          forfait_eur?: number
          id?: string
          km_inclus?: number
          majoration_pct?: number
          organization_id?: string
          prix_km_eur?: number
          supplement_accompagnant_eur?: number
          supplement_drom_eur?: number
          supplement_tpmr_eur?: number
        }
        Relationships: [
          {
            foreignKeyName: "tariff_grids_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          actif: boolean
          archive: boolean
          archive_at: string | null
          capacite_charge_kg: number | null
          created_at: string
          created_by: string | null
          equipement_autre: string | null
          equipement_brancard: boolean
          equipement_oxygene: boolean
          id: string
          immatriculation: string
          marque: string | null
          modele: string | null
          organization_id: string
          places_assises: number | null
          places_tpmr: number | null
          type: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          archive?: boolean
          archive_at?: string | null
          capacite_charge_kg?: number | null
          created_at?: string
          created_by?: string | null
          equipement_autre?: string | null
          equipement_brancard?: boolean
          equipement_oxygene?: boolean
          id?: string
          immatriculation: string
          marque?: string | null
          modele?: string | null
          organization_id: string
          places_assises?: number | null
          places_tpmr?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          archive?: boolean
          archive_at?: string | null
          capacite_charge_kg?: number | null
          created_at?: string
          created_by?: string | null
          equipement_autre?: string | null
          equipement_brancard?: boolean
          equipement_oxygene?: boolean
          id?: string
          immatriculation?: string
          marque?: string | null
          modele?: string | null
          organization_id?: string
          places_assises?: number | null
          places_tpmr?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_alerts: {
        Row: {
          activated_at: string
          activated_by: string | null
          active: boolean
          created_at: string
          deactivated_at: string | null
          id: string
          motif: string
          organization_id: string
          zone: string | null
        }
        Insert: {
          activated_at?: string
          activated_by?: string | null
          active?: boolean
          created_at?: string
          deactivated_at?: string | null
          id?: string
          motif: string
          organization_id: string
          zone?: string | null
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          active?: boolean
          created_at?: string
          deactivated_at?: string | null
          id?: string
          motif?: string
          organization_id?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      patients_safe: {
        Row: {
          adresse_ligne1: string | null
          adresse_ligne2: string | null
          archive: boolean | null
          archive_at: string | null
          archive_reason: string | null
          canal_contact_prefere:
            | Database["public"]["Enums"]["canal_contact_prefere"]
            | null
          code_postal: string | null
          consentement_sms: boolean | null
          consentement_sms_at: string | null
          contact_urgence_nom: string | null
          contact_urgence_telephone: string | null
          created_at: string | null
          created_by: string | null
          date_naissance: string | null
          genre: string | null
          has_nir: boolean | null
          id: string | null
          nir_last4: string | null
          nom: string | null
          organization_id: string | null
          prenom: string | null
          search_text: string | null
          telephone: string | null
          telephone_normalized: string | null
          updated_at: string | null
          updated_by: string | null
          ville: string | null
        }
        Insert: {
          adresse_ligne1?: string | null
          adresse_ligne2?: string | null
          archive?: boolean | null
          archive_at?: string | null
          archive_reason?: string | null
          canal_contact_prefere?:
            | Database["public"]["Enums"]["canal_contact_prefere"]
            | null
          code_postal?: string | null
          consentement_sms?: boolean | null
          consentement_sms_at?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string | null
          created_by?: string | null
          date_naissance?: string | null
          genre?: string | null
          has_nir?: never
          id?: string | null
          nir_last4?: string | null
          nom?: string | null
          organization_id?: string | null
          prenom?: string | null
          search_text?: string | null
          telephone?: string | null
          telephone_normalized?: string | null
          updated_at?: string | null
          updated_by?: string | null
          ville?: string | null
        }
        Update: {
          adresse_ligne1?: string | null
          adresse_ligne2?: string | null
          archive?: boolean | null
          archive_at?: string | null
          archive_reason?: string | null
          canal_contact_prefere?:
            | Database["public"]["Enums"]["canal_contact_prefere"]
            | null
          code_postal?: string | null
          consentement_sms?: boolean | null
          consentement_sms_at?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string | null
          created_by?: string | null
          date_naissance?: string | null
          genre?: string | null
          has_nir?: never
          id?: string | null
          nir_last4?: string | null
          nom?: string | null
          organization_id?: string | null
          prenom?: string | null
          search_text?: string | null
          telephone?: string | null
          telephone_normalized?: string | null
          updated_at?: string | null
          updated_by?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_breach_deadlines: { Args: never; Returns: undefined }
      current_organization_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: { required_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      nir_match_patient_for_legal_request: {
        Args: {
          p_date_naissance: string
          p_nir_search_hash: string
          p_nom: string
          p_request_id: string
        }
        Returns: string
      }
      purge_driver_positions: { Args: never; Returns: undefined }
      purge_internal_messages: { Args: never; Returns: undefined }
      purge_legal_request_attempts: { Args: never; Returns: undefined }
      purge_login_attempts: { Args: never; Returns: undefined }
      recompute_prescription_status: {
        Args: { p_id: string }
        Returns: undefined
      }
      rgpd_anonymize_patient: {
        Args: { p_patient_id: string; p_request_id: string; p_salt: string }
        Returns: undefined
      }
      search_patients: {
        Args: { q: string }
        Returns: {
          adresse_ligne1: string | null
          adresse_ligne2: string | null
          archive: boolean | null
          archive_at: string | null
          archive_reason: string | null
          canal_contact_prefere:
            | Database["public"]["Enums"]["canal_contact_prefere"]
            | null
          code_postal: string | null
          consentement_sms: boolean | null
          consentement_sms_at: string | null
          contact_urgence_nom: string | null
          contact_urgence_telephone: string | null
          created_at: string | null
          created_by: string | null
          date_naissance: string | null
          genre: string | null
          has_nir: boolean | null
          id: string | null
          nir_last4: string | null
          nom: string | null
          organization_id: string | null
          prenom: string | null
          search_text: string | null
          telephone: string | null
          telephone_normalized: string | null
          updated_at: string | null
          updated_by: string | null
          ville: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "patients_safe"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      unaccent_immutable: { Args: { input: string }; Returns: string }
    }
    Enums: {
      canal_contact_prefere: "sms" | "appel" | "aucun"
      driver_incident_type: "panne_vehicule" | "indisponible"
      driver_preference_origin: "patient" | "chauffeur"
      driver_status: "actif" | "conge" | "suspendu" | "archive"
      ordering_party_billing_modality:
        | "a_la_course"
        | "hebdomadaire"
        | "mensuelle"
      ordering_party_tariff_mode: "cgss_standard" | "grille_propre"
      patient_constraint_type:
        | "medical_oxygene"
        | "medical_fauteuil"
        | "medical_brancard"
        | "vehicule_tpmr"
        | "horaire_matin"
        | "horaire_apres_midi"
        | "accompagnement_obligatoire"
        | "autre"
      patient_driver_preference_kind: "prefere" | "evite"
      patient_incident_type:
        | "retard"
        | "refus_paiement"
        | "conflit_chauffeur"
        | "plainte"
        | "autre"
      prescriber_type: "medecin" | "etablissement"
      prescription_status: "active" | "epuisee" | "expiree"
      ride_group_status: "en_attente" | "acceptee" | "refusee" | "annulee"
      ride_status:
        | "brouillon"
        | "validee"
        | "assignee"
        | "en_cours"
        | "terminee"
        | "annulee_regulateur"
        | "annulee_patient"
        | "annulee_chauffeur"
        | "annulee_meteo"
        | "arrive_sur_place"
        | "patient_a_bord"
      ride_transport_mode: "taxi_conventionne" | "tpmr" | "vsl" | "ambulance"
      ride_urgency: "programmee" | "urgente" | "immediate"
      user_role: "dirigeant" | "regulateur" | "chauffeur"
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
      canal_contact_prefere: ["sms", "appel", "aucun"],
      driver_incident_type: ["panne_vehicule", "indisponible"],
      driver_preference_origin: ["patient", "chauffeur"],
      driver_status: ["actif", "conge", "suspendu", "archive"],
      ordering_party_billing_modality: [
        "a_la_course",
        "hebdomadaire",
        "mensuelle",
      ],
      ordering_party_tariff_mode: ["cgss_standard", "grille_propre"],
      patient_constraint_type: [
        "medical_oxygene",
        "medical_fauteuil",
        "medical_brancard",
        "vehicule_tpmr",
        "horaire_matin",
        "horaire_apres_midi",
        "accompagnement_obligatoire",
        "autre",
      ],
      patient_driver_preference_kind: ["prefere", "evite"],
      patient_incident_type: [
        "retard",
        "refus_paiement",
        "conflit_chauffeur",
        "plainte",
        "autre",
      ],
      prescriber_type: ["medecin", "etablissement"],
      prescription_status: ["active", "epuisee", "expiree"],
      ride_group_status: ["en_attente", "acceptee", "refusee", "annulee"],
      ride_status: [
        "brouillon",
        "validee",
        "assignee",
        "en_cours",
        "terminee",
        "annulee_regulateur",
        "annulee_patient",
        "annulee_chauffeur",
        "annulee_meteo",
        "arrive_sur_place",
        "patient_a_bord",
      ],
      ride_transport_mode: ["taxi_conventionne", "tpmr", "vsl", "ambulance"],
      ride_urgency: ["programmee", "urgente", "immediate"],
      user_role: ["dirigeant", "regulateur", "chauffeur"],
    },
  },
} as const
