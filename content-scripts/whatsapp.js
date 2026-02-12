// ═════════════════════════════════════════════════════════════════
// WHATSAPP CONTACT EXTRACTOR v16.0 - REWRITTEN WITH REAL HTML
// Based on actual HTML structure from user (Feb 2026)
// ═════════════════════════════════════════════════════════════════

console.log('📲 WhatsApp Extractor v16.0 cargado');

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Logging system
const logger = {
  logs: [],
  log(emoji, msg, data = null) {
    const timestamp = new Date().toLocaleTimeString('es-AR');
    const entry = `[${timestamp}] ${emoji} ${msg}`;
    console.log(entry, data || '');
    this.logs.push({ timestamp, msg, data });
  },
  debug: function(msg, data) { this.log('🔍', msg, data); },
  info: function(msg, data) { this.log('ℹ️', msg, data); },
  success: function(msg, data) { this.log('✅', msg, data); },
  warn: function(msg, data) { this.log('⚠️', msg, data); },
  error: function(msg, data) { this.log('❌', msg, data); },
  step: function(num, msg) { this.log(`📍 [${num}]`, msg); },
  getLogs() { return this.logs; }
};

// ═════════════════════════════════════════════════════════════════
// MAIN EXTRACTOR CLASS
// ═════════════════════════════════════════════════════════════════

class WhatsAppExtractor {
  constructor() {
    this.contactos = [];
    this.grupoNombre = '';
    this.nombresVistos = new Set();
  }

  async extraer() {
    logger.step(1, 'Iniciando extracción v16.0');
    
    // Get group name from header
    const headerSpan = document.querySelector('#main header span[title]');
    this.grupoNombre = headerSpan?.getAttribute('title') || 'Grupo_WA';
    logger.info('Grupo detectado:', this.grupoNombre);
    
    // Find the members container
    logger.step(2, 'Buscando lista de miembros');
    
    // The members list is in div.x1y332i5 with height style, containing role="listitem"
    const membersContainer = await this.findMembersContainer();
    
    if (!membersContainer) {
      logger.error('No se encontró la lista de miembros');
      throw new Error('No se encontró la lista de miembros. Asegurate de:\n1. Hacer click en el nombre del grupo\n2. Luego click en "X miembros" para ver la lista');
    }
    
    logger.success('Lista de miembros encontrada');
    
    // Extract members with scroll
    logger.step(3, 'Extrayendo miembros');
    await this.scrollAndExtract(membersContainer);
    
    if (this.contactos.length === 0) {
      logger.error('No se extrajeron contactos');
      throw new Error('No se encontraron miembros. Verificá que la lista de miembros esté visible.');
    }
    
    logger.success(`Extracción completada: ${this.contactos.length} miembros`);
    return this.contactos;
  }
  
  async findMembersContainer() {
    logger.debug('Buscando contenedor...');
    
    // Try multiple times
    for (let attempt = 0; attempt < 10; attempt++) {
      
      // METHOD 1: Find by role="listitem" (most reliable)
      const listItems = document.querySelectorAll('div[role="listitem"]');
      logger.debug(`Intento ${attempt + 1}: ${listItems.length} listItems encontrados`);
      
      if (listItems.length > 0) {
        // Verify these are contact items (should have span[title])
        let validItems = 0;
        for (const item of listItems) {
          if (item.querySelector('span[dir="auto"][title]')) {
            validItems++;
          }
        }
        
        if (validItems > 0) {
          logger.success(`Encontrados ${validItems} miembros válidos`);
          // Return the parent container that has the scroll
          const container = listItems[0].closest('div[style*="height"]') 
            || listItems[0].parentElement;
          return container;
        }
      }
      
      // METHOD 2: Find the "X miembros" section
      const allText = document.body.innerText;
      if (allText.includes('miembros')) {
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent?.match(/^\d+\s*miembros?$/i)) {
            logger.debug('Encontrado texto "miembros":', span.textContent);
            // The list should be nearby
            const parent = span.closest('div[class*="x1n2onr6"]');
            if (parent) {
              const list = parent.querySelector('div[role="listitem"]')?.parentElement;
              if (list) return list;
            }
          }
        }
      }
      
      logger.debug('Esperando 500ms...');
      await wait(500);
    }
    
    return null;
  }
  
  async scrollAndExtract(container) {
    let lastCount = 0;
    let noChangeCount = 0;
    
    // Initial extraction
    this.extractVisibleMembers();
    logger.info(`Extracción inicial: ${this.contactos.length} miembros`);
    
    // Scroll to load more
    for (let i = 0; i < 50; i++) {
      // Try to scroll the container
      if (container.scrollHeight > container.clientHeight) {
        container.scrollTop += 300;
      } else {
        // Try scrolling the parent
        const scrollParent = container.closest('div[style*="overflow"]') || container.parentElement;
        if (scrollParent) {
          scrollParent.scrollTop += 300;
        }
      }
      
      await wait(300);
      
      // Extract new members
      this.extractVisibleMembers();
      
      // Check if we got new members
      if (this.contactos.length === lastCount) {
        noChangeCount++;
        if (noChangeCount >= 5) {
          logger.info('No más miembros nuevos, terminando scroll');
          break;
        }
      } else {
        noChangeCount = 0;
        logger.debug(`Scroll ${i}: ${this.contactos.length} miembros`);
      }
      
      lastCount = this.contactos.length;
    }
  }
  
  extractVisibleMembers() {
    // ═══════════════════════════════════════════════════════════════
    // SELECTORES REALES (del HTML proporcionado):
    // 
    // Container: div[role="listitem"]
    // Button: div[role="button"]
    // Nombre: span[dir="auto"][title="Aldi"] con clase x1iyjqo2
    // Admin: div con texto "Admin. del grupo"
    // Estado: span[data-testid="selectable-text"].copyable-text
    // ═══════════════════════════════════════════════════════════════
    
    const listItems = document.querySelectorAll('div[role="listitem"]');
    
    for (const item of listItems) {
      try {
        // Find name: span[dir="auto"][title]
        const nameSpan = item.querySelector('span[dir="auto"][title]');
        if (!nameSpan) continue;
        
        const nombre = nameSpan.getAttribute('title')?.trim();
        if (!nombre || nombre.length < 1) continue;
        
        // Skip if already seen
        if (this.nombresVistos.has(nombre)) continue;
        
        // Skip "Tú" (yourself)
        if (nombre === 'Tú' || nombre === 'You') continue;
        
        this.nombresVistos.add(nombre);
        
        // Check if admin
        const itemText = item.textContent?.toLowerCase() || '';
        const esAdmin = itemText.includes('admin');
        
        // Get status/bio
        let estado = '';
        const estadoSpan = item.querySelector('span[data-testid="selectable-text"].copyable-text, span._aupe.copyable-text');
        if (estadoSpan) {
          const estadoTitle = estadoSpan.getAttribute('title');
          estado = estadoTitle && estadoTitle.trim() !== '' && estadoTitle.trim() !== ' ' ? estadoTitle.trim() : '';
        }
        
        // Check if name is a phone number
        const esNumero = /^\+?\d[\d\s\-]{7,}$/.test(nombre.replace(/\s/g, ''));
        
        this.contactos.push({
          nombre: esNumero ? 'Sin nombre' : nombre,
          numero: esNumero ? nombre.replace(/[\s\-]/g, '') : '',
          esAdmin,
          estado,
          identificador: nombre
        });
        
        logger.success(`${nombre}${esAdmin ? ' (Admin)' : ''}${estado ? ` - "${estado.substring(0, 25)}..."` : ''}`);
        
      } catch (err) {
        // Silent fail for individual items
      }
    }
  }

  generarCSV() {
    if (!this.contactos.length) return null;
    
    const rows = this.contactos.map(c => 
      `"${(c.nombre || '').replace(/"/g, '""')}","${(c.numero || '').replace(/"/g, '""')}","${c.esAdmin ? 'Sí' : 'No'}","${(c.estado || '').replace(/"/g, '""')}","${this.grupoNombre.replace(/"/g, '""')}"`
    );
    
    return 'Nombre,Número,Es Admin,Estado,Grupo\n' + rows.join('\n');
  }

  descargarCSV() {
    const csv = this.generarCSV();
    if (!csv) return;
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.grupoNombre.replace(/[^a-zA-Z0-9áéíóúñ\s]/gi, '').trim().replace(/\s+/g, '_') + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logger.success('CSV descargado');
  }
}

// ═════════════════════════════════════════════════════════════════
// MESSAGE HANDLERS
// ═════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  // PING handler
  if (msg.action === 'PING') {
    sendResponse({ success: true, version: '16.0', page: 'whatsapp' });
    return true;
  }
  
  // EXTRACT_CONTACTS handler
  if (msg.action === 'EXTRACT_CONTACTS') {
    (async () => {
      const ext = new WhatsAppExtractor();
      
      try {
        logger.step(0, 'Recibido comando EXTRACT_CONTACTS');
        
        // Pre-checks
        if (!window.location.host.includes('web.whatsapp.com')) {
          throw new Error('No estás en WhatsApp Web. Abrí web.whatsapp.com');
        }
        
        // Check if there's a chat open
        const mainChat = document.querySelector('#main');
        if (!mainChat) {
          throw new Error('No hay chat abierto. Abrí un grupo primero.');
        }
        
        // Check if members list is visible
        const listItems = document.querySelectorAll('div[role="listitem"]');
        const hasMembers = Array.from(listItems).some(item => item.querySelector('span[dir="auto"][title]'));
        
        if (!hasMembers) {
          logger.warn('Lista de miembros no visible');
          throw new Error('La lista de miembros no está visible.\n\n📋 Pasos:\n1. Click en el nombre del grupo (arriba)\n2. Click en "X miembros"\n3. Asegurate que la lista sea visible\n4. Volvé a intentar');
        }
        
        // Extract
        const contactos = await ext.extraer();
        
        // Download CSV if requested
        if (msg.generarCSV !== false) {
          ext.descargarCSV();
        }
        
        // Import to list if requested
        if (msg.importarALista !== false && msg.targetList) {
          chrome.runtime.sendMessage({
            action: 'WHATSAPP_CONTACTS_IMPORTED',
            contacts: contactos.map(c => ({ 
              name: c.nombre, 
              phone: c.numero || c.identificador,
              status: c.estado,
              isAdmin: c.esAdmin 
            })),
            groupName: ext.grupoNombre,
            targetList: msg.targetList,
            stats: { 
              total: contactos.length, 
              admins: contactos.filter(c => c.esAdmin).length 
            }
          });
        }
        
        logger.success(`✅ Extracción completada: ${contactos.length} contactos`);
        
        sendResponse({ 
          success: true, 
          contactos, 
          grupoNombre: ext.grupoNombre,
          count: contactos.length,
          logs: logger.getLogs()
        });
        
      } catch (error) {
        logger.error('Error en extracción:', error.message);
        
        sendResponse({ 
          success: false, 
          error: error.message,
          logs: logger.getLogs()
        });
      }
    })();
    
    return true; // Keep channel open for async response
  }
  
  return true;
});

console.log('✅ WhatsApp v16.0 listo');
