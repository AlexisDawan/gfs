import { useState, useMemo, useEffect, useCallback, useTransition } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { ScrimCard } from "./ScrimCard";
import { AdCard } from "./AdCard";
import { SkeletonLoader } from "./SkeletonLoader";
import { Filter, RotateCcw, X, ChevronUp, ChevronDown, RefreshCw, Trash2, ArrowUp } from "lucide-react";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { supabase } from "../../../utils/supabase/client";
import { motion, AnimatePresence } from "motion/react";

interface Scrim {
  id: number | string;
  lfs_type: string; // ✅ Peut être "scrim", "warmup", ou vide (pour "Autre")
  region: string; // Peut être vide
  platform: string; // Peut être vide ou par défaut
  rankSR: string; // Peut être vide
  time_start: string; // Peut être vide
  time_end: string; // Peut être vide
  rank?: string;
  availability_day?: "today" | string;
  timezone?: string;
  discord_message_url?: string;
  author_discord_id?: string;
  author_discord_username?: string;
  author_discord_display_name?: string;
  timestamp_created?: string;
  channel_name?: string; // ✅ Nouveau : nom du salon Discord
  channel_id?: string; // ✅ Nouveau : ID du salon Discord
}

export function ScrimSearchPage() {
  // États des filtres
  const [selectedType, setSelectedType] = useState<string>("Tous");
  const [selectedRegion, setSelectedRegion] = useState<string>("Tous"); // ✅ Changé de tableau à string
  const [selectedPlatform, setSelectedPlatform] = useState<string>("Tous"); // ✅ Défaut "all" au lieu de "PC"
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("Tous");
  const [selectedTimezones, setSelectedTimezones] = useState<string[]>([]);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showDesktopFilters, setShowDesktopFilters] = useState(false); // ✅ Masqués par défaut

  // ✅ PAGINATION : Limiter l'affichage à 30 scrims par page
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  // États pour les données réelles
  const [scrims, setScrims] = useState<Scrim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSkeletons, setShowSkeletons] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  // ✅ NOUVEAU : État pour la sync manuelle
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");

  // ✅ NOUVEAU : État pour le cleanup
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState<string>("");

  // ✅ État pour le bouton "Scroll to Top"
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ✅ Hook pour tracker le scroll et afficher/masquer le bouton
  useEffect(() => {
    const handleScroll = () => {
      // Afficher le bouton si on a scrollé de plus de 400px
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ✅ Fonction pour remonter en haut de la page
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Récupérer les scrims depuis l'API
  useEffect(() => {
    let isInitialLoad = true;

    // ✅ WARMUP : Appeler régulièrement pour garder le backend chaud
    const keepBackendWarm = () => {
      fetch(`https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/warmup`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      }).catch(() => {}); // Ignorer les erreurs silencieusement
    };

    // Appeler immédiatement
    keepBackendWarm();

    // Puis toutes les 5 minutes
    const warmupInterval = setInterval(keepBackendWarm, 300000); // 5 minutes

    const fetchScrims = async () => {
      try {
        // ✅ CHARGEMENT IMMÉDIAT : Afficher les scrims existants en premier
        if (isInitialLoad) {
          setIsLoading(true);
          
          // 1️⃣ Charger les scrims immédiatement (sans attendre le resync)
          try {
            console.log("🔄 Fetching scrims from backend...");
            
            // ✅ FALLBACK POSTGRES : Si backend timeout, lire directement depuis Postgres
            const fetchWithFallback = async () => {
              try {
                // Essayer d'abord le backend Edge Function
                const response = await fetch(
                  `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims`,
                  {
                    headers: {
                      Authorization: `Bearer ${publicAnonKey}`,
                    },
                    signal: AbortSignal.timeout(60000), // ✅ 60 secondes (augmenté de 30s)
                  }
                );

                if (!response.ok) {
                  throw new Error(`Backend returned ${response.status}`);
                }

                const data = await response.json();
                return data.scrims || [];
              } catch (backendError: any) {
                console.warn("⚠️ Backend timeout ou erreur, fallback vers Postgres direct:", backendError.message);
                
                // ✅ FALLBACK : Lire directement depuis Postgres
                console.log("🔄 Reading directly from Postgres...");
                const { data: pgData, error: pgError } = await supabase
                  .from('scrims')
                  .select('*')
                  .order('created_at', { ascending: false })
                  .limit(1000);

                if (pgError) {
                  console.error("❌ Postgres direct read failed:", pgError);
                  throw new Error(`Backend et Postgres ont échoué: ${pgError.message}`);
                }

                console.log("✅ Scrims loaded from Postgres directly:", pgData?.length || 0);
                
                // Mapper les données Postgres au format attendu
                return (pgData || []).map((row: any) => ({
                  id: row.id,
                  lfs_type: row.lfs_type || '',
                  region: row.region || '',
                  platform: row.platform || '',
                  rankSR: row.rank_sr || '',
                  time_start: row.time_start || '',
                  time_end: row.time_end || '',
                  discord_message_url: row.discord_message_url,
                  author_discord_id: row.author_discord_id,
                  author_discord_username: row.author_username,
                  timestamp_created: row.timestamp_created,
                  channel_name: row.channel_name,
                  channel_id: row.channel_id,
                }));
              }
            };

            const scrimsData = await fetchWithFallback();
            
            // ✅ DÉLAI MINIMUM pour montrer les skeletons (meilleure UX)
            await new Promise(resolve => setTimeout(resolve, 800)); // 800ms minimum
            
            setScrims(scrimsData);
            setError(null);
            setIsLoading(false);
            
            // ✅ Fade out progressif des skeletons avant d'afficher les vrais scrims
            setTimeout(() => {
              setShowSkeletons(false);
            }, 200);

            console.log("✅ Scrims chargés:", scrimsData.length);
          } catch (err: any) {
            console.error("❌ Error fetching initial scrims:", err);
            
            // Message d'erreur plus détaillé
            let errorMessage = "Impossible de charger les scrims. ";
            
            if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
              errorMessage += "Le serveur backend est inaccessible. Veuillez vérifier que:\n" +
                "1. Les Edge Functions Supabase sont déployées\n" +
                "2. Les variables d'environnement DISCORD_USER_TOKEN sont configurées\n" +
                "3. Votre connexion internet fonctionne correctement";
            } else if (err.message) {
              errorMessage += err.message;
            } else {
              errorMessage += "Erreur réseau inconnue";
            }
            
            setError(errorMessage);
            setIsLoading(false);
            setShowSkeletons(false);
            return;
          }
          
          // ✅ Scrims chargés avec succès - La sync automatique se fera toutes les 5 minutes
          isInitialLoad = false;
        } else {
          // POLLING NORMAL : Recharger simplement les scrims (la sync auto se fait)
          const dataResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims`,
            {
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
              },
              signal: AbortSignal.timeout(30000),
            }
          );

          if (!dataResponse.ok) {
            throw new Error(`HTTP error! status: ${dataResponse.status}`);
          }

          const data = await dataResponse.json();
          setScrims(data.scrims || []);
          setError(null);
        }
      } catch (err) {
        console.error("Error fetching scrims:", err);
        setError("Erreur lors du chargement des scrims");
        setIsLoading(false);
        setShowSkeletons(false);
      }
    };

    fetchScrims();

    // ✅ NETTOYAGE : Désactiver le polling automatique car pg_cron s'en charge
    // Le cron Supabase sync les scrims toutes les 5 minutes automatiquement
    // Pas besoin de polling côté frontend = économie de ressources !

    return () => {
      // Cleanup si nécessaire
    };
  }, [lastSyncTime]);

  const ranks = [
    { label: "Platine", range: "2.5k – 2.9k", color: "bg-cyan-500" },
    { label: "Diamant", range: "3k – 3.4k", color: "bg-blue-500" },
    { label: "Master", range: "3.5k - 3.9k", color: "bg-[#6BD36B]" },
    { label: "GM", range: "4k - 4.4k", color: "bg-[#D6649C]" },
    { label: "Champion", range: "4.5k+", color: "bg-[#A77BFF]" },
    { label: "Advanced", range: "texte-only", color: "bg-yellow-500" },
  ];

  const toggleMultiSelect = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  // Fonction pour réinitialiser tous les filtres
  const resetFilters = () => {
    setSelectedType("Tous");
    setSelectedRegion("Tous");
    setSelectedPlatform("Tous"); // ✅ Reset à "all"
    setSelectedRanks([]);
    setSelectedTimeSlot("Tous");
    setSelectedTimezones([]);
  };
  
  // Fonction pour forcer une resync manuelle
  const handleManualResync = async () => {
    setIsSyncing(true);
    setSyncStatus("En cours...");
    try {
      const resyncResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims/force-resync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (resyncResponse.ok) {
        const resyncResult = await resyncResponse.json();
        console.log("✅ Manual Force Resync complete:", resyncResult);
        
        // Recharger les scrims après le resync
        const updatedResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
          }
        );
        
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json();
          setScrims(updatedData.scrims || []);
          console.log("✅ Scrims reloaded after manual resync:", updatedData.scrims?.length || 0);
        }
      }
    } catch (err) {
      console.error("❌ Manual resync error:", err);
      setSyncStatus("Erreur");
    } finally {
      setIsSyncing(false);
    }
  };

  // ✅ Fonction pour forcer une sync complète des 7 derniers jours
  const handleFullSync7Days = async () => {
    setIsSyncing(true);
    setSyncStatus("Initialisation...");
    
    try {
      console.log("🔄 Starting full 48h sync...");
      
      let batchIndex = 0;
      let hasMore = true;
      let totalAddedAll = 0;
      let totalSkippedAll = 0;
      let totalErrorsAll = 0;
      let totalFetchedAll = 0;
      let totalParsedAll = 0;
      
      // Appeler l'endpoint par batch jusqu'à ce qu'il n'y ait plus de channels à traiter
      while (hasMore) {
        setSyncStatus(`Batch ${batchIndex + 1} en cours...`);
        
        const syncResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims/sync-full-7days`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              batchSize: 5,
              batchIndex,
            }),
          }
        );
        
        if (!syncResponse.ok) {
          throw new Error(`Sync failed: ${syncResponse.status}`);
        }
        
        const syncResult = await syncResponse.json();
        console.log(`✅ Batch ${batchIndex + 1} complete:`, syncResult);
        
        totalFetchedAll += syncResult.fetched || 0;
        totalParsedAll += syncResult.parsed || 0;
        totalAddedAll += syncResult.added || 0;
        totalSkippedAll += syncResult.skipped || 0;
        totalErrorsAll += syncResult.errors || 0;
        
        hasMore = syncResult.hasMore;
        batchIndex++;
        
        // Mettre à jour le status avec le progrès détaillé
        setSyncStatus(
          `Batch ${batchIndex}/${Math.ceil(syncResult.totalChannels / 5)} - ${totalFetchedAll} msg récupérés, ${totalParsedAll} LFS parsés, ${totalAddedAll} ajoutés`
        );
        
        // Petit délai entre les batchs
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log(`✅ Full sync complete: ${totalFetchedAll} fetched, ${totalParsedAll} parsed, ${totalAddedAll} added, ${totalSkippedAll} skipped, ${totalErrorsAll} errors`);
      
      setSyncStatus(`✅ ${totalAddedAll} scrims ajoutés (${totalParsedAll} LFS parsés sur ${totalFetchedAll} messages)`);
      
      // Recharger les scrims après la sync
      const updatedResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (updatedResponse.ok) {
        const updatedData = await updatedResponse.json();
        setScrims(updatedData.scrims || []);
        console.log("✅ Scrims reloaded after sync:", updatedData.scrims?.length || 0);
      }
      
      // Réinitialiser le message après 5 secondes
      setTimeout(() => {
        setSyncStatus("");
      }, 5000);
      
    } catch (err) {
      console.error("❌ Full sync error:", err);
      setSyncStatus("❌ Erreur lors de la sync");
      
      setTimeout(() => {
        setSyncStatus("");
      }, 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // ✅ CONSOLE : Exposer la fonction sync dans la console pour debug
  useEffect(() => {
    (window as any).syncScrims = handleFullSync7Days;
    return () => {
      delete (window as any).syncScrims;
    };
  }, []);

  // 🧹 Fonction pour tester le nettoyage des scrims > 7 jours
  const handleCleanup = async () => {
    setIsCleaningUp(true);
    setCleanupStatus("Nettoyage en cours...");
    
    try {
      console.log("🧹 Starting cleanup...");
      
      const cleanupResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims/cleanup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (!cleanupResponse.ok) {
        throw new Error(`Cleanup failed: ${cleanupResponse.status}`);
      }
      
      const cleanupResult = await cleanupResponse.json();
      console.log("✅ Cleanup complete:", cleanupResult);
      
      setCleanupStatus(`✅ ${cleanupResult.deleted} scrim(s) supprimé(s)`);
      
      // Recharger les scrims après le nettoyage
      const updatedResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (updatedResponse.ok) {
        const updatedData = await updatedResponse.json();
        setScrims(updatedData.scrims || []);
        console.log("✅ Scrims reloaded after cleanup:", updatedData.scrims?.length || 0);
      }
      
      // Réinitialiser le message après 5 secondes
      setTimeout(() => {
        setCleanupStatus("");
      }, 5000);
      
    } catch (err) {
      console.error("❌ Cleanup error:", err);
      setCleanupStatus("❌ Erreur lors du nettoyage");
      
      setTimeout(() => {
        setCleanupStatus("");
      }, 3000);
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Listes des valeurs prédéfinies pour détecter "Autre"
  const DEFINED_TIMEZONES = ["CET", "CEST", "EST", "BST"];
  
  // Créneaux horaires prédéfinis
  const TIME_SLOTS = [
    { id: "20-22", label: "20:00-22:00", start: "20:00", end: "22:00" },
    { id: "21-23", label: "21:00-23:00", start: "21:00", end: "23:00" },
  ];

  // Fonction pour déterminer le rank à partir du rankSR
  const getRankFromSR = (rankSR?: string): string | null => {
    if (!rankSR) return null;
    
    const sr = rankSR.toLowerCase().replace(/k/g, '').replace(/\\+/g, '');
    const numSR = parseFloat(sr);
    
    // Platine: 2.5, 2.6, 2.7, 2.8, 2.9
    if ((numSR >= 2.5 && numSR < 3) || ['2.5', '2.6', '2.7', '2.8', '2.9'].includes(sr)) {
      return "Platine";
    }
    
    // Diamant: 3, 3.1, 3.2, 3.3, 3.4
    if ((numSR >= 3 && numSR < 3.5) || ['3', '3.1', '3.2', '3.3', '3.4'].includes(sr)) {
      return "Diamant";
    }
    
    // Master: 3.5, 3.6, 3.7, 3.8, 3.9
    if ((numSR >= 3.5 && numSR < 4) || ['3.5', '3.6', '3.7', '3.8', '3.9'].includes(sr)) {
      return "Master";
    }
    
    // GM: 4, 4.1, 4.2, 4.3, 4.4, 4+ ou "open"
    if ((numSR >= 4 && numSR < 4.5) || ['4', '4.1', '4.2', '4.3', '4.4'].includes(sr) || rankSR.toLowerCase().includes('open')) {
      return "GM";
    }
    
    // Champion: 4.5+, ou advanced, expert, master, owcs
    if (numSR >= 4.5 || ['4.5'].includes(sr) || 
        rankSR.toLowerCase().includes('advanced') || 
        rankSR.toLowerCase().includes('expert') || 
        rankSR.toLowerCase().includes('master') || 
        rankSR.toLowerCase().includes('owcs')) {
      return "Champion";
    }
    
    return null;
  };

  // Fonction pour vérifier si un temps est dans un créneau horaire (ÉGALITÉ STRICTE)
  const isTimeInSlot = (timeStart: string, timeEnd: string, slotStart: string, slotEnd: string): boolean => {
    // ✅ STRICTE : Les horaires doivent correspondre EXACTEMENT au créneau
    // Normaliser les formats pour la comparaison (ex: "20:00" vs "20:0")
    const normalizeTime = (time: string) => {
      const [hour, minute] = time.split(':');
      return `${hour.padStart(2, '0')}:${(minute || '00').padStart(2, '0')}`;
    };

    const normalizedStart = normalizeTime(timeStart);
    const normalizedEnd = normalizeTime(timeEnd);
    const normalizedSlotStart = normalizeTime(slotStart);
    const normalizedSlotEnd = normalizeTime(slotEnd);

    // Retourner true UNIQUEMENT si les horaires correspondent EXACTEMENT
    return normalizedStart === normalizedSlotStart && normalizedEnd === normalizedSlotEnd;
  };

  // Filtrer les scrims selon les critères sélectionnés
  const filteredScrims = useMemo(() => {
    return scrims.filter((scrim) => {
      // ✅ NOUVEAU : Exclure les messages sans lfs_type
      if (!scrim.lfs_type || scrim.lfs_type.trim() === '') {
        return false;
      }

      // Filtre Type
      if (selectedType !== "Tous") {
        const scrimType = scrim.lfs_type?.toLowerCase() || "";
        if (selectedType === "Scrim" && scrimType !== "scrim") return false;
        if (selectedType === "Warmup" && scrimType !== "warmup") return false;
        if (selectedType === "Autre" && scrimType !== "" && scrimType !== "scrim" && scrimType !== "warmup") return false;
      }

      // ✅ FILTRE PAR RÉGION (choix unique)
      if (selectedRegion !== "Tous") {
        if (selectedRegion === "EU") {
          // Afficher uniquement les scrims EU
          if (scrim.region !== "EU") return false;
        } else if (selectedRegion === "NA") {
          // Afficher uniquement les scrims NA
          if (scrim.region !== "NA") return false;
        } else if (selectedRegion === "Autre") {
          // Afficher uniquement les scrims qui ne sont NI EU NI NA
          if (scrim.region === "EU" || scrim.region === "NA") return false;
        }
      }

      // ✅ FILTRE PAR PLATEFORME (choix unique)
      if (selectedPlatform !== "Tous") {
        if (selectedPlatform === "PC") {
          // Afficher uniquement les scrims PC
          if (scrim.platform !== "PC") return false;
        } else if (selectedPlatform === "Console") {
          // Afficher uniquement les scrims Console
          if (scrim.platform !== "Console") return false;
        } else if (selectedPlatform === "Autre") {
          // Afficher uniquement les scrims qui ne sont NI PC NI Console (plateforme vide/non spécifiée)
          if (scrim.platform === "PC" || scrim.platform === "Console") return false;
        }
      }

      // ✅ FILTRE PAR FUSEAU HORAIRE (multi-sélection inclusive avec "Autre")
      if (selectedTimezones.length > 0) {
        const hasAutre = selectedTimezones.includes("Autre");
        const definedTimezones = selectedTimezones.filter(tz => tz !== "Autre");
        
        // Si "Autre" est sélectionné
        if (hasAutre) {
          // Accepter si :
          // 1. Le fuseau est dans la sélection (hors "Autre")
          // 2. OU le fuseau est vide/undefined
          // 3. OU le fuseau n'est pas dans DEFINED_TIMEZONES
          const hasMatchingTimezone = definedTimezones.length > 0 && scrim.timezone && definedTimezones.includes(scrim.timezone);
          const hasNoTimezone = !scrim.timezone || scrim.timezone === "";
          const hasNonDefinedTimezone = scrim.timezone && !DEFINED_TIMEZONES.includes(scrim.timezone);
          
          if (!hasMatchingTimezone && !hasNoTimezone && !hasNonDefinedTimezone) {
            return false;
          }
        } else {
          // Si "Autre" n'est PAS sélectionné, accepter uniquement les scrims avec un fuseau dans la sélection
          if (!scrim.timezone || !definedTimezones.includes(scrim.timezone)) {
            return false;
          }
        }
      }

      // ✅ FILTRE PAR HORAIRE (choix unique avec inclusion totale)
      if (selectedTimeSlot !== "Tous") {
        // Vérifier si le scrim a des horaires
        const hasTimeStart = scrim.time_start && scrim.time_start !== "";
        const hasTimeEnd = scrim.time_end && scrim.time_end !== "";
        
        if (selectedTimeSlot === "Autre") {
          // Afficher les scrims SANS horaires OU avec des horaires non listés
          if (hasTimeStart && hasTimeEnd) {
            // Vérifier si les horaires correspondent à un créneau défini
            const matchesDefinedSlot = TIME_SLOTS.some(slot => {
              return isTimeInSlot(scrim.time_start, scrim.time_end, slot.start, slot.end);
            });
            
            // Si les horaires correspondent à un créneau défini, ne pas afficher
            if (matchesDefinedSlot) return false;
          }
          // Sinon, afficher (horaires vides ou non listés)
        } else {
          // Créneau spécifique sélectionné
          // Ne pas afficher si pas d'horaires
          if (!hasTimeStart || !hasTimeEnd) return false;
          
          // Trouver le créneau sélectionné
          const selectedSlot = TIME_SLOTS.find(slot => slot.id === selectedTimeSlot);
          if (!selectedSlot) return false;
          
          // Vérifier l'inclusion totale : time_start ET time_end doivent être dans le créneau
          if (!isTimeInSlot(scrim.time_start, scrim.time_end, selectedSlot.start, selectedSlot.end)) {
            return false;
          }
        }
      }

      // ✅ NOUVEAU : FILTRE PAR NIVEAU/RANK (multi-sélection inclusive avec "Autre")
      if (selectedRanks.length > 0) {
        const hasAutre = selectedRanks.includes("Autre");
        const definedRanks = selectedRanks.filter(r => r !== "Autre");
        
        // Récupérer le rank du scrim (priorité : champ rank, sinon dérivé du rankSR)
        const scrimRank = scrim.rank || getRankFromSR(scrim.rankSR);
        
        // Si "Autre" est sélectionné
        if (hasAutre) {
          // Accepter si :
          // 1. Le rank est dans la sélection (hors "Autre")
          // 2. OU le rank est vide/undefined
          // 3. OU le rank n'est pas dans la liste définie
          const hasMatchingRank = definedRanks.length > 0 && scrimRank && definedRanks.includes(scrimRank);
          const hasNoRank = !scrimRank || scrimRank === "";
          const hasNonDefinedRank = scrimRank && !["Platine", "Diamant", "Master", "GM", "Champion"].includes(scrimRank);
          
          if (!hasMatchingRank && !hasNoRank && !hasNonDefinedRank) {
            return false;
          }
        } else {
          // Si "Autre" n'est PAS sélectionné, accepter uniquement les scrims avec un rank dans la sélection (OR logic)
          if (!scrimRank || !definedRanks.includes(scrimRank)) {
            return false;
          }
        }
      }
      
      return true; // Accepter les scrims qui passent tous les filtres
    });
  }, [scrims, selectedType, selectedRegion, selectedPlatform, selectedRanks, selectedTimeSlot, selectedTimezones]);
  
  const getRankColor = (rank: string) => {
    const rankObj = ranks.find(r => r.label === rank);
    return rankObj?.color || "bg-gray-500";
  };

  const getRankColorMemo = useCallback(getRankColor, []);

  // ✅ Positions pour les publicités (première entre 10-15, puis toutes les 30 cartes)
  const adPositions = useMemo(() => {
    if (filteredScrims.length < 10) return [];
    
    const positions: number[] = [];
    const firstAdPosition = Math.floor(Math.random() * 6) + 10; // Entre 10 et 15
    positions.push(firstAdPosition);
    
    // Ajouter une pub toutes les 30 cartes après la première
    let nextPosition = firstAdPosition + 30;
    while (nextPosition < filteredScrims.length) {
      positions.push(nextPosition);
      nextPosition += 30;
    }
    
    return positions;
  }, [filteredScrims.length]);

  // ✅ Construire le tableau avec les pubs insérées
  const scrimsWithAd = useMemo(() => {
    const items: Array<{ type: 'scrim' | 'ad'; data?: Scrim; id: string }> = [];
    
    filteredScrims.forEach((scrim, index) => {
      items.push({ type: 'scrim', data: scrim, id: `scrim-${scrim.id}` });
      
      // Insérer une pub si la position actuelle est dans le tableau adPositions
      if (adPositions.includes(index)) {
        items.push({ type: 'ad', id: `ad-card-${index}` });
      }
    });
    
    return items;
  }, [filteredScrims, adPositions]);

  // Compter les filtres actifs
  const activeFiltersCount = 
    (selectedType !== "Tous" ? 1 : 0) +
    (selectedRegion !== "Tous" ? 1 : 0) +
    (selectedPlatform !== "Tous" ? 1 : 0) + // ✅ Compter seulement si différent de "all"
    selectedRanks.length +
    (selectedTimeSlot !== "Tous" ? 1 : 0) +
    selectedTimezones.length;

  // Composant de filtres réutilisable
  const FiltersContent = () => (
    <div className="space-y-6">
      {/* LIGNE 1: Type de scrim, Région, Plateforme - 3 colonnes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
        {/* Type de scrim */}
        <div className="space-y-2.5">
          <Label className="text-white text-sm font-medium">Type de scrim</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedType === "Tous" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType("Tous")}
              className={`
                h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                ${selectedType === "Tous" 
                  ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0" 
                  : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                }
              `}
            >
              Tous
            </Button>
            <Button
              variant={selectedType === "Scrim" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType("Scrim")}
              className={`
                h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                ${selectedType === "Scrim" 
                  ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0" 
                  : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                }
              `}
            >
              Scrim
            </Button>
            <Button
              variant={selectedType === "Warmup" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType("Warmup")}
              className={`
                h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                ${selectedType === "Warmup" 
                  ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0" 
                  : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                }
              `}
            >
              Warmup
            </Button>
          </div>
        </div>

        {/* Région - Pills multi-sélection */}
        <div className="space-y-2.5">
          <Label className="text-white text-sm font-medium">Région</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedRegion === "Tous" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedRegion("Tous")}
              className={`
                h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                ${selectedRegion === "Tous"
                  ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0"
                  : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                }
              `}
            >
              Tous
            </Button>
            {["EU", "NA", "Autre"].map((region) => (
              <Button
                key={region}
                variant={selectedRegion === region ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRegion(region)}
                className={`
                  h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                  ${selectedRegion === region
                    ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0"
                    : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                  }
                `}
              >
                {region}
              </Button>
            ))}
          </div>
        </div>

        {/* Plateforme - Pills */}
        <div className="space-y-2.5">
          <Label className="text-white text-sm font-medium">Plateforme</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedPlatform === "Tous" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPlatform("Tous")}
              className={`
                h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                ${selectedPlatform === "Tous"
                  ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0"
                  : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                }
              `}
            >
              Tous
            </Button>
            <Button
              variant={selectedPlatform === "PC" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPlatform("PC")}
              className={`
                h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                ${selectedPlatform === "PC"
                  ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0"
                  : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                }
              `}
            >
              PC
            </Button>
            <Button
              variant={selectedPlatform === "Console" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPlatform("Console")}
              className={`
                h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                ${selectedPlatform === "Console"
                  ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0"
                  : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                }
              `}
            >
              Console
            </Button>
            <Button
              variant={selectedPlatform === "Autre" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPlatform("Autre")}
              className={`
                h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                ${selectedPlatform === "Autre"
                  ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0"
                  : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                }
              `}
            >
              Autre
            </Button>
          </div>
        </div>
      </div>

      {/* LIGNE 2: Niveau/Rank, Fuseau horaire, Horaire - 3 colonnes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
        {/* Niveau / Rank - Checkboxes avec scroll */}
        <div className="space-y-2.5">
          <Label className="text-white text-sm font-medium">Niveau / Rank</Label>
          <div className="bg-[#0d1b2a] backdrop-blur-sm rounded-lg p-4 space-y-2.5 max-h-56 overflow-y-auto border border-white/10 hover:border-[#00d4ff]/30 transition-colors">
            {ranks.filter(rank => rank.label !== "Advanced").map((rank) => (
              <div 
                key={rank.label} 
                className="flex items-center space-x-3 group cursor-pointer hover:bg-white/5 p-1.5 -m-1.5 rounded-md transition-all"
                onClick={() => toggleMultiSelect(rank.label, setSelectedRanks)}
              >
                <Checkbox
                  id={`rank-${rank.label}`}
                  checked={selectedRanks.includes(rank.label)}
                  onCheckedChange={() => toggleMultiSelect(rank.label, setSelectedRanks)}
                  className="border-2 border-white/30 data-[state=checked]:bg-[#00d4ff] data-[state=checked]:border-[#00d4ff] w-4 h-4 transition-all group-hover:border-white/50 group-hover:scale-110"
                />
                <label
                  htmlFor={`rank-${rank.label}`}
                  className="text-xs text-white cursor-pointer flex items-center gap-2.5 flex-1"
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${rank.color} transition-transform group-hover:scale-125`}></span>
                  <span className="font-medium">{rank.label}</span>
                  <span className="text-white/40 text-[10px] ml-auto">{rank.range}</span>
                </label>
              </div>
            ))}
            <div 
              className="flex items-center space-x-3 group cursor-pointer hover:bg-white/5 p-1.5 -m-1.5 rounded-md transition-all"
              onClick={() => toggleMultiSelect("Autre", setSelectedRanks)}
            >
              <Checkbox
                id="rank-Autre"
                checked={selectedRanks.includes("Autre")}
                onCheckedChange={() => toggleMultiSelect("Autre", setSelectedRanks)}
                className="border-2 border-white/30 data-[state=checked]:bg-[#00d4ff] data-[state=checked]:border-[#00d4ff] w-4 h-4 transition-all group-hover:border-white/50 group-hover:scale-110"
              />
              <label
                htmlFor="rank-Autre"
                className="text-xs text-white cursor-pointer font-medium"
              >
                Autre
              </label>
            </div>
          </div>
        </div>

        {/* Fuseau horaire - Checkboxes */}
        <div className="space-y-2.5">
          <Label className="text-white text-sm font-medium">Fuseau horaire</Label>
          <div className="bg-[#0d1b2a] backdrop-blur-sm rounded-lg p-4 space-y-2.5 border border-white/10 hover:border-[#00d4ff]/30 transition-colors">
            {["CET", "CEST", "EST", "BST"].map((tz) => (
              <div 
                key={tz} 
                className="flex items-center space-x-3 group cursor-pointer hover:bg-white/5 p-1.5 -m-1.5 rounded-md transition-all"
                onClick={() => toggleMultiSelect(tz, setSelectedTimezones)}
              >
                <Checkbox
                  id={`tz-${tz}`}
                  checked={selectedTimezones.includes(tz)}
                  onCheckedChange={() => toggleMultiSelect(tz, setSelectedTimezones)}
                  className="border-2 border-white/30 data-[state=checked]:bg-[#00d4ff] data-[state=checked]:border-[#00d4ff] w-4 h-4 transition-all group-hover:border-white/50 group-hover:scale-110"
                />
                <label
                  htmlFor={`tz-${tz}`}
                  className="text-xs text-white cursor-pointer font-medium"
                >
                  {tz}
                </label>
              </div>
            ))}
            <div 
              className="flex items-center space-x-3 group cursor-pointer hover:bg-white/5 p-1.5 -m-1.5 rounded-md transition-all"
              onClick={() => toggleMultiSelect("Autre", setSelectedTimezones)}
            >
              <Checkbox
                id="tz-Autre"
                checked={selectedTimezones.includes("Autre")}
                onCheckedChange={() => toggleMultiSelect("Autre", setSelectedTimezones)}
                className="border-2 border-white/30 data-[state=checked]:bg-[#00d4ff] data-[state=checked]:border-[#00d4ff] w-4 h-4 transition-all group-hover:border-white/50 group-hover:scale-110"
              />
              <label
                htmlFor="tz-Autre"
                className="text-xs text-white cursor-pointer font-medium"
              >
                Autre
              </label>
            </div>
          </div>
        </div>

        {/* Horaire - Pills */}
        <div className="space-y-2.5">
          <Label className="text-white text-sm font-medium">Horaire</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedTimeSlot === "Tous" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTimeSlot("Tous")}
              className={`
                h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                ${selectedTimeSlot === "Tous"
                  ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0"
                  : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                }
              `}
            >
              Tous
            </Button>
            {TIME_SLOTS.map((slot) => (
              <Button
                key={slot.id}
                variant={selectedTimeSlot === slot.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTimeSlot(slot.id)}
                className={`
                  h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                  ${selectedTimeSlot === slot.id
                    ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0"
                    : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                  }
                `}
              >
                {slot.label}
              </Button>
            ))}
            <Button
              variant={selectedTimeSlot === "Autre" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTimeSlot("Autre")}
              className={`
                h-9 px-4 rounded-lg transition-all duration-200 text-sm font-medium
                ${selectedTimeSlot === "Autre"
                  ? "bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00b8e6] shadow-md shadow-[#00d4ff]/20 border-0"
                  : "bg-[#0d1b2a] text-white/90 border-white/20 hover:bg-[#00d4ff] hover:text-[#0a0e27] hover:border-[#00d4ff] hover:shadow-md hover:shadow-[#00d4ff]/20 hover:scale-105 active:scale-95"
                }
              `}
            >
              Autre
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0e27]">
      {/* Barre de filtres - Desktop */}
      <div className="hidden md:block bg-[#0d1b2a] shadow-lg border-b-2 border-[#00d4ff]/30 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header avec bouton toggle */}
          <div className="py-4 flex items-center justify-between">
            <Button
              onClick={() => setShowDesktopFilters(!showDesktopFilters)}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-[#00d4ff]/20 hover:text-[#00d4ff] transition-all font-medium"
            >
              {showDesktopFilters ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Masquer les filtres
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Afficher les filtres
                </>
              )}
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 bg-[#00d4ff] text-[#0a0e27]">{activeFiltersCount}</Badge>
              )}
            </Button>
            {activeFiltersCount > 0 && (
              <Button
                onClick={resetFilters}
                variant="outline"
                size="sm"
                className="border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff] hover:text-[#0a0e27] transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-2" />
                Réinitialiser
              </Button>
            )}
          </div>
          
          {/* Contenu des filtres (collapsible avec animation) */}
          {showDesktopFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pb-6">
                <FiltersContent />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Bouton toggle filtres - Mobile */}
      <div className="md:hidden sticky top-0 z-50 bg-[#0d1b2a] py-4 px-4 border-b-2 border-[#00d4ff]/30 flex items-center justify-between">
        <Button
          onClick={() => setShowFilterDrawer(!showFilterDrawer)}
          className="bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00d4ff]/80"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filtres
          {activeFiltersCount > 0 && (
            <Badge className="ml-2 bg-[#6c63ff] text-white">{activeFiltersCount}</Badge>
          )}
        </Button>
        {activeFiltersCount > 0 && (
          <Button
            onClick={resetFilters}
            variant="outline"
            size="sm"
            className="border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff] hover:text-[#0a0e27]"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Drawer mobile */}
      {showFilterDrawer && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setShowFilterDrawer(false)}>
          <div 
            className="absolute top-0 left-0 w-full max-w-md h-full bg-[#0d1b2a] shadow-2xl overflow-y-auto animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#0d1b2a] border-b-2 border-[#00d4ff]/30 p-4 flex items-center justify-between z-10">
              <h2 className="text-white text-xl font-semibold">Filtres</h2>
              <Button
                onClick={() => setShowFilterDrawer(false)}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-[#00d4ff]/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-4">
              <FiltersContent />
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={resetFilters}
                  variant="outline"
                  className="flex-1 border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff] hover:text-[#0a0e27]"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Réinitialiser
                </Button>
                <Button
                  onClick={() => setShowFilterDrawer(false)}
                  className="flex-1 bg-[#00d4ff] text-[#0a0e27] hover:bg-[#00d4ff]/80"
                >
                  Appliquer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Résultats avec animation fade-in */}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Compteur de résultats + Bouton Sync */}
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-white/70 text-lg">
              {filteredScrims.length} scrim{filteredScrims.length > 1 ? "s" : ""} trouvé{filteredScrims.length > 1 ? "s" : ""}
            </p>
            
            {/* ✅ Sync via console : syncScrims() */}
            {syncStatus && (
              <span className="text-sm text-[#00d4ff]">{syncStatus}</span>
            )}
          </div>

          {filteredScrims.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scrimsWithAd.map((item) => {
                if (item.type === 'scrim') {
                  return (
                    <div key={item.id} className="transition-opacity duration-200">
                      <ScrimCard scrim={item.data!} getRankColor={getRankColorMemo} />
                    </div>
                  );
                } else {
                  return (
                    <div key={item.id} className="transition-opacity duration-200">
                      <AdCard />
                    </div>
                  );
                }
              })}
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <p className="text-white/50 text-lg mb-8">Chargement des scrims...</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div 
                    key={i} 
                    className="animate-fadeIn opacity-0" 
                    style={{ 
                      animation: `fadeIn 0.4s ease-out ${i * 0.15}s forwards` 
                    }}
                  >
                    <SkeletonLoader />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 text-lg">{error}</p>
              <p className="text-white/50 text-sm mt-2">Assurez-vous que le bot Discord est configuré et en ligne</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-white/50 text-lg">Aucun scrim trouvé</p>
              <p className="text-white/30 text-sm mt-2">Les scrims apparaîtront ici dès qu'ils seront postés sur Discord</p>
            </div>
          )}
        </div>
      </div>

      {/* Styles pour l'animation fade-in */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Bouton "Scroll to Top" */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-8 right-8 z-50"
          >
            <Button
              onClick={scrollToTop}
              className="bg-gradient-to-r from-[#6c63ff] to-[#00d4ff] text-white hover:from-[#5a52e0] hover:to-[#00b8e6] rounded-full w-14 h-14 p-0 shadow-xl shadow-[#6c63ff]/30 hover:shadow-[#00d4ff]/50 transition-all duration-300 hover:scale-110 active:scale-95"
              aria-label="Retour en haut"
            >
              <ArrowUp className="w-6 h-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}