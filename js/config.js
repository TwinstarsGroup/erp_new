/**
 * Supabase Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * Replace the placeholder values below with your actual Supabase project URL
 * and anon/public API key from:
 *   https://supabase.com/dashboard → Your Project → Settings → API
 *
 * NEVER put service_role key here — only the anon (public) key.
 */

const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialise the Supabase client (loaded via CDN in each HTML page)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
