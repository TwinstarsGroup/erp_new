/**
 * Supabase Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * Replace the placeholder values below with your actual Supabase project URL
 * and anon/public API key from:
 *   https://supabase.com/dashboard → Your Project → Settings → API
 *
 * NEVER put service_role key here — only the anon (public) key.
 */

const SUPABASE_URL = 'https://lqaomzpyhgntfkthleuo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__s0-IYwN9ivc2VOYFQWzbg_NFHs_SQn'; //configuration to Supabase

// Initialise the Supabase client (loaded via CDN in each HTML page)
const supabaseClient = (window.supabase && typeof window.supabase.createClient === 'function')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : (console.error('Supabase SDK not loaded. Ensure the CDN script is included before config.js.'), null);
