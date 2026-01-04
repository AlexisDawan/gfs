import * as kv from "./kv_store.tsx";
import { parseScrimMessage } from "./discord_parser.tsx";

/**
 * Interface pour les messages Discord
 */
interface DiscordMessage {
  id: string;
  content: string;
  timestamp: string;
  channel_id: string;
  guild_id?: string;
  author: {
    id: string;
    username: string;
    global_name?: string;
  };
}

/**
 * Interface pour les informations d'un channel Discord
 */
interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

/**
 * Récupère les informations d'un channel Discord
 */
async function fetchChannelInfo(
  channelId: string,
  userToken: string
): Promise<DiscordChannel> {
  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}`,
    {
      headers: {
        Authorization: userToken,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Discord API error: ${response.status} ${await response.text()}`);
  }

  return await response.json();
}

/**
 * Récupère les messages d'un channel Discord avec retry sur rate limit
 */
async function fetchDiscordMessages(
  channelId: string,
  userToken: string,
  limit: number = 100, // ✅ Revenir à 100 messages (limite max Discord)
  retries: number = 3
): Promise<DiscordMessage[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
        {
          headers: {
            Authorization: userToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 429) {
        // Rate limited - attendre et réessayer
        const data = await response.json();
        const retryAfter = (data.retry_after || 1) * 1000; // Convertir en ms
        console.warn(`⏳ Rate limited on channel ${channelId}, waiting ${retryAfter}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        continue; // Réessayer
      }

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status} ${await response.text()}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === retries - 1) throw error; // Dernière tentative échouée
      console.warn(`⚠️ Attempt ${attempt + 1} failed for channel ${channelId}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
    }
  }
  return []; // Fallback
}

/**
 * Utilitaire pour créer un délai
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Nettoie les anciens scrims (plus de 7 jours)
 */
export async function cleanupOldScrims(): Promise<number> {
  try {
    const allScrims = await kv.getByPrefix("scrim_");
    const now = new Date();
    let deleted = 0;

    for (const scrim of allScrims) {
      if (scrim.timestamp_created) {
        const scrimDate = new Date(scrim.timestamp_created);
        const hoursDiff =
          (now.getTime() - scrimDate.getTime()) / (1000 * 60 * 60);

        // Supprimer les scrims de plus de 7 jours (168 heures)
        if (hoursDiff > 168) {
          await kv.del(`scrim_${scrim.id}`);
          deleted++;
        }
      }
    }

    if (deleted > 0) {
      console.log(`🗑️ Cleaned up ${deleted} old scrims (>7 days)`);
    }

    return deleted;
  } catch (error) {
    console.error("Error cleaning up old scrims:", error);
    return 0;
  }
}

/**
 * Normalise le contenu d'un message pour la détection de doublons
 */
function normalizeContent(content: string): string {
  return content
    .toLowerCase()
    .replace(/\s+/g, " ") // Normaliser les espaces
    .replace(/[^\w\s]/g, "") // Retirer la ponctuation
    .trim();
}

/**
 * Génère un hash unique pour identifier un message (pour détecter les doublons)
 */
function generateMessageHash(authorId: string, content: string): string {
  const normalized = normalizeContent(content);
  return `${authorId}_${normalized}`;
}

/**
 * Trouve un scrim existant avec le même hash (doublon)
 */
async function findExistingScrimByHash(hash: string): Promise<any | null> {
  try {
    const allScrims = await kv.getByPrefix("scrim_");
    return allScrims.find(scrim => scrim.content_hash === hash) || null;
  } catch (error) {
    console.error("Error finding existing scrim by hash:", error);
    return null;
  }
}

/**
 * Synchronise les messages Discord avec la base de données (LEGACY)
 * @param incremental Si true, ne supprime pas les scrims existants (sync rapide)
 */
export async function syncDiscordMessages(
  channelIds: string,
  userToken: string,
  incremental: boolean = true
): Promise<{ added: number; skipped: number; errors: number; deleted: number; channelStats?: Array<{ channelId: string; channelName: string; messageCount: number }> }> {
  // Utiliser la nouvelle fonction batch sans déduplication pour compatibilité
  const result = await syncDiscordMessagesBatch(channelIds, userToken, incremental);
  return {
    added: result.added,
    skipped: result.skipped,
    errors: result.errors,
    deleted: result.deleted,
    channelStats: result.channelStats,
  };
}

/**
 * ✅ NOUVEAU : Synchronise les messages Discord par batch avec déduplication et fusion
 * @param channelIds Liste de channel IDs (max 5 recommandé pour éviter CPU timeout)
 * @param userToken Token Discord utilisateur
 * @param incremental Si true, ne supprime pas les scrims existants
 */
export async function syncDiscordMessagesBatch(
  channelIds: string,
  userToken: string,
  incremental: boolean = true
): Promise<{ 
  added: number; 
  skipped: number; 
  errors: number; 
  deleted: number; 
  merged: number;
  channelStats?: Array<{ channelId: string; channelName: string; messageCount: number }> 
}> {
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalDeleted = 0;
  let totalMerged = 0;

  try {
    const channelIdArray = channelIds
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    console.log(`🔄 Syncing batch of ${channelIdArray.length} channel(s)...`);

    // Récupérer les informations de chaque salon
    const channelInfoMap = new Map<string, string>();
    
    for (const channelId of channelIdArray) {
      try {
        const channelInfo = await fetchChannelInfo(channelId, userToken);
        channelInfoMap.set(channelId, channelInfo.name);
        console.log(`📍 Channel ${channelId} name: "${channelInfo.name}"`);
      } catch (error) {
        console.error(`❌ Error fetching channel info for ${channelId}:`, error);
      }
      await delay(200); // Petit délai entre chaque requête
    }

    // Récupérer tous les messages
    const allMessages: DiscordMessage[] = [];
    const channelStats: { channelId: string; channelName: string; messageCount: number }[] = [];
    
    for (let i = 0; i < channelIdArray.length; i++) {
      const channelId = channelIdArray[i];
      console.log(`📨 Fetching messages from channel ${i + 1}/${channelIdArray.length}...`);
      
      try {
        const messages = await fetchDiscordMessages(channelId, userToken, 100);
        const channelName = channelInfoMap.get(channelId) || "Unknown";
        console.log(`✅ Fetched ${messages.length} messages from "${channelName}"`);
        
        allMessages.push(...messages);
        
        channelStats.push({
          channelId,
          channelName,
          messageCount: messages.length,
        });
      } catch (error) {
        console.error(`❌ Error fetching from channel ${channelId}:`, error);
        totalErrors++;
        
        const channelName = channelInfoMap.get(channelId) || "Unknown";
        channelStats.push({
          channelId,
          channelName,
          messageCount: 0,
        });
      }
      
      if (i < channelIdArray.length - 1) {
        await delay(500); // Délai entre channels
      }
    }

    console.log(`📨 Total fetched: ${allMessages.length} messages`);

    // ✅ FILTRER PAR DATE : 7 derniers jours uniquement
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentMessages = allMessages.filter((message) => {
      const messageDate = new Date(message.timestamp);
      return messageDate >= sevenDaysAgo;
    });
    
    console.log(`📅 Filtered to ${recentMessages.length} messages from last 7 days`);

    // ✅ DÉDUPLICATION ET FUSION
    // Créer un hash pour chaque message : author_id + contenu normalisé
    const messageGroups = new Map<string, DiscordMessage[]>();
    
    for (const message of recentMessages) {
      const hash = `${message.author.id}_${normalizeContent(message.content)}`;
      
      if (!messageGroups.has(hash)) {
        messageGroups.set(hash, []);
      }
      messageGroups.get(hash)!.push(message);
    }

    console.log(`🔍 Found ${messageGroups.size} unique messages (${recentMessages.length - messageGroups.size} duplicates detected)`);

    // ✅ OPTIMISATION : Charger TOUS les scrims existants UNE SEULE FOIS
    console.log(`⚡ Loading existing scrims for deduplication...`);
    const allExistingScrims = await kv.getByPrefix("scrim_");
    const existingScrimsMap = new Map<string, any>();
    
    for (const scrim of allExistingScrims) {
      if (scrim.content_hash) {
        existingScrimsMap.set(scrim.content_hash, scrim);
      }
    }
    
    console.log(`⚡ Loaded ${existingScrimsMap.size} existing scrims into memory for fast lookup`);

    // Traiter chaque groupe de messages (fusion si nécessaire)
    for (const [hash, messages] of messageGroups.entries()) {
      try {
        // ✅ MODIFICATION : Trier par timestamp CROISSANT (plus ancien en premier) pour garder le 1er message
        const sortedMessages = messages.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        const primaryMessage = sortedMessages[0]; // ✅ Le plus ANCIEN (premier posté)
        const isDuplicate = messages.length > 1;

        // ✅ DÉTECTER STRIKETHROUGH
        const hasStrikethrough = primaryMessage.content.includes("~~");

        // ✅ VÉRIFIER SI UN DOUBLON EXISTE DÉJÀ (recherche en mémoire - RAPIDE!)
        const existingScrimWithSameHash = existingScrimsMap.get(hash);

        if (existingScrimWithSameHash) {
          // Un scrim avec le même contenu existe déjà
          
          if (hasStrikethrough) {
            // Si le nouveau message a un strikethrough, supprimer l'ancien
            await kv.del(`scrim_${existingScrimWithSameHash.id}`);
            totalDeleted++;
            console.log(`🗑️ Deleted existing scrim ${existingScrimWithSameHash.id} (new message has strikethrough)`);
            continue;
          }

          // ✅ VÉRIFICATION TEMPORELLE : Ignorer si posté dans les 10 minutes
          const existingTimestamp = new Date(existingScrimWithSameHash.timestamp_created).getTime();
          const newTimestamp = new Date(primaryMessage.timestamp).getTime();
          const timeDiffMinutes = (newTimestamp - existingTimestamp) / (1000 * 60);

          if (timeDiffMinutes < 10) {
            // Doublon posté dans les 10 minutes : merger les channels mais ne pas créer de nouveau scrim
            const newChannels = messages.map(m => {
              const channelName = channelInfoMap.get(m.channel_id);
              return channelName || `Channel ${m.channel_id}`;
            });

            // Merger les channels (éviter les doublons)
            const existingChannels = existingScrimWithSameHash.posted_in_channels || [existingScrimWithSameHash.channel_name];
            const mergedChannels = [...new Set([...existingChannels, ...newChannels])];

            // Mettre à jour le scrim existant avec les nouveaux channels
            const updatedScrim = {
              ...existingScrimWithSameHash,
              posted_in_channels: mergedChannels,
              channel_count: mergedChannels.length,
            };

            await kv.set(`scrim_${existingScrimWithSameHash.id}`, updatedScrim);
            totalMerged++;
            console.log(`🔄 Ignored duplicate within 10 minutes (merged channels for scrim ${existingScrimWithSameHash.id}, now in ${mergedChannels.length} channels)`);
            continue;
          } else {
            // ✅ Doublon posté APRÈS 10 minutes : traiter comme un NOUVEAU scrim distinct
            console.log(`⏰ Same content but posted ${Math.round(timeDiffMinutes)} minutes later - creating new scrim`);
            // Ne pas continuer, laisser le code créer un nouveau scrim ci-dessous
          }
        }

        // Pas de doublon existant OU doublon après 10 minutes, créer un nouveau scrim
        if (hasStrikethrough) {
          totalSkipped++;
          console.log(`⏭️ Skipped new message ${primaryMessage.id} (strikethrough)`);
          continue;
        }

        // Récupérer les noms des channels où le message a été posté
        const postedInChannels = messages.map(m => {
          const channelName = channelInfoMap.get(m.channel_id);
          return channelName || `Channel ${m.channel_id}`;
        });

        // Utiliser le nom du premier channel comme channel principal
        const primaryChannelName = channelInfoMap.get(primaryMessage.channel_id);

        // Parser le message
        const messageUrl = `https://discord.com/channels/${primaryMessage.guild_id || "@me"}/${primaryMessage.channel_id}/${primaryMessage.id}`;

        const parsedScrim = parseScrimMessage(
          primaryMessage.content,
          messageUrl,
          primaryMessage.author.id,
          primaryMessage.timestamp,
          primaryMessage.author.username,
          primaryMessage.author.global_name,
          primaryChannelName,
          primaryMessage.channel_id
        );

        if (!parsedScrim) {
          totalErrors++;
          console.log(`❌ Failed to parse message ${primaryMessage.id}`);
          continue;
        }

        // ✅ CRÉER LE NOUVEAU SCRIM avec hash et informations de fusion
        const newScrim = {
          id: primaryMessage.id,
          ...parsedScrim,
          content_hash: hash, // ✅ Stocker le hash pour détecter les doublons
          posted_in_channels: postedInChannels,
          channel_count: postedInChannels.length,
        };

        await kv.set(`scrim_${primaryMessage.id}`, newScrim);

        totalAdded++;
        
        if (isDuplicate) {
          totalMerged++;
          console.log(`✅ Added and merged scrim ${primaryMessage.id} (posted in ${postedInChannels.length} channels: ${postedInChannels.join(", ")})`);
        } else {
          console.log(`✅ Added scrim ${primaryMessage.id}`);
        }

      } catch (error) {
        totalErrors++;
        console.error(`Error processing message group:`, error);
      }
    }

    console.log(
      `✅ Batch sync complete: ${totalAdded} added, ${totalSkipped} skipped, ${totalMerged} merged, ${totalErrors} errors, ${totalDeleted} deleted`
    );

    return { 
      added: totalAdded, 
      skipped: totalSkipped, 
      errors: totalErrors, 
      deleted: totalDeleted,
      merged: totalMerged,
      channelStats 
    };
  } catch (error) {
    console.error("Error syncing batch:", error);
    throw error;
  }
}