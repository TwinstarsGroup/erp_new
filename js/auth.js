/**
 * Authentication helpers
 * Handles Google OAuth via Supabase and guards protected pages.
 */

// ── Guard: redirect to login if not authenticated ─────────────────────────
async function requireAuth() {
  if (!supabaseClient) { console.error('Supabase client not initialised'); return null; }
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  startIdleTimer();
  return session;
}

// ── Idle timeout: sign out after 10 minutes of inactivity ────────────────
let _idleTimer = null;
function startIdleTimer() {
  if (_idleTimer !== null) return; // already running
  const IDLE_MS = 10 * 60 * 1000;
  _idleTimer = setTimeout(signOut, IDLE_MS);
  function resetTimer() {
    clearTimeout(_idleTimer);
    _idleTimer = setTimeout(signOut, IDLE_MS);
  }
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
    document.addEventListener(evt, resetTimer, { passive: true });
  });
}

// ── Populate sidebar user info ────────────────────────────────────────────
function populateSidebarUser(session) {
  const user = session.user;
  const avatar = document.getElementById('user-avatar');
  const name   = document.getElementById('user-name');
  const email  = document.getElementById('user-email');

  if (avatar) avatar.src = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=2563eb&color=fff`;
  if (name)   name.textContent  = user.user_metadata?.full_name || user.email.split('@')[0];
  if (email)  email.textContent = user.email;
}

// ── Sign in with Google ───────────────────────────────────────────────────
async function signInWithGoogle() {
  if (!supabaseClient) { showToast('Authentication service unavailable', 'error'); return; }
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: new URL('dashboard.html', window.location.href).href
    }
  });
  if (error) showToast('Login failed: ' + error.message, 'error');
}

// ── Sign out ──────────────────────────────────────────────────────────────
async function signOut() {
  if (!supabaseClient) { console.error('Supabase client not initialised'); return; }
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}
