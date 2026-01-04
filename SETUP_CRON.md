# 🕐 Configuration du Cron Automatique pour GoForScrim

## 📝 Instructions

Exécute ce SQL dans le **SQL Editor** de Supabase pour configurer le cron automatique.

---

## ⚠️ IMPORTANT : Obtenir ton Project ID et Anon Key

Avant de commencer, récupère ces valeurs depuis ton dashboard Supabase :

1. **Project ID** : Va sur ton projet → Settings → General → Reference ID
2. **Anon Key** : Va sur ton projet → Settings → API → `anon` `public` key

Tu devras remplacer `YOUR_PROJECT_ID` et `YOUR_ANON_KEY` dans le SQL ci-dessous.

---

## 1️⃣ Activer les extensions nécessaires

```sql
-- Activer pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Activer pg_net pour les requêtes HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

## 2️⃣ Créer la fonction qui appelle la sync incrémentale

**⚠️ REMPLACE `YOUR_PROJECT_ID` et `YOUR_ANON_KEY` par tes vraies valeurs !**

```sql
-- Fonction pour appeler l'endpoint de sync incrémentale
CREATE OR REPLACE FUNCTION trigger_incremental_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://YOUR_PROJECT_ID.supabase.co';
  supabase_anon_key text := 'YOUR_ANON_KEY';
BEGIN
  -- Appeler l'endpoint de sync incrémentale via pg_net
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/make-server-e52d06d3/scrims/sync-incremental',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_anon_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000  -- 60 secondes de timeout
  ) INTO request_id;

  -- Logger le résultat
  RAISE NOTICE 'Sync incremental triggered: request_id=%', request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in trigger_incremental_sync: %', SQLERRM;
END;
$$;
```

---

## 3️⃣ Configurer le cron job (toutes les 5 minutes)

```sql
-- Supprimer le cron existant (si présent)
SELECT cron.unschedule('incremental-sync-job');

-- Créer un nouveau cron job qui s'exécute toutes les 5 minutes
SELECT cron.schedule(
  'incremental-sync-job',           -- Nom du job
  '*/5 * * * *',                    -- Toutes les 5 minutes
  $$SELECT trigger_incremental_sync()$$
);
```

---

## 4️⃣ Vérifier que le cron fonctionne

```sql
-- Voir tous les cron jobs actifs
SELECT * FROM cron.job;

-- Voir l'historique des exécutions (dernières 10)
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

---

## 5️⃣ Tester manuellement

```sql
-- Tester la fonction manuellement (devrait retourner "NOTICE: Sync incremental triggered")
SELECT trigger_incremental_sync();

-- Vérifier les logs de pg_net (pour voir si la requête HTTP a bien été envoyée)
SELECT * FROM net._http_response 
ORDER BY created DESC 
LIMIT 5;
```

---

## ⏱️ Fréquences possibles

Si tu veux changer la fréquence, modifie le cron pattern dans l'étape 3 :

| Fréquence | Cron Pattern | Description |
|-----------|--------------|-------------|
| **1 minute** | `* * * * *` | Très fréquent (peut causer rate limit Discord) |
| **5 minutes** | `*/5 * * * *` | ✅ **RECOMMANDÉ** - Bon équilibre |
| **10 minutes** | `*/10 * * * *` | Plus économe |
| **30 minutes** | `*/30 * * * *` | Moins fréquent |

---

## 🧹 Nettoyage automatique

Le nettoyage des scrims > 7 jours est **déjà intégré** dans la sync incrémentale, donc il se fera automatiquement toutes les 5 minutes ! ✅

---

## 🎯 Résultat final

- ✅ La sync incrémentale s'exécute **automatiquement toutes les 5 minutes**
- ✅ Le nettoyage des vieux scrims se fait **automatiquement**
- ✅ Le frontend n'a **plus besoin de faire du polling**
- ✅ **Économie de ressources** maximale !

---

## 🔧 Dépannage

### Si le cron ne fonctionne pas :

1. **Vérifier que les extensions sont activées** :
   ```sql
   SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
   ```

2. **Vérifier les erreurs dans les logs** :
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE status = 'failed' 
   ORDER BY start_time DESC;
   ```

3. **Tester manuellement la fonction** :
   ```sql
   SELECT trigger_incremental_sync();
   ```

4. **Vérifier que l'endpoint fonctionne** : Va dans Edge Functions logs et lance manuellement la fonction pour voir les erreurs.

---

## 🚀 Prochaine étape

Une fois le cron configuré, tu peux **supprimer le polling du frontend** pour décharger complètement le site !

