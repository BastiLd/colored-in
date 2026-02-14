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
  signedUrlCache: new Map(),
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
      const match = parsed.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/[^/]+\/(.+)$/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    } catch {
      return null;
    }
    return null;
  },

  encodeStoragePath: function (path) {
    if (!path) return '';
    return encodeURIComponent(path).replace(/%2F/g, '/');
  },

  getPublicUrl: function (bucket, path) {
    if (!bucket || !path) return null;
    const safePath = this.encodeStoragePath(path);
    return `${this.url}/storage/v1/object/public/${bucket}/${safePath}`;
  },

  normalizeSignedUrl: function (signedUrl) {
    if (!signedUrl || typeof signedUrl !== 'string') return null;

    // Relative URL returned by storage API (e.g. "/object/sign/..." or "object/sign/...")
    if (!signedUrl.startsWith('http')) {
      let rel = signedUrl.startsWith('/') ? signedUrl : `/${signedUrl}`;
      if (rel.startsWith('/object/')) {
        rel = `/storage/v1${rel}`;
      }
      return `${this.url}${rel}`;
    }

    // Absolute URL returned by storage API
    try {
      const parsed = new URL(signedUrl);
      if (parsed.pathname.startsWith('/object/')) {
        parsed.pathname = `/storage/v1${parsed.pathname}`;
      }
      return parsed.toString();
    } catch {
      return signedUrl;
    }
  },

  async createSignedUrl(bucket, path, expiresIn = 3600) {
    await this.ensureConfig();
    if (!path) {
      console.warn('[SupabaseClient] createSignedUrl: No path provided');
      return null;
    }
    await this.ensureAuth();
    
    const cacheKey = `${bucket}:${path}:${expiresIn}`;
    const cached = this.signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt && cached.expiresAt > Date.now() + 30_000 && cached.url) {
      const normalizedCachedUrl = this.normalizeSignedUrl(cached.url);
      if (normalizedCachedUrl && normalizedCachedUrl !== cached.url) {
        this.signedUrlCache.set(cacheKey, { ...cached, url: normalizedCachedUrl });
      }
      console.log('[SupabaseClient] Using cached signed URL for:', path);
      return normalizedCachedUrl || cached.url;
    }
    
    const safePath = this.encodeStoragePath(path);
    console.log('[SupabaseClient] Creating signed URL for bucket:', bucket, 'path:', safePath);
    
    try {
      const response = await fetch(`${this.url}/storage/v1/object/sign/${bucket}/${safePath}`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(true),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SupabaseClient] Failed to create signed URL:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      const signedUrl = data?.signedUrl || data?.signedURL || data?.signed_url;
      if (!signedUrl) {
        console.error('[SupabaseClient] No signed URL in response:', data);
        return null;
      }

      const full = this.normalizeSignedUrl(signedUrl);
      if (!full) {
        console.error('[SupabaseClient] Could not normalize signed URL:', signedUrl);
        return null;
      }
      
      console.log('[SupabaseClient] Created signed URL:', full);
      this.signedUrlCache.set(cacheKey, { url: full, expiresAt: Date.now() + expiresIn * 1000 });
      return full;
    } catch (error) {
      console.error('[SupabaseClient] Error creating signed URL:', error);
      return null;
    }
  },

  async ensureAuth() {
    // Make sure we have a valid access token loaded (or refreshed) from chrome.storage.
    if (this.accessToken) return true;
    await this.getSession();
    if (this.accessToken) return true;
    const refreshed = await this.refreshSession();
    return Boolean(refreshed?.access_token);
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
    if (!result.session) return null;
    
    // If token hasn't expired, use it directly
    if (result.session.expires_at > Date.now()) {
      this.accessToken = result.session.access_token;
      return result.session;
    }
    
    // Token expired - try to refresh it automatically
    console.log('[SupabaseClient] Session expired, attempting refresh...');
    const refreshed = await this.refreshSession();
    if (refreshed) {
      return await chrome.storage.local.get('session').then(r => r.session);
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
    await this.ensureAuth();
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
    await this.ensureAuth();
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
  // Uses the same try-fallback pattern as the website Dashboard:
  // try full columns first, fall back to basic columns if description/color_descriptions don't exist yet.
  async getUserPalettes(userId) {
    await this.ensureConfig();
    await this.ensureAuth();
    
    console.log('[SupabaseClient] Fetching palettes for user:', userId);

    const trySelect = async (columns) => {
      const url = `${this.url}/rest/v1/public_palettes?created_by=eq.${userId}&select=${columns}&order=created_at.desc`;
      console.log('[SupabaseClient] Request URL:', url);
      const response = await fetch(url, {
        headers: this.getHeaders(true),
      });
      return response;
    };

    try {
      // Try with all columns (including description columns added in later migration)
      let response = await trySelect('id,name,colors,tags,created_at,description,color_descriptions');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[SupabaseClient] Full select failed:', response.status, errorText);
        
        // If column doesn't exist (42703), retry with basic columns only
        const isMissingColumn = response.status === 400 && 
          (errorText.includes('does not exist') || errorText.includes('42703'));
        
        if (isMissingColumn) {
          console.log('[SupabaseClient] Falling back to basic columns...');
          response = await trySelect('id,name,colors,tags,created_at');
          
          if (!response.ok) {
            const fallbackError = await response.text();
            console.error('[SupabaseClient] Fallback also failed:', response.status, fallbackError);
            return [];
          }
        } else {
          return [];
        }
      }

      const data = await response.json();
      console.log('[SupabaseClient] Fetched', data.length, 'palettes');
      return data;
    } catch (error) {
      console.error('[SupabaseClient] Error fetching palettes:', error);
      return [];
    }
  },

  // Save a link or image asset record
  async createUserAsset(payload) {
    await this.ensureConfig();
    await this.ensureAuth();
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
    await this.ensureAuth();
    if (!file || !file.name) throw new Error('Missing file');

    const safeExt = (file.name.split('.').pop() || 'png').replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;
    const path = `${userId}/${fileName}`;
    const bucket = 'user-assets';
    const safePath = this.encodeStoragePath(path);

    const uploadRes = await fetch(`${this.url}/storage/v1/object/${bucket}/${safePath}`, {
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
    await this.ensureAuth();
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
    await this.ensureAuth();
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

  // ====== Notes API ======

  // Get user notes
  async getUserNotes(userId) {
    await this.ensureConfig();
    await this.ensureAuth();
    const response = await fetch(
      `${this.url}/rest/v1/user_notes?user_id=eq.${userId}&select=*&order=updated_at.desc`,
      { headers: this.getHeaders(true) }
    );
    if (!response.ok) return [];
    return await response.json();
  },

  // Create a note
  async createNote(payload) {
    await this.ensureConfig();
    await this.ensureAuth();
    const response = await fetch(`${this.url}/rest/v1/user_notes`, {
      method: 'POST',
      headers: { ...this.getHeaders(true), Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Failed to create note');
    const data = await response.json();
    return data?.[0] || null;
  },

  // Update a note
  async updateNote(noteId, payload) {
    await this.ensureConfig();
    await this.ensureAuth();
    const response = await fetch(
      `${this.url}/rest/v1/user_notes?id=eq.${noteId}`,
      {
        method: 'PATCH',
        headers: { ...this.getHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
      }
    );
    if (!response.ok) throw new Error('Failed to update note');
    const data = await response.json();
    return data?.[0] || null;
  },

  // Delete a note
  async deleteNote(noteId) {
    await this.ensureConfig();
    await this.ensureAuth();
    const response = await fetch(
      `${this.url}/rest/v1/user_notes?id=eq.${noteId}`,
      { method: 'DELETE', headers: this.getHeaders(true) }
    );
    if (!response.ok) throw new Error('Failed to delete note');
  },

  // ====== Site Mode API (reuses generate-palette with extended prompt) ======
  async generateSiteTheme(siteInfo) {
    await this.ensureConfig();
    await this.ensureAuth();
    const prompt = `Create a complete color theme for a website with these details:
Topic/Industry: ${siteInfo.topic}
Target Audience: ${siteInfo.audience}
Style: ${siteInfo.style}
Additional Info: ${siteInfo.additional || 'None'}

Please create a palette that works as a complete website theme. Include colors for:
- Primary brand color
- Secondary/accent color  
- Background color
- Text color
- Call-to-action color

Also provide theme recommendations for fonts, spacing, and layout in the description.`;

    const response = await fetch(`${this.url}/functions/v1/generate-palette`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate site theme');
    }

    return await response.json();
  },
};

// Export for use in popup
window.SupabaseClient = SupabaseClient;

// Start loading remote config early (best-effort)
ensureRemoteSupabaseConfig().catch(() => {});
