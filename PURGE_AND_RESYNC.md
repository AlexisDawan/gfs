# 🧹 Purge complète et resynchronisation

## ⚠️ Problème identifié

La base de données contient des timestamps **impossibles** :
- Messages datés de **2025-09** et **2025-10** (dans le futur !)
- Messages datés de **2024-05** et **2024-06** (il y a 7-8 mois)

**Date actuelle : 3 janvier 2026**

Ces dates sont corrompues et empêchent le bon fonctionnement du cleanup automatique.

---

## ✅ Solution : Purge + Resync propre

### **Étape 1 : Purger TOUTES les données**

Dans le **SQL Editor** de Supabase :

```sql
-- Supprimer TOUS les scrims existants
DELETE FROM scrims;

-- Vérifier que la table est vide
SELECT COUNT(*) FROM scrims;
-- Résultat attendu : 0
```

---

### **Étape 2 : Vérifier que le cron est correct**

```sql
-- Vérifier le cron job
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-scrims';
```

Tu devrais voir dans la colonne `command` :
```
DELETE FROM scrims WHERE timestamp_created < NOW() - INTERVAL '7 days';
```

Si ce n'est PAS le cas, re-exécute les commandes de `/FIX_CRON_TIMESTAMP.md`.

---

### **Étape 3 : Resync propre depuis Discord (48h)**

Retourne sur l'interface GoForScrim et clique sur le bouton **"Sync 48h"**.

Cela va :
1. ✅ Récupérer les messages Discord des **48 dernières heures**
2. ✅ Parser uniquement les messages LFS valides
3. ✅ Insérer dans Postgres avec les **vrais timestamps Discord**
4. ✅ Ignorer les doublons automatiquement

---

### **Étape 4 : Vérifier les nouveaux timestamps**

Après la sync, vérifie que les dates sont cohérentes :

```sql
-- Voir les 10 scrims les plus récents
SELECT 
  id, 
  timestamp_created,
  lfs_type,
  region
FROM scrims
ORDER BY timestamp_created DESC
LIMIT 10;
```

Les dates devraient être **entre le 1er et 3 janvier 2026** (48 dernières heures).

---

### **Étape 5 : Tester le cleanup**

Clique sur le bouton **"Test Cleanup"** dans l'interface.

Résultat attendu :
```json
{
  "success": true,
  "deleted": 0,
  "message": "Successfully deleted 0 scrims older than 7 days"
}
```

**Pourquoi 0 ?** Parce que tous les scrims datent de moins de 48h, donc aucun n'a plus de 7 jours.

---

## 📊 Vérifications supplémentaires

### **Compter les scrims par jour**

```sql
SELECT 
  DATE(timestamp_created) as date,
  COUNT(*) as count
FROM scrims
GROUP BY DATE(timestamp_created)
ORDER BY date DESC;
```

Tu devrais voir uniquement :
- **2026-01-03** (aujourd'hui)
- **2026-01-02** (hier)
- **2026-01-01** (avant-hier)

---

### **Voir les plus anciens scrims**

```sql
SELECT 
  id,
  timestamp_created,
  lfs_type,
  message_content
FROM scrims
ORDER BY timestamp_created ASC
LIMIT 5;
```

Le plus ancien scrim devrait dater du **1er janvier 2026 après-midi** (il y a ~48h).

---

## 🎯 Résultat attendu

Après la purge + resync :

| Avant | Après |
|-------|-------|
| ❌ 183 scrims avec dates corrompues | ✅ ~50-100 scrims (48h de données) |
| ❌ Dates de 2024-05 à 2025-10 | ✅ Dates du 1-3 janvier 2026 |
| ❌ Cleanup ne fonctionne pas | ✅ Cleanup fonctionne (0 supprimé car tout récent) |

---

## 🚀 Commandes rapides

```sql
-- 1. Purger tout
DELETE FROM scrims;

-- 2. Vérifier que c'est vide
SELECT COUNT(*) FROM scrims;

-- 3. Vérifier le cron
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'cleanup-old-scrims';
```

Puis clique sur **"Sync 48h"** dans l'interface.

---

## ❓ FAQ

### **Pourquoi les dates étaient corrompues ?**

Probablement des **données de test** insérées manuellement ou un bug lors d'une sync précédente.

### **Est-ce que je perds des données importantes ?**

Non. Les scrims Discord datent de maximum 48h, donc purger et resync ne change rien.

### **Et si j'ai besoin de plus de 48h de données ?**

Après la purge, tu peux changer le bouton pour sync 7 jours en modifiant `fortyEightHoursAgo` en `sevenDaysAgo` dans le backend.
