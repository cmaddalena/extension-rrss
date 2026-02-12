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
