# Mes Commandes — appli pour les marchés

Petite appli web (installable sur le téléphone, fonctionne sans réseau) pour noter les commandes
de confitures et autres produits, les trier et ne rien oublier.

## Utilisation

1. **Saisir** : écris ou dicte la commande en une phrase, puis « Analyser ».
   > Marie Dupont 06 12 34 56 78, 2 fraise 1 abricot pour samedi, acompte 5 €

   L'appli repère le client, le téléphone, les produits et quantités, la date de retrait,
   le marché, l'acompte (ou « payé ») et une note (« Note : … »). Vérifie, corrige si besoin, enregistre.
   Un produit inconnu est signalé et peut être ajouté au catalogue en un clic.
2. **Rappels** (sur l'écran Saisir) : commandes pas encore retirées, à préparer pour aujourd'hui/demain,
   prêtes à remettre, retirées mais pas payées, sans date.
3. **Commandes** : regroupées par date, par marché ou par statut
   (À préparer → Prête → Retirée, ou Annulée). Recherche par client ou produit, encaissement en un clic.
4. **Production** : total par produit à préparer, par date et par marché.
5. **Réglages** : tes produits (prix, autres noms utilisés dans les messages) et tes marchés
   (avec un jour fixe, « samedi » choisit le bon marché et inversement).

Les données sont stockées **uniquement dans le navigateur du téléphone** (pas de compte, pas de serveur).
Ne pas vider les données de navigation du navigateur.

## Mettre en ligne (gratuit)

L'appli est faite de fichiers statiques, sans étape de build.

**Netlify** : « Add new site » → « Import from Git » → ce dépôt, puis
- Base directory : `commandes`
- Build command : *(vide)*
- Publish directory : `commandes`

Ensuite, ouvre l'adresse du site sur le téléphone :
- Android (Chrome) : menu ⋮ → « Installer l'application »
- iPhone (Safari) : Partager → « Sur l'écran d'accueil »

## Développement

```bash
cd commandes
npm start      # http://localhost:8080
npm test       # tests de l'analyse des messages
```

Après une modification des fichiers, incrémenter `VERSION` dans `sw.js` pour que les téléphones
récupèrent la nouvelle version.
