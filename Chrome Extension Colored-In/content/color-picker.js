// Color Picker Content Script
// This script is injected into web pages to enable color picking

(function() {
  // Prevent multiple injections
  if (window.__coloredInPickerActive) {
    return;
  }
  window.__coloredInPickerActive = true;

  // #region agent log (debug-mode)
  function dbg(hypothesisId, location, message, data) {
    try {
      chrome.runtime.sendMessage({
        action: 'debugLog',
        hypothesisId,
        location,
        message,
        data,
      });
    } catch {
      // ignore
    }
  }
  dbg('H6', 'Chrome Extension Colored-In/content/color-picker.js:INIT', 'overlay picker injected', {
    hrefPrefix: typeof location?.href === 'string' ? location.href.slice(0, 40) : null,
  });
  // #endregion

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.id = 'colored-in-picker-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2147483647;
    cursor: crosshair;
    background: transparent;
  `;

  // Create magnifier element
  const magnifier = document.createElement('div');
  magnifier.id = 'colored-in-magnifier';
  magnifier.style.cssText = `
    position: fixed;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 3px solid #8b5cf6;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    pointer-events: none;
    z-index: 2147483647;
    display: none;
    overflow: hidden;
    background: white;
  `;

  // Create color preview
  const colorPreview = document.createElement('div');
  colorPreview.id = 'colored-in-color-preview';
  colorPreview.style.cssText = `
    position: fixed;
    padding: 8px 12px;
    background: #1a1a24;
    color: white;
    font-family: monospace;
    font-size: 14px;
    border-radius: 6px;
    border: 1px solid #8b5cf6;
    pointer-events: none;
    z-index: 2147483647;
    display: none;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;

  // Create canvas for color extraction
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Add elements to page
  document.body.appendChild(overlay);
  document.body.appendChild(magnifier);
  document.body.appendChild(colorPreview);

  let currentColor = null;
  let isPicking = false;
  let captureImg = null;
  let captureScale = null; // imageWidth / window.innerWidth

  // Function to get color at position
  function getColorAtPosition(x, y) {
    // We can't directly capture the screen in content scripts.
    // Workaround: sample computed backgroundColor of the *underlying* element.
    // Important: our overlay sits on top, so elementFromPoint() would return the overlay.
    const elements = document.elementsFromPoint(x, y);

    // Prefer an element that actually has a non-transparent background color.
    const element = elements.find((el) => {
      if (!(el instanceof Element)) return false;
      const id = el.id || '';
      const isOurUi =
        id !== 'colored-in-picker-overlay' &&
        id !== 'colored-in-magnifier' &&
        id !== 'colored-in-color-preview';
      if (!isOurUi) return false;
      const bg = window.getComputedStyle(el).backgroundColor;
      return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    });
    
    if (element) {
      const computedStyle = window.getComputedStyle(element);
      let color = computedStyle.backgroundColor;

      // #region agent log (debug-mode)
      dbg('H6', 'Chrome Extension Colored-In/content/color-picker.js:SAMPLE', 'sample element', {
        tag: element.tagName,
        id: element.id || null,
        cls: typeof element.className === 'string' ? element.className.slice(0, 60) : null,
        bg: typeof color === 'string' ? color.slice(0, 40) : null,
        elementsTop3: elements
          .slice(0, 3)
          .map((el) => (el && el instanceof Element ? `${el.tagName}${el.id ? `#${el.id}` : ''}` : String(el))),
      });
      // #endregion
      
      // If transparent, try to get from parent or use white
      if (color === 'rgba(0, 0, 0, 0)' || color === 'transparent') {
        // Check if there's a background image or try parent
        let parent = element.parentElement;
        while (parent && (color === 'rgba(0, 0, 0, 0)' || color === 'transparent')) {
          const parentStyle = window.getComputedStyle(parent);
          color = parentStyle.backgroundColor;
          parent = parent.parentElement;
        }
        
        if (color === 'rgba(0, 0, 0, 0)' || color === 'transparent') {
          color = 'rgb(255, 255, 255)';
        }
      }
      
      return rgbToHex(color);
    }

    // #region agent log (debug-mode)
    dbg('H7', 'Chrome Extension Colored-In/content/color-picker.js:SAMPLE_NONE', 'no underlying element found', {
      x,
      y,
      elementsCount: Array.isArray(elements) ? elements.length : null,
    });
    // #endregion
    
    return '#FFFFFF';
  }

  // Pixel-accurate color sampling from a screenshot (for hover magnifier).
  async function ensureCapture() {
    // Hide our UI so it doesn't appear in the screenshot.
    const prevMagnifierDisplay = magnifier.style.display;
    const prevPreviewDisplay = colorPreview.style.display;
    magnifier.style.display = 'none';
    colorPreview.style.display = 'none';

    // #region agent log (debug-mode)
    dbg('H9', 'Chrome Extension Colored-In/content/color-picker.js:CAPTURE_REQ', 'request capture', {
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio,
    });
    // #endregion

    const resp = await chrome.runtime.sendMessage({ action: 'captureVisibleTab' });
    if (!resp?.success || typeof resp.dataUrl !== 'string') {
      // #region agent log (debug-mode)
      dbg('H10', 'Chrome Extension Colored-In/content/color-picker.js:CAPTURE_FAIL', 'capture response not ok', {
        success: resp?.success ?? null,
        error: typeof resp?.error === 'string' ? resp.error.slice(0, 160) : null,
      });
      // #endregion
      magnifier.style.display = prevMagnifierDisplay;
      colorPreview.style.display = prevPreviewDisplay;
      return;
    }

    const img = new Image();
    img.src = resp.dataUrl;
    try {
      await img.decode();
      captureImg = img;
      captureScale = img.width / window.innerWidth;

      // #region agent log (debug-mode)
      dbg('H9', 'Chrome Extension Colored-In/content/color-picker.js:CAPTURE_OK', 'capture decoded', {
        imgW: img.width,
        imgH: img.height,
        scale: captureScale,
      });
      // #endregion
    } catch (e) {
      // #region agent log (debug-mode)
      dbg('H10', 'Chrome Extension Colored-In/content/color-picker.js:CAPTURE_DECODE_ERR', 'capture decode failed', {
        message: typeof e?.message === 'string' ? e.message.slice(0, 160) : String(e),
      });
      // #endregion
    } finally {
      magnifier.style.display = prevMagnifierDisplay;
      colorPreview.style.display = prevPreviewDisplay;
    }
  }

  function samplePixelColor(x, y) {
    if (!captureImg || !captureScale || !ctx) return null;
    const sx = Math.max(0, Math.min(captureImg.width - 1, Math.floor(x * captureScale)));
    const sy = Math.max(0, Math.min(captureImg.height - 1, Math.floor(y * captureScale)));
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.drawImage(captureImg, sx, sy, 1, 1, 0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      const color = '#' + [data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      return color;
    } catch (e) {
      return null;
    }
  }

  // Convert RGB to HEX
  function rgbToHex(rgb) {
    // Handle rgba format
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('').toUpperCase();
    }
    return rgb;
  }

  // Mouse move handler
  function handleMouseMove(e) {
    if (isPicking) return;
    const x = e.clientX;
    const y = e.clientY;
    
    // Update magnifier position
    magnifier.style.left = (x + 20) + 'px';
    magnifier.style.top = (y + 20) + 'px';
    magnifier.style.display = 'block';
    
    // Update color preview position
    colorPreview.style.left = (x + 20) + 'px';
    colorPreview.style.top = (y + 130) + 'px';
    colorPreview.style.display = 'block';
    
    // Get color at position (prefer pixel-sampling if we have a capture)
    currentColor = samplePixelColor(x, y) || getColorAtPosition(x, y);
    
    // Update magnifier background
    magnifier.style.background = currentColor;
    
    // Update color preview
    colorPreview.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 20px; background: ${currentColor}; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);"></div>
        <span>${currentColor}</span>
      </div>
    `;
  }

  // Click handler
  async function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (isPicking) return;
    isPicking = true;

    // #region agent log (debug-mode)
    dbg('H8', 'Chrome Extension Colored-In/content/color-picker.js:CLICK_ENTRY', 'click - attempt EyeDropper', {
      hasEyeDropper: 'EyeDropper' in window,
    });
    // #endregion

    // IMPORTANT: disable our overlay from intercepting while EyeDropper is active.
    overlay.style.pointerEvents = 'none';
    magnifier.style.display = 'none';
    colorPreview.style.display = 'none';

    // Pixel-accurate pick on click (user gesture) if available.
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new EyeDropper();
        const result = await eyeDropper.open();
        currentColor = String(result?.sRGBHex || '').toUpperCase();
        // #region agent log (debug-mode)
        dbg('H8', 'Chrome Extension Colored-In/content/color-picker.js:EYEDROPPER_OK', 'EyeDropper returned', {
          color: currentColor,
        });
        // #endregion
      } catch (error) {
        // #region agent log (debug-mode)
        dbg('H8', 'Chrome Extension Colored-In/content/color-picker.js:EYEDROPPER_ERR', 'EyeDropper failed/cancelled', {
          message: typeof error?.message === 'string' ? error.message.slice(0, 120) : String(error),
        });
        // #endregion
      }
    }

    // Fallback heuristic if EyeDropper unavailable/cancelled.
    if (!currentColor || typeof currentColor !== 'string' || !currentColor.startsWith('#')) {
      currentColor = samplePixelColor(e.clientX, e.clientY) || getColorAtPosition(e.clientX, e.clientY);
      // #region agent log (debug-mode)
      dbg('H6', 'Chrome Extension Colored-In/content/color-picker.js:CLICK', 'click picked color (fallback)', {
        color: currentColor,
      });
      // #endregion
    }
    
    if (currentColor) {
      // Copy to clipboard
      navigator.clipboard.writeText(currentColor).then(() => {
        showNotification(currentColor);
      }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback - try using execCommand
        const input = document.createElement('input');
        input.value = currentColor;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showNotification(currentColor);
      });

      // Best-effort: notify background so popup can display last picked color if needed.
      try {
        chrome.runtime.sendMessage({ action: 'colorPicked', color: currentColor });
      } catch {
        // ignore
      }
    }
    
    cleanup();
  }

  // Show notification
  function showNotification(color) {
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
    
    notification.innerHTML = `
      <div style="width: 24px; height: 24px; background: ${color}; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);"></div>
      <span>Copied <strong>${color}</strong> to clipboard!</span>
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
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        notification.remove();
        style.remove();
      }, 300);
    }, 2000);
  }

  // Escape key handler
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup();
    }
  }

  // Cleanup function
  function cleanup() {
    overlay.remove();
    magnifier.remove();
    colorPreview.remove();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('scroll', ensureCapture, true);
    window.removeEventListener('resize', ensureCapture);
    window.__coloredInPickerActive = false;
    isPicking = false;
    captureImg = null;
    captureScale = null;
  }

  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown);
  window.addEventListener('scroll', ensureCapture, true);
  window.addEventListener('resize', ensureCapture);

  // Show initial instructions
  const instructions = document.createElement('div');
  instructions.style.cssText = `
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
    animation: fadeIn 0.3s ease;
  `;
  instructions.innerHTML = `
    <strong>Color Picker Active</strong> - Click anywhere to copy color. Press <kbd style="background: #2a2a3a; padding: 2px 6px; border-radius: 4px; margin: 0 4px;">ESC</kbd> to cancel.
  `;
  
  document.body.appendChild(instructions);

  // Get an initial capture so hover preview can be pixel-accurate.
  ensureCapture();
  
  setTimeout(() => {
    instructions.style.opacity = '0';
    instructions.style.transition = 'opacity 0.3s ease';
    setTimeout(() => instructions.remove(), 300);
  }, 3000);
})();
