// Supabase client for Chrome Extension
let SUPABASE_URL = 'https://gevqwporirhaekapftib.supabase.co';
let SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdldnF3cG9yaXJoYWVrYXBmdGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxMjM3MzEsImV4cCI6MjA1MDY5OTczMX0.aP07NmSbwZRmgf2xyOVG9XVe7WByPi-OuJeu2vpjKKI';

// The extension can fetch the latest public anon key from the deployed web app.
// This avoids hardcoding a key that can become invalid if the project's JWT secret is rotated.
const REMOTE_SUPABASE_CONFIG_URL = 'https://bastild.github.io/colored-in/supabase-config.json';
let remoteConfigLoaded = false;
let remoteConfigLoadPromise = null;

async function loadRemoteSupabaseConfig() {
  try {
    const res = await fetch(REMOTE_SUPABASE_CONFIG_URL, { cache: 'no-store' });
    if (!res.ok) {
      // #region agent log (debug-mode)
      try {
        fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'pre-fix',
            hypothesisId: 'H4',
            location: 'Chrome Extension Colored-In/lib/supabase.js:loadRemoteSupabaseConfig:HTTP_ERROR',
            message: 'Remote supabase-config.json fetch failed',
            data: { status: res.status },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      } catch {}
      // #endregion
      return;
    }
    const cfg = await res.json();
    const nextUrl = typeof cfg?.url === 'string' ? cfg.url.trim() : '';
    const nextKey = typeof cfg?.anonKey === 'string' ? cfg.anonKey.trim() : '';

    if (nextUrl && nextKey && nextKey.length > 50) {
      SUPABASE_URL = nextUrl;
      SUPABASE_ANON_KEY = nextKey;
      remoteConfigLoaded = true;
    }

    // #region agent log (debug-mode)
    try {
      fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'H4',
          location: 'Chrome Extension Colored-In/lib/supabase.js:loadRemoteSupabaseConfig:SUCCESS',
          message: 'Remote supabase-config.json loaded',
          data: {
            remoteConfigLoaded,
            urlHost: (() => {
              try { return nextUrl ? new URL(nextUrl).host : null; } catch { return null; }
            })(),
            keyLen: nextKey?.length ?? 0,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    } catch {}
    // #endregion
  } catch {
    // #region agent log (debug-mode)
    try {
      fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'H4',
          location: 'Chrome Extension Colored-In/lib/supabase.js:loadRemoteSupabaseConfig:NETWORK_ERROR',
          message: 'Remote supabase-config.json fetch errored',
          data: {},
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    } catch {}
    // #endregion
  }
}

function ensureRemoteSupabaseConfig() {
  if (remoteConfigLoadPromise) return remoteConfigLoadPromise;
  remoteConfigLoadPromise = loadRemoteSupabaseConfig();
  return remoteConfigLoadPromise;
}

// #region agent log (debug-mode)
try {
  fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'pre-fix',
      hypothesisId: 'H3',
      location: 'Chrome Extension Colored-In/lib/supabase.js:SUPABASE_CONFIG',
      message: 'Supabase config snapshot (extension)',
      data: {
        urlHost: (() => {
          try { return new URL(SUPABASE_URL).host; } catch { return null; }
        })(),
        keyPresent: Boolean(SUPABASE_ANON_KEY),
        keyLen: SUPABASE_ANON_KEY?.length ?? 0,
        keyLooksJwt: typeof SUPABASE_ANON_KEY === 'string' ? SUPABASE_ANON_KEY.startsWith('eyJ') : false,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
} catch {
  // ignore
}
// #endregion

// Simple Supabase client for extension
const SupabaseClient = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,
  accessToken: null,
  ensureConfig: async function () {
    await ensureRemoteSupabaseConfig();
    // sync any newly loaded config onto the client object
    this.url = SUPABASE_URL;
    this.key = SUPABASE_ANON_KEY;
  },

  // Set access token after login
  setAccessToken(token) {
    this.accessToken = token;
  },

  // Get headers for authenticated requests
  getHeaders(authenticated = false) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.key,
    };
    if (authenticated && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  },

  // Login with email and password
  async signIn(email, password) {
    await this.ensureConfig();

    // #region agent log (debug-mode)
    try {
      fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'H3',
          location: 'Chrome Extension Colored-In/lib/supabase.js:signIn:ENTRY',
          message: 'Extension signIn called',
          data: {
            hasAt: typeof email === 'string' ? email.includes('@') : false,
            emailLen: typeof email === 'string' ? email.length : 0,
            urlHost: (() => {
              try { return this.url ? new URL(this.url).host : null; } catch { return null; }
            })(),
            keyLen: typeof this.key === 'string' ? this.key.length : 0,
            remoteConfigLoaded,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    } catch {
      // ignore
    }
    // #endregion

    const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      // #region agent log (debug-mode)
      try {
        fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'pre-fix',
            hypothesisId: 'H3',
            location: 'Chrome Extension Colored-In/lib/supabase.js:signIn:ERROR',
            message: 'Extension signIn failed',
            data: {
              status: response.status,
              errorCode: error?.error ?? null,
              hasErrorDescription: Boolean(error?.error_description),
              hasMessage: Boolean(error?.message),
              messageSnippet: typeof error?.message === 'string' ? error.message.slice(0, 60) : null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      } catch {
        // ignore
      }
      // #endregion
      throw new Error(error.error_description || error.message || 'Login failed');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    
    // Store session in chrome.storage
    await chrome.storage.local.set({
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
        expires_at: Date.now() + (data.expires_in * 1000),
      }
    });

    return data;
  },

  // Sign out
  async signOut() {
    this.accessToken = null;
    await chrome.storage.local.remove('session');
  },

  // Get current session from storage
  async getSession() {
    const result = await chrome.storage.local.get('session');
    if (result.session && result.session.expires_at > Date.now()) {
      this.accessToken = result.session.access_token;
      return result.session;
    }
    return null;
  },

  // Refresh token if expired
  async refreshSession() {
    const result = await chrome.storage.local.get('session');
    if (!result.session?.refresh_token) {
      return null;
    }

    const response = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ refresh_token: result.session.refresh_token }),
    });

    if (!response.ok) {
      await this.signOut();
      return null;
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    
    await chrome.storage.local.set({
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
        expires_at: Date.now() + (data.expires_in * 1000),
      }
    });

    return data;
  },

  // Get user subscription
  async getUserSubscription(userId) {
    const response = await fetch(
      `${this.url}/rest/v1/user_subscriptions?user_id=eq.${userId}&select=*`,
      {
        headers: this.getHeaders(true),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data[0] || null;
  },

  // Get user assets
  async getUserAssets(userId) {
    const response = await fetch(
      `${this.url}/rest/v1/user_assets?user_id=eq.${userId}&select=*&order=created_at.desc`,
      {
        headers: this.getHeaders(true),
      }
    );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  },

  // Call Edge Function: generate-palette
  async generatePalette(prompt) {
    const response = await fetch(`${this.url}/functions/v1/generate-palette`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate palette');
    }

    return await response.json();
  },

  // Call Edge Function: analyze-asset
  async analyzeAsset(assetType, assetUrl, mode = 'extract', expandText = '') {
    const response = await fetch(`${this.url}/functions/v1/analyze-asset`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ assetType, assetUrl, mode, expandText }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to analyze asset');
    }

    return await response.json();
  },
};

// Export for use in popup
window.SupabaseClient = SupabaseClient;

// Start loading remote config early (best-effort)
ensureRemoteSupabaseConfig().catch(() => {});
