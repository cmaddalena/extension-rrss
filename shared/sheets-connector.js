// ═════════════════════════════════════════════════════════════════
// GOOGLE SHEETS API CONNECTOR
// ═════════════════════════════════════════════════════════════════

class SheetsConnector {
  constructor() {
    this.spreadsheetId = null;
    this.accessToken = null;
    this.baseURL = 'https://sheets.googleapis.com/v4/spreadsheets';
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════

  async connect() {
    console.log('🔗 Conectando con Google Sheets...');
    
    try {
      // 1. Get OAuth token
      this.accessToken = await this.getAuthToken();
      
      // 2. Check if already have a spreadsheet
      const stored = await chrome.storage.local.get('sheetsSpreadsheetId');
      
      if (stored.sheetsSpreadsheetId) {
        this.spreadsheetId = stored.sheetsSpreadsheetId;
        console.log('✅ Spreadsheet existente:', this.spreadsheetId);
        return { success: true, spreadsheetId: this.spreadsheetId };
      }
      
      // 3. Create new spreadsheet
      const result = await this.createSpreadsheet();
      
      return result;
      
    } catch (error) {
      console.error('❌ Error conectando:', error);
      throw error;
    }
  }

  async getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
  }

  async disconnect() {
    if (this.accessToken) {
      // Revoke token
      await chrome.identity.removeCachedAuthToken({ token: this.accessToken });
      this.accessToken = null;
    }
    
    this.spreadsheetId = null;
    await chrome.storage.local.remove('sheetsSpreadsheetId');
    
    console.log('👋 Desconectado de Google Sheets');
  }

  // ═══════════════════════════════════════════════════════════════
  // SPREADSHEET CREATION
  // ═══════════════════════════════════════════════════════════════

  async createSpreadsheet() {
    console.log('📄 Creando nuevo spreadsheet...');
    
    const title = `Social Analyzer Data - ${new Date().toLocaleDateString()}`;
    
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: title
        },
        sheets: [
          { properties: { title: 'REFERENTES' } },
          { properties: { title: 'PROSPECTS' } },
          { properties: { title: 'LISTAS' } },
          { properties: { title: 'LOGS_COMENTARIOS' } },
          { properties: { title: 'LOGS_FOLLOWS' } },
          { properties: { title: 'LOGS_CONEXIONES' } },
          { properties: { title: 'LOGS_DMS' } },
          { properties: { title: 'CONFIG' } }
        ]
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }
    
    const data = await response.json();
    this.spreadsheetId = data.spreadsheetId;
    
    // Save spreadsheet ID
    await chrome.storage.local.set({ sheetsSpreadsheetId: this.spreadsheetId });
    
    console.log('✅ Spreadsheet creado:', this.spreadsheetId);
    
    // Initialize with headers
    await this.initializeHeaders();
    
    return {
      success: true,
      spreadsheetId: this.spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`
    };
  }

  async initializeHeaders() {
    console.log('📋 Inicializando headers...');
    
    const requests = [];
    
    // REFERENTES headers
    requests.push({
      updateCells: {
        range: {
          sheetId: 0,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 10
        },
        rows: [{
          values: [
            { userEnteredValue: { stringValue: 'ID' } },
            { userEnteredValue: { stringValue: 'Plataforma' } },
            { userEnteredValue: { stringValue: 'Username' } },
            { userEnteredValue: { stringValue: 'Prompt Custom' } },
            { userEnteredValue: { stringValue: 'Tags' } },
            { userEnteredValue: { stringValue: 'Enabled' } },
            { userEnteredValue: { stringValue: 'Última Interacción' } },
            { userEnteredValue: { stringValue: 'Total Comentarios' } },
            { userEnteredValue: { stringValue: 'Total Likes' } },
            { userEnteredValue: { stringValue: 'Notas' } }
          ]
        }],
        fields: 'userEnteredValue'
      }
    });
    
    // PROSPECTS headers
    requests.push({
      updateCells: {
        range: {
          sheetId: 1,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 13
        },
        rows: [{
          values: [
            { userEnteredValue: { stringValue: 'ID' } },
            { userEnteredValue: { stringValue: 'Listas' } },
            { userEnteredValue: { stringValue: 'Plataforma' } },
            { userEnteredValue: { stringValue: 'Username' } },
            { userEnteredValue: { stringValue: 'Nombre Real' } },
            { userEnteredValue: { stringValue: 'Origen' } },
            { userEnteredValue: { stringValue: 'Tags' } },
            { userEnteredValue: { stringValue: 'Status' } },
            { userEnteredValue: { stringValue: 'Follow' } },
            { userEnteredValue: { stringValue: 'Like' } },
            { userEnteredValue: { stringValue: 'Comment' } },
            { userEnteredValue: { stringValue: 'DM' } },
            { userEnteredValue: { stringValue: 'Notas' } }
          ]
        }],
        fields: 'userEnteredValue'
      }
    });
    
    // LISTAS headers
    requests.push({
      updateCells: {
        range: {
          sheetId: 2,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 6
        },
        rows: [{
          values: [
            { userEnteredValue: { stringValue: 'ID' } },
            { userEnteredValue: { stringValue: 'Nombre' } },
            { userEnteredValue: { stringValue: 'Descripción' } },
            { userEnteredValue: { stringValue: 'Creada' } },
            { userEnteredValue: { stringValue: 'Total Prospects' } },
            { userEnteredValue: { stringValue: 'Activa' } }
          ]
        }],
        fields: 'userEnteredValue'
      }
    });
    
    // LOGS_COMENTARIOS headers
    requests.push({
      updateCells: {
        range: {
          sheetId: 3,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 10
        },
        rows: [{
          values: [
            { userEnteredValue: { stringValue: 'Timestamp' } },
            { userEnteredValue: { stringValue: 'Plataforma' } },
            { userEnteredValue: { stringValue: 'Usuario/Referente' } },
            { userEnteredValue: { stringValue: 'Post URL' } },
            { userEnteredValue: { stringValue: 'Post Preview' } },
            { userEnteredValue: { stringValue: 'Mi Comentario' } },
            { userEnteredValue: { stringValue: 'Liked' } },
            { userEnteredValue: { stringValue: 'Status' } },
            { userEnteredValue: { stringValue: 'Error Message' } },
            { userEnteredValue: { stringValue: 'Notas' } }
          ]
        }],
        fields: 'userEnteredValue'
      }
    });
    
    // Execute batch update
    await this.batchUpdate(requests);
    
    // Format headers (bold, freeze)
    await this.formatHeaders();
    
    console.log('✅ Headers inicializados');
  }

  async formatHeaders() {
    const requests = [
      // Freeze first row in all sheets
      {
        updateSheetProperties: {
          properties: {
            sheetId: 0,
            gridProperties: { frozenRowCount: 1 }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      },
      {
        updateSheetProperties: {
          properties: {
            sheetId: 1,
            gridProperties: { frozenRowCount: 1 }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      },
      {
        updateSheetProperties: {
          properties: {
            sheetId: 2,
            gridProperties: { frozenRowCount: 1 }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      },
      {
        updateSheetProperties: {
          properties: {
            sheetId: 3,
            gridProperties: { frozenRowCount: 1 }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      }
    ];
    
    await this.batchUpdate(requests);
  }

  async batchUpdate(requests) {
    const response = await fetch(`${this.baseURL}/${this.spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }
    
    return await response.json();
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  async appendRow(sheetName, values) {
    const range = `${sheetName}!A:Z`;
    
    const response = await fetch(
      `${this.baseURL}/${this.spreadsheetId}/values/${range}:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [values]
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }
    
    return await response.json();
  }

  async getRows(sheetName, range = 'A:Z') {
    const fullRange = `${sheetName}!${range}`;
    
    const response = await fetch(
      `${this.baseURL}/${this.spreadsheetId}/values/${fullRange}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }
    
    const data = await response.json();
    return data.values || [];
  }

  async updateRow(sheetName, rowIndex, values) {
    const range = `${sheetName}!A${rowIndex}:Z${rowIndex}`;
    
    const response = await fetch(
      `${this.baseURL}/${this.spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [values]
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }
    
    return await response.json();
  }

  // ═══════════════════════════════════════════════════════════════
  // SPECIFIC OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  async logComment(data) {
    const values = [
      new Date().toISOString(),
      data.platform,
      data.username,
      data.postUrl || '',
      data.postPreview || '',
      data.comment || '',
      data.liked ? 'SI' : 'NO',
      data.status || 'success',
      data.errorMessage || '',
      data.notes || ''
    ];
    
    return await this.appendRow('LOGS_COMENTARIOS', values);
  }

  async logFollow(data) {
    const values = [
      new Date().toISOString(),
      data.platform,
      data.username,
      data.origin || '',
      data.reason || '',
      data.status || 'followed'
    ];
    
    return await this.appendRow('LOGS_FOLLOWS', values);
  }

  async addReferente(data) {
    const values = [
      data.id,
      data.platform,
      data.username,
      data.customPrompt || '',
      data.tags || '',
      data.enabled ? 'SI' : 'NO',
      data.lastInteraction || '',
      data.totalComments || 0,
      data.totalLikes || 0,
      data.notes || ''
    ];
    
    return await this.appendRow('REFERENTES', values);
  }

  async getReferentes() {
    const rows = await this.getRows('REFERENTES', 'A2:J');
    
    return rows.map(row => ({
      id: row[0],
      platform: row[1],
      username: row[2],
      customPrompt: row[3] || null,
      tags: row[4] || '',
      enabled: row[5] === 'SI',
      lastInteraction: row[6] || null,
      totalComments: parseInt(row[7]) || 0,
      totalLikes: parseInt(row[8]) || 0,
      notes: row[9] || ''
    }));
  }

  async syncReferentes(referentes) {
    // Clear existing data (except headers)
    // Then append all referentes
    
    for (const ref of referentes) {
      await this.addReferente(ref);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════

  async openSpreadsheet() {
    if (!this.spreadsheetId) {
      throw new Error('No spreadsheet connected');
    }
    
    const url = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`;
    chrome.tabs.create({ url });
  }

  getSpreadsheetUrl() {
    if (!this.spreadsheetId) return null;
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`;
  }

  isConnected() {
    return !!this.spreadsheetId && !!this.accessToken;
  }
}

// Export singleton instance
const sheetsConnector = new SheetsConnector();

// Make available globally
if (typeof window !== 'undefined') {
  window.sheetsConnector = sheetsConnector;
}
