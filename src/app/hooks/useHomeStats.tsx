import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase/client';

export interface HomeStats {
  totalMessages: number;
  totalChannels: number;
  activeUsers: number;
}

/**
 * Hook pour récupérer les statistiques de la page d'accueil depuis Supabase
 */
export function useHomeStats() {
  const [stats, setStats] = useState<HomeStats>({
    totalMessages: 0,
    totalChannels: 0,
    activeUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);

        // 1. Nombre total de messages parsés
        const { count: messagesCount, error: messagesError } = await supabase
          .from('scrims')
          .select('*', { count: 'exact', head: true });

        if (messagesError) throw messagesError;

        // 2. Nombre de salons Discord uniques
        const { data: channelsData, error: channelsError } = await supabase
          .from('scrims')
          .select('channel_id');

        if (channelsError) throw channelsError;

        const uniqueChannels = new Set(
          channelsData
            ?.filter(item => item.channel_id)
            .map(item => item.channel_id)
        );

        // 3. Nombre d'utilisateurs actifs (auteurs Discord uniques)
        const { data: usersData, error: usersError } = await supabase
          .from('scrims')
          .select('author_discord_id');

        if (usersError) throw usersError;

        const uniqueUsers = new Set(
          usersData
            ?.filter(item => item.author_discord_id)
            .map(item => item.author_discord_id)
        );

        setStats({
          totalMessages: messagesCount || 0,
          totalChannels: uniqueChannels.size,
          activeUsers: uniqueUsers.size,
        });

        console.log('✅ Home stats loaded:', {
          messages: messagesCount,
          channels: uniqueChannels.size,
          users: uniqueUsers.size,
        });
      } catch (err) {
        console.error('❌ Error fetching home stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return { stats, loading, error };
}

/**
 * Fonction helper pour formater les nombres avec K/M suffix et ajouter "+"
 */
export function formatStatNumber(num: number): string {
  if (num >= 1000000) {
    return Math.floor(num / 1000000) + 'M+';
  }
  if (num >= 1000) {
    return Math.floor(num / 1000) + 'K+';
  }
  return num.toString() + '+';
}