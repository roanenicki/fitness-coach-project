// Renseigne les valeurs de ton projet Supabase.
// N'utilise JAMAIS la clé service_role ici.
const SUPABASE_URL = "https://TON-PROJET.supabase.co";
const SUPABASE_ANON_KEY = "TA_CLE_PUBLIQUE";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
