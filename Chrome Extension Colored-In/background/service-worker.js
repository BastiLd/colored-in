// Colored In - Background Service Worker
// Handles keyboard shortcuts and color picker using EyeDropper API

const DEBUG_ENDPOINT = 'http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa';
const DEBUG_SESSION_ID = 'debug-session';
const DEBUG_RUN_ID = 'color-picker-pre-fix';

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
    await activateColorPicker();
  }
});

// Activate color picker in the current tab using EyeDropper API
async function activateColorPicker() {
  try {
    // #region agent log (debug-mode)
    dbg('H2', 'Chrome Extension Colored-In/background/service-worker.js:activateColorPicker:ENTRY', 'activateColorPicker called', {});
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
    
    // Inject and execute the EyeDropper API code
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        // Check if EyeDropper API is available
        if (!('EyeDropper' in window)) {
          // Fallback notification
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: #1a1a24;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            border-radius: 8px;
            border: 1px solid #8b5cf6;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 2147483647;
          `;
          notification.textContent = 'EyeDropper API is not supported in this browser. Please use Chrome 95+.';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 3000);
          return { success: false, error: 'EyeDropper not supported' };
        }
        
        try {
          const eyeDropper = new EyeDropper();
          const result = await eyeDropper.open();
          const color = result.sRGBHex.toUpperCase();
          
          // Copy to clipboard
          await navigator.clipboard.writeText(color);
          
          // Show success notification
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: #1a1a24;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            border-radius: 8px;
            border: 1px solid #8b5cf6;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 2147483647;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideUp 0.3s ease;
          `;
          
          // Add animation
          const style = document.createElement('style');
          style.textContent = `
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateX(-50%) translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
              }
            }
          `;
          document.head.appendChild(style);
          
          notification.innerHTML = `
            <div style="width: 24px; height: 24px; background: ${color}; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);"></div>
            <span>Copied <strong>${color}</strong> to clipboard!</span>
          `;
          
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
              notification.remove();
              style.remove();
            }, 300);
          }, 2000);
          
          return { success: true, color };
        } catch (error) {
          // User cancelled the picker
          console.log('Color picker cancelled or error:', error.message);
          return { success: false, error: error.message };
        }
      }
    });
    
    console.log('Color picker result:', results);
    // #region agent log (debug-mode)
    dbg('H4', 'Chrome Extension Colored-In/background/service-worker.js:activateColorPicker:RESULT', 'executeScript returned', {
      hasResults: Array.isArray(results),
      firstResultKeys: results?.[0]?.result ? Object.keys(results[0].result) : null,
      success: results?.[0]?.result?.success ?? null,
      error: typeof results?.[0]?.result?.error === 'string' ? results[0].result.error.slice(0, 80) : null,
    });
    // #endregion
    
    if (results && results[0] && results[0].result && results[0].result.success) {
      // Store the picked color
      chrome.storage.local.set({ lastPickedColor: results[0].result.color });
    }
    
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
    activateColorPicker().then(() => {
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
