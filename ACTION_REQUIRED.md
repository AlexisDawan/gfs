# ⚠️ ACTIONS REQUISES - Corrections Critiques

## 🚨 Problèmes identifiés

### **1. Cron Job utilise le mauvais champ** ❌
- **Problème** : Le cron `pg_cron` utilise `created_at` au lieu de `timestamp_created`
- **Impact** : Les scrims ne sont JAMAIS supprimés (même après 7 jours)
- **Raison** : `created_at` = date d'insertion en DB (toujours récent), `timestamp_created` = date du message Discord (peut être ancien)

### **2. KV Store est obsolète mais reste présent** ⚠️
- **Problème** : Le code contient encore des références au KV Store
- **Impact** : Aucun (le KV Store n'est plus utilisé en pratique)
- **Raison** : Migration vers Postgres complétée mais fichiers legacy protégés

---

## ✅ CORRECTIONS APPLIQUÉES (Backend)

### **1️⃣ Cleanup Postgres corrigé**
- ✅ Fichier `/supabase/functions/server/postgres_client.tsx` mis à jour
- ✅ Fonction `cleanupOldScrims()` utilise maintenant `timestamp_created`
- ✅ Endpoint `/scrims/cleanup` fonctionne correctement

### **2️⃣ Documentation mise à jour**
- ✅ `/SETUP_CLEANUP_CRON.md` - Instructions SQL corrigées
- ✅ `/FIX_CRON_TIMESTAMP.md` - Guide de correction du cron existant
- ✅ `/KV_STORE_STATUS.md` - Explication du statut du KV Store

---

## 🔧 ACTIONS À FAIRE MANUELLEMENT (Supabase)

### **⚡ URGENT : Corriger le cron job dans Supabase**

Ouvre le **SQL Editor** dans Supabase et exécute ces 3 commandes :

#### **Étape 1 : Supprimer l'ancien cron**
```sql
SELECT cron.unschedule('cleanup-old-scrims');
```

#### **Étape 2 : Créer le nouveau cron (CORRIGÉ)**
```sql
SELECT cron.schedule(
  'cleanup-old-scrims',
  '0 0 * * *',
  $$
  DELETE FROM scrims
  WHERE timestamp_created < NOW() - INTERVAL '7 days';
  $$
);
```

#### **Étape 3 : Vérifier**
```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-scrims';
```

Tu devrais voir dans `command` :
```
DELETE FROM scrims WHERE timestamp_created < NOW() - INTERVAL '7 days';
```

---

## 🧪 TESTER LE CLEANUP

### **Option 1 : Bouton dans l'interface** (recommandé)
1. Ouvre l'application GoForScrim
2. Clique sur le bouton **"Test Cleanup"** (rouge)
3. Vérifie le nombre de scrims supprimés

### **Option 2 : SQL direct**
```sql
-- Voir combien de scrims seront supprimés
SELECT COUNT(*) FROM scrims 
WHERE timestamp_created < NOW() - INTERVAL '7 days';

-- Supprimer et afficher les IDs
DELETE FROM scrims
WHERE timestamp_created < NOW() - INTERVAL '7 days'
RETURNING id, timestamp_created;
```

---

## 📊 VÉRIFIER LA DIFFÉRENCE

### **Avant la correction** ❌
```sql
-- Ancien cron (created_at)
SELECT COUNT(*) FROM scrims WHERE created_at < NOW() - INTERVAL '7 days';
-- Résultat : 0 (tous les scrims ont été insérés récemment)
```

### **Après la correction** ✅
```sql
-- Nouveau cron (timestamp_created)
SELECT COUNT(*) FROM scrims WHERE timestamp_created < NOW() - INTERVAL '7 days';
-- Résultat : X scrims (messages Discord de plus de 7 jours)
```

---

## 🎯 Résumé des changements

| Composant | Avant | Après | Statut |
|-----------|-------|-------|--------|
| **Backend cleanup** | ❌ `created_at` | ✅ `timestamp_created` | ✅ Corrigé |
| **Cron pg_cron** | ❌ `created_at` | ⏳ À corriger manuellement | ⚠️ ACTION REQUISE |
| **KV Store** | ⚠️ Partiellement utilisé | ✅ Complètement obsolète | ✅ Clarifié |
| **Sync 48h** | ❌ 24h | ✅ 48h | ✅ Corrigé |

---

## ✅ CHECKLIST

- [x] Backend corrigé (`postgres_client.tsx`)
- [x] Documentation mise à jour
- [x] Bouton "Test Cleanup" dans l'interface
- [x] Sync 48h au lieu de 24h
- [ ] **Cron pg_cron à corriger dans Supabase** ⚠️ **TOI**

---

## 🚀 Prochaines étapes

1. **MAINTENANT** : Corriger le cron dans Supabase (3 commandes SQL ci-dessus)
2. **TESTER** : Bouton "Test Cleanup" pour vérifier que ça fonctionne
3. **VÉRIFIER** : Dans 24h, vérifier que le cron automatique a bien supprimé les vieux scrims

---

## 📞 Support

Si le cleanup ne fonctionne toujours pas après la correction :
1. Vérifie les logs dans Supabase Dashboard > Database > Logs
2. Vérifie `cron.job_run_details` pour voir les exécutions
3. Vérifie que `pg_cron` est bien activé : `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
