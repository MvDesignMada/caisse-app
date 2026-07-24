# Application de gestion de caisse — Instructions

## Ce qui est fait
- Schéma SQL complet avec RLS (sécurité par ligne) — `supabase/schema.sql`
- Edge Function de création de compte responsable — `supabase/functions/create-user`
- App React + Tailwind : login, saisie responsable, dashboard admin (stats + graphiques), historique (recherche/modif/suppression/export Excel-PDF-CSV)
- Mode sombre, gros boutons, responsive mobile

## Ce qui N'EST PAS fait / à faire toi-même
- **Création du projet Supabase** (compte + clés API) — je ne peux pas le faire à ta place.
- **Déploiement de l'Edge Function** (nécessite le CLI Supabase installé sur ton poste).
- **Création des comptes admin/responsables** — à faire une fois via l'Edge Function ou directement dans Supabase Auth (interface web) pour le premier admin.
- **Notifications** : implémentées en in-app (table `notifications`) seulement. Pas d'email/SMS/push — ça demanderait un service tiers en plus (Resend, Twilio, etc.).
- Tests réels non faits — vérifie le calcul métier (Espèces = cash net des sorties) correspond bien à ta réalité terrain avant de mettre en prod.

## Étapes de déploiement

### 1. Créer le projet Supabase
1. Va sur https://supabase.com → New project.
2. Une fois créé, va dans **SQL Editor** → colle le contenu de `supabase/schema.sql` → Run.
3. Va dans **Project Settings > API** → note `Project URL` et `anon public key`.

### 2. Créer le premier compte admin
Dans Supabase → **Authentication > Users > Add user** → crée ton compte admin avec email/mot de passe.
Puis dans **SQL Editor**, exécute (remplace l'UUID par celui de l'utilisateur créé, visible dans Authentication > Users) :
```sql
insert into profils (id, nom, email, role, magasin_id)
values ('UUID_DE_TON_USER', 'Ton nom', 'ton@email.com', 'admin', null);
```

### 3. Déployer l'Edge Function (pour créer les comptes responsables ensuite)
```bash
npm install -g supabase
supabase login
supabase link --project-ref TON_PROJECT_REF
supabase functions deploy create-user
```

### 4. Configurer le projet React
```bash
cd caisse-app
cp .env.example .env
# édite .env avec ton URL et ta clé anon
npm install
npm run dev
```

### 5. Déployer sur Hostinger (hébergement mutualisé)

L'app React se compile en fichiers statiques (HTML/CSS/JS) — pas besoin de Node.js sur le serveur, un hébergement mutualisé classique suffit.

**Important** : les variables `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) sont injectées **au moment du build**, pas à l'exécution. Donc édite bien `.env` avec tes vraies valeurs AVANT de lancer le build — contrairement à Vercel, il n'y a pas d'écran "Environment Variables" à remplir après coup.

1. En local, vérifie que `.env` contient tes vraies clés Supabase (étape 4 ci-dessus), puis :
   ```bash
   npm run build
   ```
   Ça génère un dossier `dist/` avec tous les fichiers statiques prêts à héberger.

2. Connecte-toi à ton **hPanel Hostinger** → **Gestionnaire de fichiers** (ou via FTP avec FileZilla).

3. Va dans le dossier `public_html` (ou le sous-dossier de ton domaine/sous-domaine si tu veux une URL du style `caisse.tondomaine.com`).

4. Upload **tout le contenu du dossier `dist/`** (pas le dossier `dist` lui-même, son contenu) directement dans `public_html`. Le fichier `.htaccess` (déjà inclus dans le build, il vient de `public/.htaccess`) doit être copié aussi — active "afficher les fichiers cachés" dans le gestionnaire de fichiers si tu ne le vois pas.

5. Le `.htaccess` est nécessaire car l'app utilise `react-router` (plusieurs "pages" comme `/historique`) : sans lui, actualiser la page sur une URL autre que l'accueil donnerait une erreur 404. Vérifie qu'il est bien présent à la racine de `public_html`.

6. Le certificat SSL gratuit de Hostinger doit être activé (hPanel > SSL) pour que Supabase Auth fonctionne correctement en HTTPS.

7. À chaque modification du code, il faut refaire `npm run build` et re-uploader le contenu de `dist/` — il n'y a pas de déploiement automatique comme avec Vercel/Git. Si tu veux ça plus tard (déploiement auto à chaque changement), ça demande un accès SSH ou un webhook, pas disponible en mutualisé standard.

**Ce qui ne change pas** : l'Edge Function (`create-user`) tourne sur l'infrastructure Supabase, pas sur Hostinger — l'étape 3 (déploiement de l'Edge Function) reste identique, elle n'a rien à voir avec ton hébergeur.

### 6. Créer les comptes responsables
Une fois connecté en admin, appelle la fonction depuis le frontend (à ajouter dans une page "Gestion des utilisateurs" si tu veux une UI — pas encore construite) :
```js
await supabase.functions.invoke('create-user', {
  body: { email: 'resp1@magasin.com', password: '...', nom: 'Jean', magasin_id: '<id du magasin>' }
})
```
Ou plus simple pour démarrer vite : crée-les manuellement dans Authentication > Users, puis ajoute la ligne correspondante dans la table `profils` via SQL Editor, comme à l'étape 2 mais avec `role: 'responsable'` et le bon `magasin_id`.

## Modèle de paiement (mis à jour)
- **Espèces** : cash reçu aujourd'hui. C'est le SEUL montant qui impacte la caisse physique.
- **Chèque** et **Mobile Money** : ventes réelles, mais ne touchent jamais le tiroir-caisse physique.
- **Différés** : ventes à crédit, le client n'a pas encore payé.
- **Chiffre d'affaires** = espèces + chèque + mobile money + différés.
- **Résultat** = chiffre d'affaires − total des sorties (profit du jour). **Assomption à confirmer** : si "résultat" doit vouloir dire autre chose pour toi (ex: uniquement cash-basis), dis-le, la formule est dans `rapports.résultat` (colonne générée en SQL) et facile à changer.
- **Solde de caisse physique** = solde de la veille + espèces du jour − total des sorties.
- **Versement** : une sortie avec `catégorie = 'versement'` (cochée dans le formulaire responsable). Sert à sortir le cash vers la banque. Le dashboard admin affiche depuis quand la caisse d'un magasin n'a pas été versée (vue SQL `dernier_versement`).

## Points à vérifier avant mise en prod
- Un rapport par magasin et par jour est forcé en base (`unique(magasin_id, date)`) — si un magasin doit pouvoir avoir plusieurs rapports/jour un jour, il faudra changer ce point.
- Le module "gestion des utilisateurs" (créer/lister les responsables depuis l'UI admin) n'est pas construit — actuellement il faut passer par SQL ou par un appel manuel à l'Edge Function.
