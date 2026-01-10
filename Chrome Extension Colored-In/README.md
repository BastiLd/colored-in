# Colored In - Chrome Extension

A powerful Chrome extension for AI-powered color palette generation and analysis.

## Features

### For All Users (Free, Pro, Ultra, Individual)
- **Color Picker**: Press `ALT+SHIFT+C` on any webpage to pick colors and copy them to clipboard

### For Ultra & Individual Plans
- **Create with AI**: Generate beautiful palettes using AI with natural language descriptions
- **Manual Builder**: Quick link to open the full Manual Builder on the website
- **Analyze and Create**: Three powerful analysis modes:
  - **Analyze and Expand**: Combine an image/link with your creative direction
  - **Analyze and Improve**: Get AI suggestions with explanations for each color choice
  - **Analyze and Extract**: Extract the exact colors from any image or website
- **Multiple Palettes**: Generate 1 or 2 palettes at once

## Installation

### Developer Mode (for testing)
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the `Chrome Extension Colored-In` folder
5. The extension icon will appear in your toolbar

### From Chrome Web Store (coming soon)
The extension will be available on the Chrome Web Store after review.

## Usage

### Color Picker
1. Press `ALT+SHIFT+C` on any webpage
2. Click anywhere on the page to pick a color
3. The HEX code is automatically copied to your clipboard
4. Press `ESC` to cancel

### AI Palette Generation
1. Click the extension icon
2. Sign in with your Colored In account (Ultra or Individual plan required)
3. Click "Create with AI" from the menu
4. Describe your desired palette (e.g., "sunset beach vibes")
5. Click Generate

### Analyze Assets
1. Click the extension icon
2. Go to "Analyze and Create"
3. Select a saved asset or add a new link/image
4. Click "Analyze" and choose your analysis mode:
   - **Expand**: Add your own creative direction
   - **Improve**: Get color suggestions with explanations
   - **Extract**: Pull exact colors from the asset

## Plan Requirements

| Feature | Free | Pro | Ultra | Individual |
|---------|------|-----|-------|------------|
| Color Picker | ✅ | ✅ | ✅ | ✅ |
| AI Palette Generation | ❌ | ❌ | ✅ | ✅ |
| Analyze and Extract | ❌ | ❌ | ✅ | ✅ |
| Analyze and Expand | ❌ | ❌ | ✅ | ✅ |
| Analyze and Improve | ❌ | ❌ | ✅ | ✅ |
| Multiple Palettes | ❌ | ❌ | ✅ | ✅ |

## File Structure

```
Chrome Extension Colored-In/
├── manifest.json           # Extension configuration
├── popup/
│   ├── popup.html          # Main popup interface
│   ├── popup.css           # Styles
│   └── popup.js            # UI logic
├── background/
│   └── service-worker.js   # Keyboard shortcuts handling
├── content/
│   └── color-picker.js     # Color picker tool
├── lib/
│   └── supabase.js         # Supabase client
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Development

### Prerequisites
- Chrome browser (version 88+)
- Colored In account with Ultra or Individual plan for full features

### Local Development
1. Clone the repository
2. Navigate to `Chrome Extension Colored-In` folder
3. Load unpacked extension in Chrome
4. Make changes and click "Reload" in `chrome://extensions/`

### Building for Production
1. Update version in `manifest.json`
2. Zip the entire folder
3. Submit to Chrome Web Store

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `ALT+SHIFT+C` | Activate color picker |
| `ESC` | Cancel color picker |

## Troubleshooting

### Extension not working?
1. Make sure you're signed in with a valid account
2. Check that your plan is Ultra or Individual
3. Refresh the page and try again

### Color picker not activating?
1. The shortcut may conflict with other extensions
2. Go to `chrome://extensions/shortcuts` to verify/change the shortcut
3. Some browser internal pages don't allow color picking

### Login issues?
1. Check your email and password
2. Try signing in on the main website first
3. Clear extension storage and try again

## Support

For help and support, visit [Colored In](https://bastild.github.io/colored-in/) or contact us through the website.

## License

Copyright © 2026 Colored In. All rights reserved.
