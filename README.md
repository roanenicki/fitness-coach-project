# Fitness Coach V2 — multi-athlètes

Cette version remplace le fonctionnement V1 « un coach voit toutes les séances » par une relation explicite **coach → athlètes**.

## 1. Important avant de commencer

Le mot de passe de la base communiqué dans la conversation **ne doit pas être mis dans GitHub, dans JavaScript, ni dans le ZIP**. Utilisez-le uniquement dans Supabase si nécessaire et, par prudence, envisagez de le changer puisqu’il a été partagé dans une conversation.

Le navigateur utilise uniquement la clé publique/publishable/anon de Supabase. **La clé `service_role` reste exclusivement dans la Supabase Edge Function.**

## 2. Supabase

1. Ouvrez votre projet Supabase.
2. SQL Editor → exécutez `supabase/schema.sql`.
3. Vérifiez que votre compte actuel existe dans `auth.users` et `public.profiles`.
4. Passez votre compte en coach une seule fois :

```sql
update public.profiles
set role='coach'
where id='UUID_DE_VOTRE_COMPTE';
```

## 3. Configurer le frontend

Dans `js/config.js`, remplacez :

- `SUPABASE_URL` par l'URL de votre projet.
- `SUPABASE_ANON_KEY` par la clé publique/publishable/anon.

Ne mettez jamais `service_role` dans ce fichier.

## 4. Déployer la fonction create-athlete

Avec Supabase CLI, depuis la racine du projet :

```bash
supabase login
supabase link --project-ref VOTRE_PROJECT_REF
supabase functions deploy create-athlete
```

La fonction utilise automatiquement les secrets Supabase disponibles côté Edge Function. Si votre environnement exige de les définir explicitement, configurez `SUPABASE_SERVICE_ROLE_KEY` côté Supabase uniquement.

## 5. GitHub Pages

Poussez les fichiers du frontend dans votre dépôt GitHub puis activez GitHub Pages sur la branche/répertoire souhaité.

Le flux devient :

**Coach → Ajouter une athlète → Edge Function sécurisée → Auth + profil + relation coach_athletes → l’athlète se connecte → séances → coach voit uniquement ses athlètes.**

## 6. Ajouter une athlète

Depuis `coach.html`, le coach clique sur « Ajouter une athlète », saisit nom, email et mot de passe temporaire. Le navigateur appelle la Edge Function avec le token de session du coach. La fonction vérifie le rôle du coach puis crée le compte Auth et la relation.

## 7. Limite actuelle

Le programme de démonstration reste basé sur lundi/mercredi/vendredi. La V2 traite le **multi-athlètes et la sécurité RLS**, pas encore la gestion avancée de plusieurs programmes personnalisés.
