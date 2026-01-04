# 📚 GoForScrim - Guide des Commandes & Actions

## 🎮 Actions Utilisateur Interface

### 🔍 **Filtres de Recherche**
| Action | Description | Type |
|--------|-------------|------|
| **Type de scrim** | Filtrer par type (Tous / Scrim / Warmup) | Choix unique |
| **Région** | Filtrer par région (Tous / EU / NA / Autre) | Choix unique |
| **Plateforme** | Filtrer par plateforme (Tous / PC / Console / Autre) | Choix unique |
| **Niveau/Rank** | Filtrer par niveau (Platine, Diamant, Master, GM, Champion, Autre) | Multi-sélection |
| **Fuseau horaire** | Filtrer par timezone (CET, CEST, EST, BST, Autre) | Multi-sélection |
| **Horaire** | Filtrer par créneau (Tous / 20:00-22:00 / 21:00-23:00 / Autre) | Choix unique |

### 🎨 **Interactions UI**
| Action | Description |
|--------|-------------|
| **Afficher/Masquer filtres** (Desktop) | Toggle l'affichage de la barre de filtres |
| **Ouvrir drawer filtres** (Mobile) | Ouvre le panneau latéral de filtres |
| **Réinitialiser filtres** | Réinitialise tous les filtres à leurs valeurs par défaut |
| **Appliquer filtres** (Mobile) | Ferme le drawer et applique les filtres sélectionnés |
| **Scroll to Top** | Bouton flottant pour remonter en haut de la page (apparaît après 400px de scroll) |
| **Clic sur scrim** | Ouvre le lien Discord du message d'origine dans un nouvel onglet |

---

## 💻 Commandes Console (Dev)

### 🔄 **Synchronisation**
```javascript
// Force une synchronisation complète des scrims des 7 derniers jours (168h)
syncScrims()
```
**Description :**
- Récupère tous les messages "LFS" (Looking For Scrim) des 41 salons Discord suivis
- Traite les messages par batchs de 5 salons simultanément
- Parse les informations (type, région, plateforme, rank, horaires, timezone)
- Insère uniquement les nouveaux scrims (évite les doublons via `discord_message_id`)
- Affiche un statut en temps réel dans l'interface
- Recharge automatiquement la liste des scrims après la sync

**Utilisation :**
```javascript
// Ouvrir la console (F12) et taper :
syncScrims()
```

---

## 🚀 Commandes Utiles Recommandées

### 📊 **Analytics & Debug**

#### 1. **Compter les scrims par région**
```javascript
// Afficher la répartition des scrims par région
const countByRegion = {};
scrims.forEach(s => {
  const region = s.region || 'Unknown';
  countByRegion[region] = (countByRegion[region] || 0) + 1;
});
console.table(countByRegion);
```

#### 2. **Lister les scrims d'une plateforme spécifique**
```javascript
// Afficher tous les scrims PC
console.table(scrims.filter(s => s.platform === 'PC'));
```

#### 3. **Vérifier les scrims sans informations**
```javascript
// Trouver les scrims incomplets (sans région, plateforme ou rank)
const incomplete = scrims.filter(s => 
  !s.region || !s.platform || !s.rankSR
);
console.log(`${incomplete.length} scrims incomplets :`, incomplete);
```

#### 4. **Exporter les scrims en CSV**
```javascript
// Générer un CSV des scrims actuels
const csv = [
  'Type,Région,Plateforme,Rank,Horaires,Timezone,Auteur,Lien',
  ...scrims.map(s => 
    `${s.lfs_type},${s.region},${s.platform},${s.rankSR},"${s.time_start}-${s.time_end}",${s.timezone},${s.author_discord_username},${s.discord_message_url}`
  )
].join('\n');
console.log(csv);
// Copier le résultat et coller dans un fichier .csv
```

#### 5. **Trouver les scrims les plus récents**
```javascript
// Afficher les 10 scrims les plus récents
const recent = scrims
  .sort((a, b) => new Date(b.timestamp_created) - new Date(a.timestamp_created))
  .slice(0, 10);
console.table(recent);
```

---

### 🛠️ **Commandes Avancées Recommandées**

#### 6. **Clear la base de données locale**
```javascript
// ⚠️ ATTENTION : Efface TOUS les scrims de la DB
// Utiliser uniquement en dev/test
const clearAllScrims = async () => {
  const { projectId, publicAnonKey } = await import('./utils/supabase/info');
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims/cleanup`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}` }
    }
  );
  const result = await response.json();
  console.log(`✅ ${result.deleted} scrims supprimés`);
};
// Appel : clearAllScrims()
```

#### 7. **Tester le parser Discord**
```javascript
// Tester le parsing d'un message LFS personnalisé
const testParser = (message) => {
  console.log('Message original :', message);
  // Le parser est côté backend, cette commande permet de visualiser
  // Appeler ensuite syncScrims() pour voir le résultat
};
// Exemple :
testParser('LFS EU PC 3.5k+ 20:00-22:00 CET');
```

#### 8. **Monitoring des performances**
```javascript
// Mesurer le temps de chargement des scrims
const measureLoadTime = async () => {
  console.time('Load Scrims');
  const { projectId, publicAnonKey } = await import('./utils/supabase/info');
  await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims`,
    { headers: { Authorization: `Bearer ${publicAnonKey}` } }
  );
  console.timeEnd('Load Scrims');
};
// Appel : measureLoadTime()
```

#### 9. **Vider le cache et forcer un reload**
```javascript
// Force le rechargement de tous les scrims
location.reload();
```

#### 10. **Afficher les statistiques de filtrage**
```javascript
// Voir combien de scrims sont visibles vs cachés
const stats = {
  total: scrims.length,
  visible: filteredScrims.length,
  hidden: scrims.length - filteredScrims.length,
  percentage: ((filteredScrims.length / scrims.length) * 100).toFixed(2) + '%'
};
console.table(stats);
```

---

## 🔧 Commandes Backend (Optionnel)

### API Routes disponibles

| Route | Méthode | Description |
|-------|---------|-------------|
| `/scrims` | GET | Récupère tous les scrims stockés |
| `/scrims/sync-full-7days` | POST | Sync complète 168h (7 jours) |
| `/scrims/cleanup` | POST | Supprime les scrims > 7 jours |
| `/warmup` | GET | Warmup endpoint (garde le backend actif) |

### Exemples d'utilisation

#### Appel API direct avec `fetch`
```javascript
// Récupérer tous les scrims
const { projectId, publicAnonKey } = await import('./utils/supabase/info');
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims`,
  { headers: { Authorization: `Bearer ${publicAnonKey}` } }
);
const data = await response.json();
console.log(`${data.scrims.length} scrims récupérés`);
```

#### Tester le cleanup manuel
```javascript
// Forcer le nettoyage des vieux scrims
const { projectId, publicAnonKey } = await import('./utils/supabase/info');
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/scrims/cleanup`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${publicAnonKey}` }
  }
);
const result = await response.json();
console.log(`✅ ${result.deleted} scrims supprimés`);
```

---

## 🎯 Raccourcis Clavier Suggérés (À implémenter)

### Suggestions pour améliorer l'UX

| Raccourci | Action Suggérée | Priorité |
|-----------|-----------------|----------|
| `F` ou `/` | Focus sur la recherche/filtres | 🔥 Haute |
| `Ctrl+K` | Ouvrir la recherche rapide | 🔥 Haute |
| `Esc` | Fermer les modales/drawers | ⭐ Moyenne |
| `R` | Réinitialiser les filtres | ⭐ Moyenne |
| `S` | Lancer une sync manuelle | ⭐ Moyenne |
| `↑` ou `Home` | Scroll to top | 💡 Basse |
| `↓` ou `End` | Scroll to bottom | 💡 Basse |
| `1-3` | Sélectionner type (Scrim/Warmup/Autre) | 💡 Basse |

---

## 📋 Checklist des Fonctionnalités

### ✅ Implémenté
- [x] Filtres multi-critères (Type, Région, Plateforme, Rank, Timezone, Horaire)
- [x] Sync manuelle via console (`syncScrims()`)
- [x] Scroll to top automatique
- [x] Affichage responsive (Desktop + Mobile)
- [x] Drawer de filtres mobile
- [x] Compteur de résultats
- [x] Badge de filtres actifs
- [x] Skeleton loaders pendant le chargement
- [x] Fallback Postgres si Edge Function timeout
- [x] Warmup automatique toutes les 5 minutes
- [x] Cleanup automatique (pg_cron) tous les jours à 00:00 UTC

### 🚧 À Implémenter (Suggestions)
- [ ] Recherche textuelle dans les scrims
- [ ] Tri par date/rank/région
- [ ] Favoris/bookmarks de scrims
- [ ] Notifications push pour nouveaux scrims
- [ ] Export CSV/JSON des résultats
- [ ] Dark/Light mode toggle
- [ ] Raccourcis clavier
- [ ] PWA (Progressive Web App)
- [ ] Pagination des résultats
- [ ] Filtres sauvegardés (presets)

---

## 🐛 Debug & Troubleshooting

### Problèmes Courants

#### 1. **Les scrims ne se chargent pas**
```javascript
// Vérifier la connexion au backend
const { projectId, publicAnonKey } = await import('./utils/supabase/info');
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-e52d06d3/warmup`,
  { headers: { Authorization: `Bearer ${publicAnonKey}` } }
);
console.log('Backend status:', response.status); // Devrait retourner 200
```

#### 2. **La sync échoue**
```javascript
// Vérifier les logs dans la console
// Les erreurs détaillées apparaissent avec le préfixe ❌
// Vérifier aussi les variables d'environnement :
// - DISCORD_USER_TOKEN
// - DISCORD_CHANNEL_ID
```

#### 3. **Les filtres ne fonctionnent pas**
```javascript
// Vérifier l'état des filtres
console.log({
  selectedType,
  selectedRegion,
  selectedPlatform,
  selectedRanks,
  selectedTimeSlot,
  selectedTimezones
});
```

---

## 📞 Support

Pour toute question ou suggestion de nouvelles commandes, n'hésitez pas à ouvrir une issue ou contribuer au projet ! 🚀

---

**Dernière mise à jour :** 3 Janvier 2026  
**Version :** 1.0.0
