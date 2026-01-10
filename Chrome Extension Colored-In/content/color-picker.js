// Color Picker Content Script
// This script is injected into web pages to enable color picking

(function() {
  // Prevent multiple injections
  if (window.__coloredInPickerActive) {
    return;
  }
  window.__coloredInPickerActive = true;

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

  // Function to get color at position
  function getColorAtPosition(x, y) {
    // Create a new canvas to capture the screen
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = window.innerWidth;
    captureCanvas.height = window.innerHeight;
    const captureCtx = captureCanvas.getContext('2d');
    
    // We can't directly capture the screen in content scripts
    // So we'll use a workaround - get the computed background color of elements
    const element = document.elementFromPoint(x, y);
    
    if (element) {
      const computedStyle = window.getComputedStyle(element);
      let color = computedStyle.backgroundColor;
      
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
    
    return '#FFFFFF';
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
    
    // Get color at position
    currentColor = getColorAtPosition(x, y);
    
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
  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
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
    window.__coloredInPickerActive = false;
  }

  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown);

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
  
  setTimeout(() => {
    instructions.style.opacity = '0';
    instructions.style.transition = 'opacity 0.3s ease';
    setTimeout(() => instructions.remove(), 300);
  }, 3000);
})();
