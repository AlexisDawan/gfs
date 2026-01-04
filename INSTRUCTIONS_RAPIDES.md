# 🚀 Instructions Rapides - Configuration des Cron Jobs

## ✅ Ce qui a été fait

1. ✅ **Nettoyage automatique supprimé du code backend** → Plus de surcharge
2. ✅ **Polling frontend désactivé** → Économie de ressources
3. ✅ **Documentation complète créée** pour configurer pg_cron

---

## 📝 Prochaines étapes (à faire maintenant)

### 1️⃣ Configurer le Cron de Nettoyage Quotidien (00h00)

**Fichier** : `/SETUP_CLEANUP_CRON.md`

**Actions** :
1. Ouvre le **SQL Editor** de Supabase
2. Copie-colle le SQL du fichier `/SETUP_CLEANUP_CRON.md`
3. Exécute le SQL
4. Vérifie que le cron est actif :
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'cleanup-old-scrims-daily';
   ```

**Résultat** :
- ✅ Les scrims de +7 jours seront supprimés **automatiquement tous les jours à 00h00**

---

### 2️⃣ (Optionnel) Configurer le Cron de Sync Incrémentale (5 min)

**Fichier** : `/SETUP_CRON.md`

**Actions** :
1. Ouvre le **SQL Editor** de Supabase
2. Copie-colle le SQL du fichier `/SETUP_CRON.md`
3. **REMPLACE** `YOUR_PROJECT_ID` et `YOUR_ANON_KEY` par tes vraies valeurs
4. Exécute le SQL
5. Vérifie que le cron est actif :
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'incremental-sync-job';
   ```

**Résultat** :
- ✅ La sync Discord se fera **automatiquement toutes les 5 minutes**
- ✅ Le frontend n'aura plus besoin de faire de polling

---

## 🎯 Recommandation

**Commence par l'étape 1️⃣ (nettoyage quotidien)** → C'est le plus important pour éviter la surcharge de la base de données !

L'étape 2️⃣ est optionnelle si tu veux aussi automatiser la sync Discord.

---

## 🔍 Vérifier que tout fonctionne

### Voir tous les cron jobs actifs

```sql
SELECT * FROM cron.job;
```

### Voir l'historique des exécutions (dernières 10)

```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### Tester manuellement le nettoyage

```sql
-- Voir combien de scrims seraient supprimés (sans les supprimer)
SELECT COUNT(*) AS scrims_to_delete
FROM scrims
WHERE created_at < NOW() - INTERVAL '7 days';

-- Tester la fonction de nettoyage
SELECT cleanup_old_scrims();
```

---

## ⚠️ Important

- Le cron s'exécute en **UTC** (pas en heure française)
- Si tu veux 00h00 heure française :
  - **Hiver (CET = UTC+1)** : utilise `0 23 * * *` (23h00 UTC = 00h00 CET)
  - **Été (CEST = UTC+2)** : utilise `0 22 * * *` (22h00 UTC = 00h00 CEST)

---

## 📚 Documentation Complète

| Fichier | Description |
|---------|-------------|
| `/SETUP_CLEANUP_CRON.md` | ✅ **Configuration du nettoyage quotidien (PRIORITÉ)** |
| `/SETUP_CRON.md` | Configuration de la sync incrémentale (optionnel) |
| `/ARCHITECTURE_CRON.md` | Vue d'ensemble de l'architecture complète |

---

## 🎉 Une fois configuré

Le système sera **100% autonome** :
- ✅ Nettoyage automatique des vieux scrims (00h00)
- ✅ Sync automatique Discord (5 min) [si configuré]
- ✅ Aucune surcharge côté frontend ou backend
- ✅ Économie maximale de ressources

**C'est parti ! 🚀**
