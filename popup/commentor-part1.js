// ═════════════════════════════════════════════════════════════════
// COMENTADOR INTELIGENTE - PARTE 1: Configuración
// ═════════════════════════════════════════════════════════════════

// Inicialización
let currentEditingReferente = null;

// ═════════════════════════════════════════════════════════════════
// AI CONFIGURATION
// ═════════════════════════════════════════════════════════════════

// Cargar configuración de IA
async function loadAIConfig() {
  const result = await chrome.storage.local.get('aiConfig');
  const config = result.aiConfig || getDefaultAIConfig();
  
  document.getElementById('ai-provider').value = config.provider;
  document.getElementById('ai-api-key').value = config.apiKey || '';
  updateAIModelOptions(config.provider);
  document.getElementById('ai-model').value = config.model;
  
  // Habilitar botón "Comentar TODOS" si hay API key
  updateCommentAllButton();
}

function getDefaultAIConfig() {
  return {
    provider: 'anthropic',
    apiKey: '',
    model: 'claude-3-5-sonnet-20241022'
  };
}

// Actualizar opciones de modelo según provider
function updateAIModelOptions(provider) {
  const modelSelect = document.getElementById('ai-model');
  modelSelect.innerHTML = '';
  
  const models = {
    anthropic: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (recomendado)' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
      { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' }
    ],
    openai: [
      { value: 'gpt-4o', label: 'GPT-4o (recomendado)' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-4', label: 'GPT-4' }
    ]
  };
  
  models[provider].forEach(model => {
    const option = document.createElement('option');
    option.value = model.value;
    option.textContent = model.label;
    modelSelect.appendChild(option);
  });
}

// Cambio de provider
document.getElementById('ai-provider')?.addEventListener('change', (e) => {
  updateAIModelOptions(e.target.value);
});

// Toggle mostrar/ocultar API key
document.getElementById('toggle-api-key')?.addEventListener('click', () => {
  const input = document.getElementById('ai-api-key');
  input.type = input.type === 'password' ? 'text' : 'password';
});

// Test de conexión AI
document.getElementById('test-ai-connection')?.addEventListener('click', async () => {
  const provider = document.getElementById('ai-provider').value;
  const apiKey = document.getElementById('ai-api-key').value;
  const model = document.getElementById('ai-model').value;
  
  if (!apiKey) {
    showToast('❌ Por favor ingresá tu API key', 'error');
    return;
  }
  
  const statusEl = document.getElementById('ai-connection-status');
  statusEl.textContent = '🔄 Probando...';
  statusEl.className = '';
  
  try {
    // Guardar config antes de probar
    await chrome.storage.local.set({
      aiConfig: { provider, apiKey, model }
    });
    
    // Test simple
    const testPrompt = "Di solo 'OK' si puedes responder";
    const response = await callAI(testPrompt, provider, apiKey, model);
    
    statusEl.textContent = '✅ Conectado';
    statusEl.className = 'success';
    showToast('✅ Conexión exitosa con ' + provider, 'success');
    
    updateCommentAllButton();
  } catch (error) {
    statusEl.textContent = '❌ Error';
    statusEl.className = 'error';
    showToast('❌ Error: ' + error.message, 'error');
  }
});

// Call AI API
async function callAI(prompt, provider, apiKey, model, imageUrl = null) {
  if (provider === 'anthropic') {
    return await callAnthropic(prompt, apiKey, model, imageUrl);
  } else if (provider === 'openai') {
    return await callOpenAI(prompt, apiKey, model, imageUrl);
  }
}

async function callAnthropic(prompt, apiKey, model, imageUrl) {
  const messages = [{
    role: 'user',
    content: imageUrl ? [
      { type: 'text', text: prompt },
      { type: 'image', source: { type: 'url', url: imageUrl } }
    ] : prompt
  }];
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 300,
      messages
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API Error');
  }
  
  const data = await response.json();
  return data.content[0].text;
}

async function callOpenAI(prompt, apiKey, model, imageUrl) {
  const messages = [{
    role: 'user',
    content: imageUrl ? [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: imageUrl } }
    ] : prompt
  }];
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages,
      max_tokens: 300
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API Error');
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// ═════════════════════════════════════════════════════════════════
// GLOBAL PROMPT CONFIGURATION
// ═════════════════════════════════════════════════════════════════

async function loadGlobalPrompt() {
  const result = await chrome.storage.local.get('globalPrompt');
  const prompt = result.globalPrompt || getDefaultGlobalPrompt();
  
  document.getElementById('global-expertise').value = prompt.expertise;
  document.getElementById('global-objective').value = prompt.objective;
  document.getElementById('global-tone').value = prompt.tone;
  document.getElementById('global-instructions').value = prompt.instructions;
}

function getDefaultGlobalPrompt() {
  return {
    expertise: 'IA, Ventas B2B, Automatización',
    objective: 'autoridad',
    tone: 'profesional',
    instructions: 'Aporta valor, sé auténtico, max 150 chars, evita emojis excesivos'
  };
}

document.getElementById('save-global-prompt')?.addEventListener('click', async () => {
  const prompt = {
    expertise: document.getElementById('global-expertise').value,
    objective: document.getElementById('global-objective').value,
    tone: document.getElementById('global-tone').value,
    instructions: document.getElementById('global-instructions').value
  };
  
  await chrome.storage.local.set({ globalPrompt: prompt });
  showToast('✅ Prompt global guardado', 'success');
});

// ═════════════════════════════════════════════════════════════════
// REFERENTES MANAGEMENT
// ═════════════════════════════════════════════════════════════════

async function loadReferentes() {
  const result = await chrome.storage.local.get('referentes');
  const referentes = result.referentes || [];
  
  const container = document.getElementById('referentes-list');
  const countEl = document.getElementById('referentes-count');
  
  countEl.textContent = referentes.length;
  
  if (referentes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No tenés referentes cargados todavía</p>
        <button class="btn btn-primary" id="add-referente-empty">+ Agregar Primer Referente</button>
      </div>
    `;
    
    document.getElementById('add-referente-empty')?.addEventListener('click', openReferenteModal);
    return;
  }
  
  container.innerHTML = referentes.map(ref => `
    <div class="referente-card ${ref.enabled ? '' : 'disabled'}" data-id="${ref.id}">
      <div class="referente-header">
        <div class="referente-info">
          <div class="referente-name">
            <span class="platform-badge ${ref.platform}">${ref.platform === 'instagram' ? '📱' : '💼'} ${ref.platform.toUpperCase()}</span>
            @${ref.username}
          </div>
          <div class="referente-prompt ${ref.customPrompt ? 'custom' : ''}">
            🎯 Prompt: ${ref.customPrompt ? 'Custom' : 'Global (default)'}
          </div>
          ${ref.lastCommentedAt ? `
            <div class="referente-last-comment">
              Último comentario: ${new Date(ref.lastCommentedAt).toLocaleString()}
            </div>
          ` : ''}
        </div>
        <div class="referente-actions">
          <button class="btn btn-sm btn-secondary view-post" data-id="${ref.id}">👀 Ver</button>
          <button class="btn btn-sm btn-primary comment-one" data-id="${ref.id}">💬 Comentar</button>
          <button class="btn btn-sm btn-secondary edit-ref" data-id="${ref.id}">✏️</button>
          <button class="btn btn-sm btn-danger delete-ref" data-id="${ref.id}">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
  
  // Event listeners
  container.querySelectorAll('.edit-ref').forEach(btn => {
    btn.addEventListener('click', () => editReferente(btn.dataset.id));
  });
  
  container.querySelectorAll('.delete-ref').forEach(btn => {
    btn.addEventListener('click', () => deleteReferente(btn.dataset.id));
  });
  
  container.querySelectorAll('.view-post').forEach(btn => {
    btn.addEventListener('click', () => viewReferenteProfile(btn.dataset.id));
  });
  
  container.querySelectorAll('.comment-one').forEach(btn => {
    btn.addEventListener('click', () => commentOne(btn.dataset.id));
  });
  
  updateCommentAllButton();
}

function openReferenteModal(refId = null) {
  const modal = document.getElementById('modal-referente');
  const title = document.getElementById('referente-modal-title');
  
  currentEditingReferente = refId;
  
  if (refId) {
    // Modo edición
    title.textContent = '✏️ Editar Referente';
    chrome.storage.local.get('referentes').then(result => {
      const referentes = result.referentes || [];
      const ref = referentes.find(r => r.id === refId);
      if (ref) {
        document.getElementById('referente-platform').value = ref.platform;
        document.getElementById('referente-username').value = ref.username;
        document.getElementById('referente-use-custom-prompt').checked = !!ref.customPrompt;
        document.getElementById('referente-custom-prompt').value = ref.customPrompt || '';
        toggleCustomPrompt();
      }
    });
  } else {
    // Modo agregar
    title.textContent = '➕ Agregar Referente';
    document.getElementById('referente-platform').value = 'instagram';
    document.getElementById('referente-username').value = '';
    document.getElementById('referente-use-custom-prompt').checked = false;
    document.getElementById('referente-custom-prompt').value = '';
    toggleCustomPrompt();
  }
  
  modal.classList.add('active');
}

function toggleCustomPrompt() {
  const checkbox = document.getElementById('referente-use-custom-prompt');
  const container = document.getElementById('custom-prompt-container');
  container.style.display = checkbox.checked ? 'block' : 'none';
}

document.getElementById('referente-use-custom-prompt')?.addEventListener('change', toggleCustomPrompt);

document.getElementById('add-referente')?.addEventListener('click', () => openReferenteModal());

document.getElementById('save-referente')?.addEventListener('click', async () => {
  const platform = document.getElementById('referente-platform').value;
  const username = document.getElementById('referente-username').value.trim().replace('@', '');
  const useCustom = document.getElementById('referente-use-custom-prompt').checked;
  const customPrompt = useCustom ? document.getElementById('referente-custom-prompt').value.trim() : null;
  
  if (!username) {
    showToast('❌ Por favor ingresá un username', 'error');
    return;
  }
  
  const result = await chrome.storage.local.get('referentes');
  const referentes = result.referentes || [];
  
  if (currentEditingReferente) {
    // Editar existente
    const index = referentes.findIndex(r => r.id === currentEditingReferente);
    if (index !== -1) {
      referentes[index] = {
        ...referentes[index],
        platform,
        username,
        customPrompt
      };
    }
  } else {
    // Agregar nuevo
    const newRef = {
      id: 'ref_' + Date.now(),
      platform,
      username,
      customPrompt,
      enabled: true,
      lastCommentedPostId: null,
      lastCommentedAt: null
    };
    referentes.push(newRef);
  }
  
  await chrome.storage.local.set({ referentes });
  await loadReferentes();
  
  document.getElementById('modal-referente').classList.remove('active');
  showToast('✅ Referente guardado', 'success');
});

document.getElementById('cancel-referente')?.addEventListener('click', () => {
  document.getElementById('modal-referente').classList.remove('active');
});

async function editReferente(refId) {
  openReferenteModal(refId);
}

async function deleteReferente(refId) {
  if (!confirm('¿Eliminar este referente?')) return;
  
  const result = await chrome.storage.local.get('referentes');
  const referentes = result.referentes || [];
  const filtered = referentes.filter(r => r.id !== refId);
  
  await chrome.storage.local.set({ referentes: filtered });
  await loadReferentes();
  
  showToast('✅ Referente eliminado', 'success');
}

async function viewReferenteProfile(refId) {
  const result = await chrome.storage.local.get('referentes');
  const referentes = result.referentes || [];
  const ref = referentes.find(r => r.id === refId);
  
  if (!ref) return;
  
  const url = ref.platform === 'instagram' 
    ? `https://www.instagram.com/${ref.username}/`
    : `https://www.linkedin.com/in/${ref.username}/`;
  
  chrome.tabs.create({ url });
}

function updateCommentAllButton() {
  const btn = document.getElementById('comment-all-referentes');
  chrome.storage.local.get(['aiConfig', 'referentes']).then(result => {
    const hasAPIKey = result.aiConfig?.apiKey;
    const hasReferentes = result.referentes?.length > 0;
    btn.disabled = !hasAPIKey || !hasReferentes;
  });
}

// ═════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('tab-commentor')) {
    loadAIConfig();
    loadGlobalPrompt();
    loadReferentes();
  }
});

// Close modals
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.target.closest('.modal').classList.remove('active');
  });
});
