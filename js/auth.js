/**
 * Authentication helpers
 * Handles Google OAuth via Supabase and guards protected pages.
 */

// ── Guard: redirect to login if not authenticated ─────────────────────────
async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
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
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: new URL('dashboard.html', window.location.href).href
    }
  });
  if (error) showToast('Login failed: ' + error.message, 'error');
}

// ── Sign out ──────────────────────────────────────────────────────────────
async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}
