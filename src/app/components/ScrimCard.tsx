import { memo } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { MessageCircle, ExternalLink, Clock } from "lucide-react";

interface Scrim {
  id: number;
  lfs_type: string; // ✅ Peut être "scrim", "warmup", ou vide (pour "Autre")
  region: string; // Peut être vide
  platform: "PC" | "Console"; // Peut être vide
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
}

interface ScrimCardProps {
  scrim: Scrim;
  getRankColor: (rank: string) => string;
  isNew?: boolean; // ✅ NOUVEAU : Pour afficher le badge "NEW"
}

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins}min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Il y a ${diffDays}j`;
};

// Fonction pour formater l'heure au format 24h (HH:MM) et convertir les heures anglaises en heures FR
const formatTime24h = (time?: string) => {
  if (!time) return null;
  
  // Si l'heure est déjà au format HH:MM, extraire les heures et minutes
  const parts = time.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || '00'; // Si pas de minutes, utiliser '00'
  
  // NE PLUS CONVERTIR : Le parser renvoie déjà les heures en format 24h correct
  // Retourner directement au format HH:MM
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
};

export function ScrimCard({ scrim, getRankColor, isNew }: ScrimCardProps) {
  // Construire le nom d'affichage (priorité : display_name > username > id)
  const authorName = scrim.author_discord_display_name || scrim.author_discord_username || scrim.author_discord_id;
  
  // ✅ Fonction pour dériver le rank du SR (identique à celle de ScrimSearchPage)
  const getRankFromSR = (rankSR?: string): string | null => {
    if (!rankSR) return null;
    
    const sr = rankSR.toLowerCase().replace(/k/g, '').replace(/\+/g, '');
    const numSR = parseFloat(sr);
    
    if ((numSR >= 2.5 && numSR < 3) || ['2.5', '2.6', '2.7', '2.8', '2.9'].includes(sr)) {
      return "Platine";
    }
    if ((numSR >= 3 && numSR < 3.5) || ['3', '3.1', '3.2', '3.3', '3.4'].includes(sr)) {
      return "Diamant";
    }
    if ((numSR >= 3.5 && numSR < 4) || ['3.5', '3.6', '3.7', '3.8', '3.9'].includes(sr)) {
      return "Master";
    }
    if ((numSR >= 4 && numSR < 4.5) || ['4', '4.1', '4.2', '4.3', '4.4'].includes(sr) || rankSR.toLowerCase().includes('open')) {
      return "GM";
    }
    if (numSR >= 4.5 || ['4.5'].includes(sr) || 
        rankSR.toLowerCase().includes('advanced') || 
        rankSR.toLowerCase().includes('expert') || 
        rankSR.toLowerCase().includes('master') || 
        rankSR.toLowerCase().includes('owcs')) {
      return "Champion";
    }
    
    return null;
  };
  
  // Récupérer le rank (priorité : champ rank, sinon dérivé du rankSR)
  const displayRank = scrim.rank || getRankFromSR(scrim.rankSR);

  // Transformer availability_day en affichage français (afficher "Aujourd'hui" si absent)
  const dayDisplay = scrim.availability_day
    ? scrim.availability_day === "today"
      ? "Aujourd'hui"
      : scrim.availability_day === "tonight"
      ? "Ce soir"
      : scrim.availability_day === "tomorrow"
      ? "Demain"
      : scrim.availability_day === "asap"
      ? "ASAP"
      : scrim.availability_day
    : "Aujourd'hui"; // Par défaut si pas de jour spécifié
    
  const timeDisplay = scrim.time_start && scrim.time_end
    ? `${formatTime24h(scrim.time_start)}-${formatTime24h(scrim.time_end)}`
    : "N/A";
    
  // Fonction pour ouvrir le DM Discord
  const openDiscordDM = () => {
    if (scrim.author_discord_id) {
      // ✅ Deep link Discord pour ouvrir l'app au lieu du navigateur
      const discordAppLink = `discord://discord.com/users/${scrim.author_discord_id}`;
      window.location.href = discordAppLink;
      
      // Fallback vers le web si l'app n'est pas installée (après 1 seconde)
      setTimeout(() => {
        window.open(`https://discord.com/users/${scrim.author_discord_id}`, '_blank');
      }, 1000);
    }
  };
  
  // ✅ Fonction pour ouvrir le message Discord dans l'app
  const openDiscordMessage = () => {
    if (scrim.discord_message_url) {
      // Extraire guild_id, channel_id, message_id de l'URL
      const urlMatch = scrim.discord_message_url.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
      
      if (urlMatch) {
        const [, guildId, channelId, messageId] = urlMatch;
        // ✅ Deep link Discord pour ouvrir l'app
        const discordAppLink = `discord://discord.com/channels/${guildId}/${channelId}/${messageId}`;
        window.location.href = discordAppLink;
        
        // Fallback vers le web si l'app n'est pas installée (après 1 seconde)
        setTimeout(() => {
          window.open(scrim.discord_message_url, '_blank');
        }, 1000);
      } else {
        // Si le format ne correspond pas, ouvrir le lien web directement
        window.open(scrim.discord_message_url, '_blank');
      }
    }
  };

  // ✅ Déterminer le texte à afficher pour le type de scrim
  const getTypeDisplay = () => {
    if (scrim.lfs_type === "scrim") return "SCRIM";
    if (scrim.lfs_type === "warmup") return "WARMUP";
    // Si lfs_type est vide ou autre chose, afficher "AUTRE"
    return "AUTRE";
  };

  return (
    <Card className="bg-[#0d1b2a] border-[#00d4ff]/20 hover:border-[#00d4ff] transition-colors duration-200 h-full flex flex-col">
      <CardContent className="p-6 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-white/70 flex-wrap">
              <span className="text-white font-semibold">
                {getTypeDisplay()}
              </span>
              <span className="text-white/40">•</span>
              <span>{scrim.region || "N/A"}</span>
              <span className="text-white/40">•</span>
              <span>{scrim.platform || "N/A"}</span>
              {scrim.rankSR && (
                <>
                  <span className="text-white/40">•</span>
                  <span>{scrim.rankSR}</span>
                </>
              )}
            </div>
            {/* Afficher le tag Discord de l'auteur */}
            {authorName && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-white/40 text-sm">Par</span>
                <span className="text-[#00d4ff] text-sm font-medium">@{authorName}</span>
              </div>
            )}
          </div>
          {scrim.timestamp_created && (
            <span className="text-white/40 text-xs whitespace-nowrap ml-2">
              {formatTimestamp(scrim.timestamp_created)}
            </span>
          )}
        </div>

        {/* Informations */}
        <div className="space-y-2 mb-4 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-white/60">Jour</span>
            <span className="text-white">{dayDisplay}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/60">Horaire</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-white/60" />
              <span className="text-white">{timeDisplay}</span>
            </div>
          </div>
          {scrim.timezone && (
            <div className="flex items-center justify-between">
              <span className="text-white/60">Fuseau</span>
              <span className="text-white">{scrim.timezone}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {scrim.discord_message_url && (
            <Button 
              className="w-full bg-[#6c63ff] hover:bg-[#6c63ff]/80 text-white border-0"
              onClick={openDiscordMessage}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Voir sur Discord
            </Button>
          )}
          {scrim.author_discord_id && (
            <Button 
              variant="outline" 
              className="w-full border-[#00d4ff] text-[#00d4ff] hover:bg-[#00d4ff] hover:text-[#0a0e27]"
              onClick={openDiscordDM}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Message privé
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ✅ Export par défaut
export default memo(ScrimCard);