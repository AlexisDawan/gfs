# 🏗️ Architecture du Système de Sync et Nettoyage Automatique

## 📊 Vue d'ensemble

L'application GoForScrim utilise **pg_cron de Supabase** pour gérer automatiquement la synchronisation et le nettoyage des scrims, déchargeant complètement le frontend et optimisant les ressources.

---

## 🔄 Système de Synchronisation

### ⏰ Sync Incrémentale (toutes les 5 minutes)

**Fichier de configuration** : `/SETUP_CRON.md`

**Cron Pattern** : `*/5 * * * *` (toutes les 5 minutes)

**Endpoint appelé** : `/functions/v1/make-server-e52d06d3/scrims/sync-incremental`

**Fonction** :
- Parcourt les 17 salons Discord configurés
- Récupère uniquement les **nouveaux messages** (via `after=last_message_id`)
- Parse et stocke les scrims dans Postgres
- Met à jour `channel_sync_state` avec le dernier message ID

**Avantages** :
- ✅ Pas de polling côté frontend
- ✅ Consommation minimale de ressources
- ✅ Pas de rate limit Discord (uniquement les nouveaux messages)
- ✅ Déduplication automatique (via `content_hash`)

---

## 🧹 Système de Nettoyage

### ⏰ Nettoyage Quotidien (tous les jours à 00h00)

**Fichier de configuration** : `/SETUP_CLEANUP_CRON.md`

**Cron Pattern** : `0 0 * * *` (tous les jours à minuit UTC)

**Fonction SQL** : `cleanup_old_scrims()`

**Action** :
- Supprime les scrims avec `created_at < NOW() - INTERVAL '7 days'`
- Exécution **directe en SQL** (pas d'appel HTTP)
- Logs le nombre de scrims supprimés

**Avantages** :
- ✅ Exécution légère (SQL pur)
- ✅ Pas de charge sur le backend Edge Functions
- ✅ Gestion automatique de la rétention (7 jours)
- ✅ Une seule fois par jour (économie de ressources)

---

## 📁 Fichiers de Configuration

| Fichier | Description |
|---------|-------------|
| `/SETUP_CRON.md` | Configuration du cron de sync incrémentale (5 min) |
| `/SETUP_CLEANUP_CRON.md` | Configuration du cron de nettoyage quotidien (00h00) |
| `/ARCHITECTURE_CRON.md` | ✅ **Ce fichier** - Vue d'ensemble de l'architecture |

---

## 🚀 Workflow Complet

```
┌─────────────────────────────────────────────────────────────────┐
│                     WORKFLOW AUTOMATIQUE                        │
└─────────────────────────────────────────────────────────────────┘

🕐 Toutes les 5 minutes (pg_cron)
│
├─> Appel HTTP vers /scrims/sync-incremental
│   │
│   ├─> Pour chaque channel Discord :
│   │   ├─> Récupérer last_message_id depuis Postgres
│   │   ├─> Fetch nouveaux messages Discord (after=last_message_id)
│   │   ├─> Parser les messages (discord_parser.tsx)
│   │   ├─> Stocker dans Postgres (table scrims)
│   │   └─> Mettre à jour last_message_id (table channel_sync_state)
│   │
│   └─> Retour : { added, skipped, errors }

───────────────────────────────────────────────────────────────────

🕐 Tous les jours à 00h00 (pg_cron)
│
├─> Exécution SQL directe : cleanup_old_scrims()
│   │
│   ├─> DELETE FROM scrims WHERE created_at < NOW() - INTERVAL '7 days'
│   │
│   └─> Retour : Nombre de scrims supprimés

───────────────────────────────────────────────────────────────────

🌐 Frontend (ScrimSearchPage.tsx)
│
├─> Charge les scrims au démarrage (GET /scrims)
│
├─> Fallback Postgres si backend timeout
│   └─> Lecture directe depuis table scrims
│
└─> ✅ AUCUN POLLING (tout géré par pg_cron)
```

---

## 📊 Tables Postgres Utilisées

### 1. **scrims** (table principale)

Stocke tous les scrims avec déduplication automatique.

**Colonnes principales** :
- `id` : Primary key (auto-increment)
- `discord_message_id` : Unique ID Discord
- `content_hash` : Hash pour déduplication
- `lfs_type`, `region`, `platform`, `rank_sr`, etc.
- `created_at` : Timestamp de création (pour nettoyage)
- `posted_in_channels` : Array des salons où le message a été posté

**Index** :
- `discord_message_id` (UNIQUE)
- `created_at` (pour le nettoyage)

### 2. **channel_sync_state** (état de la sync)

Stocke le dernier message traité par channel.

**Colonnes** :
- `channel_id` : ID du salon Discord (UNIQUE)
- `channel_name` : Nom du salon
- `last_message_id` : Dernier message ID traité
- `last_sync_at` : Timestamp de la dernière sync

---

## ⚙️ Variables d'Environnement Requises

| Variable | Description |
|----------|-------------|
| `DISCORD_USER_TOKEN` | Token utilisateur Discord (pour l'API) |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_ANON_KEY` | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (backend uniquement) |

---

## 🎯 Avantages de cette Architecture

1. ✅ **Zero polling frontend** → Économie de ressources côté client
2. ✅ **Sync intelligente** → Uniquement les nouveaux messages
3. ✅ **Déduplication automatique** → Pas de doublons
4. ✅ **Nettoyage automatique** → Suppression des vieux scrims
5. ✅ **Scalabilité** → Peut gérer des centaines de salons Discord
6. ✅ **Résilience** → Fallback Postgres si backend timeout
7. ✅ **Économie Discord API** → Pas de rate limit

---

## 📝 Instructions de Déploiement

### 1. Configurer la Sync Incrémentale

```bash
# Exécuter le SQL dans /SETUP_CRON.md
# Remplacer YOUR_PROJECT_ID et YOUR_ANON_KEY
```

### 2. Configurer le Nettoyage Quotidien

```bash
# Exécuter le SQL dans /SETUP_CLEANUP_CRON.md
```

### 3. Vérifier les Cron Jobs

```sql
-- Voir tous les cron jobs actifs
SELECT * FROM cron.job;

-- Voir l'historique des exécutions
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

### 4. Tester Manuellement

```sql
-- Tester la sync incrémentale
SELECT trigger_incremental_sync();

-- Tester le nettoyage
SELECT cleanup_old_scrims();
```

---

## 🔧 Maintenance

### Modifier la Fréquence de Sync

```sql
-- Passer à 10 minutes
SELECT cron.unschedule('incremental-sync-job');
SELECT cron.schedule(
  'incremental-sync-job',
  '*/10 * * * *',
  $$SELECT trigger_incremental_sync()$$
);
```

### Modifier l'Heure de Nettoyage

```sql
-- Passer à 02h00 UTC
SELECT cron.unschedule('cleanup-old-scrims-daily');
SELECT cron.schedule(
  'cleanup-old-scrims-daily',
  '0 2 * * *',
  $$SELECT cleanup_old_scrims()$$
);
```

### Changer la Période de Rétention

```sql
-- Passer à 14 jours au lieu de 7
CREATE OR REPLACE FUNCTION cleanup_old_scrims()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
  cutoff_date timestamp;
BEGIN
  -- 14 jours au lieu de 7
  cutoff_date := NOW() - INTERVAL '14 days';
  
  DELETE FROM scrims WHERE created_at < cutoff_date;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '🧹 Cleanup completed: % scrims deleted', deleted_count;
END;
$$;
```

---

## 🛠️ Dépannage

### Le cron ne s'exécute pas

1. Vérifier que `pg_cron` est activé :
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Vérifier les logs :
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE status = 'failed' 
   ORDER BY start_time DESC;
   ```

### Sync trop lente

- Réduire le nombre de channels
- Augmenter l'intervalle (passer à 10 minutes)
- Vérifier les logs Edge Functions

### Trop de scrims supprimés

- Augmenter la période de rétention (14 jours au lieu de 7)
- Vérifier la timezone du cron (UTC vs locale)

---

## 🎉 Résultat Final

- ✅ Sync automatique toutes les 5 minutes
- ✅ Nettoyage automatique tous les jours à 00h00
- ✅ Aucune charge côté frontend
- ✅ Économie maximale de ressources
- ✅ Scalabilité garantie

**Le système est maintenant 100% autonome ! 🚀**
