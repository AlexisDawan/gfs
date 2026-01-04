/**
 * Parser Discord pour extraire les informations de scrim
 */

export interface ParsedScrim {
  lfs_type: string; // ✅ Peut être "scrim", "warmup", ou vide (pour "Autre")
  region: string; // Peut être vide
  platform: string; // Peut être vide (PC, Console, ou vide pour "Autre")
  rankSR: string; // Peut être vide
  time_start: string; // Peut être vide
  time_end: string; // Peut être vide
  rank?: string;
  availability_day?: string;
  timezone?: string;
  discord_message_url?: string;
  author_discord_id?: string;
  author_discord_username?: string;
  author_discord_display_name?: string;
  timestamp_created?: string;
  channel_name?: string; // ✅ Nouveau : nom du salon Discord
  channel_id?: string; // ✅ Nouveau : ID du salon Discord
}

/**
 * Parse un message Discord pour extraire les informations de scrim
 */
export function parseScrimMessage(
  content: string,
  messageUrl: string,
  authorId: string,
  timestamp: string,
  authorUsername?: string,
  authorDisplayName?: string,
  channelName?: string,
  channelId?: string
): ParsedScrim | null {
  const contentLower = content.toLowerCase();

  // ✅ ACCEPTER TOUS LES MESSAGES DISCORD - Plus de filtrage par mot-clé
  console.log(`✅ Message accepted (no filtering):`, {
    content: content.substring(0, 100),
    author: authorUsername,
  });

  // Déterminer le type (scrim ou warmup) - ✅ NE PAS mettre de valeur par défaut
  let lfs_type: string = ""; // ✅ Vide par défaut, sera rempli uniquement si un mot-clé est détecté
  
  // Détecter "warmup" en premier
  if (
    contentLower.includes("warmup") ||
    contentLower.includes("warm-up") ||
    contentLower.includes("warm up") ||
    contentLower.includes("lfw") ||
    contentLower.includes("looking for warm")
  ) {
    lfs_type = "warmup";
    console.log(`✅ Type detected: warmup`);
  } 
  // Détecter "scrim" uniquement si "warmup" n'a pas été détecté
  else if (
    contentLower.includes("lfs") ||
    contentLower.includes("scrim") ||
    contentLower.includes("looking for scrim")
  ) {
    lfs_type = "scrim";
    console.log(`✅ Type detected: scrim`);
  } else {
    // ✅ Aucun type détecté → Reste vide (sera affiché dans "Autre")
    console.log(`❌ No type detected (will be in "Autre" category)`);
  }

  // Extraire la région - optionnel
  let region: string | undefined;
  if (contentLower.includes("eu") || contentLower.includes("europe") || contentLower.includes("fr")) {
    region = "EU";
  } else if (
    contentLower.includes("na") ||
    contentLower.includes("us") ||
    contentLower.includes("americas")
  ) {
    region = "NA";
  }

  // ✅ Extraire la plateforme avec détection stricte des mots-clés
  let platform: string | undefined;
  if (contentLower.includes("pc")) {
    platform = "PC";
    console.log(`🖥️ Platform detected: PC`);
  } else if (contentLower.includes("console")) {
    platform = "Console";
    console.log(`🎮 Platform detected: Console`);
  } else {
    console.log(`❓ No platform detected (will be empty/Autre)`);
  }

  // Extraire le rank (textuel) - optionnel
  let keywordRank: string | undefined;
  
  // 1️⃣ Détecter les mots-clés de rank en priorité BASSE (SR numérique prioritaire)
  
  // Champion
  if (contentLower.includes("champ") || contentLower.includes("champion")) {
    keywordRank = "Champion";
  }
  // GM
  else if (
    contentLower.includes(" gm ") || 
    contentLower.includes(" gm\n") || 
    contentLower.includes("\ngm ") ||
    contentLower.match(/\bgm\b/i) ||
    contentLower.includes("grandmaster") || 
    contentLower.includes("grand master")
  ) {
    keywordRank = "GM";
  }
  // Master
  else if (
    contentLower.includes("master") || 
    contentLower.includes("masters") || 
    contentLower.includes("mast")
  ) {
    keywordRank = "Master";
  }
  // Diamant
  else if (
    contentLower.includes("dia") || 
    contentLower.includes("diam") || 
    contentLower.includes("diamant") || 
    contentLower.includes("diamond")
  ) {
    keywordRank = "Diamant";
  }
  // Platine
  else if (
    contentLower.includes("plat") || 
    contentLower.includes("platine") || 
    contentLower.includes("platin") || 
    contentLower.includes("platinum")
  ) {
    keywordRank = "Platine";
  }
  
  // ⏸️ Le mapping SR → Rank sera fait APRÈS l'extraction du SR numérique
  
  // Extraire le SR (numérique) - optionnel
  let rankSR: string | undefined;
  
  // 🔍 DEBUG: Logger le contenu pour analyse SR
  console.log(`🔍 Parser - Analyzing SR in message:`, content.substring(0, 150));
  
  // Pattern 1: Plage avec slash ou tiret (4.4/4.5k, 4.4-5k, 2.8/3k)
  const rangePattern1 = /\b([1-5])\.([0-9])[\/\-]([1-5])\.?([0-9])?k\b/i;
  const rangeMatch1 = content.match(rangePattern1);
  
  if (rangeMatch1) {
    // Extraire le SR le plus bas (premier nombre)
    const lowSR = `${rangeMatch1[1]}.${rangeMatch1[2]}`;
    rankSR = `${lowSR}k`;
    console.log(`✅ Pattern 1 matched: ${rankSR}`);
  } else {
    console.log(`❌ Pattern 1 (plage avec point) no match`);
    
    // Pattern 2: Format abrégé (3k4/5 signifie 3.4k à 3.5k)
    // CORRECTION : Vérifier que le chiffre après le tiret n'est PAS le début d'une heure (7-23)
    const rangePattern2 = /\b([1-5])k([0-9])[\\/\-]([0-9])(?!\d)/i;
    const rangeMatch2 = content.match(rangePattern2);
    
    if (rangeMatch2) {
      // Vérifier que le dernier chiffre n'est pas le début d'une heure
      const lastDigit = parseInt(rangeMatch2[3]);
      // Si c'est 1 ou 2, vérifier le contexte pour éviter de capturer 4K2-21
      const nextChar = content.charAt(rangeMatch2.index + rangeMatch2[0].length);
      
      // Si le chiffre suivant est aussi un chiffre (ex: 4K2-21), ignorer ce match
      if (!/\d/.test(nextChar)) {
        // Le SR le plus bas est le premier chiffre après le k
        const baseK = rangeMatch2[1];
        const lowDecimal = rangeMatch2[2];
        rankSR = `${baseK}.${lowDecimal}k`;
        console.log(`✅ Pattern 2 matched: ${rankSR}`);
      } else {
        console.log(`❌ Pattern 2 rejected: chiffre suivi d'un autre chiffre (probablement une heure)`);
      }
    }
    
    if (!rankSR) {
      console.log(`❌ Pattern 2 (plage abrégée) no match`);
      
      // Pattern 3: Format compact sans point (4K4 → 4.4k, 3K5 → 3.5k)
      // CORRECTION : Ne pas utiliser \b après k car ça ne fonctionne pas avec les majuscules (4K2)
      const compactPattern = /([1-5])k([0-9])(?=\s|$|[^0-9a-z])/i;
      const compactMatch = content.match(compactPattern);
      
      if (compactMatch) {
        // 4K4 devient 4.4k
        rankSR = `${compactMatch[1]}.${compactMatch[2]}k`;
        console.log(`✅ Pattern 3 (compact) matched: ${rankSR} from "${compactMatch[0]}"`);
      } else {
        console.log(`❌ Pattern 3 (compact 4K4) no match`);
        
        // Pattern 3.5: Format avec + (4.5+, 3.5+) - Nouveau pattern pour détecter X.X+
        const plusPattern = /([1-5])\.([0-9])\+(?=\s|$|[^0-9])/i;
        const plusMatch = content.match(plusPattern);
        
        if (plusMatch) {
          rankSR = `${plusMatch[1]}.${plusMatch[2]}k`;
          console.log(`✅ Pattern 3.5 (plus) matched: ${rankSR} from "${plusMatch[0]}"`);
        } else {
          console.log(`❌ Pattern 3.5 (plus) no match`);
          
          // Pattern 4: Format simple (3k, 3.5k)
          const simplePattern = /\b([1-5])\.?([0-9])?k\b/i;
          const simpleMatch = content.match(simplePattern);
          
          if (simpleMatch) {
            const decimal = simpleMatch[2] || "0";
            rankSR = `${simpleMatch[1]}.${decimal}k`;
            console.log(`✅ Pattern 4 matched: ${rankSR}`);
          } else {
            console.log(`❌ Pattern 4 (simple) no match`);
            
            // Pattern 5: Format XXXX (2500, 3000, 3500)
            const numericPattern = /\b([1-5])([0-9]{2})0\b/;
            const numericMatch = content.match(numericPattern);
            
            if (numericMatch) {
              const srValue = parseInt(numericMatch[1] + numericMatch[2] + "00");
              rankSR = `${(srValue / 1000).toFixed(1)}k`;
              console.log(`✅ Pattern 5 matched: ${rankSR}`);
            } else {
              console.log(`❌ Pattern 5 (numérique) no match`);
            }
          }
        }
      }
    }
  }
  
  console.log(`🔍 Final rankSR: ${rankSR || 'UNDEFINED'}`);

  // 2️⃣ Mapper le SR numérique vers un rank (PRIORITÉ HAUTE)
  let rank: string | undefined;
  
  if (rankSR) {
    // Convertir rankSR en nombre (ex: "3.2k" → 3200)
    const srValue = parseFloat(rankSR.replace("k", "")) * 1000;
    
    if (srValue >= 4500) {
      rank = "Champion";
    } else if (srValue >= 4000) {
      rank = "GM";
    } else if (srValue >= 3500) {
      rank = "Master";
    } else if (srValue >= 3000) {
      rank = "Diamant";
    } else if (srValue >= 2500) {
      rank = "Platine";
    }
    
    console.log(`🏆 Rank from SR (${rankSR} → ${srValue}): ${rank || 'UNDEFINED'}`);
  }
  
  // 3️⃣ Fallback : Si pas de SR numérique, utiliser le mot-clé
  if (!rank && keywordRank) {
    rank = keywordRank;
    console.log(`🏆 Rank from keyword: ${rank}`);
  }
  
  // 4️⃣ Si toujours pas de rank, laisser vide (catégorie "Autre")
  if (!rank) {
    console.log(`🏆 No rank detected - will be categorized as "Autre"`);
  }

  // Extraire la disponibilité (jour) - optionnel
  let availability_day: string | undefined;
  if (
    contentLower.includes("today") ||
    contentLower.includes("tonight") ||
    contentLower.includes("tn") ||
    contentLower.includes("ce soir") ||
    contentLower.includes("aujourd'hui") ||
    contentLower.includes("asap") ||
    contentLower.includes("now") ||
    contentLower.includes("urgent")
  ) {
    availability_day = "Aujourd'hui";
  } else if (
    contentLower.includes("tomorrow") ||
    contentLower.includes("demain") ||
    contentLower.includes("tmr") ||
    contentLower.includes("tmrw")
  ) {
    availability_day = "Demain";
  } else {
    // Chercher des jours spécifiques
    const dayPatterns = [
      { pattern: /\b(monday|lundi|mon)\b/i, day: "Lundi" },
      { pattern: /\b(tuesday|mardi|tue)\b/i, day: "Mardi" },
      { pattern: /\b(wednesday|mercredi|wed)\b/i, day: "Mercredi" },
      { pattern: /\b(thursday|jeudi|thu)\b/i, day: "Jeudi" },
      { pattern: /\b(friday|vendredi|fri)\b/i, day: "Vendredi" },
      { pattern: /\b(saturday|samedi|sat)\b/i, day: "Samedi" },
      { pattern: /\b(sunday|dimanche|sun)\b/i, day: "Dimanche" },
    ];

    for (const { pattern, day } of dayPatterns) {
      if (pattern.test(contentLower)) {
        availability_day = day;
        break;
      }
    }
  }

  // Si aucun jour n'est mentionné, mettre automatiquement "Aujourd'hui"
  if (!availability_day) {
    availability_day = "Aujourd'hui";
  }

  // Extraire les horaires (format HH:MM-HH:MM ou HH-HH ou HHhMM)
  let time_start: string | undefined;
  let time_end: string | undefined;

  // PRIORITÉ 1 : Chercher d'abord les formats AM/PM (10-12PM, 10-12AM, 10PM-12AM)
  if (!time_start || !time_end) {
    const timeAMPMPattern = /\b(\d{1,2})(?::(\d{2}))?\s*(?:[-–—]|to)\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i;
    const timeAMPMMatch = content.match(timeAMPMPattern);

    if (timeAMPMMatch) {
      let startHour = parseInt(timeAMPMMatch[1]);
      const startMin = timeAMPMMatch[2] || "00";
      let endHour = parseInt(timeAMPMMatch[3]);
      const endMin = timeAMPMMatch[4] || "00";
      const period = timeAMPMMatch[5].toUpperCase();

      // Convertir AM/PM en format 24h
      // Logique : "10-12PM" signifie "10PM-12AM" (22:00-00:00)
      if (period === "PM") {
        // Pour PM : ajouter 12 si < 12
        if (startHour < 12) startHour += 12;
        // Si endHour === 12, c'est probablement 12AM (minuit), pas 12PM (midi)
        if (endHour === 12) {
          endHour = 0; // Minuit
        } else {
          endHour += 12;
        }
      } else if (period === "AM") {
        // Pour AM : 12AM = minuit (0h), autres heures restent identiques
        if (startHour === 12) startHour = 0;
        if (endHour === 12) endHour = 0;
      }

      // Validation
      if (startHour >= 0 && startHour <= 23 && endHour >= 0 && endHour <= 23) {
        time_start = `${startHour.toString().padStart(2, "0")}:${startMin}`;
        time_end = `${endHour.toString().padStart(2, "0")}:${endMin}`;
        console.log(`⏰ Time pattern AM/PM matched: ${time_start}-${time_end}`);
      }
    }
  }

  // PRIORITÉ 2 : Chercher les patterns avec "h" (21h-23h, 21h/23h)
  if (!time_start || !time_end) {
    const timeWithHPattern =
      /\b(\d{1,2})h(\d{2})?[\/\s-]*(?:to|à|[-–—\/])[\/\s-]*(\d{1,2})h(\d{2})?\b/i;
    const timeWithHMatch = content.match(timeWithHPattern);

    if (timeWithHMatch) {
      const startHour = parseInt(timeWithHMatch[1]);
      const startMin = timeWithHMatch[2] || "00";
      const endHour = parseInt(timeWithHMatch[3]);
      const endMin = timeWithHMatch[4] || "00";

      // Validation : vérifier que les heures sont dans une plage valide (0-23)
      if (startHour >= 0 && startHour <= 23 && endHour >= 0 && endHour <= 23) {
        time_start = `${startHour.toString().padStart(2, "0")}:${startMin}`;
        time_end = `${endHour.toString().padStart(2, "0")}:${endMin}`;
        console.log(`⏰ Time pattern WITH h matched: ${time_start}-${time_end}`);
      }
    }
  }

  // PRIORITÉ 3 : Si pas trouvé, chercher les patterns avec ":" (HH:MM-HH:MM)
  if (!time_start || !time_end) {
    const timeWithColonPattern =
      /\b(\d{1,2}):(\d{2})[\s-]*(?:to|à|[-–—])[\s-]*(\d{1,2}):(\d{2})\b/i;
    const timeWithColonMatch = content.match(timeWithColonPattern);

    if (timeWithColonMatch) {
      const startHour = parseInt(timeWithColonMatch[1]);
      const startMin = timeWithColonMatch[2];
      const endHour = parseInt(timeWithColonMatch[3]);
      const endMin = timeWithColonMatch[4];

      if (startHour >= 0 && startHour <= 23 && endHour >= 0 && endHour <= 23) {
        time_start = `${startHour.toString().padStart(2, "0")}:${startMin}`;
        time_end = `${endHour.toString().padStart(2, "0")}:${endMin}`;
        console.log(`⏰ Time pattern WITH colon matched: ${time_start}-${time_end}`);
      }
    }
  }

  // PRIORITÉ 4 : Si toujours pas trouvé, chercher HH-HH (mais seulement pour heures >= 7 pour éviter SR)
  if (!time_start || !time_end) {
    // CORRECTION : Ne pas consommer les tirets avant le groupe de séparateurs
    const timeSimplePattern =
      /\b(\d{1,2})\s*(?:to|à|[-–—])\s*(\d{1,2})\b/gi;
    const matches = content.matchAll(timeSimplePattern);

    for (const match of matches) {
      const startHour = parseInt(match[1]);
      const endHour = parseInt(match[2]);

      // Validation stricte : heures entre 7 et 23 pour éviter de capturer les SR (ex: 3-3)
      if (startHour >= 7 && startHour <= 23 && endHour >= 7 && endHour <= 23) {
        time_start = `${startHour.toString().padStart(2, "0")}:00`;
        time_end = `${endHour.toString().padStart(2, "0")}:00`;
        console.log(`⏰ Time pattern SIMPLE matched: ${time_start}-${time_end}`);
        break;
      }
    }
  }

  // Fallback : Heure unique (ne sera pas accepté car time_end manquant)
  if (!time_start && !time_end) {
    const singleTimePattern = /\b(\d{1,2})(?:[h:](\d{2}))?\b/i;
    const singleTimeMatch = content.match(singleTimePattern);

    if (singleTimeMatch) {
      const hour = parseInt(singleTimeMatch[1]);
      const min = singleTimeMatch[2] || "00";

      // Vérifier que l'heure est valide (0-23)
      if (hour >= 0 && hour <= 23) {
        time_start = `${hour.toString().padStart(2, "0")}:${min}`;
      }
    }
  }

  // Extraire le fuseau horaire - optionnel
  let timezone: string | undefined;
  const timezonePatterns = [
    { pattern: /\b(cet)\b/i, tz: "CET" },
    { pattern: /\b(cest)\b/i, tz: "CEST" },
    { pattern: /\b(est)\b/i, tz: "EST" },
    { pattern: /\b(bst)\b/i, tz: "BST" },
  ];

  for (const { pattern, tz } of timezonePatterns) {
    if (pattern.test(content)) {
      timezone = tz;
      break;
    }
  }

  // ✅ FALLBACK RÉGION : Si la région n'est pas dans le message, chercher dans le nom du salon
  if (!region && channelName) {
    const channelNameLower = channelName.toLowerCase();
    console.log(`🔍 Region not found in message, checking channel name: "${channelName}"`);
    
    if (channelNameLower.includes("eu") || channelNameLower.includes("europe")) {
      region = "EU";
      console.log(`✅ Region detected from channel name: EU`);
    } else if (
      channelNameLower.includes("na") ||
      channelNameLower.includes("us") ||
      channelNameLower.includes("americas") ||
      channelNameLower.includes("north-america") ||
      channelNameLower.includes("northamerica")
    ) {
      region = "NA";
      console.log(`✅ Region detected from channel name: NA`);
    } else if (
      channelNameLower.includes("apac") ||
      channelNameLower.includes("asia") ||
      channelNameLower.includes("oceania") ||
      channelNameLower.includes("oce")
    ) {
      region = "APAC";
      console.log(`✅ Region detected from channel name: APAC`);
    } else if (
      channelNameLower.includes("sa") ||
      channelNameLower.includes("south-america") ||
      channelNameLower.includes("southamerica") ||
      channelNameLower.includes("latam")
    ) {
      region = "SA";
      console.log(`✅ Region detected from channel name: SA`);
    } else {
      console.log(`❌ No region detected in channel name`);
    }
  }

  // ✅ FALLBACK PLATEFORME : Si la plateforme n'est pas dans le message, chercher dans le nom du salon
  if (!platform && channelName) {
    const channelNameLower = channelName.toLowerCase();
    console.log(`🔍 Platform not found in message, checking channel name: "${channelName}"`);
    
    if (channelNameLower.includes("pc")) {
      platform = "PC";
      console.log(`✅ Platform detected from channel name: PC`);
    } else if (channelNameLower.includes("console")) {
      platform = "Console";
      console.log(`✅ Platform detected from channel name: Console`);
    } else {
      console.log(`❌ No platform detected in channel name`);
    }
  }

  // Créer l'objet scrim - TOUS les champs sont maintenant optionnels
  const scrim: ParsedScrim = {
    lfs_type,
    region: region || "", // Peut être vide
    platform: platform || "", // ✅ Vide par défaut (pas d'hypothèse)
    rankSR: rankSR || "", // Peut être vide
    time_start: time_start || "", // Peut être vide
    time_end: time_end || "", // Peut être vide
    discord_message_url: messageUrl,
    author_discord_id: authorId,
    author_discord_username: authorUsername,
    author_discord_display_name: authorDisplayName,
    timestamp_created: timestamp,
    channel_name: channelName,
    channel_id: channelId,
  };

  // Ajouter les champs optionnels s'ils existent
  if (rank) scrim.rank = rank;
  if (availability_day) scrim.availability_day = availability_day;
  if (timezone) scrim.timezone = timezone;

  return scrim;
}

/**
 * Vérifie si un message contient des mots-clés LFS
 */
export function isLfsMessage(content: string): boolean {
  const contentLower = content.toLowerCase();
  const lfsKeywords = [
    "lfs",
    "lf ",
    "lfw",
    "lf warm up",
    "looking for",
    "scrim",
    "warmup",
    "warm up",
  ];

  return lfsKeywords.some((keyword) => contentLower.includes(keyword));
}