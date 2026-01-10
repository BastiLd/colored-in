// Colored In - Background Service Worker
// Handles keyboard shortcuts and color picker injection

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  
  if (command === 'pick-color') {
    await activateColorPicker();
  }
});

// Activate color picker in the current tab
async function activateColorPicker() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      console.error('No active tab found');
      return;
    }
    
    // Check if we can inject into this tab
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:')) {
      console.log('Cannot inject into browser internal pages');
      // Show notification that color picker doesn't work on this page
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Colored In',
        message: 'Color picker cannot be used on browser internal pages.'
      });
      return;
    }
    
    // Inject the color picker script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/color-picker.js']
    });
    
    console.log('Color picker injected into tab:', tab.id);
    
  } catch (error) {
    console.error('Failed to activate color picker:', error);
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
