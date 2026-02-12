// ═══════════════════════════════════════════════════════════════════════
// POPUP.JS - Social Media Analyzer Pro
// ═══════════════════════════════════════════════════════════════════════

let currentPlatform = 'instagram';
let currentCompetitor = null;
let currentAnalysisId = null;

// ═════════════════════════════════════════════════════════════════
// INIT
// ═════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('📊 Social Analyzer Pro - Iniciando...');
  
  // Init tabs
  initTabs();
  
  // Init modals
  initModals();
  
  // Check if there's an active analysis
  await checkActiveAnalysis();
  
  // Load competitors
  await loadCompetitors('instagram');
  await loadCompetitors('linkedin');
  
  // Load metrics
  await loadMetrics('instagram');
  
  // Init event listeners
  initEventListeners();
  
  console.log('✅ Dashboard listo');
});

// ═════════════════════════════════════════════════════════════════
// CHECK ACTIVE ANALYSIS
// ═════════════════════════════════════════════════════════════════

async function checkActiveAnalysis() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_ANALYSIS_STATE' });
    
    if (response && response.active) {
      console.log('🔄 Análisis activo detectado:', response);
      
      // Mostrar progress bar con estado actual
      const platformIcon = response.platform === 'instagram' ? '📱' : '💼';
      document.getElementById('global-progress').style.display = 'block';
      document.getElementById('global-progress-platform').textContent = platformIcon;
      document.getElementById('global-progress-username').textContent = `@${response.username}`;
      document.getElementById('global-progress-status').textContent = response.status;
      document.getElementById('global-progress-text').textContent = `${response.current} / ${response.total} posts`;
      
      const percentage = response.total > 0 ? (response.current / response.total * 100).toFixed(0) : 0;
      document.getElementById('global-progress-bar').style.width = `${percentage}%`;
    }
  } catch (error) {
    console.log('No hay análisis activo');
  }
}

// ═════════════════════════════════════════════════════════════════
// TABS
// ═════════════════════════════════════════════════════════════════

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update active states
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`tab-${tabName}`).classList.add('active');
      
      // Load data if needed
      if (tabName === 'metrics') {
        loadMetrics(currentPlatform);
      }
    });
  });
  
  // Metrics sub-tabs
  const metricsTabs = document.querySelectorAll('.metrics-tab');
  metricsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const platform = tab.dataset.platform;
      currentPlatform = platform;
      
      metricsTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      loadMetrics(platform);
    });
  });
}

// ═════════════════════════════════════════════════════════════════
// LOAD COMPETITORS
// ═════════════════════════════════════════════════════════════════

async function loadCompetitors(platform) {
  console.log(`📋 Cargando competidores de ${platform}...`);
  
  const competitors = await StorageManager.getCompetitors(platform);
  const listEl = document.getElementById(`${platform}-list`);
  
  if (competitors.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <p>👋 No tenés competidores agregados</p>
        <p class="small">Agregá tu primer competidor para empezar</p>
      </div>
    `;
    return;
  }
  
  listEl.innerHTML = '';
  
  for (const competitor of competitors) {
    const card = createCompetitorCard(competitor, platform);
    listEl.appendChild(card);
  }
}

function createCompetitorCard(competitor, platform) {
  const card = document.createElement('div');
  card.className = 'competitor-card';
  
  // Format last analyzed
  let lastAnalyzedText = '⏳ Nunca analizado';
  if (competitor.lastAnalyzed) {
    const date = new Date(competitor.lastAnalyzed);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) lastAnalyzedText = '📊 Hoy';
    else if (diffDays === 1) lastAnalyzedText = '📊 Ayer';
    else lastAnalyzedText = `📊 Hace ${diffDays} días`;
  }
  
  // Stats
  const statsHTML = competitor.postCount > 0 ? `
    <span>${competitor.postCount} posts</span>
    <span>•</span>
    <span>${formatNumber(competitor.avgLikes)} likes avg</span>
    <span>•</span>
    <span>${lastAnalyzedText}</span>
  ` : `<span>${lastAnalyzedText}</span>`;
  
  card.innerHTML = `
    <div class="competitor-header">
      <div class="competitor-username">@${competitor.username}</div>
      ${competitor.analysisCount > 0 ? `<div class="badge">${competitor.analysisCount} análisis</div>` : ''}
    </div>
    <div class="competitor-stats">${statsHTML}</div>
    <div class="competitor-actions">
      <button class="btn btn-primary btn-sm" data-action="analyze" data-platform="${platform}" data-username="${competitor.username}">
        📊 Analizar
      </button>
      ${competitor.analysisCount > 0 ? `
        <button class="btn btn-success btn-sm" data-action="summary" data-platform="${platform}" data-username="${competitor.username}">
          📈 Resumen
        </button>
        <button class="btn btn-secondary btn-sm" data-action="history" data-platform="${platform}" data-username="${competitor.username}">
          📜 Historial (${competitor.analysisCount})
        </button>
        <button class="btn btn-secondary btn-sm" data-action="download" data-platform="${platform}" data-username="${competitor.username}">
          📥 HTML
        </button>
      ` : ''}
      <button class="btn btn-danger btn-sm btn-icon" data-action="delete" data-platform="${platform}" data-username="${competitor.username}">
        🗑️
      </button>
    </div>
  `;
  
  // Event listeners
  card.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const platform = e.target.dataset.platform;
      const username = e.target.dataset.username;
      
      handleCompetitorAction(action, platform, username);
    });
  });
  
  return card;
}

// ═════════════════════════════════════════════════════════════════
// COMPETITOR ACTIONS
// ═════════════════════════════════════════════════════════════════

async function handleCompetitorAction(action, platform, username) {
  console.log(`🎯 Acción: ${action} - ${platform}/${username}`);
  
  switch(action) {
    case 'analyze':
      openAnalyzeModal(platform, username);
      break;
    
    case 'summary':
      openSummaryModal(platform, username);
      break;
    
    case 'history':
      openHistoryModal(platform, username);
      break;
    
    case 'download':
      await downloadLatestHTML(platform, username);
      break;
    
    case 'delete':
      await deleteCompetitor(platform, username);
      break;
  }
}

// ═════════════════════════════════════════════════════════════════
// MODALS
// ═════════════════════════════════════════════════════════════════

function initModals() {
  // Close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllModals();
    });
  });
  
  // Click outside to close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAllModals();
      }
    });
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('active');
  });
  currentCompetitor = null;
  currentAnalysisId = null;
}

function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

// ═════════════════════════════════════════════════════════════════
// ADD COMPETITOR
// ═════════════════════════════════════════════════════════════════

function initEventListeners() {
  // Add competitor buttons
  document.getElementById('add-instagram').addEventListener('click', () => {
    currentPlatform = 'instagram';
    openModal('modal-add');
  });
  
  document.getElementById('add-linkedin').addEventListener('click', () => {
    currentPlatform = 'linkedin';
    openModal('modal-add');
  });
  
  // Confirm add
  document.getElementById('confirm-add').addEventListener('click', async () => {
    const username = document.getElementById('new-username').value.trim();
    
    if (!username) {
      showToast('⚠️ Ingresá un username', 'error');
      return;
    }
    
    const result = await StorageManager.addCompetitor(currentPlatform, username);
    
    if (result.success) {
      showToast(`✅ @${username} agregado a ${currentPlatform}`, 'success');
      await loadCompetitors(currentPlatform);
      closeAllModals();
      document.getElementById('new-username').value = '';
    } else {
      showToast(`❌ ${result.error}`, 'error');
    }
  });
  
  document.getElementById('cancel-add').addEventListener('click', closeAllModals);
  
  // Analyze modal - quick options
  document.querySelectorAll('[data-count]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('analyze-count').value = btn.dataset.count;
    });
  });
  
  document.getElementById('cancel-analyze').addEventListener('click', closeAllModals);
  document.getElementById('confirm-analyze').addEventListener('click', startAnalysis);
  
  // Summary modal
  document.getElementById('close-summary').addEventListener('click', closeAllModals);
  document.getElementById('download-summary-html').addEventListener('click', () => {
    if (currentAnalysisId) {
      window.downloadAnalysisHTML(currentAnalysisId);
    } else {
      showToast('❌ No hay análisis seleccionado', 'error');
    }
  });
  
  // History modal
  document.getElementById('close-history').addEventListener('click', closeAllModals);
  
  // Config
  document.getElementById('clear-data').addEventListener('click', clearAllData);
}

// ═════════════════════════════════════════════════════════════════
// ANALYZE
// ═════════════════════════════════════════════════════════════════

function openAnalyzeModal(platform, username) {
  currentPlatform = platform;
  currentCompetitor = username;
  
  document.getElementById('analyze-title').textContent = `📊 Analizar @${username}`;
  openModal('modal-analyze');
}

async function startAnalysis() {
  const count = parseInt(document.getElementById('analyze-count').value);
  
  if (!count || count < 1 || count > 100) {
    showToast('⚠️ Ingresá un número entre 1 y 100', 'error');
    return;
  }
  
  // Guardar variables ANTES de cerrar modal
  const platform = currentPlatform;
  const username = currentCompetitor;
  
  console.log(`🚀 Iniciando análisis: ${platform}/${username} - ${count} posts`);
  
  closeAllModals();
  
  // Mostrar global progress bar
  const platformIcon = platform === 'instagram' ? '📱' : '💼';
  document.getElementById('global-progress').style.display = 'block';
  document.getElementById('global-progress-platform').textContent = platformIcon;
  document.getElementById('global-progress-username').textContent = `@${username}`;
  document.getElementById('global-progress-status').textContent = '🔍 Abriendo perfil...';
  document.getElementById('global-progress-text').textContent = `0 / ${count} posts`;
  document.getElementById('global-progress-bar').style.width = '0%';
  
  // Send message to background worker
  chrome.runtime.sendMessage({
    action: 'START_ANALYSIS',
    platform: platform,
    username: username,
    postCount: count
  });
}

// ═════════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════════

async function openSummaryModal(platform, username) {
  currentPlatform = platform;
  currentCompetitor = username;
  
  document.getElementById('summary-title').textContent = `📈 Resumen: @${username}`;
  document.getElementById('summary-content').innerHTML = '<div class="loading">Cargando...</div>';
  
  openModal('modal-summary');
  
  // Get latest analysis
  const listKey = `analyses_list_${platform}_${username}`;
  const listResult = await chrome.storage.local.get(listKey);
  const analysisList = listResult[listKey] || [];
  
  if (analysisList.length === 0) {
    document.getElementById('summary-content').innerHTML = '<div class="empty-state"><p>No hay análisis disponibles</p></div>';
    return;
  }
  
  // Get most recent analysis
  const latestId = analysisList[0];
  const analysisResult = await chrome.storage.local.get(latestId);
  const analysis = analysisResult[latestId];
  
  if (!analysis) {
    document.getElementById('summary-content').innerHTML = '<div class="empty-state"><p>No se pudo cargar el análisis</p></div>';
    return;
  }
  
  currentAnalysisId = latestId;
  
  // Render summary
  renderSummary(analysis);
}

function renderSummary(analysis) {
  const stats = analysis.stats;
  
  const html = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value">${stats.totalPosts}</div>
        <div class="metric-label">Posts</div>
      </div>
      <div class="metric-card pink">
        <div class="metric-value">${formatNumber(stats.totalLikes)}</div>
        <div class="metric-label">Likes</div>
      </div>
      <div class="metric-card green">
        <div class="metric-value">${formatNumber(stats.avgLikes)}</div>
        <div class="metric-label">Avg Likes</div>
      </div>
      <div class="metric-card orange">
        <div class="metric-value">${formatNumber(stats.avgComments)}</div>
        <div class="metric-label">Avg Comments</div>
      </div>
    </div>
    
    ${stats.topPost ? `
      <div class="top-post">
        <div class="top-post-header">🏆 Post con mejor engagement</div>
        <div class="top-post-text">${stats.topPost.caption ? stats.topPost.caption.substring(0, 100) + '...' : 'Sin caption'}</div>
        <div class="top-post-stats">❤️ ${formatNumber(stats.topPost.likes)} likes • 💬 ${formatNumber(stats.topPost.comments || 0)} comments</div>
      </div>
    ` : ''}
    
    <div style="margin-top: 15px;">
      <p class="small"><strong>⏰ Mejor hora:</strong> ${stats.bestHour || 'N/A'}:00hs</p>
      <p class="small"><strong>📅 Mejor día:</strong> ${stats.bestDay || 'N/A'}</p>
    </div>
  `;
  
  document.getElementById('summary-content').innerHTML = html;
}

// ═════════════════════════════════════════════════════════════════
// HISTORY
// ═════════════════════════════════════════════════════════════════

async function openHistoryModal(platform, username) {
  currentPlatform = platform;
  currentCompetitor = username;
  
  document.getElementById('history-title').textContent = `📜 Historial: @${username}`;
  document.getElementById('history-content').innerHTML = '<div class="loading">Cargando...</div>';
  
  openModal('modal-history');
  
  // Obtener lista de análisis
  const listKey = `analyses_list_${platform}_${username}`;
  const listResult = await chrome.storage.local.get(listKey);
  const analysisList = listResult[listKey] || [];
  
  if (analysisList.length === 0) {
    document.getElementById('history-content').innerHTML = '<div class="empty-state"><p>No hay análisis previos</p></div>';
    return;
  }
  
  // Obtener todos los análisis
  const analysisIds = analysisList.slice(0, 20); // Máximo 20
  const analysesResult = await chrome.storage.local.get(analysisIds);
  
  let html = '';
  
  for (const analysisId of analysisIds) {
    const analysis = analysesResult[analysisId];
    if (!analysis) continue;
    
    const date = new Date(analysis.analyzedAt);
    const dateStr = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    const totalPosts = analysis.stats?.totalPosts || analysis.posts?.length || 0;
    const avgLikes = analysis.stats?.avgLikes || 0;
    
    html += `
      <div class="history-item">
        <div class="history-header">
          <div class="history-date">📅 ${dateStr}</div>
        </div>
        <div class="history-stats">
          ${totalPosts} posts • ${formatNumber(avgLikes)} avg likes
        </div>
        <div class="history-actions">
          <button class="btn btn-success btn-sm" onclick="viewAnalysis('${analysisId}')">📈 Ver</button>
          <button class="btn btn-secondary btn-sm" onclick="downloadAnalysisHTML('${analysisId}')">📥 HTML</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteAnalysis('${analysisId}')">🗑️</button>
        </div>
      </div>
    `;
  }
  
  document.getElementById('history-content').innerHTML = html;
}

// Global functions for onclick
window.viewAnalysis = async function(analysisId) {
  console.log('👁️ Viendo análisis:', analysisId);
  
  // Obtener directamente de storage
  const result = await chrome.storage.local.get(analysisId);
  const analysis = result[analysisId];
  
  if (analysis) {
    currentAnalysisId = analysisId;
    currentCompetitor = analysis.username;
    currentPlatform = analysis.platform;
    renderSummary(analysis);
    closeAllModals();
    openModal('modal-summary');
  } else {
    showToast('❌ No se encontró el análisis', 'error');
  }
};

window.downloadAnalysisHTML = async function(analysisId) {
  console.log('📥 Descargando HTML para:', analysisId);
  
  // Obtener el análisis
  const result = await chrome.storage.local.get(analysisId);
  const analysis = result[analysisId];
  
  if (!analysis) {
    showToast('❌ No se encontró el análisis', 'error');
    return;
  }
  
  showToast('📥 Generando HTML...', 'info');
  
  // Generar HTML
  const html = generateFullHTMLReport(analysis);
  
  // Descargar
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const date = new Date(analysis.analyzedAt);
  const dateStr = date.toISOString().split('T')[0];
  a.download = `${analysis.platform}_${analysis.username}_${dateStr}.html`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('✅ HTML descargado', 'success');
};

window.deleteAnalysis = async function(analysisId) {
  if (!confirm('¿Eliminar este análisis?')) return;
  
  // Obtener el análisis para saber platform y username
  const result = await chrome.storage.local.get(analysisId);
  const analysis = result[analysisId];
  
  if (!analysis) {
    showToast('❌ No se encontró el análisis', 'error');
    return;
  }
  
  // Eliminar el análisis
  await chrome.storage.local.remove(analysisId);
  
  // Actualizar la lista
  const listKey = `analyses_list_${analysis.platform}_${analysis.username}`;
  const listResult = await chrome.storage.local.get(listKey);
  const list = listResult[listKey] || [];
  const newList = list.filter(id => id !== analysisId);
  await chrome.storage.local.set({ [listKey]: newList });
  
  // Actualizar contador del competidor
  const competitorsKey = `competitors_${analysis.platform}`;
  const compResult = await chrome.storage.local.get(competitorsKey);
  const competitors = compResult[competitorsKey] || [];
  const compIndex = competitors.findIndex(c => c.username === analysis.username);
  
  if (compIndex !== -1) {
    competitors[compIndex].analysisCount = Math.max(0, (competitors[compIndex].analysisCount || 1) - 1);
    await chrome.storage.local.set({ [competitorsKey]: competitors });
  }
  
  showToast('✅ Análisis eliminado', 'success');
  
  // Recargar historial
  if (currentCompetitor && currentPlatform) {
    await openHistoryModal(currentPlatform, currentCompetitor);
  } else {
    closeAllModals();
  }
};

// ═════════════════════════════════════════════════════════════════
// DELETE COMPETITOR
// ═════════════════════════════════════════════════════════════════

async function deleteCompetitor(platform, username) {
  if (!confirm(`¿Eliminar a @${username}? Se borrarán todos sus análisis.`)) {
    return;
  }
  
  await StorageManager.removeCompetitor(platform, username);
  showToast(`✅ @${username} eliminado`, 'success');
  await loadCompetitors(platform);
}

// ═════════════════════════════════════════════════════════════════
// DOWNLOAD HTML
// ═════════════════════════════════════════════════════════════════

async function downloadLatestHTML(platform, username) {
  // Obtener el análisis más reciente
  const listKey = `analyses_list_${platform}_${username}`;
  const listResult = await chrome.storage.local.get(listKey);
  const analysisList = listResult[listKey] || [];
  
  if (analysisList.length === 0) {
    showToast('❌ No hay análisis disponibles', 'error');
    return;
  }
  
  // Obtener el más reciente
  const latestId = analysisList[0];
  
  // Usar la función global
  await window.downloadAnalysisHTML(latestId);
}

// ═════════════════════════════════════════════════════════════════
// METRICS
// ═════════════════════════════════════════════════════════════════

async function loadMetrics(platform) {
  console.log(`📊 Cargando métricas globales de ${platform}...`);
  
  const metricsKey = `global_metrics_${platform}`;
  const result = await chrome.storage.local.get(metricsKey);
  const metrics = result[metricsKey];
  
  console.log('🔍 Métricas encontradas:', metrics);
  console.log('🔍 Key buscada:', metricsKey);
  
  const container = document.getElementById('metrics-content');
  
  if (!metrics || metrics.totalCompetitors === 0) {
    // Debug: listar todas las keys en storage
    chrome.storage.local.get(null, (allData) => {
      console.log('📦 Todo el storage:', Object.keys(allData));
      console.log('📦 Keys de métricas:', Object.keys(allData).filter(k => k.includes('global_metrics')));
    });
    
    container.innerHTML = '<div class="empty-state"><p>📊 Analizá al menos un competidor para ver métricas</p></div>';
    return;
  }
  
  const html = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value">${metrics.totalCompetitors}</div>
        <div class="metric-label">Competidores</div>
      </div>
      <div class="metric-card pink">
        <div class="metric-value">${metrics.totalPosts}</div>
        <div class="metric-label">Posts</div>
      </div>
      <div class="metric-card green">
        <div class="metric-value">${formatNumber(metrics.avgLikes)}</div>
        <div class="metric-label">Avg Likes</div>
      </div>
      <div class="metric-card orange">
        <div class="metric-value">${metrics.bestDay}</div>
        <div class="metric-label">Mejor Día</div>
      </div>
    </div>
    
    ${metrics.topPost ? `
      <div class="top-post">
        <div class="top-post-header">🏆 Post con más engagement (todos)</div>
        <div class="top-post-text">@${metrics.topPost.username}: ${metrics.topPost.caption ? metrics.topPost.caption.substring(0, 80) + '...' : 'Sin caption'}</div>
        <div class="top-post-stats">❤️ ${formatNumber(metrics.topPost.likes)} likes</div>
      </div>
    ` : ''}
    
    ${metrics.topCompetitor ? `
      <p class="small" style="margin-top: 15px;"><strong>🥇 Mejor competidor:</strong> @${metrics.topCompetitor}</p>
    ` : ''}
    
    <p class="small"><strong>⏰ Mejores horarios:</strong> ${metrics.topHours ? metrics.topHours.join(':00, ') + ':00' : 'N/A'}</p>
  `;
  
  container.innerHTML = html;
}

// ═════════════════════════════════════════════════════════════════
// CONFIG
// ═════════════════════════════════════════════════════════════════

async function clearAllData() {
  if (!confirm('⚠️ ¿Eliminar TODOS los datos? Esta acción no se puede deshacer.')) {
    return;
  }
  
  await chrome.storage.local.clear();
  showToast('✅ Todos los datos eliminados', 'success');
  
  // Reload UI
  await loadCompetitors('instagram');
  await loadCompetitors('linkedin');
  await loadMetrics('instagram');
}

// ═════════════════════════════════════════════════════════════════
// UTILS
// ═════════════════════════════════════════════════════════════════

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ═════════════════════════════════════════════════════════════════
// GENERATE HTML REPORT
// ═════════════════════════════════════════════════════════════════

function generateFullHTMLReport(analysis) {
  const { username, platform, analyzedAt, posts, stats } = analysis;
  const date = new Date(analyzedAt);
  const dateStr = date.toLocaleDateString('es-AR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // ═════════════════════════════════════════════════════════════════
  // CALCULAR SCORES
  // ═════════════════════════════════════════════════════════════════
  
  // 1. FRECUENCIA DE POSTEO (posts por semana)
  // IMPORTANTE: Ordenar posts por timestamp primero
  const sortedPosts = [...posts].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  const oldestPost = sortedPosts.length > 0 ? new Date(sortedPosts[0].timestamp) : new Date();
  const newestPost = sortedPosts.length > 0 ? new Date(sortedPosts[sortedPosts.length - 1].timestamp) : new Date();
  const daysDiff = Math.max(1, (newestPost - oldestPost) / (1000 * 60 * 60 * 24));
  const postsPerWeek = posts.length / (daysDiff / 7);
  
  // Score frecuencia (0-100)
  let frequencyScore = 0;
  let frequencyLabel = '';
  if (postsPerWeek >= 7) {
    frequencyScore = 100;
    frequencyLabel = 'Excelente';
  } else if (postsPerWeek >= 3) {
    frequencyScore = 80;
    frequencyLabel = 'Muy bueno';
  } else if (postsPerWeek >= 1) {
    frequencyScore = 60;
    frequencyLabel = 'Bueno';
  } else if (postsPerWeek >= 0.5) {
    frequencyScore = 40;
    frequencyLabel = 'Regular';
  } else {
    frequencyScore = 20;
    frequencyLabel = 'Bajo';
  }
  
  // 2. ENGAGEMENT RATE
  // Fórmula: (Total Likes + Comments) / (Posts * Followers estimados)
  // Como no tenemos followers exactos, usamos avg likes como proxy
  const avgEngagement = stats.avgLikes || 0;
  
  let engagementScore = 0;
  let engagementLabel = '';
  if (platform === 'instagram') {
    // Instagram: 100-500 likes = bueno, 500-2000 = muy bueno, 2000+ = excelente
    if (avgEngagement >= 2000) {
      engagementScore = 100;
      engagementLabel = 'Excelente';
    } else if (avgEngagement >= 500) {
      engagementScore = 80;
      engagementLabel = 'Muy bueno';
    } else if (avgEngagement >= 100) {
      engagementScore = 60;
      engagementLabel = 'Bueno';
    } else if (avgEngagement >= 20) {
      engagementScore = 40;
      engagementLabel = 'Regular';
    } else {
      engagementScore = 20;
      engagementLabel = 'Bajo';
    }
  } else if (platform === 'linkedin') {
    // LinkedIn: 50-200 likes = bueno, 200-1000 = muy bueno, 1000+ = excelente
    if (avgEngagement >= 1000) {
      engagementScore = 100;
      engagementLabel = 'Excelente';
    } else if (avgEngagement >= 200) {
      engagementScore = 80;
      engagementLabel = 'Muy bueno';
    } else if (avgEngagement >= 50) {
      engagementScore = 60;
      engagementLabel = 'Bueno';
    } else if (avgEngagement >= 10) {
      engagementScore = 40;
      engagementLabel = 'Regular';
    } else {
      engagementScore = 20;
      engagementLabel = 'Bajo';
    }
  }
  
  // 3. CONSISTENCIA (varianza de likes)
  const likesArray = posts.map(p => p.likes);
  const avgLikes = likesArray.reduce((a, b) => a + b, 0) / likesArray.length;
  const variance = likesArray.reduce((sum, likes) => sum + Math.pow(likes - avgLikes, 2), 0) / likesArray.length;
  const stdDev = Math.sqrt(variance);
  const cv = avgLikes > 0 ? (stdDev / avgLikes) : 1; // Coeficiente de variación
  
  let consistencyScore = 0;
  let consistencyLabel = '';
  if (cv <= 0.3) {
    consistencyScore = 100;
    consistencyLabel = 'Muy consistente';
  } else if (cv <= 0.5) {
    consistencyScore = 80;
    consistencyLabel = 'Consistente';
  } else if (cv <= 0.8) {
    consistencyScore = 60;
    consistencyLabel = 'Moderado';
  } else if (cv <= 1.2) {
    consistencyScore = 40;
    consistencyLabel = 'Variable';
  } else {
    consistencyScore = 20;
    consistencyLabel = 'Muy variable';
  }
  
  // SCORE GLOBAL (promedio ponderado)
  const globalScore = Math.round(
    (frequencyScore * 0.3) + 
    (engagementScore * 0.5) + 
    (consistencyScore * 0.2)
  );
  
  let globalLabel = '';
  let globalColor = '';
  if (globalScore >= 80) {
    globalLabel = 'Influencer Top';
    globalColor = '#4caf50';
  } else if (globalScore >= 60) {
    globalLabel = 'Influencer Sólido';
    globalColor = '#8bc34a';
  } else if (globalScore >= 40) {
    globalLabel = 'En Crecimiento';
    globalColor = '#ffc107';
  } else {
    globalLabel = 'Principiante';
    globalColor = '#ff9800';
  }
  
  // Calcular distribución por día de semana
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayDistribution = stats.distribution?.daily || new Array(7).fill(0);
  const hourDistribution = stats.distribution?.hourly || new Array(24).fill(0);
  
  // Top 10 posts
  const topPosts = [...posts]
    .filter(p => p.likes > 0)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 10);
  
  // Generar filas de la tabla
  let tableRows = '';
  posts.forEach(post => {
    const postDate = new Date(post.timestamp);
    const dateStr = postDate.toLocaleDateString('es-AR');
    const timeStr = postDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const caption = post.caption ? post.caption.substring(0, 80) + '...' : 'Sin caption';
    
    // Generar URL correcta según plataforma
    let postUrl = '#';
    if (analysis.platform === 'instagram' && post.postId) {
      postUrl = `https://www.instagram.com/p/${post.postId}/`;
    } else if (analysis.platform === 'linkedin' && post.postId) {
      postUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${post.postId}`;
    }
    
    tableRows += `
      <tr>
        <td>${dateStr} ${timeStr}</td>
        <td><a href="${postUrl}" target="_blank">${caption}</a></td>
        <td>${formatNumber(post.likes)}</td>
        <td><a href="${postUrl}" target="_blank">Ver Post</a></td>
      </tr>
    `;
  });
  
  // Generar filas de top posts
  let topPostsRows = '';
  topPosts.forEach((post, i) => {
    const caption = post.caption ? post.caption.substring(0, 60) + '...' : 'Sin caption';
    
    // Generar URL correcta según plataforma
    let postUrl = '#';
    if (analysis.platform === 'instagram' && post.postId) {
      postUrl = `https://www.instagram.com/p/${post.postId}/`;
    } else if (analysis.platform === 'linkedin' && post.postId) {
      postUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${post.postId}`;
    }
    
    topPostsRows += `
      <tr>
        <td>${i + 1}</td>
        <td><a href="${postUrl}" target="_blank">${caption}</a></td>
        <td>${formatNumber(post.likes)}</td>
      </tr>
    `;
  });
  
  // Generar gráfico de días (barras simples con CSS)
  let dayBars = '';
  const maxDayCount = Math.max(...dayDistribution);
  days.forEach((day, i) => {
    const count = dayDistribution[i];
    const percentage = maxDayCount > 0 ? (count / maxDayCount * 100) : 0;
    dayBars += `
      <div class="bar-item">
        <div class="bar-label">${day}</div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="bar-value">${count}</div>
      </div>
    `;
  });
  
  // Generar heatmap simplificado de horarios
  let heatmapRows = '';
  const hours = ['0-5', '6-11', '12-17', '18-23'];
  const ranges = [
    hourDistribution.slice(0, 6).reduce((a, b) => a + b, 0),
    hourDistribution.slice(6, 12).reduce((a, b) => a + b, 0),
    hourDistribution.slice(12, 18).reduce((a, b) => a + b, 0),
    hourDistribution.slice(18, 24).reduce((a, b) => a + b, 0)
  ];
  const maxHourCount = Math.max(...ranges);
  
  hours.forEach((hour, i) => {
    const count = ranges[i];
    const intensity = maxHourCount > 0 ? Math.round((count / maxHourCount) * 100) : 0;
    const color = intensity > 66 ? '#4caf50' : intensity > 33 ? '#ffc107' : '#e0e0e0';
    
    heatmapRows += `
      <div class="heatmap-cell" style="background: ${color};">
        <div class="heatmap-hour">${hour}hs</div>
        <div class="heatmap-count">${count}</div>
      </div>
    `;
  });
  
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Análisis de @${username} - ${platform}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 {
      color: #667eea;
      font-size: 32px;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #8e8e8e;
      font-size: 14px;
      margin-bottom: 30px;
    }
    
    /* SCORES SECTION */
    .scores-section {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 40px;
    }
    .global-score {
      text-align: center;
      margin-bottom: 30px;
    }
    .global-score-value {
      font-size: 72px;
      font-weight: 700;
      background: ${globalColor};
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .global-score-label {
      font-size: 24px;
      font-weight: 600;
      color: ${globalColor};
      margin-top: 10px;
    }
    .scores-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .score-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .score-card-title {
      font-size: 14px;
      color: #8e8e8e;
      margin-bottom: 10px;
      text-transform: uppercase;
    }
    .score-card-value {
      font-size: 36px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 5px;
    }
    .score-card-label {
      font-size: 14px;
      font-weight: 600;
    }
    .score-card-note {
      font-size: 11px;
      color: #999;
      margin-top: 5px;
      font-style: italic;
    }
    .score-bar {
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 10px;
    }
    .score-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      transition: width 0.3s ease;
    }
    
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .metric-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
    }
    .metric-value {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .metric-label {
      font-size: 12px;
      opacity: 0.9;
      text-transform: uppercase;
    }
    .section {
      margin-bottom: 40px;
    }
    h2 {
      font-size: 20px;
      color: #333;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
      color: #667eea;
    }
    tr:hover {
      background: #f9f9f9;
    }
    a {
      color: #667eea;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .bar-item {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
    }
    .bar-label {
      width: 100px;
      font-size: 14px;
      font-weight: 600;
    }
    .bar-container {
      flex: 1;
      height: 30px;
      background: #f0f0f0;
      border-radius: 5px;
      overflow: hidden;
      margin: 0 10px;
    }
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      transition: width 0.3s ease;
    }
    .bar-value {
      width: 50px;
      text-align: right;
      font-weight: 600;
      color: #667eea;
    }
    .heatmap {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-top: 20px;
    }
    .heatmap-cell {
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      color: white;
    }
    .heatmap-hour {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .heatmap-count {
      font-size: 24px;
      font-weight: 700;
    }
    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #8e8e8e;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Análisis de @${username}</h1>
    <div class="subtitle">
      Plataforma: ${platform} • Analizado: ${dateStr} • ${posts.length} posts
    </div>
    
    <div class="scores-section">
      <div class="global-score">
        <div class="global-score-value">${globalScore}</div>
        <div class="global-score-label">${globalLabel}</div>
      </div>
      
      <div class="scores-grid">
        <div class="score-card">
          <div class="score-card-title">Frecuencia de Posteo</div>
          <div class="score-card-value">${postsPerWeek.toFixed(1)}</div>
          <div class="score-card-label">${frequencyLabel} • ${postsPerWeek.toFixed(1)} posts/semana</div>
          <div class="score-bar">
            <div class="score-bar-fill" style="width: ${frequencyScore}%"></div>
          </div>
        </div>
        
        <div class="score-card">
          <div class="score-card-title">Engagement</div>
          <div class="score-card-value">${formatNumber(avgEngagement)}</div>
          <div class="score-card-label">${engagementLabel} • Avg likes por post</div>
          <div class="score-bar">
            <div class="score-bar-fill" style="width: ${engagementScore}%"></div>
          </div>
        </div>
        
        <div class="score-card">
          <div class="score-card-title">Consistencia</div>
          <div class="score-card-value">${consistencyScore}</div>
          <div class="score-card-label">${consistencyLabel}</div>
          <div class="score-bar">
            <div class="score-bar-fill" style="width: ${consistencyScore}%"></div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="metrics">
      <div class="metric-card">
        <div class="metric-value">${posts.length}</div>
        <div class="metric-label">Posts Analizados</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${formatNumber(stats.totalLikes || 0)}</div>
        <div class="metric-label">Total Likes</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${formatNumber(stats.avgLikes || 0)}</div>
        <div class="metric-label">Promedio Likes</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${stats.bestHour || 0}:00</div>
        <div class="metric-label">Mejor Hora</div>
      </div>
    </div>
    
    <div class="section">
      <h2>📈 Top 10 Posts por Engagement</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Caption</th>
            <th>Likes</th>
          </tr>
        </thead>
        <tbody>
          ${topPostsRows}
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <h2>📅 Distribución por Día de Semana</h2>
      ${dayBars}
    </div>
    
    <div class="section">
      <h2>⏰ Distribución por Horario</h2>
      <div class="heatmap">
        ${heatmapRows}
      </div>
    </div>
    
    <div class="section">
      <h2>📋 Todos los Posts</h2>
      <table>
        <thead>
          <tr>
            <th>Fecha y Hora</th>
            <th>Caption</th>
            <th>Likes</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      Generado por Social Analyzer Pro • ${new Date().toLocaleString('es-AR')}
    </div>
  </div>
</body>
</html>
  `;
}

// ═════════════════════════════════════════════════════════════════
// LISTEN TO BACKGROUND MESSAGES
// ═════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Mensaje del background:', message);
  
  if (message.action === 'ANALYSIS_COMPLETE') {
    // Ocultar global progress bar
    document.getElementById('global-progress').style.display = 'none';
    
    showToast(`✅ Análisis de @${message.username} completado!`, 'success');
    loadCompetitors(message.platform);
    loadMetrics(message.platform);
  }
  
  if (message.action === 'ANALYSIS_ERROR') {
    // Ocultar global progress bar
    document.getElementById('global-progress').style.display = 'none';
    
    showToast(`❌ Error: ${message.error}`, 'error');
  }
  
  if (message.action === 'ANALYSIS_PROGRESS') {
    // Actualizar global progress bar
    const percentage = message.total > 0 ? (message.current / message.total * 100).toFixed(0) : 0;
    
    document.getElementById('global-progress-status').textContent = message.status || '📊 Analizando...';
    document.getElementById('global-progress-text').textContent = `${message.current} / ${message.total} posts`;
    document.getElementById('global-progress-bar').style.width = `${percentage}%`;
  }
});

// ═════════════════════════════════════════════════════════════════
// WHATSAPP EXTRACTOR
// ═════════════════════════════════════════════════════════════════

document.getElementById('start-whatsapp-extraction')?.addEventListener('click', async () => {
  // Verificar que estamos en WhatsApp Web
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('web.whatsapp.com')) {
    showToast('❌ Abrí WhatsApp Web primero', 'error');
    return;
  }
  
  // Mostrar progreso
  document.getElementById('whatsapp-progress').style.display = 'block';
  document.getElementById('whatsapp-results').style.display = 'none';
  document.getElementById('start-whatsapp-extraction').disabled = true;
  
  showToast('🚀 Extracción iniciada...', 'info');
  
  try {
    // Enviar mensaje al content script
    await chrome.tabs.sendMessage(tab.id, {
      action: 'START_WHATSAPP_EXTRACTION'
    });
  } catch (error) {
    console.error('Error:', error);
    showToast('❌ Error al iniciar extracción', 'error');
    document.getElementById('whatsapp-progress').style.display = 'none';
    document.getElementById('start-whatsapp-extraction').disabled = false;
  }
});

// Listener para actualizaciones de progreso
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'WHATSAPP_PROGRESS') {
    document.getElementById('whatsapp-progress-status').textContent = message.status;
    document.getElementById('whatsapp-progress-details').textContent = `${message.current} contactos encontrados`;
  }
  
  if (message.action === 'WHATSAPP_COMPLETE') {
    document.getElementById('whatsapp-progress').style.display = 'none';
    document.getElementById('whatsapp-results').style.display = 'block';
    document.getElementById('start-whatsapp-extraction').disabled = false;
    
    // Mostrar estadísticas
    document.getElementById('whatsapp-total').textContent = message.stats.total;
    document.getElementById('whatsapp-with-name').textContent = message.stats.conNombre;
    document.getElementById('whatsapp-admins').textContent = message.stats.admins;
    
    showToast(`✅ ${message.stats.total} contactos extraídos`, 'success');
  }
  
  if (message.action === 'WHATSAPP_ERROR') {
    document.getElementById('whatsapp-progress').style.display = 'none';
    document.getElementById('start-whatsapp-extraction').disabled = false;
    
    showToast(`❌ Error: ${message.error}`, 'error');
  }
});

// ═════════════════════════════════════════════════════════════════
// ANTI-BAN CONFIGURATION
// ═════════════════════════════════════════════════════════════════

// Cargar configuración anti-ban
async function loadAntibanConfig() {
  const result = await chrome.storage.local.get('antibanConfig');
  const config = result.antibanConfig || getDefaultAntibanConfig();
  
  // Delays
  document.getElementById('delay-comments-min').value = config.delays.betweenComments.min;
  document.getElementById('delay-comments-max').value = config.delays.betweenComments.max;
  document.getElementById('delay-likes-min').value = config.delays.betweenLikes.min;
  document.getElementById('delay-likes-max').value = config.delays.betweenLikes.max;
  document.getElementById('delay-pages-min').value = config.delays.betweenPageLoads.min;
  document.getElementById('delay-pages-max').value = config.delays.betweenPageLoads.max;
  
  // Límites Instagram
  document.getElementById('limit-ig-comments').value = config.dailyLimits.instagram.comments;
  document.getElementById('limit-ig-likes').value = config.dailyLimits.instagram.likes;
  document.getElementById('limit-ig-follows').value = config.dailyLimits.instagram.follows;
  
  // Límites LinkedIn
  document.getElementById('limit-li-comments').value = config.dailyLimits.linkedin.comments;
  document.getElementById('limit-li-likes').value = config.dailyLimits.linkedin.likes;
  document.getElementById('limit-li-follows').value = config.dailyLimits.linkedin.follows;
  
  // Horarios
  document.getElementById('active-hours-enabled').checked = config.activeHours.enabled;
  document.getElementById('active-hours-start').value = config.activeHours.start;
  document.getElementById('active-hours-end').value = config.activeHours.end;
  
  // Pausas
  document.getElementById('breaks-enabled').checked = config.breaks.enabled;
  document.getElementById('lunch-break').checked = !!config.breaks.lunch;
  document.getElementById('evening-break').checked = !!config.breaks.evening;
  
  toggleSubconfigs();
}

function getDefaultAntibanConfig() {
  return {
    delays: {
      betweenComments: { min: 30, max: 90 },
      betweenLikes: { min: 10, max: 30 },
      betweenFollows: { min: 20, max: 60 },
      afterLogin: { min: 5, max: 10 },
      betweenPageLoads: { min: 2, max: 5 }
    },
    dailyLimits: {
      instagram: {
        comments: 20,
        likes: 100,
        follows: 50,
        dms: 30
      },
      linkedin: {
        comments: 15,
        likes: 50,
        follows: 30,
        messages: 20
      }
    },
    activeHours: {
      enabled: true,
      start: '09:00',
      end: '21:00',
      timezone: 'America/Argentina/Buenos_Aires'
    },
    breaks: {
      enabled: true,
      lunch: { start: '12:00', end: '14:00' },
      evening: { start: '18:00', duration: 30 }
    },
    randomization: {
      enabled: true,
      variability: 0.3
    }
  };
}

// Guardar configuración anti-ban
document.getElementById('save-antiban-config')?.addEventListener('click', async () => {
  const config = {
    delays: {
      betweenComments: {
        min: parseInt(document.getElementById('delay-comments-min').value),
        max: parseInt(document.getElementById('delay-comments-max').value)
      },
      betweenLikes: {
        min: parseInt(document.getElementById('delay-likes-min').value),
        max: parseInt(document.getElementById('delay-likes-max').value)
      },
      betweenFollows: { min: 20, max: 60 },
      afterLogin: { min: 5, max: 10 },
      betweenPageLoads: {
        min: parseInt(document.getElementById('delay-pages-min').value),
        max: parseInt(document.getElementById('delay-pages-max').value)
      }
    },
    dailyLimits: {
      instagram: {
        comments: parseInt(document.getElementById('limit-ig-comments').value),
        likes: parseInt(document.getElementById('limit-ig-likes').value),
        follows: parseInt(document.getElementById('limit-ig-follows').value),
        dms: 30
      },
      linkedin: {
        comments: parseInt(document.getElementById('limit-li-comments').value),
        likes: parseInt(document.getElementById('limit-li-likes').value),
        follows: parseInt(document.getElementById('limit-li-follows').value),
        messages: 20
      }
    },
    activeHours: {
      enabled: document.getElementById('active-hours-enabled').checked,
      start: document.getElementById('active-hours-start').value,
      end: document.getElementById('active-hours-end').value,
      timezone: 'America/Argentina/Buenos_Aires'
    },
    breaks: {
      enabled: document.getElementById('breaks-enabled').checked,
      lunch: document.getElementById('lunch-break').checked ? 
        { start: '12:00', end: '14:00' } : null,
      evening: document.getElementById('evening-break').checked ? 
        { start: '18:00', duration: 30 } : null
    },
    randomization: {
      enabled: true,
      variability: 0.3
    }
  };
  
  await chrome.storage.local.set({ antibanConfig: config });
  showToast('✅ Configuración Anti-Ban guardada', 'success');
});

// Toggle subconfigs
document.getElementById('active-hours-enabled')?.addEventListener('change', toggleSubconfigs);
document.getElementById('breaks-enabled')?.addEventListener('change', toggleSubconfigs);

function toggleSubconfigs() {
  const activeHoursEnabled = document.getElementById('active-hours-enabled')?.checked;
  const breaksEnabled = document.getElementById('breaks-enabled')?.checked;
  
  const activeHoursConfig = document.getElementById('active-hours-config');
  const breaksConfig = document.getElementById('breaks-config');
  
  if (activeHoursConfig) {
    activeHoursConfig.style.display = activeHoursEnabled ? 'block' : 'none';
  }
  
  if (breaksConfig) {
    breaksConfig.style.display = breaksEnabled ? 'block' : 'none';
  }
}

// Cargar config al abrir el tab
document.addEventListener('DOMContentLoaded', () => {
  loadAntibanConfig();
});
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
// ═════════════════════════════════════════════════════════════════
// ACCOUNT CONFIGURATION - ANTI-BAN
// ═════════════════════════════════════════════════════════════════

// Presets
const ACCOUNT_PRESETS = {
  'ultra-safe': {
    instagram: {
      daily: {
        comments: { max: 10, perHour: 3 },
        likes: { max: 50, perHour: 10 },
        follows: { max: 20, perHour: 5 },
        dms: { max: 15, perHour: 3 }
      },
      delays: {
        comments: { min: 40, max: 120 },
        likes: { min: 15, max: 45 },
        follows: { min: 30, max: 90 },
        dms: { min: 60, max: 180 }
      }
    },
    linkedin: {
      daily: {
        comments: { max: 8, perHour: 2 },
        likes: { max: 30, perHour: 6 },
        connections: { max: 15, perHour: 3 },
        messages: { max: 10, perHour: 2 }
      },
      delays: {
        comments: { min: 60, max: 150 },
        likes: { min: 20, max: 60 },
        connections: { min: 50, max: 120 },
        messages: { min: 70, max: 180 }
      }
    }
  },
  
  'conservative': {
    instagram: {
      daily: {
        comments: { max: 20, perHour: 5 },
        likes: { max: 100, perHour: 20 },
        follows: { max: 50, perHour: 10 },
        dms: { max: 30, perHour: 5 }
      },
      delays: {
        comments: { min: 30, max: 90 },
        likes: { min: 10, max: 30 },
        follows: { min: 20, max: 60 },
        dms: { min: 40, max: 120 }
      }
    },
    linkedin: {
      daily: {
        comments: { max: 15, perHour: 3 },
        likes: { max: 50, perHour: 10 },
        connections: { max: 30, perHour: 5 },
        messages: { max: 20, perHour: 4 }
      },
      delays: {
        comments: { min: 40, max: 100 },
        likes: { min: 15, max: 40 },
        connections: { min: 30, max: 90 },
        messages: { min: 50, max: 140 }
      }
    }
  },
  
  'moderate': {
    instagram: {
      daily: {
        comments: { max: 35, perHour: 8 },
        likes: { max: 200, perHour: 35 },
        follows: { max: 80, perHour: 15 },
        dms: { max: 50, perHour: 8 }
      },
      delays: {
        comments: { min: 25, max: 70 },
        likes: { min: 8, max: 25 },
        follows: { min: 15, max: 50 },
        dms: { min: 30, max: 90 }
      }
    },
    linkedin: {
      daily: {
        comments: { max: 25, perHour: 5 },
        likes: { max: 80, perHour: 15 },
        connections: { max: 50, perHour: 8 },
        messages: { max: 35, perHour: 6 }
      },
      delays: {
        comments: { min: 30, max: 80 },
        likes: { min: 12, max: 35 },
        connections: { min: 25, max: 70 },
        messages: { min: 40, max: 110 }
      }
    }
  },
  
  'aggressive': {
    instagram: {
      daily: {
        comments: { max: 50, perHour: 12 },
        likes: { max: 300, perHour: 50 },
        follows: { max: 100, perHour: 20 },
        dms: { max: 80, perHour: 12 }
      },
      delays: {
        comments: { min: 20, max: 50 },
        likes: { min: 5, max: 15 },
        follows: { min: 10, max: 35 },
        dms: { min: 25, max: 70 }
      }
    },
    linkedin: {
      daily: {
        comments: { max: 40, perHour: 8 },
        likes: { max: 120, perHour: 20 },
        connections: { max: 70, perHour: 12 },
        messages: { max: 50, perHour: 8 }
      },
      delays: {
        comments: { min: 25, max: 60 },
        likes: { min: 10, max: 28 },
        connections: { min: 20, max: 55 },
        messages: { min: 35, max: 90 }
      }
    }
  }
};

// Load account configuration
async function loadAccountConfig() {
  const result = await chrome.storage.local.get('accountConfig');
  const config = result.accountConfig || ACCOUNT_PRESETS['conservative'];
  
  applyConfigToUI(config);
  updateUsageDashboard();
}

// Apply config to UI
function applyConfigToUI(config) {
  // Instagram limits
  document.getElementById('ig-comments-day').value = config.instagram.daily.comments.max;
  document.getElementById('ig-comments-hour').value = config.instagram.daily.comments.perHour;
  document.getElementById('ig-likes-day').value = config.instagram.daily.likes.max;
  document.getElementById('ig-likes-hour').value = config.instagram.daily.likes.perHour;
  document.getElementById('ig-follows-day').value = config.instagram.daily.follows.max;
  document.getElementById('ig-follows-hour').value = config.instagram.daily.follows.perHour;
  document.getElementById('ig-dms-day').value = config.instagram.daily.dms.max;
  document.getElementById('ig-dms-hour').value = config.instagram.daily.dms.perHour;
  
  // Instagram delays
  document.getElementById('ig-delay-comments-min').value = config.instagram.delays.comments.min;
  document.getElementById('ig-delay-comments-max').value = config.instagram.delays.comments.max;
  document.getElementById('ig-delay-likes-min').value = config.instagram.delays.likes.min;
  document.getElementById('ig-delay-likes-max').value = config.instagram.delays.likes.max;
  document.getElementById('ig-delay-follows-min').value = config.instagram.delays.follows.min;
  document.getElementById('ig-delay-follows-max').value = config.instagram.delays.follows.max;
  document.getElementById('ig-delay-dms-min').value = config.instagram.delays.dms.min;
  document.getElementById('ig-delay-dms-max').value = config.instagram.delays.dms.max;
  
  // LinkedIn limits
  document.getElementById('li-comments-day').value = config.linkedin.daily.comments.max;
  document.getElementById('li-comments-hour').value = config.linkedin.daily.comments.perHour;
  document.getElementById('li-likes-day').value = config.linkedin.daily.likes.max;
  document.getElementById('li-likes-hour').value = config.linkedin.daily.likes.perHour;
  document.getElementById('li-connections-day').value = config.linkedin.daily.connections.max;
  document.getElementById('li-connections-hour').value = config.linkedin.daily.connections.perHour;
  document.getElementById('li-messages-day').value = config.linkedin.daily.messages.max;
  document.getElementById('li-messages-hour').value = config.linkedin.daily.messages.perHour;
  
  // LinkedIn delays
  document.getElementById('li-delay-comments-min').value = config.linkedin.delays.comments.min;
  document.getElementById('li-delay-comments-max').value = config.linkedin.delays.comments.max;
  document.getElementById('li-delay-likes-min').value = config.linkedin.delays.likes.min;
  document.getElementById('li-delay-likes-max').value = config.linkedin.delays.likes.max;
  document.getElementById('li-delay-connections-min').value = config.linkedin.delays.connections.min;
  document.getElementById('li-delay-connections-max').value = config.linkedin.delays.connections.max;
  document.getElementById('li-delay-messages-min').value = config.linkedin.delays.messages.min;
  document.getElementById('li-delay-messages-max').value = config.linkedin.delays.messages.max;
}

// Save account configuration
document.getElementById('save-account-config')?.addEventListener('click', async () => {
  const config = {
    instagram: {
      daily: {
        comments: {
          max: parseInt(document.getElementById('ig-comments-day').value),
          perHour: parseInt(document.getElementById('ig-comments-hour').value)
        },
        likes: {
          max: parseInt(document.getElementById('ig-likes-day').value),
          perHour: parseInt(document.getElementById('ig-likes-hour').value)
        },
        follows: {
          max: parseInt(document.getElementById('ig-follows-day').value),
          perHour: parseInt(document.getElementById('ig-follows-hour').value)
        },
        dms: {
          max: parseInt(document.getElementById('ig-dms-day').value),
          perHour: parseInt(document.getElementById('ig-dms-hour').value)
        }
      },
      delays: {
        comments: {
          min: parseInt(document.getElementById('ig-delay-comments-min').value),
          max: parseInt(document.getElementById('ig-delay-comments-max').value)
        },
        likes: {
          min: parseInt(document.getElementById('ig-delay-likes-min').value),
          max: parseInt(document.getElementById('ig-delay-likes-max').value)
        },
        follows: {
          min: parseInt(document.getElementById('ig-delay-follows-min').value),
          max: parseInt(document.getElementById('ig-delay-follows-max').value)
        },
        dms: {
          min: parseInt(document.getElementById('ig-delay-dms-min').value),
          max: parseInt(document.getElementById('ig-delay-dms-max').value)
        }
      }
    },
    linkedin: {
      daily: {
        comments: {
          max: parseInt(document.getElementById('li-comments-day').value),
          perHour: parseInt(document.getElementById('li-comments-hour').value)
        },
        likes: {
          max: parseInt(document.getElementById('li-likes-day').value),
          perHour: parseInt(document.getElementById('li-likes-hour').value)
        },
        connections: {
          max: parseInt(document.getElementById('li-connections-day').value),
          perHour: parseInt(document.getElementById('li-connections-hour').value)
        },
        messages: {
          max: parseInt(document.getElementById('li-messages-day').value),
          perHour: parseInt(document.getElementById('li-messages-hour').value)
        }
      },
      delays: {
        comments: {
          min: parseInt(document.getElementById('li-delay-comments-min').value),
          max: parseInt(document.getElementById('li-delay-comments-max').value)
        },
        likes: {
          min: parseInt(document.getElementById('li-delay-likes-min').value),
          max: parseInt(document.getElementById('li-delay-likes-max').value)
        },
        connections: {
          min: parseInt(document.getElementById('li-delay-connections-min').value),
          max: parseInt(document.getElementById('li-delay-connections-max').value)
        },
        messages: {
          min: parseInt(document.getElementById('li-delay-messages-min').value),
          max: parseInt(document.getElementById('li-delay-messages-max').value)
        }
      }
    },
    behavior: {
      activeHours: {
        enabled: document.getElementById('active-hours-enabled').checked,
        start: document.getElementById('active-hours-start').value,
        end: document.getElementById('active-hours-end').value
      },
      breaks: {
        enabled: document.getElementById('breaks-enabled').checked,
        lunch: document.getElementById('lunch-break').checked,
        evening: document.getElementById('evening-break').checked
      },
      randomBreaks: document.getElementById('random-breaks').checked,
      weekendMode: document.getElementById('weekend-mode').checked,
      warmupMode: document.getElementById('warmup-mode').checked
    }
  };
  
  await chrome.storage.local.set({ accountConfig: config });
  
  // Update delay manager
  await updateDelayManagerConfig(config);
  
  showToast('✅ Configuración guardada', 'success');
});

// Preset buttons
document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.preset;
    
    // Update active state
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Apply preset
    const config = ACCOUNT_PRESETS[preset];
    applyConfigToUI(config);
  });
});

// Reset to recommended
document.getElementById('reset-account-config')?.addEventListener('click', () => {
  if (confirm('¿Restaurar configuración recomendada?')) {
    const config = ACCOUNT_PRESETS['conservative'];
    applyConfigToUI(config);
    
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-preset="conservative"]').classList.add('active');
  }
});

// Update usage dashboard
async function updateUsageDashboard() {
  const stats = await window.delayManager?.getDailyStats();
  
  if (!stats) return;
  
  // Instagram
  updateUsageBar('ig-comments', stats.instagram.comments);
  updateUsageBar('ig-likes', stats.instagram.likes);
  updateUsageBar('ig-follows', stats.instagram.follows);
  updateUsageBar('ig-dms', stats.instagram.dms);
  
  // LinkedIn
  updateUsageBar('li-comments', stats.linkedin.comments);
  updateUsageBar('li-likes', stats.linkedin.likes);
  updateUsageBar('li-connections', stats.linkedin.connections);
  
  // Check for alerts
  updateUsageAlerts(stats);
}

function updateUsageBar(id, stat) {
  const bar = document.getElementById(`usage-${id}`);
  const text = document.getElementById(`usage-${id}-text`);
  
  if (!bar || !text) return;
  
  const percentage = stat.percentage;
  bar.style.width = `${percentage}%`;
  text.textContent = `${stat.count}/${stat.limit}`;
  
  // Change color based on usage
  bar.classList.remove('warning', 'critical');
  if (percentage >= 100) {
    bar.classList.add('critical');
  } else if (percentage >= 80) {
    bar.classList.add('warning');
  }
}

function updateUsageAlerts(stats) {
  const alertsContainer = document.getElementById('usage-alerts');
  alertsContainer.innerHTML = '';
  
  const alerts = [];
  
  // Check all platforms and actions
  for (const platform in stats) {
    for (const action in stats[platform]) {
      const stat = stats[platform][action];
      
      if (stat.percentage >= 100) {
        alerts.push({
          level: 'critical',
          message: `🛑 ${platform} ${action}: Límite alcanzado (${stat.count}/${stat.limit})`
        });
      } else if (stat.percentage >= 80) {
        alerts.push({
          level: 'warning',
          message: `⚠️ ${platform} ${action}: ${stat.percentage}% usado (${stat.count}/${stat.limit})`
        });
      }
    }
  }
  
  // Display alerts
  alerts.forEach(alert => {
    const div = document.createElement('div');
    div.className = `usage-alert ${alert.level}`;
    div.textContent = alert.message;
    alertsContainer.appendChild(div);
  });
  
  if (alerts.length === 0) {
    const div = document.createElement('div');
    div.style.textAlign = 'center';
    div.style.color = '#4caf50';
    div.textContent = '✅ Ninguna alerta activa';
    alertsContainer.appendChild(div);
  }
}

// Update delay manager with new config
async function updateDelayManagerConfig(config) {
  // Convert to delay manager format
  const antibanConfig = {
    delays: {
      betweenComments: config.instagram.delays.comments,
      betweenLikes: config.instagram.delays.likes,
      betweenFollows: config.instagram.delays.follows,
      betweenDMs: config.instagram.delays.dms,
      betweenPageLoads: { min: 2, max: 5 }
    },
    dailyLimits: {
      instagram: config.instagram.daily,
      linkedin: config.linkedin.daily
    },
    activeHours: config.behavior.activeHours,
    breaks: config.behavior.breaks,
    randomization: {
      enabled: true,
      variability: 0.3
    }
  };
  
  await chrome.storage.local.set({ antibanConfig });
}

// Toggle sub-settings
document.getElementById('active-hours-enabled')?.addEventListener('change', (e) => {
  document.getElementById('active-hours-settings').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('breaks-enabled')?.addEventListener('change', (e) => {
  document.getElementById('breaks-settings').style.display = e.target.checked ? 'block' : 'none';
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('tab-account')) {
    loadAccountConfig();
    
    // Update dashboard every 30 seconds
    setInterval(updateUsageDashboard, 30000);
  }
});
// ═════════════════════════════════════════════════════════════════
// GOOGLE SHEETS UI INTEGRATION
// ═════════════════════════════════════════════════════════════════

// Check connection status on load
async function checkSheetsConnection() {
  const stored = await chrome.storage.local.get('sheetsSpreadsheetId');
  
  if (stored.sheetsSpreadsheetId) {
    showSheetsConnected(stored.sheetsSpreadsheetId);
    await updateSheetsStats();
  } else {
    showSheetsDisconnected();
  }
}

function showSheetsConnected(spreadsheetId) {
  document.getElementById('sheets-disconnected').style.display = 'none';
  document.getElementById('sheets-connected').style.display = 'block';
}

function showSheetsDisconnected() {
  document.getElementById('sheets-disconnected').style.display = 'block';
  document.getElementById('sheets-connected').style.display = 'none';
}

// Connect button
document.getElementById('connect-sheets')?.addEventListener('click', async () => {
  const btn = document.getElementById('connect-sheets');
  btn.disabled = true;
  btn.textContent = '🔄 Conectando...';
  
  try {
    const result = await window.sheetsConnector.connect();
    
    if (result.success) {
      showSheetsConnected(result.spreadsheetId);
      await updateSheetsStats();
      
      showToast('✅ Google Sheets conectado exitosamente', 'success');
      
      // Open spreadsheet in new tab
      chrome.tabs.create({ url: result.url });
    }
    
  } catch (error) {
    console.error('Error conectando Sheets:', error);
    showToast('❌ Error conectando: ' + error.message, 'error');
    
    btn.disabled = false;
    btn.textContent = '🔗 Conectar con Google Sheets';
  }
});

// Open spreadsheet button
document.getElementById('open-sheets')?.addEventListener('click', async () => {
  try {
    await window.sheetsConnector.openSpreadsheet();
  } catch (error) {
    showToast('❌ Error abriendo spreadsheet', 'error');
  }
});

// Sync button
document.getElementById('sync-sheets')?.addEventListener('click', async () => {
  const btn = document.getElementById('sync-sheets');
  btn.disabled = true;
  btn.textContent = '🔄 Sincronizando...';
  
  try {
    await syncAllDataToSheets();
    
    await updateSheetsStats();
    
    // Update last sync time
    document.getElementById('sheets-last-sync').textContent = 'Justo ahora';
    
    showToast('✅ Sincronización completa', 'success');
    
  } catch (error) {
    console.error('Error sincronizando:', error);
    showToast('❌ Error sincronizando: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Sincronizar Ahora';
  }
});

// Disconnect button
document.getElementById('disconnect-sheets')?.addEventListener('click', async () => {
  if (!confirm('¿Desconectar Google Sheets? Los datos locales no se borrarán.')) {
    return;
  }
  
  try {
    await window.sheetsConnector.disconnect();
    showSheetsDisconnected();
    showToast('👋 Desconectado de Google Sheets', 'info');
    
  } catch (error) {
    showToast('❌ Error desconectando', 'error');
  }
});

// Sync all data to Sheets
async function syncAllDataToSheets() {
  console.log('🔄 Sincronizando todos los datos...');
  
  // Get all local data
  const stored = await chrome.storage.local.get([
    'referentes',
    'commentHistory',
    'followHistory'
  ]);
  
  // Sync referentes
  if (stored.referentes && stored.referentes.length > 0) {
    console.log(`📋 Sincronizando ${stored.referentes.length} referentes...`);
    
    for (const ref of stored.referentes) {
      await window.sheetsConnector.addReferente(ref);
    }
  }
  
  // Sync comment history
  if (stored.commentHistory && stored.commentHistory.length > 0) {
    console.log(`💬 Sincronizando ${stored.commentHistory.length} comentarios...`);
    
    for (const comment of stored.commentHistory) {
      await window.sheetsConnector.logComment(comment);
    }
  }
  
  console.log('✅ Sincronización completa');
}

// Update stats
async function updateSheetsStats() {
  try {
    // Get data from Sheets
    const referentes = await window.sheetsConnector.getRows('REFERENTES', 'A2:A');
    const prospects = await window.sheetsConnector.getRows('PROSPECTS', 'A2:A');
    const comments = await window.sheetsConnector.getRows('LOGS_COMENTARIOS', 'A2:A');
    
    document.getElementById('sheets-stat-referentes').textContent = referentes.length;
    document.getElementById('sheets-stat-prospects').textContent = prospects.length;
    document.getElementById('sheets-stat-comments').textContent = comments.length;
    
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('tab-config')) {
    checkSheetsConnection();
  }
});

// ═════════════════════════════════════════════════════════════════
// COMENTADOR - BOTÓN "COMENTAR TODOS"
// ═════════════════════════════════════════════════════════════════

document.getElementById('comment-all-referentes')?.addEventListener('click', async () => {
  const btn = document.getElementById('comment-all-referentes');
  
  if (!confirm('¿Comentar en TODOS los referentes habilitados? Esto puede tomar varios minutos.')) {
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '🔄 Procesando...';
  
  try {
    const results = await window.commentOrchestrator.commentAll();
    
    // Mostrar resultados
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    let message = `✅ Proceso completado!\n\n`;
    message += `Exitosos: ${successCount}\n`;
    message += `Errores: ${errorCount}\n\n`;
    
    if (errorCount > 0) {
      message += `Errores:\n`;
      results.filter(r => !r.success).forEach(r => {
        message += `- @${r.referente}: ${r.error}\n`;
      });
    }
    
    alert(message);
    
    // Actualizar dashboard
    if (window.updateUsageDashboard) {
      await window.updateUsageDashboard();
    }
    
  } catch (error) {
    console.error('Error en comentador:', error);
    alert('❌ Error: ' + error.message);
    
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Comentar TODOS los últimos posts';
  }
});

// Habilitar botón solo si hay API key y referentes
async function updateCommentButtonState() {
  const stored = await chrome.storage.local.get(['aiConfig', 'referentes']);
  const btn = document.getElementById('comment-all-referentes');
  
  if (!btn) return;
  
  const hasApiKey = stored.aiConfig?.apiKey;
  const hasReferentes = stored.referentes?.some(r => r.enabled);
  
  btn.disabled = !(hasApiKey && hasReferentes);
  
  if (!hasApiKey) {
    btn.title = 'Configurá tu API key primero';
  } else if (!hasReferentes) {
    btn.title = 'Agregá al menos un referente habilitado';
  } else {
    btn.title = 'Click para comentar en todos los referentes';
  }
}

// Check state cuando se carga el tab
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('tab-commentor')) {
    updateCommentButtonState();
  }
});

// También check cuando se guarda config de IA o referentes
const originalTestAI = document.getElementById('test-ai-connection')?.onclick;
if (originalTestAI) {
  document.getElementById('test-ai-connection').onclick = async function() {
    await originalTestAI.call(this);
    await updateCommentButtonState();
  };
}

console.log('✅ Comentador TODOS button configurado');

// ═════════════════════════════════════════════════════════════════
// API KEY - PASTE BUTTON
// ═════════════════════════════════════════════════════════════════

document.getElementById('paste-api-key')?.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById('ai-api-key').value = text.trim();
    showToast('✅ API key pegada desde clipboard', 'success');
  } catch (error) {
    console.error('Error reading clipboard:', error);
    showToast('❌ No se pudo leer el clipboard. Pegá manualmente con Ctrl+V', 'error');
  }
});

console.log('✅ Paste API key button configurado');
