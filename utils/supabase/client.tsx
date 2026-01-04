/**
 * Client Supabase singleton pour le frontend
 * Utilisé pour Realtime et queries Postgres
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

let supabaseClient: SupabaseClient | null = null;

/**
 * Récupère ou crée l'instance unique du client Supabase
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = `https://${projectId}.supabase.co`;
    
    supabaseClient = createClient(supabaseUrl, publicAnonKey, {
      auth: {
        persistSession: false, // Pas de session auth pour ce cas d'usage
      },
      realtime: {
        params: {
          eventsPerSecond: 10, // Limite pour éviter les surcharges
        },
      },
    });
    
    console.log('✅ Supabase client initialized:', supabaseUrl);
  }
  
  return supabaseClient;
}

// ✅ Export direct pour faciliter l'import
export const supabase = getSupabaseClient();

/**
 * Types TypeScript pour la table scrims
 */
export interface ScrimRow {
  id: string;
  lfs_type: string;
  region: string;
  platform: string;
  rankSR: string;
  time_start: string;
  time_end: string;
  rank?: string;
  availability_day?: string;
  timezone?: string;
  discord_message_url?: string;
  author_discord_id?: string;
  author_discord_username?: string;
  author_discord_display_name?: string;
  timestamp_created?: string;
  channel_name?: string;
  channel_id?: string;
  created_at: string; // Timestamp Postgres
  updated_at: string; // Timestamp Postgres
}

/**
 * Type pour les événements Realtime
 */
export type RealtimeScrimPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: ScrimRow;
  old: ScrimRow | null;
};
