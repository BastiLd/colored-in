// Colored In - Background Service Worker
// Handles keyboard shortcuts and color picker using EyeDropper API

const DEBUG_ENDPOINT = 'http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa';
const DEBUG_SESSION_ID = 'debug-session';
const DEBUG_RUN_ID = 'color-picker-overlay-fix2';

function dbg(hypothesisId, location, message, data) {
  try {
    fetch(DEBUG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: DEBUG_SESSION_ID,
        runId: DEBUG_RUN_ID,
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  // #region agent log (debug-mode)
  dbg('H1', 'Chrome Extension Colored-In/background/service-worker.js:onCommand', 'Command received', {
    command,
  });
  // #endregion
  
  if (command === 'pick-color') {
    await activateColorPicker({ source: 'command' });
  }
});

// Activate color picker in the current tab using EyeDropper API
async function activateColorPicker({ source } = { source: 'unknown' }) {
  try {
    // #region agent log (debug-mode)
    dbg('H2', 'Chrome Extension Colored-In/background/service-worker.js:activateColorPicker:ENTRY', 'activateColorPicker called', { source });
    // #endregion
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      console.error('No active tab found');
      // #region agent log (debug-mode)
      dbg('H2', 'Chrome Extension Colored-In/background/service-worker.js:activateColorPicker:NO_TAB', 'No active tab found', {});
      // #endregion
      return;
    }
    
    const tabUrl = typeof tab.url === 'string' ? tab.url : null;
    // #region agent log (debug-mode)
    dbg('H2', 'Chrome Extension Colored-In/background/service-worker.js:activateColorPicker:TAB', 'Active tab snapshot', {
      tabId: tab.id ?? null,
      urlPresent: Boolean(tabUrl),
      urlPrefix: tabUrl ? tabUrl.slice(0, 32) : null,
    });
    // #endregion

    // Check if we can inject into this tab
    if (!tabUrl) {
      console.log('Cannot inject: tab.url missing');
      // #region agent log (debug-mode)
      dbg('H3', 'Chrome Extension Colored-In/background/service-worker.js:activateColorPicker:URL_MISSING', 'Cannot inject: tab.url missing', {});
      // #endregion
      return;
    }

    if (tabUrl.startsWith('chrome://') || 
        tabUrl.startsWith('chrome-extension://') ||
        tabUrl.startsWith('edge://') ||
        tabUrl.startsWith('about:')) {
      console.log('Cannot inject into browser internal pages');
      // #region agent log (debug-mode)
      dbg('H3', 'Chrome Extension Colored-In/background/service-worker.js:activateColorPicker:INTERNAL_PAGE', 'Cannot inject into internal page', {
        urlPrefix: tabUrl.slice(0, 32),
      });
      // #endregion
      return;
    }
    
    // KEYBOARD SHORTCUT PATH:
    // EyeDropper.open() requires a user gesture; Chrome commands do NOT count as one.
    // So for shortcut-triggered picks, use our overlay-based picker content script.
    if (source === 'command') {
      // #region agent log (debug-mode)
      dbg('H4', 'Chrome Extension Colored-In/background/service-worker.js:activateColorPicker:OVERLAY', 'Using overlay picker (command source)', {});
      // #endregion
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/color-picker.js'],
      });
      return;
    }

    // POPUP/CLICK PATH (user gesture): try EyeDropper first.
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        if (!('EyeDropper' in window)) {
          return { success: false, error: 'EyeDropper not supported' };
        }
        try {
          const eyeDropper = new EyeDropper();
          const result = await eyeDropper.open();
          const color = result.sRGBHex.toUpperCase();
          await navigator.clipboard.writeText(color);
          return { success: true, color };
        } catch (error) {
          return { success: false, error: error?.message || String(error) };
        }
      },
    });

    // #region agent log (debug-mode)
    dbg('H4', 'Chrome Extension Colored-In/background/service-worker.js:activateColorPicker:EYEDROPPER_RESULT', 'EyeDropper attempt returned', {
      hasResults: Array.isArray(results),
      success: results?.[0]?.result?.success ?? null,
      error: typeof results?.[0]?.result?.error === 'string' ? results[0].result.error.slice(0, 80) : null,
    });
    // #endregion

    if (results?.[0]?.result?.success) {
      chrome.storage.local.set({ lastPickedColor: results[0].result.color });
      return;
    }

    // Fallback (e.g. gesture missing): overlay picker.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/color-picker.js'],
    });
    // #region agent log (debug-mode)
    dbg('H4', 'Chrome Extension Colored-In/background/service-worker.js:activateColorPicker:OVERLAY_FALLBACK', 'Fell back to overlay picker', {});
    // #endregion
    
  } catch (error) {
    console.error('Failed to activate color picker:', error);
    // #region agent log (debug-mode)
    dbg('H5', 'Chrome Extension Colored-In/background/service-worker.js:activateColorPicker:CATCH', 'activateColorPicker threw', {
      message: typeof error?.message === 'string' ? error.message.slice(0, 120) : String(error),
    });
    // #endregion
  }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  
  if (message.action === 'pickColor') {
    activateColorPicker({ source: 'popup' }).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }
  
  if (message.action === 'colorPicked') {
    // Color was picked, could store it or send to popup
    console.log('Color picked:', message.color);
    
    // Store last picked color
    chrome.storage.local.set({ lastPickedColor: message.color });
    
    sendResponse({ success: true });
    return true;
  }

  // #region agent log (debug-mode)
  if (message.action === 'debugLog') {
    dbg(
      typeof message.hypothesisId === 'string' ? message.hypothesisId : 'H?',
      typeof message.location === 'string' ? message.location : 'unknown',
      typeof message.message === 'string' ? message.message : 'debug',
      typeof message.data === 'object' && message.data ? message.data : {}
    );
    sendResponse({ success: true });
    return true;
  }
  // #endregion
});

// Handle extension icon click (optional - popup handles this)
chrome.action.onClicked.addListener((tab) => {
  // This won't fire if there's a popup defined, but just in case
  console.log('Extension icon clicked');
});

// On install, set default values
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set default values
    chrome.storage.local.set({
      paletteCount: 1,
      lastPickedColor: null
    });
    
    // Open welcome page or show notification
    console.log('Colored In extension installed successfully!');
  }
});

// Keep service worker alive (Manifest V3 requirement for persistent connections)
// This prevents the service worker from being terminated during long operations
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();
