// Colored In - Chrome Extension Popup

// ============================================
// State Management
// ============================================
const state = {
  user: null,
  subscription: null,
  paletteCount: 1,
  currentView: 'login',
  selectedAsset: null,
  selectedAssetType: null,
  generatedPalettes: [],
  assets: [],
};

// ============================================
// DOM Elements
// ============================================
const elements = {
  // Header
  menuBtn: document.getElementById('menu-btn'),
  paletteCountBtn: document.getElementById('palette-count-btn'),
  paletteCountText: document.getElementById('palette-count-text'),
  paletteCountDropdown: document.getElementById('palette-count-dropdown'),
  homeBtn: document.getElementById('home-btn'),

  // Side Menu
  sideMenu: document.getElementById('side-menu'),
  menuOverlay: document.getElementById('menu-overlay'),
  closeMenuBtn: document.getElementById('close-menu-btn'),
  menuAI: document.getElementById('menu-ai'),
  menuManual: document.getElementById('menu-manual'),
  menuAnalyze: document.getElementById('menu-analyze'),
  logoutBtn: document.getElementById('logout-btn'),

  // Views
  loginView: document.getElementById('login-view'),
  blurView: document.getElementById('blur-view'),
  mainView: document.getElementById('main-view'),
  aiView: document.getElementById('ai-view'),
  analyzeView: document.getElementById('analyze-view'),
  detailView: document.getElementById('detail-view'),

  // Login
  loginForm: document.getElementById('login-form'),
  emailInput: document.getElementById('email'),
  passwordInput: document.getElementById('password'),
  loginBtn: document.getElementById('login-btn'),
  loginError: document.getElementById('login-error'),

  // Blur View
  upgradeBtn: document.getElementById('upgrade-btn'),

  // Main View
  userEmail: document.getElementById('user-email'),
  userPlan: document.getElementById('user-plan'),
  quickAI: document.getElementById('quick-ai'),
  quickManual: document.getElementById('quick-manual'),
  quickAnalyze: document.getElementById('quick-analyze'),

  // AI View
  aiBackBtn: document.getElementById('ai-back-btn'),
  aiResults: document.getElementById('ai-results'),
  aiPrompt: document.getElementById('ai-prompt'),
  aiGenerateBtn: document.getElementById('ai-generate-btn'),
  aiError: document.getElementById('ai-error'),

  // Analyze View
  analyzeBackBtn: document.getElementById('analyze-back-btn'),
  tabSaved: document.getElementById('tab-saved'),
  tabNew: document.getElementById('tab-new'),
  savedAssetsPanel: document.getElementById('saved-assets-panel'),
  newAssetPanel: document.getElementById('new-asset-panel'),
  savedAssetsList: document.getElementById('saved-assets-list'),
  newLinkInput: document.getElementById('new-link-input'),
  addLinkBtn: document.getElementById('add-link-btn'),
  newImageInput: document.getElementById('new-image-input'),
  uploadImageBtn: document.getElementById('upload-image-btn'),
  selectedFile: document.getElementById('selected-file'),
  selectedAssetPreview: document.getElementById('selected-asset-preview'),
  assetPreviewContent: document.getElementById('asset-preview-content'),
  analyzeBtn: document.getElementById('analyze-btn'),
  analyzeResults: document.getElementById('analyze-results'),
  analyzeError: document.getElementById('analyze-error'),

  // Analyze Modal
  analyzeModal: document.getElementById('analyze-modal'),
  closeAnalyzeModal: document.getElementById('close-analyze-modal'),
  modeExpand: document.getElementById('mode-expand'),
  modeImprove: document.getElementById('mode-improve'),
  modeExtract: document.getElementById('mode-extract'),
  expandInputSection: document.getElementById('expand-input-section'),
  expandText: document.getElementById('expand-text'),
  confirmExpandBtn: document.getElementById('confirm-expand-btn'),

  // Detail View
  detailBackBtn: document.getElementById('detail-back-btn'),
  detailPaletteName: document.getElementById('detail-palette-name'),
  detailContent: document.getElementById('detail-content'),

  // Toast
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),
};

// ============================================
// Utility Functions
// ============================================
function showToast(message, type = 'info') {
  elements.toast.className = `toast ${type}`;
  elements.toastMessage.textContent = message;
  elements.toast.classList.remove('hidden');
  
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3000);
}

function showView(viewName) {
  // Hide all views
  elements.loginView.classList.add('hidden');
  elements.blurView.classList.add('hidden');
  elements.mainView.classList.add('hidden');
  elements.aiView.classList.add('hidden');
  elements.analyzeView.classList.add('hidden');
  elements.detailView.classList.add('hidden');

  // Show requested view
  const viewElement = document.getElementById(`${viewName}-view`);
  if (viewElement) {
    viewElement.classList.remove('hidden');
  }

  state.currentView = viewName;
  closeMenu();
}

function setLoading(button, loading) {
  const span = button.querySelector('span');
  const spinner = button.querySelector('.spinner');
  
  if (loading) {
    if (span) span.classList.add('hidden');
    if (spinner) spinner.classList.remove('hidden');
    button.disabled = true;
  } else {
    if (span) span.classList.remove('hidden');
    if (spinner) spinner.classList.add('hidden');
    button.disabled = false;
  }
}

function isPremiumUser() {
  const rawPlan = state.subscription?.plan;
  const plan = window.SupabaseClient?.normalizePlan?.(rawPlan) || (typeof rawPlan === 'string' ? rawPlan.toLowerCase() : 'free');
  const isActive = Boolean(state.subscription?.is_active);
  return isActive && (plan === 'ultra' || plan === 'individual');
}

// ============================================
// Authentication
// ============================================
async function checkAuth() {
  try {
    const session = await SupabaseClient.getSession();
    
    if (session && session.user) {
      state.user = session.user;
      await loadSubscription();
      
      if (isPremiumUser()) {
        updateUserInfo();
        showView('main');
      } else {
        showView('blur');
      }
    } else {
      showView('login');
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showView('login');
  }
}

async function login(email, password) {
  setLoading(elements.loginBtn, true);
  elements.loginError.classList.add('hidden');
  
  try {
    const data = await SupabaseClient.signIn(email, password);
    state.user = data.user;
    await loadSubscription();
    
    if (isPremiumUser()) {
      updateUserInfo();
      showView('main');
    } else {
      showView('blur');
    }
    
    showToast('Signed in successfully!', 'success');
  } catch (error) {
    console.error('Login failed:', error);
    elements.loginError.textContent = error.message || 'Login failed. Please try again.';
    elements.loginError.classList.remove('hidden');
  } finally {
    setLoading(elements.loginBtn, false);
  }
}

async function logout() {
  await SupabaseClient.signOut();
  state.user = null;
  state.subscription = null;
  showView('login');
  showToast('Signed out');
}

async function loadSubscription() {
  if (!state.user) return;
  
  try {
    // Ensure remote config is loaded before making API calls
    await SupabaseClient.ensureConfig();
    const subscription = await SupabaseClient.getUserSubscription(state.user.id);
    state.subscription = subscription;
  } catch (error) {
    console.error('Failed to load subscription:', error);
    state.subscription = null;
  }
}

function updateUserInfo() {
  if (state.user) {
    elements.userEmail.textContent = state.user.email;
  }
  
  const plan = state.subscription?.plan || 'Free';
  elements.userPlan.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
}

// ============================================
// Menu
// ============================================
function openMenu() {
  elements.sideMenu.classList.add('open');
  elements.sideMenu.classList.remove('hidden');
  elements.menuOverlay.classList.add('open');
  elements.menuOverlay.classList.remove('hidden');
}

function closeMenu() {
  elements.sideMenu.classList.remove('open');
  elements.menuOverlay.classList.remove('open');
  
  setTimeout(() => {
    elements.sideMenu.classList.add('hidden');
    elements.menuOverlay.classList.add('hidden');
  }, 300);
}

// ============================================
// Palette Count
// ============================================
async function loadPaletteCount() {
  const result = await chrome.storage.local.get('paletteCount');
  state.paletteCount = result.paletteCount || 1;
  updatePaletteCountUI();
}

function updatePaletteCountUI() {
  elements.paletteCountText.textContent = state.paletteCount === 1 ? '1 Palette' : '2 Palettes';
  
  // Update dropdown active state
  const items = elements.paletteCountDropdown.querySelectorAll('.dropdown-item');
  items.forEach(item => {
    if (parseInt(item.dataset.count) === state.paletteCount) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

async function setPaletteCount(count) {
  state.paletteCount = count;
  await chrome.storage.local.set({ paletteCount: count });
  updatePaletteCountUI();
  togglePaletteCountDropdown(false);
}

function togglePaletteCountDropdown(show) {
  if (show === undefined) {
    elements.paletteCountDropdown.classList.toggle('hidden');
  } else if (show) {
    elements.paletteCountDropdown.classList.remove('hidden');
  } else {
    elements.paletteCountDropdown.classList.add('hidden');
  }
}

// ============================================
// AI Palette Generator
// ============================================
async function generatePalette() {
  const prompt = elements.aiPrompt.value.trim();
  
  if (!prompt) {
    showToast('Please enter a description', 'error');
    return;
  }
  
  setLoading(elements.aiGenerateBtn, true);
  elements.aiError.classList.add('hidden');
  
  try {
    const palettes = [];
    
    // Generate requested number of palettes
    for (let i = 0; i < state.paletteCount; i++) {
      const result = await SupabaseClient.generatePalette(prompt);
      palettes.push(result);
    }
    
    state.generatedPalettes = palettes;
    renderPalettes(palettes, elements.aiResults);
    elements.aiPrompt.value = '';
    
  } catch (error) {
    console.error('Palette generation failed:', error);
    elements.aiError.textContent = error.message || 'Failed to generate palette';
    elements.aiError.classList.remove('hidden');
  } finally {
    setLoading(elements.aiGenerateBtn, false);
  }
}

function renderPalettes(palettes, container) {
  container.innerHTML = '';
  
  palettes.forEach((palette, index) => {
    const card = document.createElement('div');
    card.className = 'palette-card';
    
    const colorsDiv = document.createElement('div');
    colorsDiv.className = 'palette-colors';
    
    palette.colors.forEach(color => {
      const colorDiv = document.createElement('div');
      colorDiv.className = 'palette-color';
      colorDiv.style.backgroundColor = color;
      colorDiv.title = color;
      colorDiv.addEventListener('click', () => copyColor(color));
      colorsDiv.appendChild(colorDiv);
    });
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'palette-info';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'palette-name';
    nameSpan.textContent = palette.name || `Palette ${index + 1}`;
    nameSpan.addEventListener('click', () => showPaletteDetail(palette));
    
    const descSpan = document.createElement('p');
    descSpan.className = 'palette-description';
    descSpan.textContent = palette.description || '';
    
    infoDiv.appendChild(nameSpan);
    if (palette.description) {
      infoDiv.appendChild(descSpan);
    }
    
    card.appendChild(colorsDiv);
    card.appendChild(infoDiv);
    container.appendChild(card);
  });
}

function copyColor(color) {
  navigator.clipboard.writeText(color).then(() => {
    showToast(`Copied ${color}`, 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

// ============================================
// Analyze and Create
// ============================================
async function loadAssets() {
  if (!state.user) return;
  
  elements.savedAssetsList.innerHTML = '<p class="loading-text">Loading assets...</p>';
  
  try {
    // Ensure remote config is loaded before making API calls
    await SupabaseClient.ensureConfig();
    const assets = await SupabaseClient.getUserAssets(state.user.id);
    state.assets = assets;
    renderAssets(assets);
  } catch (error) {
    console.error('Failed to load assets:', error);
    elements.savedAssetsList.innerHTML = '<p class="loading-text">Failed to load assets</p>';
  }
}

function renderAssets(assets) {
  if (assets.length === 0) {
    elements.savedAssetsList.innerHTML = '<p class="loading-text">No saved assets. Add a link or image!</p>';
    return;
  }
  
  elements.savedAssetsList.innerHTML = '';
  
  assets.forEach(asset => {
    const item = document.createElement('div');
    item.className = 'asset-item';
    item.dataset.id = asset.id;
    item.dataset.type = asset.type;
    item.dataset.url = asset.url;
    
    if (asset.type === 'image') {
      const img = document.createElement('img');
      img.src = asset.url;
      img.alt = asset.filename || 'Image';
      item.appendChild(img);
    } else {
      const iconDiv = document.createElement('div');
      iconDiv.className = 'asset-icon';
      iconDiv.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
      `;
      item.appendChild(iconDiv);
    }
    
    const span = document.createElement('span');
    span.textContent = asset.filename || asset.url;
    item.appendChild(span);
    
    item.addEventListener('click', () => selectAsset(asset));
    elements.savedAssetsList.appendChild(item);
  });
}

function selectAsset(asset) {
  // Deselect previous
  document.querySelectorAll('.asset-item').forEach(el => el.classList.remove('selected'));
  
  // Select new
  const item = document.querySelector(`.asset-item[data-id="${asset.id}"]`);
  if (item) {
    item.classList.add('selected');
  }
  
  state.selectedAsset = asset.url;
  state.selectedAssetType = asset.type;
  
  // Show preview
  elements.selectedAssetPreview.classList.remove('hidden');
  
  if (asset.type === 'image') {
    elements.assetPreviewContent.innerHTML = `<img src="${asset.url}" alt="Selected">`;
  } else {
    elements.assetPreviewContent.innerHTML = `
      <div class="preview-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        <span>${asset.url}</span>
      </div>
    `;
  }
}

function selectNewLink() {
  const url = elements.newLinkInput.value.trim();
  
  if (!url) {
    showToast('Please enter a URL', 'error');
    return;
  }
  
  try {
    new URL(url);
  } catch {
    showToast('Please enter a valid URL', 'error');
    return;
  }
  
  state.selectedAsset = url;
  state.selectedAssetType = 'link';
  
  elements.selectedAssetPreview.classList.remove('hidden');
  elements.assetPreviewContent.innerHTML = `
    <div class="preview-link">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
      </svg>
      <span>${url}</span>
    </div>
  `;
  
  showToast('Link selected');
}

async function saveNewLink() {
  const url = elements.newLinkInput.value.trim();
  if (!url) return;

  try {
    new URL(url);
  } catch {
    showToast('Please enter a valid URL', 'error');
    return;
  }

  if (!state.user) {
    showToast('Please sign in first', 'error');
    return;
  }

  try {
    setLoading(elements.addLinkBtn, true);
    await SupabaseClient.ensureConfig();
    const created = await SupabaseClient.createUserAsset({
      user_id: state.user.id,
      type: 'link',
      url,
      filename: null,
    });

    elements.newLinkInput.value = '';
    await loadAssets();

    if (created?.id) {
      // Select the newly created asset
      selectAsset(created);
    } else {
      // Fallback to selecting the raw URL
      state.selectedAsset = url;
      state.selectedAssetType = 'link';
    }

    showToast('Link saved!', 'success');
  } catch (error) {
    console.error('Failed to save link:', error);
    showToast(error?.message || 'Failed to save link', 'error');
  } finally {
    setLoading(elements.addLinkBtn, false);
  }
}

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Convert to data URL for preview
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    // Show immediate preview from local file
    state.selectedAsset = dataUrl;
    state.selectedAssetType = 'image';
    
    elements.selectedFile.textContent = file.name;
    elements.selectedAssetPreview.classList.remove('hidden');
    elements.assetPreviewContent.innerHTML = `<img src="${dataUrl}" alt="Selected">`;
    
    showToast('Uploading image...', 'info');

    if (!state.user) {
      showToast('Please sign in first', 'error');
      return;
    }

    try {
      // Upload to storage and save to DB so it appears in Saved Assets + Dashboard
      await SupabaseClient.ensureConfig();
      const uploaded = await SupabaseClient.uploadUserAssetImage(state.user.id, file);
      const created = await SupabaseClient.createUserAsset({
        user_id: state.user.id,
        type: 'image',
        url: uploaded.publicUrl,
        filename: uploaded.filename || file.name,
      });

      // Use the stored URL for analysis so the asset is persistent
      state.selectedAsset = uploaded.publicUrl;
      state.selectedAssetType = 'image';

      await loadAssets();
      if (created?.id) {
        selectAsset(created);
      }

      showToast('Image saved!', 'success');
    } catch (error) {
      console.error('Failed to upload image:', error);
      showToast(error?.message || 'Failed to upload image', 'error');
    }
  };
  reader.readAsDataURL(file);
}

function openAnalyzeModal() {
  if (!state.selectedAsset) {
    showToast('Please select an asset first', 'error');
    return;
  }
  
  elements.analyzeModal.classList.remove('hidden');
  elements.expandInputSection.classList.add('hidden');
}

function closeAnalyzeModalFn() {
  elements.analyzeModal.classList.add('hidden');
  elements.expandInputSection.classList.add('hidden');
}

async function analyzeWithMode(mode) {
  if (mode === 'expand') {
    elements.expandInputSection.classList.remove('hidden');
    return;
  }
  
  closeAnalyzeModalFn();
  await performAnalysis(mode);
}

async function performAnalysis(mode, expandText = '') {
  setLoading(elements.analyzeBtn, true);
  elements.analyzeError.classList.add('hidden');
  
  try {
    const palettes = [];
    
    for (let i = 0; i < state.paletteCount; i++) {
      const result = await SupabaseClient.analyzeAsset(
        state.selectedAssetType,
        state.selectedAsset,
        mode,
        expandText
      );
      palettes.push(result);
    }
    
    state.generatedPalettes = palettes;
    elements.analyzeResults.classList.remove('hidden');
    renderPalettes(palettes, elements.analyzeResults);
    
    showToast('Analysis complete!', 'success');
    
  } catch (error) {
    console.error('Analysis failed:', error);
    elements.analyzeError.textContent = error.message || 'Analysis failed';
    elements.analyzeError.classList.remove('hidden');
  } finally {
    setLoading(elements.analyzeBtn, false);
    closeAnalyzeModalFn();
  }
}

// ============================================
// Palette Detail View
// ============================================
function showPaletteDetail(palette) {
  elements.detailPaletteName.textContent = palette.name || 'Palette Details';
  
  elements.detailContent.innerHTML = '';
  
  palette.colors.forEach((color, index) => {
    const colorDiv = document.createElement('div');
    colorDiv.className = 'detail-color';
    
    const swatchDiv = document.createElement('div');
    swatchDiv.className = 'detail-swatch';
    swatchDiv.style.backgroundColor = color;
    swatchDiv.addEventListener('click', () => copyColor(color));
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'detail-color-info';
    
    const hexDiv = document.createElement('div');
    hexDiv.className = 'detail-hex';
    hexDiv.innerHTML = `
      ${color}
      <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
    hexDiv.querySelector('.copy-icon').addEventListener('click', (e) => {
      e.stopPropagation();
      copyColor(color);
    });
    
    infoDiv.appendChild(hexDiv);
    
    // Add description if available (for improve mode)
    if (palette.colorDescriptions && palette.colorDescriptions[index]) {
      const descP = document.createElement('p');
      descP.className = 'detail-description';
      descP.textContent = palette.colorDescriptions[index];
      infoDiv.appendChild(descP);
    }
    
    colorDiv.appendChild(swatchDiv);
    colorDiv.appendChild(infoDiv);
    elements.detailContent.appendChild(colorDiv);
  });
  
  // Add palette description if available
  if (palette.description) {
    const descDiv = document.createElement('div');
    descDiv.className = 'palette-description';
    descDiv.style.padding = '12px';
    descDiv.style.marginTop = '16px';
    descDiv.style.background = 'var(--bg-card)';
    descDiv.style.borderRadius = '8px';
    descDiv.innerHTML = `<strong>Description:</strong> ${palette.description}`;
    elements.detailContent.appendChild(descDiv);
  }
  
  showView('detail');
}

// ============================================
// Event Listeners
// ============================================
function initEventListeners() {
  // Header
  elements.menuBtn.addEventListener('click', openMenu);
  elements.homeBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://bastild.github.io/colored-in/dashboard' });
  });
  elements.paletteCountBtn.addEventListener('click', () => togglePaletteCountDropdown());

  // Palette Count Dropdown
  elements.paletteCountDropdown.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => setPaletteCount(parseInt(item.dataset.count)));
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!elements.paletteCountBtn.contains(e.target) && !elements.paletteCountDropdown.contains(e.target)) {
      togglePaletteCountDropdown(false);
    }
  });

  // Side Menu
  elements.closeMenuBtn.addEventListener('click', closeMenu);
  elements.menuOverlay.addEventListener('click', closeMenu);
  elements.menuAI.addEventListener('click', () => showView('ai'));
  elements.menuManual.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://bastild.github.io/colored-in/pro-builder' });
  });
  elements.menuAnalyze.addEventListener('click', () => {
    showView('analyze');
    loadAssets();
  });
  elements.logoutBtn.addEventListener('click', logout);

  // Login
  elements.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    login(elements.emailInput.value, elements.passwordInput.value);
  });

  // Blur View
  elements.upgradeBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://bastild.github.io/colored-in/pricing' });
  });

  // Main View Quick Actions
  elements.quickAI.addEventListener('click', () => showView('ai'));
  elements.quickManual.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://bastild.github.io/colored-in/pro-builder' });
  });
  elements.quickAnalyze.addEventListener('click', () => {
    showView('analyze');
    loadAssets();
  });

  // AI View
  elements.aiBackBtn.addEventListener('click', () => showView('main'));
  elements.aiGenerateBtn.addEventListener('click', generatePalette);
  elements.aiPrompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generatePalette();
    }
  });

  // Analyze View
  elements.analyzeBackBtn.addEventListener('click', () => showView('main'));
  elements.tabSaved.addEventListener('click', () => {
    elements.tabSaved.classList.add('active');
    elements.tabNew.classList.remove('active');
    elements.savedAssetsPanel.classList.remove('hidden');
    elements.newAssetPanel.classList.add('hidden');
  });
  elements.tabNew.addEventListener('click', () => {
    elements.tabNew.classList.add('active');
    elements.tabSaved.classList.remove('active');
    elements.newAssetPanel.classList.remove('hidden');
    elements.savedAssetsPanel.classList.add('hidden');
  });
  elements.addLinkBtn.addEventListener('click', saveNewLink);
  elements.uploadImageBtn.addEventListener('click', () => elements.newImageInput.click());
  elements.newImageInput.addEventListener('change', handleImageSelect);
  elements.analyzeBtn.addEventListener('click', openAnalyzeModal);

  // Analyze Modal
  elements.closeAnalyzeModal.addEventListener('click', closeAnalyzeModalFn);
  elements.modeExpand.addEventListener('click', () => analyzeWithMode('expand'));
  elements.modeImprove.addEventListener('click', () => analyzeWithMode('improve'));
  elements.modeExtract.addEventListener('click', () => analyzeWithMode('extract'));
  elements.confirmExpandBtn.addEventListener('click', async () => {
    const text = elements.expandText.value.trim();
    if (!text) {
      showToast('Please enter a description', 'error');
      return;
    }
    // Disable button and show loading
    elements.confirmExpandBtn.disabled = true;
    elements.confirmExpandBtn.textContent = 'Generating...';
    try {
      await performAnalysis('expand', text);
    } finally {
      elements.confirmExpandBtn.disabled = false;
      elements.confirmExpandBtn.textContent = 'Generate Palette';
    }
  });

  // Detail View
  elements.detailBackBtn.addEventListener('click', () => {
    // Go back to the previous view (AI or Analyze)
    if (state.currentView === 'detail') {
      showView('ai'); // Default to AI view
    }
  });

  // Close modal on backdrop click
  elements.analyzeModal.addEventListener('click', (e) => {
    if (e.target === elements.analyzeModal) {
      closeAnalyzeModalFn();
    }
  });
}

// ============================================
// Initialize
// ============================================
async function init() {
  initEventListeners();
  await loadPaletteCount();
  await checkAuth();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
