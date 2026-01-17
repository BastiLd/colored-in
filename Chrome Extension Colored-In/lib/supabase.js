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
  } catch {
  }
}

function ensureRemoteSupabaseConfig() {
  if (remoteConfigLoadPromise) return remoteConfigLoadPromise;
  remoteConfigLoadPromise = loadRemoteSupabaseConfig();
  return remoteConfigLoadPromise;
}

// Simple Supabase client for extension
const SupabaseClient = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,
  accessToken: null,
  normalizePlan: function (plan) {
    const p = (typeof plan === 'string' ? plan : '').toLowerCase();
    if (!p) return 'free';
    if (p.includes('individual')) return 'individual';
    if (p.includes('ultra')) return 'ultra';
    if (p.includes('pro')) return 'pro';
    return 'free';
  },
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

  getStoragePathFromUrl: function (assetUrl) {
    if (!assetUrl) return null;
    if (assetUrl.startsWith('data:') || assetUrl.startsWith('blob:')) {
      return null;
    }
    if (!assetUrl.startsWith('http') && assetUrl.includes('/')) {
      return assetUrl;
    }
    try {
      const parsed = new URL(assetUrl);
      const match = parsed.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)$/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    } catch {
      return null;
    }
    return null;
  },

  async createSignedUrl(bucket, path, expiresIn = 3600) {
    await this.ensureConfig();
    if (!path) return null;
    const response = await fetch(`${this.url}/storage/v1/object/sign/${bucket}/${encodeURIComponent(path)}`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(true),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const signedUrl = data?.signedUrl || data?.signedURL || data?.signed_url;
    if (!signedUrl) return null;
    if (signedUrl.startsWith('http')) return signedUrl;
    return `${this.url}${signedUrl.startsWith('/') ? '' : '/'}${signedUrl}`;
  },

  // Login with email and password
  async signIn(email, password) {
    await this.ensureConfig();

    const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
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
    await this.ensureConfig();
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
    await this.ensureConfig();
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

  // Get user palettes
  async getUserPalettes(userId) {
    await this.ensureConfig();
    const response = await fetch(
      `${this.url}/rest/v1/public_palettes?created_by=eq.${userId}&select=id,name,colors,tags,description,color_descriptions&order=created_at.desc`,
      {
        headers: this.getHeaders(true),
      }
    );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  },

  // Save a link or image asset record
  async createUserAsset(payload) {
    await this.ensureConfig();
    const response = await fetch(`${this.url}/rest/v1/user_assets`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(true),
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errText = '';
      try {
        const err = await response.json();
        errText = err?.message || err?.error || JSON.stringify(err);
      } catch {
        errText = await response.text();
      }
      throw new Error(errText || 'Failed to save asset');
    }

    const data = await response.json();
    return data?.[0] || null;
  },

  // Upload an image to Storage and return its path + signed URL
  async uploadUserAssetImage(userId, file) {
    await this.ensureConfig();
    if (!file || !file.name) throw new Error('Missing file');

    const safeExt = (file.name.split('.').pop() || 'png').replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;
    const path = `${userId}/${fileName}`;
    const bucket = 'user-assets';

    const uploadRes = await fetch(`${this.url}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`, {
      method: 'POST',
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: file,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(text || 'Failed to upload image');
    }

    const signedUrl = await this.createSignedUrl(bucket, path, 60 * 60);
    return { signedUrl, bucket, path, filename: file.name };
  },

  // Call Edge Function: generate-palette
  async generatePalette(prompt) {
    await this.ensureConfig();
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
    await this.ensureConfig();
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
