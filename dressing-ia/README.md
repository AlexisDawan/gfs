# Dressing IA — maquette fonctionnelle

Démo commerciale. Un seul codebase qui tourne **dans un navigateur** (pour montrer à un prospect sans rien installer) et **sur iPhone et Android** via Expo Go.

Ce n'est pas un prototype jetable : tout ce qui est ici est le socle réutilisable de la version finale.

---

## Lancer la démo

```bash
npm install
npm run web          # navigateur, http://localhost:8081
npm start            # QR code -> Expo Go sur iPhone / Android
```

Build statique à héberger n'importe où (Netlify, Vercel, un dossier) :

```bash
npx expo export --platform web   # sort dans dist/
```

Aucune clé d'API, aucun compte, aucune connexion requise.

---

## Ce que la maquette démontre

**Le moteur de tenues est déterministe.** Isolation thermique en **clo** (ISO 9920), générateur pseudo-aléatoire à graine, zéro appel LLM. Même entrée → même sortie, toujours. C'est ce qui rend la recette du projet opposable : on ne discute pas de savoir si une tenue est jolie, on vérifie si son isolation tient dans la fourchette.

**Le sélecteur de bulletins météo.** Canicule 34 °C, été doux, mi-saison, pluie, froid sec, gel avec vent. Un tap et les propositions changent devant le client. C'est la fonction la plus importante de la démo : elle prouve le lien météo → vêtement en trois secondes.

**L'écran Recette.** 30 situations météo rejouées sur le dressing, critère binaire (isolation entre 0,85 et 1,15 × la cible), taux de réussite affiché. C'est l'argument qui désamorce le « oui mais les tenues sont moches » avant qu'il arrive.

**Les états dégradés.** Dressing vide, dressing insuffisant pour le froid, filtres trop stricts : chaque cas a son écran et son message. Jamais d'écran blanc.

### Le résultat actuel : 25/30

Cinq scénarios échouent, tous dans le grand froid : le dressing de démonstration n'a pas de quoi atteindre 2,8 clo. **C'est voulu, et c'est un argument, pas un défaut.** Le rapport nomme la situation au lieu de la masquer — c'est exactement la fonction « liste de manques » qui se vend en V2.

---

## Ce que la maquette ne fait pas, délibérément

| Absent | Pourquoi |
|---|---|
| Photos de vêtements | Rendu par aplat de couleur HSL. Zéro fichier binaire, **zéro question de droits à l'image** |
| Appareil photo, détourage, upload | C'est le poste le plus coûteux du build (30-40 % des bugs). Hors périmètre d'une démo |
| Compte, authentification | Aucune donnée personnelle, donc aucune obligation RGPD sur la démo |
| Paiement, abonnement | Déclencherait StoreKit, Google Play Billing et le Paid Applications Agreement |
| Appel réseau | La météo réelle est branchable (`WeatherApiProvider`), mais la démo tourne sur des bulletins figés |

---

## Architecture

```
src/domain/     types.ts (contrat partagé) · clo.ts (ISO 9920) · color.ts (harmonie HSL)
                engine.ts (générateur déterministe) · scenarios.ts (les 30 cas de recette)
src/data/       taxonomy.ts (catégories, 22 couleurs) · wardrobe.ts (42 pièces fictives)
src/weather/    clo-target.ts (température ressentie -> cible clo) · provider.ts (mock + WeatherAPI)
src/theme/      tokens.ts (clair/sombre) · components.tsx (design system)
src/store/      wardrobe-store.ts (contexte React) · storage.ts (persistance tolérante aux pannes)
src/app/        expo-router — tenue du jour, dressing, recette, profil, fiche vêtement
```

**Règles tenues dans tout le code :** TypeScript strict sans `any`, aucun `Math.random()` ni `Date.now()` dans la logique métier, tout le texte visible en français, clair et sombre partout, largeur de contenu bornée pour rester présentable sur grand écran.

### Brancher la météo réelle

`WeatherApiProvider` cible WeatherAPI.com, dont le plan gratuit (100 000 appels/mois) **autorise explicitement l'usage commercial** — contrairement à Open-Meteo, dont le gratuit est non-commercial. Un adaptateur unique isole le fournisseur : en changer prend une journée.

---

## Stack

Expo SDK 57 · React Native 0.86 · React 19.2 · expo-router · react-native-web · TypeScript 6

`npx tsc --noEmit` passe sans erreur. `npx expo export --platform web` build sans erreur, zéro erreur console au runtime.
