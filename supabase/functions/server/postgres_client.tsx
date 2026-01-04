/**
 * Helper Postgres pour le backend Supabase
 * Gère les opérations sur la table scrims avec fallback KV
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import type { ParsedScrim } from './discord_parser.tsx';

/**
 * Interface pour le scrim stocké en Postgres (format attendu par index.tsx)
 */
export interface PostgresScrim {
  discord_message_id: string;
  author_discord_id: string;
  author_username?: string;
  author_avatar_url?: string;
  lfs_type: string;
  region: string;
  platform: string;
  rank_sr: string;
  time_start: string;
  time_end: string;
  message_content: string;
  discord_message_url?: string;
  channel_name?: string;
  channel_id: string;
  timestamp_created?: string;
  content_hash: string;
  posted_in_channels: string[];
}

/**
 * Crée un client Supabase avec service role key
 */
function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Insère un scrim dans Postgres (avec fallback silencieux si table n'existe pas)
 * Compatible avec le format attendu par index.tsx
 */
export async function insertScrimPostgres(
  scrim: PostgresScrim
): Promise<{ success: boolean; action?: 'inserted' | 'skipped'; id?: string; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    
    // ✅ CORRECTION : Vérifier d'abord si le scrim existe déjà
    const { data: existing, error: checkError } = await supabase
      .from('scrims')
      .select('id, discord_message_id')
      .eq('discord_message_id', scrim.discord_message_id)
      .maybeSingle();
    
    if (checkError) {
      // Si la table n'existe pas, on fait un fallback silencieux
      if (checkError.code === '42P01' || checkError.message.includes('relation') || checkError.message.includes('does not exist')) {
        console.warn('⚠️ Postgres table does not exist yet - using KV only');
        return { success: false, error: 'Table not found (using KV fallback)' };
      }
      console.error('❌ Postgres check error:', checkError);
      return { success: false, error: checkError.message };
    }
    
    // Si le scrim existe déjà, le mettre à jour mais retourner "skipped"
    if (existing) {
      // Update le scrim existant (cas où posted_in_channels a changé)
      const { error: updateError } = await supabase
        .from('scrims')
        .update({
          posted_in_channels: scrim.posted_in_channels || [],
          channel_name: scrim.channel_name || existing.channel_name,
        })
        .eq('discord_message_id', scrim.discord_message_id);
      
      if (updateError) {
        console.error('❌ Postgres update error:', updateError);
        return { success: false, error: updateError.message };
      }
      
      return { success: true, action: 'skipped', id: existing.id };
    }
    
    // ✅ Sinon, insérer un nouveau scrim
    const { data, error } = await supabase
      .from('scrims')
      .insert({
        discord_message_id: scrim.discord_message_id,
        author_discord_id: scrim.author_discord_id,
        author_username: scrim.author_username || null,
        author_avatar_url: scrim.author_avatar_url || null,
        lfs_type: scrim.lfs_type || '',
        region: scrim.region || '',
        platform: scrim.platform || '',
        rank_sr: scrim.rank_sr || '',
        time_start: scrim.time_start || '',
        time_end: scrim.time_end || '',
        message_content: scrim.message_content || '',
        discord_message_url: scrim.discord_message_url || '',
        channel_name: scrim.channel_name || null,
        channel_id: scrim.channel_id,
        timestamp_created: scrim.timestamp_created || new Date().toISOString(),
        content_hash: scrim.content_hash,
        posted_in_channels: scrim.posted_in_channels || [],
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('❌ Postgres insert error:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, action: 'inserted', id: data?.id };
    
  } catch (error) {
    console.error('❌ Postgres insert exception:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Récupère tous les scrims depuis Postgres
 * Limite aux 7 derniers jours
 */
export async function getAllScrimsFromPostgres(): Promise<PostgresScrim[]> {
  try {
    const supabase = getSupabaseAdmin();
    
    // Date limite : 7 jours en arrière
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data, error } = await supabase
      .from('scrims')
      .select('*')
      .gte('timestamp_created', sevenDaysAgo.toISOString())
      .order('timestamp_created', { ascending: false }); // ✅ CORRECTION : Trier par timestamp_created (Discord) au lieu de created_at (Postgres)
    
    if (error) {
      console.error('❌ Postgres query error:', error);
      return [];
    }
    
    console.log(`✅ Retrieved ${data.length} scrims from Postgres`);
    return data as PostgresScrim[];
    
  } catch (error) {
    console.error('❌ Postgres query exception:', error);
    return [];
  }
}

/**
 * Récupère le dernier message ID d'un channel
 * Utilisé pour le fetch incrémental Discord
 */
export async function getLastMessageId(channelId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('channel_sync_state')
      .select('last_message_id')
      .eq('channel_id', channelId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data.last_message_id;
    
  } catch (error) {
    console.error('❌ Error getting last message ID:', error);
    return null;
  }
}

/**
 * Met à jour le dernier message ID d'un channel
 */
export async function updateLastMessageId(
  channelId: string,
  messageId: string,
  channelName: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    
    await supabase
      .from('channel_sync_state')
      .upsert({
        channel_id: channelId,
        channel_name: channelName,
        last_message_id: messageId,
        last_sync_at: new Date().toISOString(),
      }, {
        onConflict: 'channel_id',
      });
    
    console.log(`✅ Updated last_message_id for ${channelName}:`, messageId);
    
  } catch (error) {
    console.error('❌ Error updating last message ID:', error);
  }
}

/**
 * Nettoie les scrims de plus de 7 jours
 * Retourne le nombre de scrims supprimés
 */
export async function cleanupOldScrims(): Promise<{ deleted: number; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    
    // Calculer la date limite (7 jours en arrière)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString();
    
    console.log(`🧹 Cleaning up scrims older than ${cutoffDate}...`);
    
    // ✅ CORRECTION : Supprimer les scrims avec timestamp_created < cutoffDate (date Discord)
    // Au lieu de created_at (date d'insertion en DB)
    const { data, error, count } = await supabase
      .from('scrims')
      .delete({ count: 'exact' })
      .lt('timestamp_created', cutoffDate);
    
    if (error) {
      console.error('❌ Error cleaning up old scrims:', error);
      return { deleted: 0, error: error.message };
    }
    
    const deletedCount = count || 0;
    console.log(`✅ Cleaned up ${deletedCount} old scrims (based on Discord timestamp)`);
    
    return { deleted: deletedCount };
    
  } catch (error) {
    console.error('❌ Error in cleanupOldScrims:', error);
    return { deleted: 0, error: String(error) };
  }
}