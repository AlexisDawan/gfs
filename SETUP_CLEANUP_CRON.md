# 🧹 Configuration du nettoyage automatique (pg_cron)

Ce guide explique comment configurer le nettoyage automatique des scrims de plus de 7 jours dans Supabase.

---

## 📋 Prérequis

1. **Accès au Dashboard Supabase** : https://supabase.com/dashboard
2. **Projet Supabase** : GoForScrim
3. **Extension `pg_cron`** : Doit être activée (généralement déjà activée par défaut)

---

## 🔧 Étapes de configuration

### 1️⃣ **Activer l'extension `pg_cron`**

Dans le **SQL Editor** de Supabase, exécuter :

```sql
-- Activer l'extension pg_cron (si pas déjà activée)
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

---

### 2️⃣ **Créer le job de nettoyage quotidien**

Dans le **SQL Editor**, exécuter la requête suivante pour créer un cron job qui s'exécute **tous les jours à 00h00 UTC** :

```sql
-- Créer un cron job pour nettoyer les scrims de plus de 7 jours
-- S'exécute tous les jours à 00h00 UTC
SELECT cron.schedule(
  'cleanup-old-scrims',        -- Nom du job
  '0 0 * * *',                 -- Cron expression (minuit tous les jours)
  $$
  DELETE FROM scrims
  WHERE timestamp_created < NOW() - INTERVAL '7 days';
  $$
);
```

**⚠️ IMPORTANT** : On utilise `timestamp_created` (date du message Discord) et non `created_at` (date d'insertion en DB).

---

### 3️⃣ **Vérifier que le cron job est bien créé**

```sql
-- Lister tous les cron jobs
SELECT * FROM cron.job;
```

Tu devrais voir une ligne avec :
- `jobname` = `cleanup-old-scrims`
- `schedule` = `0 0 * * *`
- `command` = `DELETE FROM scrims WHERE timestamp_created < NOW() - INTERVAL '7 days';`

---

### 4️⃣ **Tester le nettoyage manuellement**

Pour tester le nettoyage sans attendre minuit, tu peux :

#### **Option A : Appeler l'endpoint backend**

Depuis le frontend ou avec `curl` :

```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-e52d06d3/scrims/cleanup
```

#### **Option B : Exécuter la requête SQL directement**

```sql
-- Nettoyage manuel
DELETE FROM scrims
WHERE timestamp_created < NOW() - INTERVAL '7 days'
RETURNING id;
```

Cette requête retourne les IDs des scrims supprimés.

---

## 📊 **Vérifier les résultats**

### **Compter les scrims actuels**

```sql
-- Nombre total de scrims
SELECT COUNT(*) as total_scrims FROM scrims;

-- Nombre de scrims de moins de 7 jours
SELECT COUNT(*) as recent_scrims
FROM scrims
WHERE timestamp_created >= NOW() - INTERVAL '7 days';

-- Nombre de scrims de plus de 7 jours (à supprimer)
SELECT COUNT(*) as old_scrims
FROM scrims
WHERE timestamp_created < NOW() - INTERVAL '7 days';
```

### **Vérifier l'historique des exécutions du cron**

```sql
-- Historique des exécutions pg_cron (si disponible)
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-old-scrims')
ORDER BY start_time DESC
LIMIT 10;
```

---

## 🗑️ **Supprimer le cron job (si nécessaire)**

Si tu veux supprimer le cron job :

```sql
-- Supprimer le job de nettoyage
SELECT cron.unschedule('cleanup-old-scrims');
```

---

## ⚙️ **Modifier la fréquence du nettoyage**

### **Toutes les heures** :
```sql
SELECT cron.schedule(
  'cleanup-old-scrims',
  '0 * * * *',  -- Toutes les heures à la minute 0
  $$ DELETE FROM scrims WHERE timestamp_created < NOW() - INTERVAL '7 days'; $$
);
```

### **Tous les dimanches à 3h00** :
```sql
SELECT cron.schedule(
  'cleanup-old-scrims',
  '0 3 * * 0',  -- Dimanches à 3h00
  $$ DELETE FROM scrims WHERE timestamp_created < NOW() - INTERVAL '7 days'; $$
);
```

---

## 🔍 **Logs et monitoring**

Les logs des cron jobs sont disponibles dans :
- **Supabase Dashboard** > **Database** > **Logs**
- Rechercher `"cleanup-old-scrims"` dans les logs

---

## ✅ **Vérification finale**

1. ✅ Extension `pg_cron` activée
2. ✅ Cron job `cleanup-old-scrims` créé et visible dans `cron.job`
3. ✅ Test manuel effectué via endpoint `/scrims/cleanup`
4. ✅ Aucun scrim de plus de 7 jours restant en base

---

## 🚨 **Dépannage**

### **Le cron ne s'exécute pas**

1. Vérifier que `pg_cron` est activé :
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Vérifier que le job existe :
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'cleanup-old-scrims';
   ```

3. Vérifier les logs d'exécution :
   ```sql
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
   ```

### **Permissions insuffisantes**

Si tu as une erreur de permissions, exécute :

```sql
-- Donner les permissions nécessaires au rôle postgres
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
```

---

## 📚 **Ressources**

- [Documentation pg_cron](https://github.com/citusdata/pg_cron)
- [Supabase + pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Crontab Guru](https://crontab.guru/) - Pour comprendre les cron expressions