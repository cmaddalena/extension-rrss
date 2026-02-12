// Commentor Module - Configuration & Referentes Management

class CommentorManager {
  constructor() {
    this.aiConfig = null;
    this.globalPrompt = null;
    this.referentes = [];
    this.currentEditingId = null;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  async init() {
    await this.loadConfig();
    await this.loadReferentes();
    this.setupEventListeners();
    this.renderReferentes();
    this.updateUI();
  }

  async loadConfig() {
    const result = await chrome.storage.local.get(['commentorAIConfig', 'commentorGlobalPrompt']);
    
    this.aiConfig = result.commentorAIConfig || {
      provider: 'anthropic',
      apiKey: '',
      model: 'claude-3-5-sonnet-20241022'
    };
    
    this.globalPrompt = result.commentorGlobalPrompt || {
      expertise: 'IA, Ventas B2B, Automatización',
      objective: 'autoridad',
      tone: 'profesional',
      instructions: 'Aporta valor, sé auténtico, max 150 chars, evita emojis excesivos'
    };
    
    // Load UI
    this.loadAIConfigUI();
    this.loadGlobalPromptUI();
  }

  async loadReferentes() {
    const result = await chrome.storage.local.get('commentorReferentes');
    this.referentes = result.commentorReferentes || [];
  }

  async saveConfig() {
    await chrome.storage.local.set({
      commentorAIConfig: this.aiConfig,
      commentorGlobalPrompt: this.globalPrompt
    });
  }

  async saveReferentes() {
    await chrome.storage.local.set({
      commentorReferentes: this.referentes
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // AI CONFIGURATION
  // ═══════════════════════════════════════════════════════════════

  loadAIConfigUI() {
    // Provider
    const providerRadios = document.querySelectorAll('input[name="ai-provider"]');
    providerRadios.forEach(radio => {
      if (radio.value === this.aiConfig.provider) {
        radio.checked = true;
      }
    });
    
    // API Key
    document.getElementById('ai-api-key').value = this.aiConfig.apiKey || '';
  }

  async saveAIConfig() {
    const provider = document.querySelector('input[name="ai-provider"]:checked').value;
    const apiKey = document.getElementById('ai-api-key').value.trim();
    
    if (!apiKey) {
      this.showToast('❌ API Key requerida', 'error');
      return false;
    }
    
    this.aiConfig = {
      provider,
      apiKey,
      model: provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o'
    };
    
    await this.saveConfig();
    this.showToast('✅ Configuración de IA guardada', 'success');
    this.updateUI();
    return true;
  }

  async testAIConnection() {
    if (!this.aiConfig.apiKey) {
      this.showToast('❌ Configurá tu API Key primero', 'error');
      return;
    }
    
    const statusEl = document.getElementById('ai-connection-status');
    statusEl.textContent = 'Probando conexión...';
    statusEl.className = '';
    
    try {
      const testPrompt = 'Responde con "OK" si recibís este mensaje.';
      
      let response;
      if (this.aiConfig.provider === 'anthropic') {
        response = await this.callAnthropicAPI(testPrompt, null);
      } else {
        response = await this.callOpenAIAPI(testPrompt, null);
      }
      
      statusEl.textContent = '✅ Conectado correctamente';
      statusEl.className = 'success';
      this.showToast('✅ Conexión exitosa', 'success');
    } catch (error) {
      statusEl.textContent = '❌ Error de conexión';
      statusEl.className = 'error';
      this.showToast(`❌ Error: ${error.message}`, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL PROMPT
  // ═══════════════════════════════════════════════════════════════

  loadGlobalPromptUI() {
    document.getElementById('global-expertise').value = this.globalPrompt.expertise;
    document.getElementById('global-instructions').value = this.globalPrompt.instructions;
    
    // Objective
    const objectiveRadios = document.querySelectorAll('input[name="global-objective"]');
    objectiveRadios.forEach(radio => {
      if (radio.value === this.globalPrompt.objective) {
        radio.checked = true;
      }
    });
    
    // Tone
    const toneRadios = document.querySelectorAll('input[name="global-tone"]');
    toneRadios.forEach(radio => {
      if (radio.value === this.globalPrompt.tone) {
        radio.checked = true;
      }
    });
  }

  async saveGlobalPrompt() {
    this.globalPrompt = {
      expertise: document.getElementById('global-expertise').value.trim(),
      objective: document.querySelector('input[name="global-objective"]:checked').value,
      tone: document.querySelector('input[name="global-tone"]:checked').value,
      instructions: document.getElementById('global-instructions').value.trim()
    };
    
    await this.saveConfig();
    this.showToast('✅ Prompt global guardado', 'success');
  }

  // ═══════════════════════════════════════════════════════════════
  // REFERENTES MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  addReferente(referente) {
    const newRef = {
      id: 'ref_' + Date.now(),
      platform: referente.platform,
      username: referente.username,
      enabled: true,
      useCustomPrompt: referente.useCustomPrompt || false,
      customPrompt: referente.customPrompt || '',
      lastCommented: null,
      lastPostId: null
    };
    
    this.referentes.push(newRef);
    this.saveReferentes();
    this.renderReferentes();
    this.updateUI();
  }

  editReferente(id, updates) {
    const index = this.referentes.findIndex(r => r.id === id);
    if (index !== -1) {
      this.referentes[index] = { ...this.referentes[index], ...updates };
      this.saveReferentes();
      this.renderReferentes();
    }
  }

  deleteReferente(id) {
    this.referentes = this.referentes.filter(r => r.id !== id);
    this.saveReferentes();
    this.renderReferentes();
    this.updateUI();
  }

  renderReferentes() {
    const container = document.getElementById('referentes-list');
    const countEl = document.getElementById('referentes-count');
    
    countEl.textContent = this.referentes.length;
    
    if (this.referentes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No hay referentes agregados</p>
          <p class="hint">Agregá perfiles de Instagram o LinkedIn para comentar sus posts</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.referentes.map(ref => this.renderReferenteCard(ref)).join('');
  }

  renderReferenteCard(ref) {
    const platformIcon = ref.platform === 'instagram' ? '📱' : '💼';
    const statusClass = ref.enabled ? 'active' : 'inactive';
    const statusText = ref.enabled ? '✅ Activo' : '⏸️ Pausado';
    const promptLabel = ref.useCustomPrompt ? '🎯 Prompt: Custom' : '🎯 Prompt: Global';
    
    return `
      <div class="referente-card" data-ref-id="${ref.id}">
        <div class="referente-header">
          <div class="referente-info">
            <span class="referente-platform">${platformIcon}</span>
            <span class="referente-username">@${ref.username}</span>
          </div>
          <span class="referente-status ${statusClass}">${statusText}</span>
        </div>
        
        <div class="referente-prompt">
          <div class="referente-prompt-label">${promptLabel}</div>
          ${ref.useCustomPrompt ? 
            `<div class="prompt-preview">${ref.customPrompt.substring(0, 100)}${ref.customPrompt.length > 100 ? '...' : ''}</div>` 
            : '<div class="hint">Usando prompt global configurado arriba</div>'}
        </div>
        
        <div class="referente-actions">
          <button class="btn btn-sm btn-secondary view-post" data-ref-id="${ref.id}">
            👀 Ver Post
          </button>
          <button class="btn btn-sm btn-primary comment-one" data-ref-id="${ref.id}">
            💬 Comentar
          </button>
          <button class="btn btn-sm btn-secondary edit-ref" data-ref-id="${ref.id}">
            ✏️ Editar
          </button>
          <button class="btn btn-sm btn-danger delete-ref" data-ref-id="${ref.id}">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════

  setupEventListeners() {
    // Test AI Connection
    document.getElementById('test-ai-connection')?.addEventListener('click', () => {
      this.testAIConnection();
    });
    
    // Toggle API Key visibility
    document.getElementById('toggle-api-key')?.addEventListener('click', () => {
      const input = document.getElementById('ai-api-key');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
    
    // Save Global Prompt
    document.getElementById('save-global-prompt')?.addEventListener('click', () => {
      this.saveGlobalPrompt();
    });
    
    // Add Referente
    document.getElementById('add-referente')?.addEventListener('click', () => {
      this.openAddReferenteModal();
    });
    
    // Referente actions (delegated)
    document.getElementById('referentes-list')?.addEventListener('click', (e) => {
      const refId = e.target.dataset.refId;
      if (!refId) return;
      
      if (e.target.classList.contains('edit-ref')) {
        this.openEditReferenteModal(refId);
      } else if (e.target.classList.contains('delete-ref')) {
        if (confirm('¿Eliminar este referente?')) {
          this.deleteReferente(refId);
        }
      } else if (e.target.classList.contains('view-post')) {
        this.viewReferentePost(refId);
      } else if (e.target.classList.contains('comment-one')) {
        this.commentOneReferente(refId);
      }
    });
    
    // Comment All
    document.getElementById('comment-all-referentes')?.addEventListener('click', () => {
      this.commentAllReferentes();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════

  openAddReferenteModal() {
    const modal = document.getElementById('modal-add-referente');
    modal.style.display = 'flex';
    
    // Reset form
    document.getElementById('new-ref-platform').value = 'instagram';
    document.getElementById('new-ref-username').value = '';
    document.getElementById('new-ref-use-custom').checked = false;
    document.getElementById('new-ref-custom-prompt').value = '';
    document.getElementById('custom-prompt-container').style.display = 'none';
    
    // Toggle custom prompt
    document.getElementById('new-ref-use-custom').onchange = (e) => {
      document.getElementById('custom-prompt-container').style.display = 
        e.target.checked ? 'block' : 'none';
    };
    
    // Confirm
    document.getElementById('confirm-add-referente').onclick = () => {
      const platform = document.getElementById('new-ref-platform').value;
      const username = document.getElementById('new-ref-username').value.trim().replace('@', '');
      const useCustom = document.getElementById('new-ref-use-custom').checked;
      const customPrompt = document.getElementById('new-ref-custom-prompt').value.trim();
      
      if (!username) {
        this.showToast('❌ Username requerido', 'error');
        return;
      }
      
      // Check duplicates
      if (this.referentes.some(r => r.platform === platform && r.username === username)) {
        this.showToast('❌ Este referente ya existe', 'error');
        return;
      }
      
      this.addReferente({
        platform,
        username,
        useCustomPrompt: useCustom,
        customPrompt: useCustom ? customPrompt : ''
      });
      
      modal.style.display = 'none';
      this.showToast('✅ Referente agregado', 'success');
    };
    
    // Cancel
    document.getElementById('cancel-add-referente').onclick = () => {
      modal.style.display = 'none';
    };
    
    // Close button
    modal.querySelector('.modal-close').onclick = () => {
      modal.style.display = 'none';
    };
  }

  openEditReferenteModal(refId) {
    const ref = this.referentes.find(r => r.id === refId);
    if (!ref) return;
    
    this.currentEditingId = refId;
    const modal = document.getElementById('modal-edit-referente');
    modal.style.display = 'flex';
    
    // Load data
    document.getElementById('edit-ref-username').value = ref.username;
    document.getElementById('edit-ref-use-custom').checked = ref.useCustomPrompt;
    document.getElementById('edit-ref-custom-prompt').value = ref.customPrompt || '';
    document.getElementById('edit-ref-enabled').checked = ref.enabled;
    document.getElementById('edit-custom-prompt-container').style.display = 
      ref.useCustomPrompt ? 'block' : 'none';
    
    // Toggle custom prompt
    document.getElementById('edit-ref-use-custom').onchange = (e) => {
      document.getElementById('edit-custom-prompt-container').style.display = 
        e.target.checked ? 'block' : 'none';
    };
    
    // Confirm
    document.getElementById('confirm-edit-referente').onclick = () => {
      const updates = {
        useCustomPrompt: document.getElementById('edit-ref-use-custom').checked,
        customPrompt: document.getElementById('edit-ref-custom-prompt').value.trim(),
        enabled: document.getElementById('edit-ref-enabled').checked
      };
      
      this.editReferente(refId, updates);
      modal.style.display = 'none';
      this.showToast('✅ Referente actualizado', 'success');
    };
    
    // Cancel
    document.getElementById('cancel-edit-referente').onclick = () => {
      modal.style.display = 'none';
    };
    
    // Close button
    modal.querySelector('.modal-close').onclick = () => {
      modal.style.display = 'none';
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════

  updateUI() {
    // Enable/disable comment all button
    const hasActive = this.referentes.some(r => r.enabled);
    const hasAPIKey = this.aiConfig.apiKey !== '';
    const btn = document.getElementById('comment-all-referentes');
    
    if (btn) {
      btn.disabled = !hasActive || !hasAPIKey;
    }
  }

  showToast(message, type = 'info') {
    // Use existing toast function from popup.js
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      alert(message);
    }
  }

  // Placeholder methods (will implement in next commits)
  async viewReferentePost(refId) {
    this.showToast('⏳ Función próximamente', 'info');
  }

  async commentOneReferente(refId) {
    this.showToast('⏳ Función próximamente', 'info');
  }

  async commentAllReferentes() {
    this.showToast('⏳ Función próximamente', 'info');
  }

  async callAnthropicAPI(prompt, image) {
    // Will implement in next commit
    throw new Error('Not implemented yet');
  }

  async callOpenAIAPI(prompt, image) {
    // Will implement in next commit
    throw new Error('Not implemented yet');
  }
}

// Export instance
const commentorManager = new CommentorManager();

// Auto-init ONLY if we're in popup.html (NOT dashboard)
// The dashboard uses different elements and will crash if we try to init here
if (window.location.pathname.includes('popup.html')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => commentorManager.init());
  } else {
    commentorManager.init();
  }
}
