// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL ANALYZER PRO - DASHBOARD v5.0
// Arquitectura: CRM-Centric, Lista = 1 Plataforma
// ═══════════════════════════════════════════════════════════════════════════

console.log('🎯 Dashboard v6.0 loading...');

let currentCampaign = null;
let campaignRunning = false;
let commentorRunning = false;

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const toast = (msg, type = 'info') => {
  const c = document.getElementById('toast-container');
  if (!c) return console.log(`[${type}] ${msg}`);
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
};

const status = (id, msg, type = 'info') => {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `status-text status-${type}`;
  el.style.display = 'block';
};

const switchView = (name) => {
  if (document.querySelector(`[data-view="${name}"]`)?.classList.contains('disabled')) {
    toast('🔮 Próximamente', 'info'); return;
  }
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(`view-${name}`);
  if (view) view.classList.add('active');
  document.querySelectorAll('.menu-item').forEach(i => i.classList.toggle('active', i.dataset.view === name));
  const titles = { home: 'Dashboard', crm: 'CRM', analyzer: 'Analyzer', commentor: 'Comentador IA', campaigns: 'Campañas', config: 'Configuración' };
  document.getElementById('page-title').textContent = titles[name] || 'Dashboard';
};

const platformIcon = (p) => ({ instagram: '📱', linkedin: '💼', whatsapp: '📲' }[p] || '🌐');

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('📄 DOM Ready');
  
  // Extension ID
  const extIdEl = document.getElementById('ext-id');
  if (extIdEl) {
    try {
      extIdEl.textContent = chrome.runtime?.id || 'N/A';
    } catch(e) {
      extIdEl.textContent = 'N/A';
    }
  }
  
  // Navigation
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); switchView(el.dataset.view); });
  });
  
  // Modals
  document.querySelectorAll('.modal-close, .modal-close-btn').forEach(b => {
    b.addEventListener('click', () => b.closest('.modal').style.display = 'none');
  });
  
  // Setup listeners
  setupListeners();
  
  // Load data
  await loadData();
  
  // Message listener
  chrome.runtime.onMessage.addListener(handleMessage);
  
  console.log('✅ Dashboard v6.0 ready!');
});

function setupListeners() {
  // === HOME ===
  document.getElementById('quick-add-person')?.addEventListener('click', () => openPersonModal());
  document.getElementById('quick-import')?.addEventListener('click', () => openModal('modal-import'));
  document.getElementById('new-list-btn')?.addEventListener('click', () => openModal('modal-list'));
  document.getElementById('start-setup')?.addEventListener('click', startSetup);
  
  // === CRM ===
  document.getElementById('add-person-btn')?.addEventListener('click', () => openPersonModal());
  document.getElementById('import-btn')?.addEventListener('click', () => openModal('modal-import'));
  document.getElementById('save-person')?.addEventListener('click', savePerson);
  document.getElementById('crm-search')?.addEventListener('input', filterCRM);
  document.getElementById('crm-filter-platform')?.addEventListener('change', filterCRM);
  document.getElementById('crm-filter-list')?.addEventListener('change', filterCRM);
  document.getElementById('select-all')?.addEventListener('change', e => {
    document.querySelectorAll('.row-check').forEach(c => c.checked = e.target.checked);
    updateBulkActions();
  });
  document.getElementById('bulk-delete')?.addEventListener('click', bulkDelete);
  document.getElementById('bulk-move')?.addEventListener('click', openMoveModal);
  document.getElementById('confirm-move')?.addEventListener('click', confirmBulkMove);
  
  // === PERSON DETAIL ===
  document.getElementById('save-detail-notes')?.addEventListener('click', savePersonNotes);
  document.getElementById('add-interaction-btn')?.addEventListener('click', addManualInteraction);
  document.getElementById('save-crm-fields')?.addEventListener('click', saveCRMFields);
  document.getElementById('detail-edit')?.addEventListener('click', editPersonFromDetail);
  document.getElementById('detail-open-profile')?.addEventListener('click', openPersonProfile);
  
  // === LISTAS ===
  document.getElementById('save-list')?.addEventListener('click', saveList);
  
  // === IMPORT ===
  document.querySelectorAll('.import-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.import-option').forEach(o => o.classList.remove('active'));
      document.querySelectorAll('.import-form').forEach(f => f.style.display = 'none');
      opt.classList.add('active');
      const form = document.getElementById(`import-${opt.dataset.type}`);
      if (form) form.style.display = 'block';
    });
  });
  document.getElementById('extract-whatsapp')?.addEventListener('click', extractWhatsApp);
  document.getElementById('extract-ig-post')?.addEventListener('click', extractIGPost);
  document.getElementById('extract-ig-followers')?.addEventListener('click', extractIGFollowers);
  document.getElementById('extract-li-post')?.addEventListener('click', extractLIPost);
  document.getElementById('process-csv')?.addEventListener('click', processCSV);
  
  // === ANALYZER ===
  document.getElementById('start-analyzer')?.addEventListener('click', startAnalyzer);
  document.getElementById('analyzer-add-crm')?.addEventListener('change', e => {
    document.getElementById('analyzer-list-group').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('download-csv')?.addEventListener('click', downloadAnalysisCSV);
  document.getElementById('extract-from-post')?.addEventListener('click', extractFromCurrentPost);
  populateExtractListSelector();
  
  // === COMMENTOR ===
  document.getElementById('save-ai')?.addEventListener('click', saveAIConfig);
  document.getElementById('start-commentor')?.addEventListener('click', startCommentor);
  document.getElementById('stop-commentor')?.addEventListener('click', stopCommentor);
  
  // === CAMPAIGNS ===
  document.getElementById('new-campaign-btn')?.addEventListener('click', () => {
    document.getElementById('new-campaign-form').style.display = 'block';
    document.getElementById('campaign-detail').style.display = 'none';
  });
  document.getElementById('cancel-campaign')?.addEventListener('click', () => {
    document.getElementById('new-campaign-form').style.display = 'none';
  });
  document.getElementById('save-campaign')?.addEventListener('click', saveCampaign);
  document.getElementById('run-campaign')?.addEventListener('click', runCampaign);
  document.getElementById('stop-campaign')?.addEventListener('click', stopCampaign);
  document.getElementById('close-campaign-detail')?.addEventListener('click', () => {
    document.getElementById('campaign-detail').style.display = 'none';
  });

  // Guardar edición del mensaje de la campaña (PASO 2.1)
  document.getElementById('save-campaign-message')?.addEventListener('click', async () => {
    if (!currentCampaign) return;
    const newMsg = document.getElementById('campaign-detail-message').value.trim();
    if (!newMsg) return toast('❌ El mensaje no puede estar vacío', 'error');
    
    currentCampaign.message = newMsg;
    await saveCampaignState();
    toast('✅ Mensaje de campaña actualizado', 'success');
  });

  // Variables tags (PASO 2.2 - funciona para nueva campaña y edición)
  document.querySelectorAll('.var-tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      // Encuentra el textarea más cercano dentro del mismo form-group
      const container = e.target.closest('.form-group');
      const textarea = container.querySelector('textarea');
      if (textarea) {
        const pos = textarea.selectionStart;
        const text = textarea.value;
        textarea.value = text.slice(0, pos) + tag.dataset.var + text.slice(pos);
        textarea.focus();
      }
    });
  });
    
  // === CONFIG ===
  document.getElementById('connect-sheets')?.addEventListener('click', connectSheets);
  document.getElementById('disconnect-sheets')?.addEventListener('click', disconnectSheets);
  document.getElementById('open-sheet')?.addEventListener('click', () => {
    const id = document.getElementById('sheet-id')?.value;
    if (id) chrome.tabs.create({ url: `https://docs.google.com/spreadsheets/d/${id}` });
  });
  document.getElementById('sync-sheet')?.addEventListener('click', syncToSheets);
  document.getElementById('save-config')?.addEventListener('click', saveConfig);
  document.getElementById('save-ai-config-btn')?.addEventListener('click', saveAIConfigFromSettings);
  document.getElementById('open-whatsapp')?.addEventListener('click', () => chrome.tabs.create({ url: 'https://web.whatsapp.com' }));
  document.getElementById('extract-wa-direct')?.addEventListener('click', extractWhatsAppDirect);
  document.getElementById('export-all')?.addEventListener('click', exportAll);
  document.getElementById('import-all')?.addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file')?.addEventListener('change', importAll);
  document.getElementById('clear-all')?.addEventListener('click', clearAll);
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSON MODAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function openPersonModal(personData = null) {
  document.getElementById('person-id').value = personData?.id || '';
  document.getElementById('person-name').value = personData?.nombre || '';
  document.getElementById('person-username').value = personData?.username || '';
  document.getElementById('person-platform').value = personData?.platform || 'instagram';
  document.getElementById('person-list').value = personData?.lista || '';
  document.getElementById('person-notes').value = personData?.notas || '';
  document.getElementById('modal-person-title').textContent = personData ? '✏️ Editar Persona' : '➕ Agregar Persona';
  openModal('modal-person');
}

function openModal(id) {
  document.getElementById(id).style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════

async function loadData() {
  const data = await chrome.storage.local.get(null);
  
  const personas = data.personas || [];
  const listas = data.listas || [];
  const campaigns = data.campaigns || [];
  
  // Stats
  document.getElementById('stat-personas').textContent = personas.length;
  document.getElementById('stat-listas').textContent = listas.length;
  document.getElementById('stat-campaigns').textContent = campaigns.length;
  document.getElementById('stat-comments').textContent = data.totalComments || 0;
  
  // Setup wizard
  const hasSheets = !!data.sheetId;
  const hasAI = !!data.aiConfig?.apiKey;
  if (!hasSheets || !hasAI) {
    document.getElementById('setup-wizard').style.display = 'block';
    document.getElementById('step-sheets').querySelector('.step-status').textContent = hasSheets ? '✅' : '⏳';
    document.getElementById('step-ai').querySelector('.step-status').textContent = hasAI ? '✅' : '⏳';
  }
  
  // Listas en home
  renderHomeListas(listas, personas);
  
  // Populate list selects
  populateListSelects(listas);
  
  // CRM
  renderCRM(personas);
  
  // AI Config
  if (data.aiConfig) {
    document.getElementById('ai-provider').value = data.aiConfig.provider || 'openai';
    document.getElementById('ai-key').value = data.aiConfig.apiKey || '';
    document.getElementById('ai-expertise').value = data.aiConfig.expertise || '';
  }
  
  // Sheets
  if (data.sheetId) {
    document.getElementById('sheets-not-connected').style.display = 'none';
    document.getElementById('sheets-connected').style.display = 'block';
    document.getElementById('sheet-id').value = data.sheetId;
  }
  
  // Config
  if (data.config) {
    document.getElementById('lim-ig-comments').value = data.config.igComments || 20;
    document.getElementById('lim-ig-dms').value = data.config.igDMs || 20;
    document.getElementById('lim-li-msgs').value = data.config.liMsgs || 25;
    document.getElementById('delay-min').value = data.config.delayMin || 30;
    document.getElementById('delay-max').value = data.config.delayMax || 90;
  }
  
  // Campaigns
  renderCampaigns(campaigns);
}

function renderHomeListas(listas, personas) {
  const container = document.getElementById('home-listas');
  if (!container) return;
  
  if (!listas.length) {
    container.innerHTML = '<p class="empty-state">No hay listas. Creá una para empezar.</p>';
    return;
  }
  
  container.innerHTML = listas.map(l => {
    const count = personas.filter(p => p.lista === l.id).length;
    return `
      <div class="lista-card" data-list="${l.id}">
        <div class="lista-icon">${l.icon}</div>
        <div class="lista-info">
          <strong>${l.name}</strong>
          <span class="lista-meta">${platformIcon(l.platform)} ${l.platform} · ${count} personas</span>
        </div>
        <div class="lista-actions">
          <button class="btn-icon" data-action="delete-list" data-list-id="${l.id}" title="Eliminar lista">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Click to filter CRM
  container.querySelectorAll('.lista-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't navigate if clicking delete button
      if (e.target.closest('[data-action="delete-list"]')) return;
      
      document.getElementById('crm-filter-list').value = card.dataset.list;
      switchView('crm');
      filterCRM();
    });
  });
  
  // Delete list buttons
  container.querySelectorAll('[data-action="delete-list"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const listId = btn.dataset.listId;
      const lista = listas.find(l => l.id === listId);
      const count = personas.filter(p => p.lista === listId).length;
      
      if (!confirm(`¿Eliminar la lista "${lista?.name}"?\n\n${count} personas serán eliminadas también.`)) return;
      
      // Remove list and its persons
      const newListas = listas.filter(l => l.id !== listId);
      const newPersonas = personas.filter(p => p.lista !== listId);
      
      await chrome.storage.local.set({ listas: newListas, personas: newPersonas });
      toast(`🗑️ Lista "${lista?.name}" eliminada`, 'success');
      loadDashboard();
    });
  });
}

function populateListSelects(listas) {
  const selects = ['crm-filter-list', 'person-list', 'wa-import-list', 'csv-import-list', 'analyzer-list', 'commentor-list', 'camp-list', 'ig-followers-list', 'ig-post-list', 'li-post-list', 'move-target-list'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const first = sel.querySelector('option');
    sel.innerHTML = first ? first.outerHTML : '<option value="">Seleccionar...</option>';
    listas.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = `${l.icon} ${l.name} (${platformIcon(l.platform)})`;
      sel.appendChild(opt);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CRM
// ═══════════════════════════════════════════════════════════════════════════

async function renderCRM(personas, filter = {}) {
  const tbody = document.getElementById('crm-tbody');
  if (!tbody) return;
  
  let filtered = personas || [];
  if (filter.search) {
    const s = filter.search.toLowerCase();
    filtered = filtered.filter(p => p.nombre?.toLowerCase().includes(s) || p.username?.toLowerCase().includes(s));
  }
  if (filter.platform) filtered = filtered.filter(p => p.platform === filter.platform);
  if (filter.list) filtered = filtered.filter(p => p.lista === filter.list);
  
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay personas.</td></tr>';
    return;
  }
  
  const { listas = [] } = await chrome.storage.local.get('listas');
  
  tbody.innerHTML = filtered.map(p => {
    const lista = listas.find(l => l.id === p.lista);
    const interactions = p.interactions || [];
    return `
      <tr data-id="${p.id}">
        <td><input type="checkbox" class="row-check" data-id="${p.id}"></td>
        <td>${p.nombre || '-'}</td>
        <td><a href="${getProfileUrl(p)}" target="_blank">@${p.username}</a></td>
        <td><span class="platform-badge ${p.platform}">${platformIcon(p.platform)}</span></td>
        <td>${lista ? `${lista.icon} ${lista.name}` : '-'}</td>
        <td><span class="origin-badge">${p.origen || 'manual'}</span></td>
        <td><span class="interaction-count" title="${interactions.map(i => `${i.type}: ${i.date}`).join('\n')}">${interactions.length} 💬</span></td>
        <td>
          <button class="btn-icon view-person" data-id="${p.id}" title="Ver">👁️</button>
          <button class="btn-icon delete-person" data-id="${p.id}" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Event listeners
  tbody.querySelectorAll('.row-check').forEach(c => c.addEventListener('change', updateBulkActions));
  tbody.querySelectorAll('.delete-person').forEach(b => b.addEventListener('click', () => deletePerson(b.dataset.id)));
  tbody.querySelectorAll('.view-person').forEach(b => b.addEventListener('click', () => viewPerson(b.dataset.id)));
}

function getProfileUrl(p) {
  if (p.platform === 'instagram') return `https://instagram.com/${p.username}`;
  if (p.platform === 'linkedin') return `https://linkedin.com/in/${p.username}`;
  if (p.platform === 'whatsapp') return `https://wa.me/${p.username.replace(/\D/g, '')}`;
  return '#';
}

function filterCRM() {
  chrome.storage.local.get('personas', ({ personas = [] }) => {
    renderCRM(personas, {
      search: document.getElementById('crm-search')?.value,
      platform: document.getElementById('crm-filter-platform')?.value,
      list: document.getElementById('crm-filter-list')?.value
    });
  });
}

function updateBulkActions() {
  const count = document.querySelectorAll('.row-check:checked').length;
  document.getElementById('bulk-actions').style.display = count > 0 ? 'flex' : 'none';
  document.getElementById('selected-count').textContent = `${count} seleccionados`;
}

async function savePerson() {
  const existingId = document.getElementById('person-id').value;
  const persona = {
    id: existingId ? parseInt(existingId) : Date.now(),
    platform: document.getElementById('person-platform').value,
    nombre: document.getElementById('person-name').value.trim(),
    username: document.getElementById('person-username').value.trim().replace('@', ''),
    lista: document.getElementById('person-list').value,
    notas: document.getElementById('person-notes').value,
    origen: 'manual',
    createdAt: new Date().toISOString(),
    interactions: []
  };
  
  if (!persona.username) return toast('❌ Username requerido', 'error');
  if (!persona.lista) return toast('❌ Seleccioná una lista', 'error');
  
  const { personas = [] } = await chrome.storage.local.get('personas');
  
  if (existingId) {
    // Editar existente
    const idx = personas.findIndex(p => p.id == existingId);
    if (idx >= 0) {
      persona.interactions = personas[idx].interactions || [];
      persona.createdAt = personas[idx].createdAt;
      persona.origen = personas[idx].origen;
      personas[idx] = persona;
    }
  } else {
    // Nuevo - check duplicate
    if (personas.find(p => p.username === persona.username && p.platform === persona.platform)) {
      return toast('⚠️ Ya existe', 'error');
    }
    personas.push(persona);
  }
  
  await chrome.storage.local.set({ personas });
  
  document.getElementById('modal-person').style.display = 'none';
  document.getElementById('person-id').value = '';
  document.getElementById('person-name').value = '';
  document.getElementById('person-username').value = '';
  document.getElementById('person-notes').value = '';
  
  renderCRM(personas);
  toast(existingId ? '✅ Persona actualizada' : '✅ Persona agregada', 'success');
  
  // Sync to sheets
  syncPersonToSheet(persona);
}

async function deletePerson(id) {
  if (!confirm('¿Eliminar?')) return;
  const { personas = [] } = await chrome.storage.local.get('personas');
  await chrome.storage.local.set({ personas: personas.filter(p => p.id != id) });
  filterCRM();
  toast('🗑️ Eliminado', 'success');
}

async function bulkDelete() {
  if (!confirm('¿Eliminar seleccionados?')) return;
  const ids = [...document.querySelectorAll('.row-check:checked')].map(c => c.dataset.id);
  const { personas = [] } = await chrome.storage.local.get('personas');
  await chrome.storage.local.set({ personas: personas.filter(p => !ids.includes(String(p.id))) });
  filterCRM();
  toast(`🗑️ ${ids.length} eliminados`, 'success');
}

async function viewPerson(id) {
  const { personas = [], listas = [] } = await chrome.storage.local.get(['personas', 'listas']);
  const p = personas.find(x => x.id == id);
  if (!p) return toast('❌ Persona no encontrada', 'error');
  
  // Store current person ID
  document.getElementById('modal-person-detail').dataset.personId = id;
  
  // Fill detail modal
  document.getElementById('detail-name').textContent = p.nombre || p.username;
  document.getElementById('detail-username').textContent = `@${p.username}`;
  document.getElementById('detail-avatar').textContent = platformIcon(p.platform);
  document.getElementById('detail-platform').textContent = p.platform;
  document.getElementById('detail-platform').className = `platform-badge ${p.platform}`;
  
  const lista = listas.find(l => l.id === p.lista);
  document.getElementById('detail-list').textContent = lista ? `${lista.icon} ${lista.name}` : 'Sin lista';
  
  document.getElementById('detail-origin').textContent = p.origen || 'manual';
  document.getElementById('detail-date').textContent = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-';
  document.getElementById('detail-link').href = getProfileUrl(p);
  document.getElementById('detail-notes').value = p.notas || '';
  
  // CRM Fields (new)
  const phoneEl = document.getElementById('detail-phone');
  const emailEl = document.getElementById('detail-email');
  const otherSocialEl = document.getElementById('detail-other-social');
  const bioEl = document.getElementById('detail-bio');
  
  if (phoneEl) phoneEl.value = p.phone || '';
  if (emailEl) emailEl.value = p.email || '';
  if (otherSocialEl) otherSocialEl.value = p.otherSocial || '';
  if (bioEl) bioEl.value = p.bio || '';
  
  // Interactions - IMPROVED with full details
  const interactions = p.interactions || [];
  document.getElementById('detail-interaction-count').textContent = interactions.length;
  
  const interactionsEl = document.getElementById('detail-interactions');
  if (interactions.length === 0) {
    interactionsEl.innerHTML = '<p class="empty-state">Sin interacciones registradas.</p>';
  } else {
    const iconMap = { 
      comment: '💬', dm: '✉️', like: '❤️', call: '📞', 
      meeting: '🤝', note: '📝', follow: '➕', unfollow: '➖' 
    };
    
    // Sort by date descending
    const sorted = interactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    
    interactionsEl.innerHTML = sorted.map(i => {
      const date = new Date(i.date);
      const dateStr = date.toLocaleDateString('es-AR', { 
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      
      // Build content based on interaction type
      let contentHtml = '';
      if (i.comment) {
        contentHtml = `<div class="interaction-text">"${i.comment.substring(0, 150)}${i.comment.length > 150 ? '...' : ''}"</div>`;
      } else if (i.message) {
        contentHtml = `<div class="interaction-text">"${i.message.substring(0, 150)}..."</div>`;
      } else if (i.detail) {
        contentHtml = `<div class="interaction-text">${i.detail}</div>`;
      }
      
      const urlHtml = i.postUrl ? `<a href="${i.postUrl}" target="_blank" class="interaction-link">🔗 Ver post</a>` : '';
      const verifiedHtml = i.verified ? '<span class="badge-verified">✓</span>' : '';
      
      return `
        <div class="interaction-item type-${i.type}">
          <span class="interaction-icon">${iconMap[i.type] || '📌'}</span>
          <div class="interaction-content">
            <div class="interaction-header">
              <strong>${i.type}</strong> ${verifiedHtml}
              <small>${dateStr}</small>
            </div>
            ${contentHtml}
            ${urlHtml}
          </div>
        </div>
      `;
    }).join('');
  }
  
  openModal('modal-person-detail');
}

async function saveCRMFields() {
  const id = document.getElementById('modal-person-detail').dataset.personId;
  
  const { personas = [] } = await chrome.storage.local.get('personas');
  const person = personas.find(p => p.id == id);
  if (person) {
    person.phone = document.getElementById('detail-phone')?.value || '';
    person.email = document.getElementById('detail-email')?.value || '';
    person.otherSocial = document.getElementById('detail-other-social')?.value || '';
    person.bio = document.getElementById('detail-bio')?.value || '';
    
    await chrome.storage.local.set({ personas });
    toast('✅ Datos guardados', 'success');
    
    // Sync to sheet if connected
    syncPersonToSheet(person);
  }
}

async function savePersonNotes() {
  const id = document.getElementById('modal-person-detail').dataset.personId;
  const notes = document.getElementById('detail-notes').value;
  
  const { personas = [] } = await chrome.storage.local.get('personas');
  const person = personas.find(p => p.id == id);
  if (person) {
    person.notas = notes;
    await chrome.storage.local.set({ personas });
    toast('✅ Notas guardadas', 'success');
  }
}

async function addManualInteraction() {
  const id = document.getElementById('modal-person-detail').dataset.personId;
  const type = document.getElementById('new-interaction-type').value;
  const detail = document.getElementById('new-interaction-detail').value.trim();
  
  if (!detail) return toast('❌ Agregá un detalle', 'error');
  
  const { personas = [] } = await chrome.storage.local.get('personas');
  const person = personas.find(p => p.id == id);
  if (person) {
    if (!person.interactions) person.interactions = [];
    person.interactions.push({
      type,
      detail,
      date: new Date().toISOString()
    });
    await chrome.storage.local.set({ personas });
    
    document.getElementById('new-interaction-detail').value = '';
    viewPerson(id); // Refresh
    toast('✅ Interacción registrada', 'success');
  }
}

function editPersonFromDetail() {
  const id = document.getElementById('modal-person-detail').dataset.personId;
  document.getElementById('modal-person-detail').style.display = 'none';
  
  chrome.storage.local.get('personas', ({ personas = [] }) => {
    const person = personas.find(p => p.id == id);
    if (person) openPersonModal(person);
  });
}

function openPersonProfile() {
  const id = document.getElementById('modal-person-detail').dataset.personId;
  chrome.storage.local.get('personas', ({ personas = [] }) => {
    const person = personas.find(p => p.id == id);
    if (person) {
      chrome.tabs.create({ url: getProfileUrl(person) });
    }
  });
}

// Mover a lista
async function openMoveModal() {
  const count = document.querySelectorAll('.row-check:checked').length;
  document.getElementById('move-count').textContent = `${count} personas seleccionadas`;
  
  const { listas = [] } = await chrome.storage.local.get('listas');
  const select = document.getElementById('move-target-list');
  select.innerHTML = '<option value="">Seleccionar lista...</option>';
  listas.forEach(l => {
    select.innerHTML += `<option value="${l.id}">${l.icon} ${l.name} (${platformIcon(l.platform)})</option>`;
  });
  
  openModal('modal-move-list');
}

async function confirmBulkMove() {
  const targetList = document.getElementById('move-target-list').value;
  if (!targetList) return toast('❌ Seleccioná una lista', 'error');
  
  const ids = [...document.querySelectorAll('.row-check:checked')].map(c => c.dataset.id);
  const { personas = [] } = await chrome.storage.local.get('personas');
  
  let moved = 0;
  personas.forEach(p => {
    if (ids.includes(String(p.id))) {
      p.lista = targetList;
      moved++;
    }
  });
  
  await chrome.storage.local.set({ personas });
  document.getElementById('modal-move-list').style.display = 'none';
  filterCRM();
  toast(`✅ ${moved} personas movidas`, 'success');
}

// WhatsApp directo desde config
async function extractWhatsAppDirect() {
  status('wa-direct-status', '🔄 Buscando WhatsApp Web...', 'info');
  
  const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
  if (!tabs.length) {
    return status('wa-direct-status', '❌ Abrí WhatsApp Web primero y entrá a un grupo', 'error');
  }
  
  // Pedir lista
  const { listas = [] } = await chrome.storage.local.get('listas');
  const waLists = listas.filter(l => l.platform === 'whatsapp');
  
  if (!waLists.length) {
    return status('wa-direct-status', '❌ Creá primero una lista de WhatsApp', 'error');
  }
  
  // Usar primera lista de WA por ahora
  const targetList = waLists[0].id;
  
  try {
    // First try to ping the content script
    const pingResponse = await chrome.tabs.sendMessage(tabs[0].id, { action: 'PING' }).catch(() => null);
    
    if (!pingResponse) {
      // Content script not loaded - need to reload
      status('wa-direct-status', '⚠️ Recargá WhatsApp Web (F5) después de instalar la extensión', 'error');
      toast('💡 Tip: Recargá WhatsApp Web con F5 y volvé a intentar', 'info');
      return;
    }
    
    status('wa-direct-status', '📲 Extrayendo... Asegurate de tener abierta la LISTA DE MIEMBROS del grupo', 'info');
    
    // Wait for response with timeout
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'EXTRACT_CONTACTS', 
        targetList,
        generarCSV: true 
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout 30s')), 30000))
    ]);
    
    if (response?.success) {
      status('wa-direct-status', `✅ ${response.contactos?.length || 0} contactos extraídos!`, 'success');
      toast(`✅ ${response.contactos?.length || 0} contactos del grupo "${response.grupoNombre}"`, 'success');
      loadCRM();
    } else {
      status('wa-direct-status', `❌ ${response?.error || 'Error desconocido'}`, 'error');
      
      // Show helpful tip
      if (response?.error?.includes('lista de miembros') || response?.error?.includes('miembros')) {
        toast('💡 Abrí el grupo → Click en nombre → Click en "X miembros" → Volvé a intentar', 'info');
      }
    }
    
  } catch (e) {
    console.error('WhatsApp extraction error:', e);
    if (e.message?.includes('Could not establish connection')) {
      status('wa-direct-status', '⚠️ Recargá WhatsApp Web (F5) e intentá de nuevo', 'error');
      toast('💡 Después de instalar/actualizar la extensión, recargá las pestañas abiertas', 'info');
    } else if (e.message?.includes('Timeout')) {
      status('wa-direct-status', '⚠️ Timeout - ¿Tenés la lista de miembros abierta?', 'error');
      toast('💡 En WhatsApp: Click en nombre del grupo → Click en "X miembros"', 'info');
    } else {
      status('wa-direct-status', `❌ ${e.message}`, 'error');
    }
  }
}

// Guardar config de IA desde settings
async function saveAIConfigFromSettings() {
  const config = {
    provider: document.getElementById('config-ai-provider').value,
    apiKey: document.getElementById('config-ai-key').value.trim(),
    expertise: document.getElementById('config-ai-expertise').value.trim()
  };
  
  if (!config.apiKey) return toast('❌ API Key requerida', 'error');
  
  await chrome.storage.local.set({ aiConfig: config });
  toast('✅ Configuración de IA guardada', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTAS
// ═══════════════════════════════════════════════════════════════════════════

async function saveList() {
  const lista = {
    id: Date.now().toString(),
    platform: document.getElementById('list-platform').value,
    name: document.getElementById('list-name').value.trim(),
    icon: document.getElementById('list-icon').value || '📋',
    createdAt: new Date().toISOString()
  };
  
  if (!lista.name) return toast('❌ Nombre requerido', 'error');
  
  const { listas = [] } = await chrome.storage.local.get('listas');
  listas.push(lista);
  await chrome.storage.local.set({ listas });
  
  document.getElementById('modal-list').style.display = 'none';
  document.getElementById('list-name').value = '';
  
  const { personas = [] } = await chrome.storage.local.get('personas');
  renderHomeListas(listas, personas);
  populateListSelects(listas);
  toast('✅ Lista creada', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT
// ═══════════════════════════════════════════════════════════════════════════

async function extractWhatsApp() {
  const lista = document.getElementById('wa-import-list').value;
  const generarCSV = document.getElementById('wa-generar-csv')?.checked !== false;
  const importarALista = document.getElementById('wa-importar-lista')?.checked !== false;
  
  if (importarALista && !lista) {
    return status('wa-status', '❌ Seleccioná una lista para importar', 'error');
  }
  
  status('wa-status', '🔄 Buscando WhatsApp Web...', 'info');
  
  const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
  if (!tabs.length) {
    return status('wa-status', '❌ Abrí WhatsApp Web primero y entrá a un grupo', 'error');
  }
  
  try {
    chrome.tabs.sendMessage(tabs[0].id, { 
      action: 'EXTRACT_CONTACTS', 
      targetList: lista,
      generarCSV,
      importarALista
    });
    status('wa-status', '📲 Extrayendo miembros del grupo...', 'info');
  } catch (e) {
    status('wa-status', '❌ Recargá WhatsApp Web (F5) e intentá de nuevo', 'error');
  }
}

// Importar desde post de Instagram
async function extractIGPost() {
  const url = document.getElementById('ig-post-url').value.trim();
  const type = document.getElementById('ig-post-type').value;
  const lista = document.getElementById('ig-post-list').value;
  
  if (!url) return status('ig-post-status', '❌ Ingresá la URL del post', 'error');
  if (!lista) return status('ig-post-status', '❌ Seleccioná una lista', 'error');
  
  // Validar URL de Instagram
  if (!url.includes('instagram.com/p/') && !url.includes('instagram.com/reel/')) {
    return status('ig-post-status', '❌ URL de post inválida', 'error');
  }
  
  status('ig-post-status', '🔄 Abriendo post...', 'info');
  
  // Abrir el post en una nueva pestaña
  const tab = await chrome.tabs.create({ url, active: true });
  
  // Wait longer for Instagram to fully load the post
  status('ig-post-status', '⏳ Esperando que cargue el post...', 'info');
  await new Promise(r => setTimeout(r, 6000));
  
  try {
    chrome.tabs.sendMessage(tab.id, { 
      action: 'EXTRACT_POST_ENGAGERS', 
      type,
      targetList: lista
    });
    status('ig-post-status', '📥 Extrayendo ' + (type === 'likers' ? 'likers' : type === 'commenters' ? 'comentadores' : 'ambos') + '... (no cierres la pestaña)', 'info');
  } catch (e) {
    status('ig-post-status', '❌ Error: ' + e.message, 'error');
  }
}

// Importar seguidores de Instagram
async function extractIGFollowers() {
  const username = document.getElementById('ig-followers-username').value.trim().replace('@', '');
  const max = parseInt(document.getElementById('ig-followers-max').value) || 50;
  const lista = document.getElementById('ig-followers-list').value;
  
  if (!username) return status('ig-followers-status', '❌ Ingresá el username', 'error');
  if (!lista) return status('ig-followers-status', '❌ Seleccioná una lista', 'error');
  
  status('ig-followers-status', '🔄 Abriendo perfil...', 'info');
  
  // Navigate to profile page (NOT /followers/ URL - that doesn't open the modal)
  const url = `https://instagram.com/${username}/`;
  const tab = await chrome.tabs.create({ url, active: true });
  
  // Wait for page to load
  await new Promise(r => setTimeout(r, 5000));
  
  // Now tell content script to open followers modal and extract
  try {
    chrome.tabs.sendMessage(tab.id, { 
      action: 'EXTRACT_FOLLOWERS', 
      max,
      targetList: lista
    });
    status('ig-followers-status', '📥 Abriendo modal de seguidores y extrayendo hasta ' + max + '...', 'info');
  } catch (e) {
    status('ig-followers-status', '❌ Error: ' + e.message, 'error');
  }
}

// Importar desde post de LinkedIn
async function extractLIPost() {
  const url = document.getElementById('li-post-url').value.trim();
  const type = document.getElementById('li-post-type').value;
  const lista = document.getElementById('li-post-list').value;
  
  if (!url) return status('li-post-status', '❌ Ingresá la URL del post', 'error');
  if (!lista) return status('li-post-status', '❌ Seleccioná una lista', 'error');
  
  // Validar URL de LinkedIn
  if (!url.includes('linkedin.com')) {
    return status('li-post-status', '❌ URL de LinkedIn inválida', 'error');
  }
  
  status('li-post-status', '🔄 Abriendo post...', 'info');
  
  // Abrir el post en una nueva pestaña
  const tab = await chrome.tabs.create({ url, active: true });
  await new Promise(r => setTimeout(r, 5000));
  
  try {
    chrome.tabs.sendMessage(tab.id, { 
      action: 'EXTRACT_POST_ENGAGERS', 
      type,
      targetList: lista,
      platform: 'linkedin'
    });
    status('li-post-status', '📥 Extrayendo ' + (type === 'reactions' ? 'reacciones' : type === 'comments' ? 'comentarios' : 'ambos') + '...', 'info');
  } catch (e) {
    status('li-post-status', '❌ Error: ' + e.message, 'error');
  }
}

async function processCSV() {
  const file = document.getElementById('csv-file').files[0];
  const lista = document.getElementById('csv-import-list').value;
  
  if (!file) return toast('❌ Seleccioná un archivo', 'error');
  if (!lista) return toast('❌ Seleccioná una lista', 'error');
  
  const { listas = [] } = await chrome.storage.local.get('listas');
  const targetList = listas.find(l => l.id === lista);
  if (!targetList) return toast('❌ Lista no encontrada', 'error');
  
  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim());
  const header = lines[0].toLowerCase();
  
  const { personas = [] } = await chrome.storage.local.get('personas');
  let added = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));
    if (parts.length < 2) continue;
    
    const persona = {
      id: Date.now() + i,
      nombre: parts[0],
      username: parts[1].replace('@', ''),
      platform: targetList.platform,
      lista: lista,
      origen: 'csv',
      createdAt: new Date().toISOString(),
      interactions: []
    };
    
    if (!personas.find(p => p.username === persona.username && p.platform === persona.platform)) {
      personas.push(persona);
      added++;
    }
  }
  
  await chrome.storage.local.set({ personas });
  document.getElementById('modal-import').style.display = 'none';
  renderCRM(personas);
  toast(`✅ ${added} personas importadas`, 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTOR DE LIKERS/COMENTADORES
// ═══════════════════════════════════════════════════════════════════════════

async function populateExtractListSelector() {
  const { listas = [] } = await chrome.storage.local.get('listas');
  const select = document.getElementById('extract-target-list');
  if (!select) return;
  
  const igListas = listas.filter(l => l.platform === 'instagram');
  
  select.innerHTML = igListas.length === 0 
    ? '<option value="">Creá una lista primero</option>'
    : igListas.map(l => `<option value="${l.id}">${l.icon} ${l.name}</option>`).join('');
}

async function extractFromCurrentPost() {
  const extractType = document.getElementById('extract-type').value;
  const targetList = document.getElementById('extract-target-list').value;
  
  if (!targetList) {
    return status('extract-status', '❌ Creá una lista de Instagram primero', 'error');
  }
  
  status('extract-status', '🔄 Buscando pestaña de Instagram...', 'info');
  
  // Find Instagram tab with a post open
  const tabs = await chrome.tabs.query({ url: '*://www.instagram.com/*' });
  
  if (tabs.length === 0) {
    return status('extract-status', '❌ No hay pestaña de Instagram abierta', 'error');
  }
  
  // Find a tab that's on a post
  let postTab = null;
  for (const tab of tabs) {
    if (tab.url?.includes('/p/') || tab.url?.includes('/reel/')) {
      postTab = tab;
      break;
    }
  }
  
  // If no direct post URL, use the first Instagram tab (might have modal open)
  if (!postTab) {
    postTab = tabs[0];
    status('extract-status', '⚠️ Asegurate de tener un post abierto (modal o URL /p/)...', 'info');
  }
  
  status('extract-status', '🔄 Extrayendo...', 'info');
  
  try {
    // First ping to check if content script is loaded
    const ping = await chrome.tabs.sendMessage(postTab.id, { action: 'PING' }).catch(() => null);
    
    if (!ping) {
      return status('extract-status', '⚠️ Recargá la pestaña de Instagram (F5) e intentá de nuevo', 'error');
    }
    
    const response = await Promise.race([
      chrome.tabs.sendMessage(postTab.id, {
        action: 'EXTRACT_POST_ENGAGERS',
        type: extractType,
        targetList,
        platform: 'instagram'
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout 60s')), 60000))
    ]);
    
    if (response?.success) {
      status('extract-status', `✅ Extraídos ${response.count} usuarios!`, 'success');
      toast(`✅ ${response.count} usuarios extraídos y agregados a la lista`, 'success');
      
      // Refresh CRM if we're there
      loadCRM();
    } else {
      status('extract-status', `❌ ${response?.error || 'Error desconocido'}`, 'error');
    }
    
  } catch (e) {
    console.error('Error extrayendo:', e);
    status('extract-status', `❌ ${e.message}`, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYZER
// ═══════════════════════════════════════════════════════════════════════════

let currentAnalysis = null;

async function startAnalyzer() {
  const platform = document.getElementById('analyzer-platform').value;
  const username = document.getElementById('analyzer-username').value.trim().replace('@', '').replace(/https?:\/\/.+\/(in\/)?/g, '').replace(/\/$/, '');
  const postCount = parseInt(document.getElementById('analyzer-posts').value) || 10;
  const skipPinned = document.getElementById('analyzer-skip-pinned').checked;
  const skipCount = skipPinned ? parseInt(document.getElementById('analyzer-skip-count').value) || 0 : 0;
  
  if (!username) return status('analyzer-status', '❌ Username requerido', 'error');
  
  status('analyzer-status', '🔄 Abriendo perfil...', 'info');
  document.getElementById('analyzer-progress').style.display = 'flex';
  document.getElementById('analyzer-results').style.display = 'none';
  
  const url = platform === 'instagram'
    ? `https://instagram.com/${username}/`
    : `https://linkedin.com/in/${username}/recent-activity/all/`;
  
  const tab = await chrome.tabs.create({ url, active: true });
  await new Promise(r => setTimeout(r, 4000));
  
  chrome.tabs.sendMessage(tab.id, { 
    action: 'START_ANALYSIS', 
    username, 
    postCount, 
    skipCount, 
    platform 
  });
  
  status('analyzer-status', '📊 Analizando... mantené la pestaña visible', 'info');
}

function displayAnalysisResults(data) {
  currentAnalysis = data;
  document.getElementById('analyzer-progress').style.display = 'none';
  document.getElementById('analyzer-results').style.display = 'block';
  
  const posts = data.posts || [];
  document.getElementById('result-username').textContent = `@${data.username}`;
  document.getElementById('res-posts').textContent = posts.length;
  document.getElementById('res-likes').textContent = (data.stats?.totalLikes || 0).toLocaleString();
  document.getElementById('res-avg').textContent = Math.round(data.stats?.avgLikes || 0).toLocaleString();
  
  // Posts per week
  if (posts.length >= 2) {
    const times = posts.map(p => new Date(p.timestamp).getTime()).filter(t => !isNaN(t)).sort();
    const days = (times[times.length - 1] - times[0]) / (1000 * 60 * 60 * 24);
    document.getElementById('res-week').textContent = days > 0 ? ((posts.length / days) * 7).toFixed(1) : posts.length;
  } else {
    document.getElementById('res-week').textContent = '-';
  }
  
  // Heatmap
  renderHeatmap(posts);
  
  // Top posts
  const top = posts.filter(p => p.likes > 0).sort((a, b) => b.likes - a.likes).slice(0, 5);
  document.getElementById('analyzer-top-posts').innerHTML = top.map((p, i) => {
    const caption = p.caption ? (p.caption.substring(0, 60) + (p.caption.length > 60 ? '...' : '')) : 'Sin caption';
    return `
      <div class="post-item">
        <span class="post-rank">#${i + 1}</span>
        <span class="post-caption" title="${(p.caption || '').replace(/"/g, '&quot;')}">${caption}</span>
        <span class="post-likes">❤️ ${p.likes.toLocaleString()}</span>
        ${p.postUrl ? `<a href="${p.postUrl}" target="_blank">🔗</a>` : ''}
      </div>
    `;
  }).join('');
  
  status('analyzer-status', '✅ Análisis completado!', 'success');
  
  // Add to CRM
  if (document.getElementById('analyzer-add-crm')?.checked) {
    addAnalyzedToCRM(data);
  }
}

function renderHeatmap(posts) {
  const container = document.getElementById('analyzer-heatmap');
  if (!container || !posts.length) return;
  
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  
  posts.forEach(p => {
    const d = new Date(p.timestamp);
    if (!isNaN(d)) heatmap[d.getDay()][d.getHours()]++;
  });
  
  const max = Math.max(...heatmap.flat(), 1);
  
  container.innerHTML = `
    <table class="heatmap-table">
      <thead><tr><th></th>${Array.from({ length: 24 }, (_, h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${days.map((day, di) => `
        <tr><th>${day}</th>${heatmap[di].map(v => `
          <td style="background:${v ? `rgba(102,126,234,${0.2 + (v / max) * 0.8})` : '#f5f5f5'}">${v || ''}</td>
        `).join('')}</tr>
      `).join('')}</tbody>
    </table>
  `;
}

async function addAnalyzedToCRM(data) {
  const lista = document.getElementById('analyzer-list').value;
  if (!lista) return;
  
  const { personas = [] } = await chrome.storage.local.get('personas');
  
  if (personas.find(p => p.username === data.username)) {
    toast('ℹ️ Ya existe en el CRM', 'info');
    return;
  }
  
  personas.push({
    id: Date.now(),
    platform: data.platform || 'instagram',
    nombre: data.username,
    username: data.username,
    lista: lista,
    origen: 'analyzer',
    createdAt: new Date().toISOString(),
    notas: `${data.posts?.length} posts, Avg: ${Math.round(data.stats?.avgLikes || 0)} likes`,
    interactions: []
  });
  
  await chrome.storage.local.set({ personas });
  toast('✅ Agregado al CRM', 'success');
}

function downloadAnalysisCSV() {
  if (!currentAnalysis?.posts?.length) return;
  
  const rows = [['Fecha', 'Likes', 'Comentarios', 'URL']];
  currentAnalysis.posts.forEach(p => {
    rows.push([
      new Date(p.timestamp).toISOString(),
      p.likes,
      p.comments || 0,
      p.postUrl || ''
    ]);
  });
  
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `analysis_${currentAnalysis.username}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMENTOR
// ═══════════════════════════════════════════════════════════════════════════

async function saveAIConfig() {
  const config = {
    provider: document.getElementById('ai-provider').value,
    apiKey: document.getElementById('ai-key').value.trim(),
    expertise: document.getElementById('ai-expertise').value.trim()
  };
  
  if (!config.apiKey) return status('ai-status', '❌ API Key requerida', 'error');
  
  await chrome.storage.local.set({ aiConfig: config });
  status('ai-status', '✅ Guardado', 'success');
  
  // Update setup wizard
  document.getElementById('step-ai').querySelector('.step-status').textContent = '✅';
}

function addCommentorLog(msg, type = 'info') {
  const log = document.getElementById('commentor-log');
  if (!log) return;
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

async function startCommentor() {
  const listaId = document.getElementById('commentor-list').value;
  if (!listaId) return toast('❌ Seleccioná una lista', 'error');
  
  const { personas = [], listas = [], aiConfig } = await chrome.storage.local.get(['personas', 'listas', 'aiConfig']);
  
  if (!aiConfig?.apiKey) return toast('❌ Configurá la API de IA primero', 'error');
  
  const lista = listas.find(l => l.id === listaId);
  if (!lista) return toast('❌ Lista no encontrada', 'error');
  
  const targets = personas.filter(p => p.lista === listaId);
  if (!targets.length) return toast('❌ Lista vacía', 'error');
  
  commentorRunning = true;
  document.getElementById('start-commentor').style.display = 'none';
  document.getElementById('stop-commentor').style.display = 'inline-block';
  document.getElementById('commentor-icon').textContent = '▶️';
  document.getElementById('commentor-state').textContent = 'Ejecutando';
  document.getElementById('commentor-detail').textContent = `${targets.length} personas en cola`;
  
  addCommentorLog(`🚀 Iniciando con ${targets.length} personas de "${lista.name}"`, 'success');
  
  const { config = {} } = await chrome.storage.local.get('config');
  const delayMin = (config.delayMin || 30) * 1000;
  const delayMax = (config.delayMax || 90) * 1000;
  
  for (const person of targets) {
    if (!commentorRunning) break;
    
    addCommentorLog(`👤 Procesando @${person.username}...`, 'info');
    
    try {
      // Open profile
      const url = person.platform === 'instagram'
        ? `https://instagram.com/${person.username}/`
        : `https://linkedin.com/in/${person.username}/`;
      
      addCommentorLog(`🔗 Abriendo ${url}...`, 'info');
      const tab = await chrome.tabs.create({ url, active: false });
      
      // Wait for page to load
      addCommentorLog(`⏳ Esperando carga de página...`, 'info');
      await new Promise(r => setTimeout(r, 6000));
      
      // Send message with timeout
      let response;
      try {
        response = await Promise.race([
          chrome.tabs.sendMessage(tab.id, {
            action: 'FIND_AND_COMMENT',
            aiConfig,
            personNotes: person.notas
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: El script no respondió en 60s')), 60000)
          )
        ]);
      } catch (msgError) {
        addCommentorLog(`⚠️ Error de comunicación: ${msgError.message}`, 'error');
        addCommentorLog(`💡 ¿El content script está cargado? Verificá que Instagram esté abierto.`, 'info');
        chrome.tabs.remove(tab.id);
        continue;
      }
      
      if (response?.success) {
        if (response.verified) {
          addCommentorLog(`✅ Comentado y VERIFICADO: "${response.comment?.substring(0, 50)}..."`, 'success');
        } else {
          addCommentorLog(`⚠️ Comentado pero NO verificado: "${response.comment?.substring(0, 50)}..."`, 'warning');
        }
        
        // Save interaction
        await addInteraction(person.id, {
          type: 'comment',
          date: new Date().toISOString(),
          postUrl: response.postUrl,
          comment: response.comment,
          verified: response.verified
        });
        
        // Update total
        const { totalComments = 0 } = await chrome.storage.local.get('totalComments');
        await chrome.storage.local.set({ totalComments: totalComments + 1 });
      } else {
        addCommentorLog(`❌ No se pudo comentar: ${response?.error || 'Error desconocido'}`, 'error');
        
        // Provide helpful suggestions
        if (response?.error?.includes('campo de comentarios')) {
          addCommentorLog(`💡 Sugerencia: El post puede tener comentarios deshabilitados`, 'info');
        } else if (response?.error?.includes('botón')) {
          addCommentorLog(`💡 Sugerencia: Instagram puede haber cambiado su interfaz`, 'info');
        } else if (response?.error?.includes('bloqueando')) {
          addCommentorLog(`💡 Sugerencia: Instagram puede estar limitando tus acciones. Esperá un rato.`, 'info');
        }
      }
      
      chrome.tabs.remove(tab.id);
      
    } catch (e) {
      addCommentorLog(`❌ Error crítico: ${e.message}`, 'error');
      addCommentorLog(`📋 Stack: ${e.stack?.substring(0, 100)}...`, 'error');
    }
    
    // Delay
    const delay = delayMin + Math.random() * (delayMax - delayMin);
    addCommentorLog(`⏳ Esperando ${Math.round(delay / 1000)}s...`, 'info');
    await new Promise(r => setTimeout(r, delay));
  }
  
  addCommentorLog('✅ Ciclo completado', 'success');
  stopCommentor();
}

function stopCommentor() {
  commentorRunning = false;
  document.getElementById('start-commentor').style.display = 'inline-block';
  document.getElementById('stop-commentor').style.display = 'none';
  document.getElementById('commentor-icon').textContent = '⏸️';
  document.getElementById('commentor-state').textContent = 'Detenido';
}

async function addInteraction(personId, interaction) {
  const { personas = [] } = await chrome.storage.local.get('personas');
  const person = personas.find(p => p.id == personId);
  if (person) {
    if (!person.interactions) person.interactions = [];
    person.interactions.push(interaction);
    await chrome.storage.local.set({ personas });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════════════

async function renderCampaigns(campaigns) {
  const container = document.getElementById('campaigns-list');
  if (!container) return;
  
  if (!campaigns.length) {
    container.innerHTML = '<p class="empty-state">No hay campañas. Creá una para empezar.</p>';
    return;
  }
  
  const { listas = [] } = await chrome.storage.local.get('listas');
  
  container.innerHTML = campaigns.map(c => {
    const lista = listas.find(l => l.id === c.lista);
    const sent = c.sent?.length || 0;
    const total = c.recipients?.length || 0;
    return `
      <div class="campaign-card" data-id="${c.id}">
        <div class="campaign-info">
          <strong>${c.name}</strong>
          <span class="campaign-meta">${platformIcon(lista?.platform)} ${lista?.name || 'Lista eliminada'}</span>
        </div>
        <div class="campaign-stats-mini">
          <span class="sent">${sent}/${total}</span>
          <span class="status-badge ${c.status}">${c.status}</span>
        </div>
      </div>
    `;
  }).join('');
  
  // Click to view detail
  container.querySelectorAll('.campaign-card').forEach(card => {
    card.addEventListener('click', () => viewCampaign(card.dataset.id));
  });
}

async function saveCampaign() {
  const listaId = document.getElementById('camp-list').value;
  if (!listaId) return toast('❌ Seleccioná una lista', 'error');
  
  const name = document.getElementById('camp-name').value.trim();
  if (!name) return toast('❌ Nombre requerido', 'error');
  
  const message = document.getElementById('camp-message').value.trim();
  if (!message) return toast('❌ Mensaje requerido', 'error');
  
  const { personas = [], campaigns = [], listas = [] } = await chrome.storage.local.get(['personas', 'campaigns', 'listas']);
  
  const lista = listas.find(l => l.id === listaId);
  if (!lista) return toast('❌ Lista no encontrada', 'error');
  
  const recipients = personas.filter(p => p.lista === listaId).map(p => ({
    id: p.id,
    nombre: p.nombre,
    username: p.username,
    platform: p.platform || lista.platform,
    status: 'pending'
  }));
  
  if (!recipients.length) return toast('❌ Lista vacía', 'error');
  
  const campaign = {
    id: Date.now().toString(),
    name,
    lista: listaId,
    platform: lista.platform, // Guardar plataforma directamente
    message,
    delay: parseInt(document.getElementById('camp-delay').value) || 60,
    dailyLimit: parseInt(document.getElementById('camp-limit').value) || 20,
    status: 'draft',
    recipients,
    sent: [],
    createdAt: new Date().toISOString()
  };
  
  campaigns.push(campaign);
  await chrome.storage.local.set({ campaigns });
  
  document.getElementById('new-campaign-form').style.display = 'none';
  document.getElementById('camp-name').value = '';
  document.getElementById('camp-message').value = '';
  
  renderCampaigns(campaigns);
  toast('✅ Campaña creada', 'success');
}

async function viewCampaign(id) {
  const { campaigns = [], personas = [], listas = [] } = await chrome.storage.local.get(['campaigns', 'personas', 'listas']);
  const campaign = campaigns.find(c => c.id === id);
  if (!campaign) return;
  
  currentCampaign = campaign;
  
  // DYNAMIC: Get current persons in the list
  const currentListPersons = personas.filter(p => p.lista === campaign.lista);
  const sentIds = new Set((campaign.sent || []).map(sid => String(sid)));
  
  // Build display list with current status
  const displayRecipients = currentListPersons.map(p => ({
    id: p.id,
    nombre: p.nombre,
    username: p.username,
    status: sentIds.has(String(p.id)) ? 'sent' : 'pending'
  }));
  
  document.getElementById('new-campaign-form').style.display = 'none';
  document.getElementById('campaign-detail').style.display = 'block';
  
 document.getElementById('campaign-detail-name').textContent = campaign.name;
  document.getElementById('camp-total').textContent = displayRecipients.length;
  document.getElementById('camp-sent').textContent = campaign.sent?.length || 0;
  
  // Calcular pendientes y fallidos reales
  const failedCount = displayRecipients.filter(r => r.status === 'failed').length;
  document.getElementById('camp-failed').textContent = failedCount;
  document.getElementById('camp-pending').textContent = displayRecipients.length - (campaign.sent?.length || 0) - failedCount;
  
  // Cargar el mensaje en el textarea
  document.getElementById('campaign-detail-message').value = campaign.message || '';
  
  // Recipients list with actions
  const recipientsEl = document.getElementById('campaign-recipients');
  recipientsEl.innerHTML = displayRecipients.length > 0 ? displayRecipients.map(r => `
    <div class="recipient-item ${r.status}" data-id="${r.id}">
      <span class="recipient-name">@${r.username}</span>
      <span class="recipient-status">${r.status === 'sent' ? '✅ Enviado' : r.status === 'failed' ? '❌ Falló' : '⏳ Pendiente'}</span>
      <div class="recipient-actions">
        ${r.status === 'failed' ? `<button class="btn-tiny" data-action="retry" data-recipient="${r.id}" title="Reintentar">🔄</button>` : ''}
        ${r.status === 'pending' ? `<button class="btn-tiny" data-action="mark-sent" data-recipient="${r.id}" title="Marcar como enviado">✅</button>` : ''}
        <button class="btn-tiny btn-danger" data-action="remove" data-recipient="${r.id}" title="Quitar">🗑️</button>
      </div>
    </div>
  `).join('') : '<p>Sin destinatarios en la lista</p>';
  
  // Add event delegation for recipient actions
  recipientsEl.addEventListener('click', handleRecipientAction);
}

// Campaign recipient management - Event delegation handler
async function handleRecipientAction(e) {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  
  const action = button.dataset.action;
  const recipientId = button.dataset.recipient;
  
  if (!recipientId) return;
  
  switch (action) {
    case 'remove':
      await removeRecipient(recipientId);
      break;
    case 'mark-sent':
      await markAsSent(recipientId);
      break;
    case 'retry':
      await retryRecipient(recipientId);
      break;
  }
}

async function removeRecipient(recipientId) {
  if (!currentCampaign) return;
  
  currentCampaign.recipients = currentCampaign.recipients.filter(r => String(r.id) !== String(recipientId));
  currentCampaign.sent = (currentCampaign.sent || []).filter(id => String(id) !== String(recipientId));
  
  await saveCampaignState();
  viewCampaign(currentCampaign.id);
  toast('🗑️ Destinatario eliminado', 'success');
}

async function markAsSent(recipientId) {
  if (!currentCampaign) return;
  
  const recipient = currentCampaign.recipients.find(r => String(r.id) === String(recipientId));
  if (recipient) {
    recipient.status = 'sent';
    recipient.sentAt = new Date().toISOString();
    if (!currentCampaign.sent) currentCampaign.sent = [];
    if (!currentCampaign.sent.includes(recipientId)) {
      currentCampaign.sent.push(recipientId);
    }
  }
  
  await saveCampaignState();
  viewCampaign(currentCampaign.id);
  toast('✅ Marcado como enviado', 'success');
}

async function retryRecipient(recipientId) {
  if (!currentCampaign) return;
  
  const recipient = currentCampaign.recipients.find(r => String(r.id) === String(recipientId));
  if (recipient) {
    recipient.status = 'pending';
    delete recipient.sentAt;
    currentCampaign.sent = (currentCampaign.sent || []).filter(id => String(id) !== String(recipientId));
  }
  
  await saveCampaignState();
  viewCampaign(currentCampaign.id);
  toast('🔄 Listo para reintentar', 'success');
}

function addCampaignLog(msg, type = 'info') {
  const log = document.getElementById('campaign-log');
  if (!log) return;
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

async function runCampaign() {
  if (!currentCampaign) return;
  
  const { listas = [], personas = [] } = await chrome.storage.local.get(['listas', 'personas']);
  const lista = listas.find(l => l.id === currentCampaign.lista);
  
  // DYNAMIC QUERY: Get current persons in the list, not the snapshot
  const currentListPersons = personas.filter(p => p.lista === currentCampaign.lista);
  
  // Update recipients with current list members (preserve sent status)
  const sentIds = new Set((currentCampaign.sent || []).map(id => String(id)));
  
  // Build fresh recipients list from current list members
  const freshRecipients = currentListPersons.map(p => {
    const existingRecipient = currentCampaign.recipients?.find(r => String(r.id) === String(p.id));
    return {
      id: p.id,
      nombre: p.nombre,
      username: p.username,
      platform: p.platform || lista?.platform,
      status: sentIds.has(String(p.id)) ? 'sent' : (existingRecipient?.status || 'pending'),
      sentAt: existingRecipient?.sentAt
    };
  });
  
  // Update campaign recipients
  currentCampaign.recipients = freshRecipients;
  
  // Detectar plataforma: de campaña, de lista, o de los recipients
  let platform = currentCampaign.platform || lista?.platform;
  
  if (!platform && freshRecipients.length > 0) {
    platform = freshRecipients[0].platform;
  }
  
  if (!platform) {
    toast('❌ No se pudo determinar la plataforma. Creá una nueva campaña.', 'error');
    return;
  }
  
  // Guardar platform en la campaña para futuras ejecuciones
  if (!currentCampaign.platform) {
    currentCampaign.platform = platform;
  }
  
  await saveCampaignState();
  
  campaignRunning = true;
  document.getElementById('run-campaign').style.display = 'none';
  document.getElementById('stop-campaign').style.display = 'inline-block';
  
  // Update status
  currentCampaign.status = 'running';
  await saveCampaignState();
  
  addCampaignLog(`🚀 Iniciando campaña "${currentCampaign.name}"`, 'success');
  addCampaignLog(`📋 Plataforma: ${platform}`, 'info');
  addCampaignLog(`👥 Total en lista: ${freshRecipients.length} personas`, 'info');
  
  // Filtrar pendientes que no estén en sent
  const pending = freshRecipients.filter(r => r.status === 'pending' && !sentIds.has(String(r.id)));
  const dailyLimit = currentCampaign.dailyLimit || 20;
  const toSend = pending.slice(0, dailyLimit);
  
  addCampaignLog(`📨 Enviando a ${toSend.length} personas (límite: ${dailyLimit}/día)`, 'info');
  
  if (toSend.length === 0) {
    addCampaignLog(`⚠️ No hay destinatarios pendientes`, 'error');
    stopCampaign();
    return;
  }
  
  for (const recipient of toSend) {
    if (!campaignRunning) break;
    
    // Personalize message
    const message = currentCampaign.message
      .replace(/{nombre}/g, recipient.nombre || recipient.username)
      .replace(/{username}/g, recipient.username);
    
    addCampaignLog(`📤 Enviando a @${recipient.username}...`, 'info');
    
    try {
      let success = false;
      
      if (platform === 'whatsapp') {
        // WhatsApp: Open wa.me link
        const phone = recipient.username.replace(/\D/g, '');
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        await chrome.tabs.create({ url: waUrl, active: true });
        addCampaignLog(`📲 WhatsApp abierto para ${recipient.nombre || recipient.username}`, 'info');
        addCampaignLog(`⚠️ Enviá el mensaje manualmente y cerrá la pestaña`, 'info');
        success = true; // Manual send
      } else {
        // Instagram: Open inbox and send DM via new message flow
        // LinkedIn: Open profile and send message
        
        let url;
        if (platform === 'instagram') {
          url = 'https://instagram.com/direct/inbox/';
        } else {
          url = `https://linkedin.com/in/${recipient.username}/`;
        }
        
        addCampaignLog(`🔗 Abriendo ${platform === 'instagram' ? 'inbox' : 'perfil'}...`, 'info');
        
        const tab = await chrome.tabs.create({ url, active: true }); // active: true para que funcione mejor
        
        // Wait more for page to load completely
        addCampaignLog(`⏳ Esperando que cargue (8s)...`, 'info');
        await new Promise(r => setTimeout(r, 8000)); // 8 segundos
        
        // First check if content script is loaded
        const ping = await chrome.tabs.sendMessage(tab.id, { action: 'PING' }).catch(() => null);
        if (!ping) {
          addCampaignLog(`⚠️ Content script no cargado, esperando más...`, 'info');
          await new Promise(r => setTimeout(r, 4000));
        }
        
        try {
          addCampaignLog(`📤 Enviando SEND_DM a ${recipient.username}...`, 'info');
          
          const response = await Promise.race([
            chrome.tabs.sendMessage(tab.id, {
              action: 'SEND_DM',
              username: recipient.username,
              message
            }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout 90s')), 90000))
          ]);
          
          success = response?.success;
          
          if (response?.verified) {
            addCampaignLog(`✅ Mensaje verificado como enviado`, 'success');
          } else if (success) {
            addCampaignLog(`⚠️ Mensaje enviado (sin verificar)`, 'info');
          } else if (response?.error) {
            addCampaignLog(`❌ Error del script: ${response.error}`, 'error');
          }
          
        } catch (e) {
          console.error('Error enviando mensaje:', e);
          addCampaignLog(`❌ Error: ${e.message}`, 'error');
          success = false;
        }
        
        // Close tab after a delay
        await new Promise(r => setTimeout(r, 2000));
        chrome.tabs.remove(tab.id).catch(() => {});
      }
      
      if (success) {
        recipient.status = 'sent';
        recipient.sentAt = new Date().toISOString();
        if (!currentCampaign.sent) currentCampaign.sent = [];
        currentCampaign.sent.push(recipient.id);
        addCampaignLog(`✅ Enviado a @${recipient.username}`, 'success');
        
        // Add interaction
        await addInteraction(recipient.id, {
          type: 'dm',
          date: new Date().toISOString(),
          campaign: currentCampaign.name,
          message: message.substring(0, 100)
        });
      } else {
        recipient.status = 'failed';
        addCampaignLog(`❌ Falló @${recipient.username}`, 'error');
      }
      
    } catch (e) {
      recipient.status = 'failed';
      addCampaignLog(`❌ Error: ${e.message}`, 'error');
    }
    
    await saveCampaignState();
    viewCampaign(currentCampaign.id);
    
    // Delay
    const delay = currentCampaign.delay * 1000;
    addCampaignLog(`⏳ Esperando ${currentCampaign.delay}s...`, 'info');
    await new Promise(r => setTimeout(r, delay));
  }
  
  addCampaignLog('✅ Ciclo completado', 'success');
  
  // Check if all done
  const remainingPending = currentCampaign.recipients.filter(r => r.status === 'pending').length;
  currentCampaign.status = remainingPending === 0 ? 'completed' : 'paused';
  await saveCampaignState();
  stopCampaign();
}

function stopCampaign() {
  campaignRunning = false;
  document.getElementById('run-campaign').style.display = 'inline-block';
  document.getElementById('stop-campaign').style.display = 'none';
}

async function saveCampaignState() {
  if (!currentCampaign) return;
  const { campaigns = [] } = await chrome.storage.local.get('campaigns');
  const idx = campaigns.findIndex(c => c.id === currentCampaign.id);
  if (idx >= 0) {
    campaigns[idx] = currentCampaign;
    await chrome.storage.local.set({ campaigns });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEETS
// ═══════════════════════════════════════════════════════════════════════════

async function connectSheets() {
  status('sheets-status', '🔄 Conectando...', 'info');
  
  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (t) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(t);
      });
    });
    
    // Create spreadsheet with proper headers
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title: `Social Analyzer CRM - ${new Date().toLocaleDateString()}` },
        sheets: [
          { properties: { title: 'CRM', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Listas', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Campañas', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Interacciones', gridProperties: { frozenRowCount: 1 } } }
        ]
      })
    });
    
    if (!response.ok) throw new Error('Error creando spreadsheet');
    const data = await response.json();
    const sheetId = data.spreadsheetId;
    
    // Add headers
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: 'CRM!A1:H1', values: [['ID', 'Nombre', 'Username', 'Plataforma', 'Lista', 'Origen', 'Fecha', 'Notas']] },
          { range: 'Listas!A1:D1', values: [['ID', 'Nombre', 'Plataforma', 'Icono']] },
          { range: 'Campañas!A1:F1', values: [['ID', 'Nombre', 'Lista', 'Status', 'Enviados', 'Total']] },
          { range: 'Interacciones!A1:F1', values: [['Fecha', 'Persona', 'Tipo', 'Campaña', 'Detalle', 'URL']] }
        ]
      })
    });
    
    await chrome.storage.local.set({ sheetId });
    
    document.getElementById('sheets-not-connected').style.display = 'none';
    document.getElementById('sheets-connected').style.display = 'block';
    document.getElementById('sheet-id').value = sheetId;
    
    // Update setup wizard
    document.getElementById('step-sheets').querySelector('.step-status').textContent = '✅';
    
    status('sheets-status', '✅ Conectado!', 'success');
    
  } catch (e) {
    status('sheets-status', `❌ ${e.message}`, 'error');
  }
}

async function disconnectSheets() {
  await chrome.storage.local.remove('sheetId');
  document.getElementById('sheets-not-connected').style.display = 'block';
  document.getElementById('sheets-connected').style.display = 'none';
  toast('🔌 Desconectado', 'success');
}

async function syncToSheets() {
  const { sheetId, personas = [], listas = [], campaigns = [] } = await chrome.storage.local.get(['sheetId', 'personas', 'listas', 'campaigns']);
  
  if (!sheetId) return toast('❌ Conectá Sheets primero', 'error');
  
  toast('🔄 Sincronizando...', 'info');
  
  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (t) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(t);
      });
    });
    
    // Prepare CRM data with all fields
    const crmData = personas.map(p => [
      p.id, 
      p.nombre, 
      p.username, 
      p.platform, 
      p.lista, 
      p.origen, 
      p.createdAt, 
      p.notas || '',
      p.phone || '',
      p.email || '',
      p.otherSocial || '',
      p.bio || '',
      (p.interactions || []).length // Total interactions
    ]);
    
    const listasData = listas.map(l => [l.id, l.name, l.platform, l.icon]);
    const campaignsData = campaigns.map(c => [c.id, c.name, c.lista, c.status, c.sent?.length || 0, c.recipients?.length || 0]);
    
    // Prepare interactions data
    const interactionsData = [];
    personas.forEach(p => {
      (p.interactions || []).forEach(i => {
        interactionsData.push([
          new Date(i.date).toISOString(),
          p.nombre || p.username,
          p.username,
          i.type,
          i.comment || i.message || i.detail || '',
          i.postUrl || '',
          i.verified ? 'Sí' : 'No'
        ]);
      });
    });
    
    // Sort interactions by date descending
    interactionsData.sort((a, b) => new Date(b[0]) - new Date(a[0]));
    
    // Update headers first (in case they changed)
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: 'CRM!A1:M1', values: [['ID', 'Nombre', 'Username', 'Plataforma', 'Lista', 'Origen', 'Fecha', 'Notas', 'Celular', 'Email', 'Otras RRSS', 'Bio', 'Interacciones']] },
          { range: 'Interacciones!A1:G1', values: [['Fecha', 'Nombre', 'Username', 'Tipo', 'Detalle', 'URL', 'Verificado']] }
        ]
      })
    });
    
    // Clear and update data
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: 'CRM!A2:M', values: crmData.length ? crmData : [[]] },
          { range: 'Listas!A2:D', values: listasData.length ? listasData : [[]] },
          { range: 'Campañas!A2:F', values: campaignsData.length ? campaignsData : [[]] },
          { range: 'Interacciones!A2:G', values: interactionsData.length ? interactionsData : [[]] }
        ]
      })
    });
    
    toast(`✅ Sincronizado: ${personas.length} contactos, ${interactionsData.length} interacciones`, 'success');
    
  } catch (e) {
    toast(`❌ ${e.message}`, 'error');
  }
}

async function syncPersonToSheet(persona) {
  const { sheetId } = await chrome.storage.local.get('sheetId');
  if (!sheetId) return;
  
  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (t) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(t);
      });
    });
    
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/CRM!A:H:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [[persona.id, persona.nombre, persona.username, persona.platform, persona.lista, persona.origen, persona.createdAt, persona.notas]]
      })
    });
  } catch (e) {
    console.error('Sync error:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

async function saveConfig() {
  const config = {
    igComments: parseInt(document.getElementById('lim-ig-comments').value) || 20,
    igDMs: parseInt(document.getElementById('lim-ig-dms').value) || 20,
    liMsgs: parseInt(document.getElementById('lim-li-msgs').value) || 25,
    delayMin: parseInt(document.getElementById('delay-min').value) || 30,
    delayMax: parseInt(document.getElementById('delay-max').value) || 90
  };
  
  await chrome.storage.local.set({ config });
  toast('✅ Guardado', 'success');
}

async function exportAll() {
  const data = await chrome.storage.local.get(null);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `social-analyzer-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

async function importAll(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const data = JSON.parse(await file.text());
    await chrome.storage.local.set(data);
    location.reload();
  } catch (e) {
    toast('❌ Error importando', 'error');
  }
}

async function clearAll() {
  if (!confirm('⚠️ ¿Borrar TODOS los datos?')) return;
  await chrome.storage.local.clear();
  location.reload();
}

async function startSetup() {
  // First connect sheets
  if (!document.getElementById('step-sheets').querySelector('.step-status').textContent.includes('✅')) {
    await connectSheets();
  }
  // Then go to config for AI
  switchView('config');
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handleMessage(msg) {
  console.log('📨 Message:', msg.action);
  
  if (msg.action === 'ANALYSIS_COMPLETE_FROM_CONTENT') {
    displayAnalysisResults(msg);
  }
  
  if (msg.action === 'ANALYSIS_PROGRESS_FROM_CONTENT') {
    const bar = document.getElementById('analyzer-bar');
    const text = document.getElementById('analyzer-progress-text');
    if (bar) bar.style.width = `${(msg.current / msg.total) * 100}%`;
    if (text) text.textContent = `${msg.current}/${msg.total}`;
  }
  
  if (msg.action === 'WHATSAPP_CONTACTS_IMPORTED') {
    const { personas = [] } = await chrome.storage.local.get('personas');
    let added = 0;
    
    msg.contacts.forEach(c => {
      if (!personas.find(p => p.username === c.phone && p.platform === 'whatsapp')) {
        personas.push({
          id: Date.now() + Math.random(),
          nombre: c.name,
          username: c.phone,
          platform: 'whatsapp',
          lista: msg.targetList,
          origen: `whatsapp:${msg.groupName || 'grupo'}`,
          createdAt: new Date().toISOString(),
          interactions: []
        });
        added++;
      }
    });
    
    await chrome.storage.local.set({ personas });
    
    document.getElementById('modal-import').style.display = 'none';
    status('wa-status', `✅ ${added} contactos importados`, 'success');
    renderCRM(personas);
    toast(`✅ ${added} contactos de WhatsApp`, 'success');
  }
  
  if (msg.action === 'IG_FOLLOWERS_IMPORTED') {
    const { personas = [] } = await chrome.storage.local.get('personas');
    let added = 0;
    
    (msg.users || msg.followers || []).forEach(f => {
      if (!personas.find(p => p.username === f.username && p.platform === 'instagram')) {
        personas.push({
          id: Date.now() + Math.random(),
          nombre: f.name || f.nombre || f.username,
          username: f.username,
          platform: 'instagram',
          lista: msg.targetList,
          origen: 'ig:followers',
          createdAt: new Date().toISOString(),
          interactions: []
        });
        added++;
      }
    });
    
    await chrome.storage.local.set({ personas });
    document.getElementById('modal-import').style.display = 'none';
    status('ig-followers-status', `✅ ${added} seguidores importados`, 'success');
    renderCRM(personas);
    toast(`✅ ${added} seguidores importados`, 'success');
  }
  
// Escuchar importaciones de Instagram Y LinkedIn
  if (msg.action === 'IG_ENGAGERS_IMPORTED' || msg.action === 'IG_POST_USERS_IMPORTED' || msg.action === 'LI_POST_USERS_IMPORTED') {
    const { personas = [] } = await chrome.storage.local.get('personas');
    const platform = msg.platform || 'instagram';
    let added = 0;
    
    (msg.users || []).forEach(u => {
      if (!personas.find(p => p.username === u.username && p.platform === platform)) {
        personas.push({
          id: Date.now() + Math.random(),
          nombre: u.name || u.nombre || u.username,
          username: u.username,
          platform: platform,
          lista: msg.targetList,
          origen: `${platform}:post:${u.type || 'interaction'}`,
          createdAt: new Date().toISOString(),
          interactions: []
        });
        added++;
      }
    });
    
    await chrome.storage.local.set({ personas });
    document.getElementById('modal-import').style.display = 'none';
    
    // Actualizamos el mensajito de estado correcto según la plataforma
    const statusId = platform === 'linkedin' ? 'li-post-status' : 'ig-post-status';
    status(statusId, `✅ ${added} usuarios importados`, 'success');
    
    renderCRM(personas);
    toast(`✅ ${added} usuarios importados`, 'success');
  }
  
  if (msg.action === 'WHATSAPP_ERROR') {
    status('wa-status', `❌ ${msg.error}`, 'error');
    toast(`❌ WhatsApp: ${msg.error}`, 'error');
  }
}

console.log('✅ Dashboard v6.0 loaded');
