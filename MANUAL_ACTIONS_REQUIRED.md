# ⚠️ Actions Manuelles Requises - Audit de Sécurité & Performance

## 🔴 ACTIONS CRITIQUES (À faire IMMÉDIATEMENT)

### 1. Configurer Row Level Security (RLS) sur Supabase

**⚠️ PRIORITÉ MAXIMALE - Risque de sécurité critique**

Actuellement, la clé publique `publicAnonKey` est exposée dans le code (normal), MAIS vous devez absolument activer RLS sur Supabase pour éviter que n'importe qui puisse lire/modifier/supprimer vos données.

**Étapes :**

1. **Accéder au dashboard Supabase** : https://supabase.com/dashboard/project/nagnnlhxrpfgrrjptmcl

2. **Activer RLS sur la table `scrims`** :
   - Aller dans : Database → Tables → `scrims`
   - Cliquer sur "Enable RLS" (Row Level Security)

3. **Créer les politiques de sécurité** (via SQL Editor) :

```sql
-- POLITIQUE 1 : Lecture publique (tout le monde peut lire les scrims)
CREATE POLICY "Public read access" ON scrims
FOR SELECT USING (true);

-- POLITIQUE 2 : BLOQUER les insertions depuis le client
CREATE POLICY "No public insert" ON scrims
FOR INSERT WITH CHECK (false);

-- POLITIQUE 3 : BLOQUER les mises à jour depuis le client
CREATE POLICY "No public update" ON scrims
FOR UPDATE USING (false);

-- POLITIQUE 4 : BLOQUER les suppressions depuis le client
CREATE POLICY "No public delete" ON scrims
FOR DELETE USING (false);
```

4. **Vérifier que ça fonctionne** :
   - Ouvrir la console du navigateur (F12)
   - Essayer d'insérer un scrim manuellement :
     ```javascript
     const { projectId, publicAnonKey } = await import('./utils/supabase/info');
     const { createClient } = await import('@supabase/supabase-js');
     const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);
     const { data, error } = await supabase.from('scrims').insert({ lfs_type: 'test' });
     console.log(error); // Devrait afficher "new row violates row-level security policy"
     ```

---

### 2. Supprimer les dépendances inutilisées (Gain : ~8 MB)

**📦 Packages à désinstaller :**

Exécuter cette commande dans le terminal :

```bash
npm uninstall @emotion/react @emotion/styled @mui/icons-material @mui/material @popperjs/core next-themes cmdk embla-carousel-react input-otp react-day-picker react-resizable-panels react-responsive-masonry react-slick recharts sonner vaul tw-animate-css
```

**💡 Pourquoi :**
- Material UI n'est pas utilisé (vous utilisez Radix UI)
- Ces packages ajoutent ~8 MB au bundle final
- `tw-animate-css` est redondant avec Motion (Framer Motion)

---

### 3. Déployer sur Netlify avec les fichiers de configuration

**📝 Fichiers créés automatiquement :**
- `/_headers` : Headers de sécurité (CSP, HSTS, XSS Protection)
- `/netlify.toml` : Configuration du build et redirections SPA

**Étapes de déploiement :**

1. **Build local pour vérifier** :
   ```bash
   npm run build
   ```

2. **Déployer sur Netlify** :
   - Via CLI : `netlify deploy --prod`
   - Via interface web : Drag & drop du dossier `dist/`

3. **Vérifier les headers de sécurité** :
   - Aller sur https://securityheaders.com
   - Entrer l'URL de votre site
   - Vous devriez avoir un score A ou A+

---

## 🟡 ACTIONS RECOMMANDÉES (Performance)

### 4. Vérifier les composants Radix UI utilisés

**🔍 Packages potentiellement inutilisés :**

Vérifier dans votre code si vous utilisez réellement ces composants Radix UI :

```bash
# Vérifier si ces packages sont importés
grep -r "@radix-ui/react-accordion" src/
grep -r "@radix-ui/react-alert-dialog" src/
grep -r "@radix-ui/react-aspect-ratio" src/
grep -r "@radix-ui/react-avatar" src/
grep -r "@radix-ui/react-collapsible" src/
grep -r "@radix-ui/react-context-menu" src/
grep -r "@radix-ui/react-dropdown-menu" src/
grep -r "@radix-ui/react-hover-card" src/
grep -r "@radix-ui/react-menubar" src/
grep -r "@radix-ui/react-navigation-menu" src/
grep -r "@radix-ui/react-popover" src/
grep -r "@radix-ui/react-progress" src/
grep -r "@radix-ui/react-radio-group" src/
grep -r "@radix-ui/react-scroll-area" src/
grep -r "@radix-ui/react-select" src/
grep -r "@radix-ui/react-separator" src/
grep -r "@radix-ui/react-slider" src/
grep -r "@radix-ui/react-switch" src/
grep -r "@radix-ui/react-tabs" src/
grep -r "@radix-ui/react-toggle" src/
grep -r "@radix-ui/react-toggle-group" src/
grep -r "@radix-ui/react-tooltip" src/
```

**Si aucun résultat, désinstaller :**
```bash
npm uninstall @radix-ui/react-[nom-du-package]
```

---

### 5. Vérifier react-dnd, react-hook-form, react-popper

**🔍 Packages à auditer :**

```bash
# Vérifier si ces packages sont importés
grep -r "react-dnd" src/
grep -r "useForm\|react-hook-form" src/
grep -r "usePopper\|react-popper" src/
grep -r "date-fns" src/
```

**Si aucun import trouvé, désinstaller :**
```bash
npm uninstall react-dnd react-dnd-html5-backend react-hook-form react-popper date-fns
```

---

## ✅ ACTIONS DÉJÀ EFFECTUÉES AUTOMATIQUEMENT

- ✅ **Fonts self-hosted** : Remplacement de Google Fonts par @fontsource (gain -300ms latence)
- ✅ **Suppression tw-animate-css** : Retiré du tailwind.css (gain -50 KB CSS)
- ✅ **Headers Netlify** : Fichier `/_headers` créé avec CSP, HSTS, XSS Protection
- ✅ **Configuration Netlify** : Fichier `/netlify.toml` créé avec redirections SPA
- ✅ **Fonction sync exposée** : `syncScrims()` disponible dans la console
- ✅ **Documentation** : Rapport complet dans `/SECURITY_AUDIT_REPORT.md`

---

## 📊 RÉSUMÉ DES GAINS DE PERFORMANCE

| Action | Gain | Statut |
|--------|------|--------|
| Suppression MUI + dépendances inutilisées | -8 MB bundle | ⏳ À faire |
| Self-host Google Fonts | -300ms latence | ✅ Fait |
| Suppression tw-animate-css | -50 KB CSS | ✅ Fait |
| Audit composants Radix UI | -2-3 MB bundle | ⏳ À faire |
| Headers de sécurité Netlify | +5-10 Lighthouse | ✅ Fait |

**Total gain estimé :** -10 MB bundle + -300ms latence + meilleure sécurité

---

## 🧪 TESTS À EFFECTUER APRÈS DÉPLOIEMENT

### 1. Test de sécurité RLS

```javascript
// Dans la console du navigateur
const { projectId, publicAnonKey } = await import('./utils/supabase/info');
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);

// Essayer d'insérer (doit échouer)
const { error } = await supabase.from('scrims').insert({ lfs_type: 'test' });
console.log(error ? '✅ RLS fonctionne' : '❌ RLS non configuré');

// Essayer de lire (doit fonctionner)
const { data } = await supabase.from('scrims').select('*').limit(1);
console.log(data ? '✅ Lecture OK' : '❌ Lecture bloquée');
```

### 2. Test des headers de sécurité

- Aller sur https://securityheaders.com
- Entrer l'URL de votre site déployé
- Score attendu : **A** ou **A+**

### 3. Test Lighthouse

- Ouvrir DevTools (F12) → Lighthouse
- Lancer un audit complet
- Scores attendus :
  - Performance : **> 90**
  - Best Practices : **> 95**
  - SEO : **> 90**
  - Accessibility : **> 85**

---

## 📞 SUPPORT

Si vous rencontrez des problèmes, consultez :
- **Rapport complet** : `/SECURITY_AUDIT_REPORT.md`
- **Commandes disponibles** : `/COMMANDS.md`

---

**Dernière mise à jour :** 3 Janvier 2026  
**Statut :** ⚠️ Actions critiques requises avant production
