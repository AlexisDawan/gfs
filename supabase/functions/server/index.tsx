import { Hono } from "npm:hono@4";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { parseScrimMessage, isLfsMessage } from "./discord_parser.tsx";
import {
  syncDiscordMessages,
  syncDiscordMessagesBatch, // ✅ NOUVEAU : Sync par batch
} from "./discord_client.tsx";
import {
  insertScrimPostgres,
  getLastMessageId,
  updateLastMessageId,
  getAllScrimsFromPostgres, // ✅ AJOUT : Import de la fonction Postgres
  cleanupOldScrims, // ✅ AJOUT : Import de la fonction de nettoyage
  type PostgresScrim,
} from "./postgres_client.tsx";

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger(console.log));

// Health check endpoint (public - no auth required)
app.get("/make-server-e52d06d3/health", (c) => {
  return c.json({ 
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "GoForScrim backend is running"
  });
});

// ✅ NOUVEAU : Warmup endpoint pour garder le serveur chaud
app.get("/make-server-e52d06d3/warmup", (c) => {
  return c.json({ 
    status: "warm",
    timestamp: new Date().toISOString(),
  });
});

// Endpoint pour récupérer tous les scrims
app.get("/make-server-e52d06d3/scrims", async (c) => {
  try {
    // ✅ CORRECTION : Lire depuis Postgres au lieu du KV obsolète
    console.log("🔍 Fetching scrims from Postgres...");
    const scrimsFromPostgres = await getAllScrimsFromPostgres();
    
    console.log(`✅ Retrieved ${scrimsFromPostgres.length} scrims from Postgres`);
    
    // Convertir le format Postgres vers le format attendu par le frontend
    const scrims = scrimsFromPostgres.map(scrim => ({
      id: scrim.discord_message_id,
      lfs_type: scrim.lfs_type,
      region: scrim.region,
      platform: scrim.platform,
      rankSR: scrim.rank_sr,
      time_start: scrim.time_start,
      time_end: scrim.time_end,
      discord_message_url: scrim.discord_message_url,
      author_discord_id: scrim.author_discord_id,
      author_discord_username: scrim.author_username,
      author_discord_display_name: scrim.author_username,
      timestamp_created: scrim.timestamp_created,
      channel_name: scrim.channel_name,
      channel_id: scrim.channel_id,
      content_hash: scrim.content_hash,
    }));
    
    // Les scrims sont déjà triés par created_at DESC dans getAllScrimsFromPostgres
    return c.json({ scrims });
  } catch (error) {
    console.log(`Error fetching scrims: ${error}`);
    return c.json({ error: "Failed to fetch scrims", details: String(error) }, 500);
  }
});

// Endpoint pour synchroniser les messages Discord
app.post("/make-server-e52d06d3/scrims/sync", async (c) => {
  try {
    const userToken = Deno.env.get("DISCORD_USER_TOKEN");

    if (!userToken) {
      return c.json(
        {
          error: "Missing configuration",
          details: "DISCORD_USER_TOKEN must be set",
        },
        500
      );
    }

    // ✅ Le nettoyage des scrims > 7 jours est géré par pg_cron quotidiennement à 00h00
    // Voir /SETUP_CLEANUP_CRON.md pour la configuration

    // Sync incrémentale : plus rapide, ne supprime rien (pas de clignotement)
    const result = await syncDiscordMessages(userToken, true);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.log(`Error syncing Discord messages: ${error}`);
    return c.json(
      { error: "Failed to sync Discord messages", details: String(error) },
      500
    );
  }
});

// ✅ NOUVEAU : Endpoint pour forcer une resync complète (purge + re-sync)
app.post("/make-server-e52d06d3/scrims/force-resync", async (c) => {
  try {
    const userToken = Deno.env.get("DISCORD_USER_TOKEN");

    if (!userToken) {
      return c.json(
        {
          error: "Missing configuration",
          details: "DISCORD_USER_TOKEN must be set",
        },
        500
      );
    }

    console.log("🔄 FORCE RESYNC: Purging all existing scrims...");
    
    // Purger TOUS les scrims existants
    const allScrims = await kv.getByPrefix("scrim_");
    let purged = 0;
    for (const scrim of allScrims) {
      if (scrim.id) {
        await kv.del(`scrim_${scrim.id}`);
        purged++;
      }
    }
    
    console.log(`🗑️ Purged ${purged} existing scrims`);

    // Re-synchroniser tous les messages depuis Discord (full sync avec suppression activée)
    console.log("📡 Re-syncing all messages from Discord with channel names...");
    
    // ✅ FIXED: Utiliser la liste complète des channels
    const ALL_CHANNELS = [
      "588408318800822318", "294499300594024458", "396845244613787649",
      "580441118362173469", "177136656846028801", "844179659977785354",
      "1111284074515021844", "582607405280526365", "284782754066071552",
      "274933904983719941", "274933929436512256", "274934302423384075",
      "1111284114205708298", "586065867897438208", "284782796277415937",
      "278205140505329665", "278205205013594112", "278205283740680193",
      "1111284145658802196", "962308670228688907", "962308734233751552",
      "962308790940741642", "962308866949918760", "962308905659154462",
      "1222596735176806501", "1222596701630496929", "1181885822107123772",
      "1222596660274663464", "504043327793135618", "418463811339681813",
      "722800929509998673", "722800964477648986", "1375592440601509948",
      "746874617515343872", "423883645464346624", "746874537651732480",
      "746874551648124939", "542389077966585898", "542389019405844491",
      "542388885662203916", "542387948075876359",
    ];
    const channelIdsString = ALL_CHANNELS.join(",");
    const result = await syncDiscordMessagesBatch(channelIdsString, userToken, false); // ✅ FIXED: Ordre correct et incremental = false

    return c.json({
      success: true,
      purged,
      ...result,
      message: "All scrims purged and re-synced with channel names",
    });
  } catch (error) {
    console.log(`Error force-resyncing Discord messages: ${error}`);
    return c.json(
      { error: "Failed to force-resync Discord messages", details: String(error) },
      500
    );
  }
});

// ✅ NOUVEAU : Endpoint pour sync complète Postgres (7 derniers jours)
app.post("/make-server-e52d06d3/scrims/sync-full-7days", async (c) => {
  try {
    const userToken = Deno.env.get("DISCORD_USER_TOKEN");
    const body = await c.req.json().catch(() => ({}));
    const { batchSize = 5, batchIndex = 0 } = body; // Par défaut : 5 channels à la fois

    if (!userToken) {
      return c.json(
        {
          error: "Missing configuration",
          details: "DISCORD_USER_TOKEN must be set",
        },
        500
      );
    }

    // Liste des 41 channels
    const ALL_CHANNELS = [
      "588408318800822318", "294499300594024458", "396845244613787649",
      "580441118362173469", "177136656846028801", "844179659977785354",
      "1111284074515021844", "582607405280526365", "284782754066071552",
      "274933904983719941", "274933929436512256", "274934302423384075",
      "1111284114205708298", "586065867897438208", "284782796277415937",
      "278205140505329665", "278205205013594112", "278205283740680193",
      "1111284145658802196", "962308670228688907", "962308734233751552",
      "962308790940741642", "962308866949918760", "962308905659154462",
      "1222596735176806501", "1222596701630496929", "1181885822107123772",
      "1222596660274663464", "504043327793135618", "418463811339681813",
      "722800929509998673", "722800964477648986", "1375592440601509948",
      "746874617515343872", "423883645464346624", "746874537651732480",
      "746874551648124939", "542389077966585898", "542389019405844491",
      "542388885662203916", "542387948075876359",
    ];

    // Calculer le batch à traiter
    const startIdx = batchIndex * batchSize;
    const endIdx = Math.min(startIdx + batchSize, ALL_CHANNELS.length);
    const channelsToProcess = ALL_CHANNELS.slice(startIdx, endIdx);

    console.log(`🔄 BATCH ${batchIndex + 1}: Processing channels ${startIdx} to ${endIdx - 1} (${channelsToProcess.length} channels)`);

    if (channelsToProcess.length === 0) {
      return c.json({
        success: true,
        added: 0,
        skipped: 0,
        errors: 0,
        message: "No more channels to process",
        hasMore: false,
        totalChannels: ALL_CHANNELS.length,
        processedChannels: startIdx,
      });
    }

    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let totalMessagesFetched = 0;
    let totalMessagesParsed = 0;

    // ✅ CHANGÉ : Récupérer les messages des dernières 168h (7 jours) au lieu de 120h
    const oneHundredSixtyEightHoursAgo = new Date();
    oneHundredSixtyEightHoursAgo.setHours(oneHundredSixtyEightHoursAgo.getHours() - 168);

    console.log(`📅 Fetching messages after: ${oneHundredSixtyEightHoursAgo.toISOString()}`);

    // Pour chaque channel du batch, fetch les messages
    for (const channelId of channelsToProcess) {
      try {
        console.log(`📨 Fetching messages for channel ${channelId}...`);

        let allMessages: any[] = [];
        let lastMessageId: string | null = null;
        let hasMore = true;
        let pageCount = 0;

        // ✅ CHANGÉ : Pagination Discord - récupérer les messages des dernières 24h
        while (hasMore && pageCount < 3) { // ✅ RÉDUIT : Max 3 pages (300 messages) pour 24h
          let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
          if (lastMessageId) {
            url += `&before=${lastMessageId}`;
          }

          const response = await fetch(url, {
            headers: {
              Authorization: userToken,
              "Content-Type": "application/json",
            },
          });

          if (response.status === 429) {
            // Rate limit - attendre
            const retryAfter = parseInt(response.headers.get('retry-after') || '1000');
            console.log(`⏳ Rate limited, waiting ${retryAfter}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            continue;
          }

          if (!response.ok) {
            console.error(`❌ Discord API error for channel ${channelId}: ${response.status}`);
            totalErrors++;
            break;
          }

          const messages = await response.json();

          if (!messages || messages.length === 0) {
            hasMore = false;
            break;
          }

          // ✅ Filtrer les messages des dernières 168h
          const recentMessages = messages.filter((msg: any) => 
            new Date(msg.timestamp) >= oneHundredSixtyEightHoursAgo
          );

          allMessages = allMessages.concat(recentMessages);

          // ✅ Si on a récupéré moins de messages récents que le total, on a dépassé les 168h
          if (recentMessages.length < messages.length) {
            hasMore = false;
            break;
          }

          // Préparer pour la prochaine page
          lastMessageId = messages[messages.length - 1].id;
          pageCount++;

          // Petit délai pour éviter le rate limit
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        totalMessagesFetched += allMessages.length;
        console.log(`✅ Fetched ${allMessages.length} messages from last 168h for channel ${channelId}`);

        // Trier par timestamp croissant (plus ancien en premier)
        const sortedMessages = allMessages.sort((a: any, b: any) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        let channelAdded = 0;
        let channelParsed = 0;
        let newestMessageId: string | null = null;

        // Traiter chaque message
        for (const message of sortedMessages) {
          try {
            // ✅ LOGS DÉTAILLÉS : Afficher les premiers caractères de chaque message
            const preview = message.content.substring(0, 50).replace(/\n/g, ' ');
            console.log(`📝 Parsing message ${message.id}: "${preview}..."`);

            // Parser le message
            const parsedScrim = parseScrimMessage(
              message.content,
              `https://discord.com/channels/@me/${channelId}/${message.id}`,
              message.author.id,
              message.timestamp,
              message.author.username,
              message.author.global_name || message.author.username, // ✅ authorDisplayName
              undefined, // ✅ channelName (sera déduit plus tard si nécessaire)
              channelId  // ✅ CORRECTION : passer le channelId !
            );

            if (!parsedScrim) {
              console.log(`⚠️ Message ${message.id} not recognized as LFS`);
              continue; // Pas un message LFS
            }

            channelParsed++;
            totalMessagesParsed++;
            console.log(`✅ Message ${message.id} parsed successfully as ${parsedScrim.lfs_type}`);

            // ✅ CORRECTION : Calculer le content_hash
            const contentHash = `${message.author.id}_${message.content.toLowerCase().replace(/\s+/g, ' ').trim()}`;

            // Stocker dans Postgres
            const insertResult = await insertScrimPostgres({
              ...parsedScrim,
              discord_message_id: message.id,
              author_discord_id: message.author.id,
              author_username: message.author.username,
              author_avatar_url: message.author.avatar,
              message_content: message.content,
              channel_id: channelId,
              content_hash: contentHash, // ✅ CORRECTION : Ajouter le content_hash
              posted_in_channels: [channelId],
            });

            if (insertResult.success) {
              if (insertResult.action === 'inserted') {
                channelAdded++;
                totalAdded++;
                console.log(`✅ Scrim inserted: ${message.id}`);
              } else if (insertResult.action === 'skipped') {
                totalSkipped++;
                console.log(`⏭️ Scrim skipped (duplicate): ${message.id}`);
              }
            }

            // Mettre à jour le dernier message ID
            newestMessageId = message.id;

          } catch (parseError) {
            console.error(`❌ Error parsing message ${message.id}: ${parseError}`);
          }
        }

        // Mettre à jour le dernier message ID pour ce channel
        if (newestMessageId) {
          await updateLastMessageId(channelId, newestMessageId, `Channel ${channelId}`); // ✅ CORRECTION : Ajouter channelName
        }

        console.log(`✅ Channel ${channelId}: ${allMessages.length} fetched, ${channelParsed} parsed, ${channelAdded} added`);

      } catch (channelError) {
        console.error(`❌ Error processing channel ${channelId}: ${channelError}`);
        totalErrors++;
      }
    }

    const hasMore = endIdx < ALL_CHANNELS.length;
    
    console.log(`✅ Batch ${batchIndex + 1} complete: ${totalMessagesFetched} fetched, ${totalMessagesParsed} parsed, ${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors`);

    return c.json({
      success: true,
      fetched: totalMessagesFetched,
      parsed: totalMessagesParsed,
      added: totalAdded,
      skipped: totalSkipped,
      errors: totalErrors,
      hasMore,
      nextBatchIndex: hasMore ? batchIndex + 1 : null,
      totalChannels: ALL_CHANNELS.length,
      processedChannels: endIdx,
      message: hasMore 
        ? `Batch ${batchIndex + 1} complete. ${ALL_CHANNELS.length - endIdx} channels remaining.`
        : "All channels processed",
    });

  } catch (error) {
    console.error(`❌ Error in full 24h sync: ${error}`);
    return c.json(
      { error: "Failed to sync last 24h", details: String(error) },
      500
    );
  }
});

// ✅ NOUVEAU : Endpoint pour sync par batch (5 channels à la fois)
app.post("/make-server-e52d06d3/scrims/sync-batch", async (c) => {
  try {
    const userToken = Deno.env.get("DISCORD_USER_TOKEN");
    const body = await c.req.json();
    const { channelIds } = body; // Array de channel IDs

    if (!userToken) {
      return c.json(
        {
          error: "Missing configuration",
          details: "DISCORD_USER_TOKEN must be set",
        },
        500
      );
    }

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return c.json(
        {
          error: "Invalid request",
          details: "channelIds array is required",
        },
        400
      );
    }

    console.log(`🔄 Syncing batch of ${channelIds.length} channels...`);
    
    // Convertir array en string séparé par des virgules
    const channelIdsString = channelIds.join(",");
    
    // Sync ce batch avec déduplication et fusion
    const result = await syncDiscordMessagesBatch(channelIdsString, userToken, true); // ✅ FIXED: Ordre correct des paramètres

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.log(`Error syncing batch: ${error}`);
    return c.json(
      { error: "Failed to sync batch", details: String(error) },
      500
    );
  }
});

// ✅ NOUVEAU : Endpoint pour sync incrémentale (appelé par pg_cron toutes les 60s)
app.post("/make-server-e52d06d3/scrims/sync-incremental", async (c) => {
  try {
    const userToken = Deno.env.get("DISCORD_USER_TOKEN");

    if (!userToken) {
      return c.json(
        {
          error: "Missing configuration",
          details: "DISCORD_USER_TOKEN must be set",
        },
        500
      );
    }

    console.log("🔄 Starting incremental sync (60s cron)...");

    // Liste des 17 channels
    const ALL_CHANNELS = [
      "588408318800822318", "294499300594024458", "396845244613787649",
      "580441118362173469", "177136656846028801", "844179659977785354",
      "1111284074515021844", "582607405280526365", "284782754066071552",
      "274933904983719941", "274933929436512256", "274934302423384075",
      "1111284114205708298", "586065867897438208", "284782796277415937",
      "278205140505329665", "278205205013594112", "278205283740680193",
      "1111284145658802196", "962308670228688907", "962308734233751552",
      "962308790940741642", "962308866949918760", "962308905659154462",
      "1222596735176806501", "1222596701630496929", "1181885822107123772",
      "1222596660274663464", "504043327793135618", "418463811339681813",
      "722800929509998673", "722800964477648986", "1375592440601509948",
      "746874617515343872", "423883645464346624", "746874537651732480",
      "746874551648124939", "542389077966585898", "542389019405844491",
      "542388885662203916", "542387948075876359",
    ];

    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Pour chaque channel, fetch uniquement les nouveaux messages
    for (const channelId of ALL_CHANNELS) {
      try {
        // Obtenir le dernier message ID traité
        const lastMessageId = await getLastMessageId(channelId);
        
        // Construire l'URL avec after= si on a un lastMessageId
        let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=50`;
        if (lastMessageId) {
          url += `&after=${lastMessageId}`;
          console.log(`📨 Fetching NEW messages for channel ${channelId} (after ${lastMessageId})`);
        } else {
          console.log(`📨 Fetching messages for channel ${channelId} (no previous sync)`);
        }

        // Fetch Discord
        const response = await fetch(url, {
          headers: {
            Authorization: userToken,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.error(`❌ Discord API error for channel ${channelId}: ${response.status}`);
          totalErrors++;
          continue;
        }

        const messages = await response.json();
        
        if (!messages || messages.length === 0) {
          console.log(`✅ No new messages for channel ${channelId}`);
          continue;
        }

        console.log(`✅ Fetched ${messages.length} new messages for channel ${channelId}`);

        // Trier par timestamp croissant (plus ancien en premier)
        const sortedMessages = messages.sort((a: any, b: any) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        let channelAdded = 0;
        let newestMessageId = lastMessageId;

        // Traiter chaque message
        for (const message of sortedMessages) {
          try {
            // Parser le message
            const parsedScrim = parseScrimMessage(
              message.content,
              `https://discord.com/channels/@me/${channelId}/${message.id}`,
              message.author.id,
              message.timestamp,
              message.author.username,
              message.author.global_name || message.author.username, // ✅ CORRECTION : authorDisplayName
              undefined, // channel name (on ne l'a pas ici)
              channelId  // ✅ CORRECTION : passer le channelId !
            );

            if (!parsedScrim) {
              totalSkipped++;
              continue;
            }

            // Générer content hash
            const contentHash = `${message.author.id}_${message.content.toLowerCase().replace(/\s+/g, ' ').trim()}`;

            // Double écriture : KV + Postgres
            const kvKey = `scrim_${message.id}`;
            const kvData = {
              id: message.id,
              ...parsedScrim,
              content_hash: contentHash,
            };

            // 1. KV Store (existant)
            await kv.set(kvKey, kvData);

            // 2. Postgres (nouveau - avec fallback si table n'existe pas)
            const postgresData: PostgresScrim = {
              discord_message_id: message.id,
              author_discord_id: message.author.id,
              author_username: message.author.username,
              author_avatar_url: message.author.avatar,
              lfs_type: parsedScrim.lfs_type,
              region: parsedScrim.region,
              platform: parsedScrim.platform,
              rank_sr: parsedScrim.rankSR,
              time_start: parsedScrim.time_start,
              time_end: parsedScrim.time_end,
              message_content: message.content,
              discord_message_url: parsedScrim.discord_message_url,
              channel_name: parsedScrim.channel_name,
              channel_id: channelId,
              timestamp_created: parsedScrim.timestamp_created,
              content_hash: contentHash,
              posted_in_channels: parsedScrim.channel_name ? [parsedScrim.channel_name] : [],
            };

            await insertScrimPostgres(postgresData);

            channelAdded++;
            totalAdded++;

            // Mettre à jour le newest message ID
            newestMessageId = message.id;

          } catch (err) {
            console.error(`❌ Error processing message ${message.id}:`, err);
            totalErrors++;
          }
        }

        // Mettre à jour le last_message_id pour ce channel
        if (newestMessageId && newestMessageId !== lastMessageId) {
          await updateLastMessageId(channelId, newestMessageId, `Channel ${channelId}`); // ✅ CORRECTION : Ajouter channelName
        }

        console.log(`✅ Channel ${channelId}: Added ${channelAdded} new scrims`);

        // Petit délai entre channels pour éviter rate limit
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        console.error(`❌ Error processing channel ${channelId}:`, err);
        totalErrors++;
      }
    }

    console.log(`✅ Incremental sync complete: ${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors`);

    // ✅ Le nettoyage des scrims > 7 jours est géré par pg_cron quotidiennement à 00h00
    // Voir /SETUP_CLEANUP_CRON.md pour la configuration

    return c.json({
      success: true,
      added: totalAdded,
      skipped: totalSkipped,
      errors: totalErrors,
    });

  } catch (error) {
    console.error(`❌ Error in incremental sync: ${error}`);
    return c.json(
      { error: "Failed to sync incrementally", details: String(error) },
      500
    );
  }
});

// Endpoint pour ajouter un scrim depuis Discord (webhook)
app.post("/make-server-e52d06d3/scrims", async (c) => {
  try {
    const body = await c.req.json();
    const { content, messageUrl, authorId, timestamp, messageId, authorUsername, authorDisplayName } = body;

    // ✅ ACCEPTER TOUS LES MESSAGES - Plus de vérification LFS
    console.log(`✅ Accepting all Discord messages (no LFS filtering)`);

    // Parser le message
    const parsedScrim = parseScrimMessage(content, messageUrl, authorId, timestamp, authorUsername, authorDisplayName);
    
    if (!parsedScrim) {
      return c.json({ error: "Failed to parse scrim" }, 400);
    }

    // Stocker dans la KV store avec l'ID du message Discord
    const key = `scrim_${messageId}`;
    await kv.set(key, { id: messageId, ...parsedScrim });

    return c.json({ success: true, scrim: parsedScrim });
  } catch (error) {
    console.log(`Error creating scrim from Discord message: ${error}`);
    return c.json({ error: "Failed to create scrim", details: String(error) }, 500);
  }
});

// Endpoint pour supprimer un scrim (quand un message est supprimé sur Discord)
app.delete("/make-server-e52d06d3/scrims/:messageId", async (c) => {
  try {
    const messageId = c.req.param("messageId");
    const key = `scrim_${messageId}`;
    await kv.del(key);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting scrim: ${error}`);
    return c.json({ error: "Failed to delete scrim", details: String(error) }, 500);
  }
});

// 🧹 NOUVEAU : Endpoint pour tester le nettoyage des scrims > 7 jours
app.post("/make-server-e52d06d3/scrims/cleanup", async (c) => {
  try {
    console.log("🧹 Manual cleanup triggered...");
    
    const result = await cleanupOldScrims();
    
    if (result.error) {
      console.error(`❌ Cleanup error: ${result.error}`);
      return c.json({
        success: false,
        error: result.error,
        deleted: result.deleted,
      }, 500);
    }
    
    console.log(`✅ Cleanup complete: ${result.deleted} scrims deleted`);
    
    return c.json({
      success: true,
      deleted: result.deleted,
      message: `Successfully deleted ${result.deleted} scrims older than 7 days`,
    });
  } catch (error) {
    console.error(`❌ Error in cleanup endpoint: ${error}`);
    return c.json({
      error: "Failed to cleanup old scrims",
      details: String(error),
    }, 500);
  }
});

// 📬 Endpoint pour envoyer le formulaire de contact vers Discord
app.post("/make-server-e52d06d3/contact", async (c) => {
  try {
    console.log("📬 Contact endpoint called");
    const body = await c.req.json();
    const { name, email, type, subject, message } = body;
    console.log("📩 Received data:", { name, email, type, subject, messageLength: message?.length });

    // Validation
    if (!name || !email || !type || !message) {
      console.error("❌ Missing required fields:", { name: !!name, email: !!email, type: !!type, message: !!message });
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Récupérer le webhook URL depuis les variables d'environnement
    const webhookUrl = Deno.env.get("VITE_DISCORD_SUPPORT_WEBHOOK_URL");

    if (!webhookUrl) {
      console.error("❌ VITE_DISCORD_SUPPORT_WEBHOOK_URL not configured");
      return c.json({ error: "Webhook not configured" }, 500);
    }
    console.log("✅ Webhook URL found:", webhookUrl.substring(0, 50) + "...");

    // Préparer le message Discord
    const discordMessage = {
      embeds: [
        {
          title: "📬 Nouveau message de contact",
          color: 0x00d4ff,
          fields: [
            {
              name: "👤 Nom",
              value: name,
              inline: true,
            },
            {
              name: "📧 Email",
              value: email,
              inline: true,
            },
            {
              name: "📋 Type",
              value: subject || type,
              inline: false,
            },
            {
              name: "💬 Message",
              value: message.substring(0, 1000),
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "GoForScrim Contact Form",
          },
        },
      ],
    };

    console.log("📤 Sending to Discord webhook...");
    // Envoyer vers Discord
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(discordMessage),
    });

    console.log("📥 Discord response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Discord webhook error:", errorText);
      return c.json({ error: "Failed to send to Discord", details: errorText }, 500);
    }

    console.log("✅ Message sent successfully to Discord!");
    return c.json({ success: true });
  } catch (error) {
    console.error(`❌ Error sending contact form: ${error}`);
    return c.json({ error: "Failed to send contact form", details: String(error) }, 500);
  }
});

Deno.serve(app.fetch);