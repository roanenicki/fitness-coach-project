# FitTrack — suivi sportif à distance

## Mise en route
1. Créer un projet Supabase.
2. Exécuter `supabase/schema.sql` dans SQL Editor.
3. Créer les comptes dans Authentication.
4. Ajouter une ligne `profiles` pour chaque compte : `role='athlete'` pour la sportive, `role='coach'` pour toi.
5. Renseigner `js/config.js` avec l'URL et la clé publique/publishable Supabase.
6. Pousser le dossier sur GitHub et activer GitHub Pages.

## Sécurité
Ne jamais mettre `service_role` dans le frontend. La clé navigateur doit être publique/publishable. Les policies RLS protègent les données.

## Images
Le dossier `assets/exercises` contient les illustrations utilisées par la V1. Tu peux les remplacer par les images de ton choix en conservant les mêmes noms.
