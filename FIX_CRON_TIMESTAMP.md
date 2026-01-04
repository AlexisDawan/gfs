# 🔧 Correction du Cron Job - Utiliser timestamp_created

## ⚠️ Problème identifié

Le cron job actuel utilise `created_at` (date d'insertion en DB) au lieu de `timestamp_created` (date du message Discord).

**Résultat** : Les scrims ne sont jamais supprimés car `created_at` est toujours récent (date d'insertion), même si le message Discord date de plusieurs jours.

---

## ✅ Solution : Recréer le cron job avec timestamp_created

### **1️⃣ Supprimer l'ancien cron job**

Dans le **SQL Editor** de Supabase :

```sql
-- Supprimer l'ancien job qui utilisait created_at
SELECT cron.unschedule('cleanup-old-scrims');
```

---

### **2️⃣ Créer le nouveau cron job (CORRIGÉ)**

```sql
-- Créer le cron job CORRIGÉ avec timestamp_created
SELECT cron.schedule(
  'cleanup-old-scrims',
  '0 0 * * *',
  $$
  DELETE FROM scrims
  WHERE timestamp_created < NOW() - INTERVAL '7 days';
  $$
);
```

---

### **3️⃣ Vérifier que le nouveau cron est actif**

```sql
-- Vérifier que le job utilise bien timestamp_created
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-scrims';
```

Tu devrais voir dans la colonne `command` :
```
DELETE FROM scrims WHERE timestamp_created < NOW() - INTERVAL '7 days';
```

---

### **4️⃣ Tester immédiatement le nettoyage**

Pour supprimer les scrims de plus de 7 jours maintenant :

```sql
-- Test manuel du nettoyage
DELETE FROM scrims
WHERE timestamp_created < NOW() - INTERVAL '7 days'
RETURNING id, timestamp_created;
```

Ou utilise le bouton **"Test Cleanup"** dans l'interface.

---

## 📊 Vérifier la différence

### **Avant (created_at - INCORRECT)** ❌
```sql
-- Scrims qui seraient supprimés avec created_at
SELECT COUNT(*) FROM scrims WHERE created_at < NOW() - INTERVAL '7 days';
-- Résultat : 0 (car tous insérés récemment)
```

### **Après (timestamp_created - CORRECT)** ✅
```sql
-- Scrims qui seront supprimés avec timestamp_created
SELECT COUNT(*) FROM scrims WHERE timestamp_created < NOW() - INTERVAL '7 days';
-- Résultat : X scrims (messages Discord de plus de 7 jours)
```

---

## 🎯 Résumé

| Champ | Description | Utilisation |
|-------|-------------|-------------|
| `created_at` | Date d'insertion en DB (automatique) | ❌ Ne PAS utiliser pour le cleanup |
| `timestamp_created` | Date du message Discord original | ✅ Utiliser pour le cleanup |

**Pourquoi ?** Un message Discord posté il y a 5 jours mais inséré en DB aujourd'hui aurait :
- `timestamp_created` = il y a 5 jours ✅
- `created_at` = aujourd'hui ❌

Le cleanup doit se baser sur la **vraie date du message Discord**, pas la date d'insertion en DB.
