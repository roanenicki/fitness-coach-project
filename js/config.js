// REMPLACER UNIQUEMENT CES DEUX VALEURS par les informations publiques de votre projet Supabase.
// Ne mettez JAMAIS la clé service_role ici.
const SUPABASE_URL = 'https://VOTRE-PROJET.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_CLE_PUBLISHABLE_OU_ANON';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
