// ═══════════════════════════════════════════════════════════════════════
// LINKEDIN AUTOMATION SCRIPT - v16.2 (PRECISE SELECTORS + CONNECT FLOW)
// ═══════════════════════════════════════════════════════════════════════

console.log('🔷 LinkedIn Automation v16.2 (Precise Selectors) cargado');

const LinkedInAnalyzer = {
  config: {
    maxPosts: 30,
    scrollDelay: 2500
  },
  
  posts: [],
  
  async startAnalysis(limit = 30) {
    console.log(`🚀 Iniciando análisis de LinkedIn: ${limit} posts`);
    
    this.config.maxPosts = limit;
    this.posts = [];
    
    try {
      await this.waitForLoad();
      await this.scrollAndLoad(limit);
      this.extractPosts();
      const stats = this.calculateStats();
      
      console.log(`✅ LinkedIn análisis completo: ${this.posts.length} posts`);
      return { posts: this.posts, stats };
      
    } catch (error) {
      console.error('❌ Error en análisis LinkedIn:', error);
      throw error;
    }
  },
  
  async waitForLoad() {
    console.log('⏳ Esperando que cargue LinkedIn...');
    await new Promise(r => setTimeout(r, 3000));
  },
  
  async scrollAndLoad(limit) {
    console.log('📜 Scrolleando para cargar posts...');
    
    let scrollAttempts = 0;
    const maxScrolls = Math.max(10, Math.ceil(limit / 2));
    
    for (let i = 0; i < maxScrolls; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 500));
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 500));
      window.scrollTo(0, document.body.scrollHeight);
      
      await new Promise(r => setTimeout(r, 4000));
      
      scrollAttempts++;
      const postsCount = document.querySelectorAll('.feed-shared-update-v2, .update-components-actor, div[data-urn*="urn:li:activity"]').length;
      console.log(`📜 Scroll ${scrollAttempts}/${maxScrolls} - Posts visibles: ${postsCount}`);
      
      if (postsCount >= limit) {
        console.log(`✅ Ya hay ${postsCount} posts cargados, suficiente!`);
        break;
      }
      
      chrome.runtime.sendMessage({
        action: 'ANALYSIS_PROGRESS_FROM_CONTENT',
        platform: 'linkedin',
        current: Math.min(postsCount, limit),
        total: limit,
        status: `📜 Cargando posts... (${postsCount} encontrados)`
      }).catch(() => {});
    }
  },
  
  extractPosts() {
    console.log('🔍 Extrayendo posts...');
    
    const selectors = [
      '.feed-shared-update-v2',
      '.update-components-actor',
      'div[data-urn*="urn:li:activity"]',
      '.occludable-update'
    ];
    
    let postElements = [];
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        postElements = elements;
        break;
      }
    }
    
    if (postElements.length === 0) {
      console.error('❌ No se encontraron posts con ningún selector');
      return;
    }
    
    postElements.forEach((postEl, index) => {
      if (this.posts.length >= this.config.maxPosts) return;
      
      try {
        const post = this.extractPostData(postEl);
        if (post && post.text) {
          this.posts.push(post);
          chrome.runtime.sendMessage({
            action: 'ANALYSIS_PROGRESS_FROM_CONTENT',
            platform: 'linkedin',
            current: this.posts.length,
            total: this.config.maxPosts,
            status: '📊 Extrayendo datos...'
          }).catch(() => {});
        }
      } catch (e) {
        console.log(`⚠️ Error en post ${index}:`, e.message);
      }
    });
  },
  
  extractPostData(postEl) {
    let text = '';
    const textSelectors = [
      '.feed-shared-text',
      '.update-components-text',
      '.feed-shared-update-v2__description',
      'span[dir="ltr"]'
    ];
    
    for (const selector of textSelectors) {
      const textEl = postEl.querySelector(selector);
      if (textEl) {
        text = textEl.textContent.trim().substring(0, 200);
        break;
      }
    }
    
    let timestamp = new Date().toISOString();
    let postId = null;
    
    const urnAttr = postEl.getAttribute('data-urn');
    if (urnAttr) {
      const match = urnAttr.match(/activity:(\d{19})/);
      if (match) {
        postId = match[1];
        timestamp = this.decodeLinkedInPostTimestamp(postId);
      }
    }
    
    if (!postId) {
      const links = postEl.querySelectorAll('a[href*="activity-"]');
      for (const link of links) {
        const href = link.getAttribute('href');
        const match = href.match(/activity-(\d{19})/);
        if (match) {
          postId = match[1];
          timestamp = this.decodeLinkedInPostTimestamp(postId);
          break;
        }
      }
    }
    
    if (!postId) {
      const timeEl = postEl.querySelector('time');
      if (timeEl) {
        const datetime = timeEl.getAttribute('datetime');
        if (datetime) {
          timestamp = datetime;
        } else {
          timestamp = this.parseLinkedInRelativeDate(timeEl.textContent.trim().toLowerCase());
        }
      }
    }
    
    let likes = 0;
    const likeSelectors = ['.social-details-social-counts__reactions-count', 'button[aria-label*="reaccion"]', 'button.reactions-react-button', '.social-details-social-counts__count-value'];
    for (const selector of likeSelectors) {
      const likesEl = postEl.querySelector(selector);
      if (likesEl) {
        likes = this.extractNumber(likesEl.textContent || likesEl.getAttribute('aria-label') || '');
        if (likes > 0) break;
      }
    }
    
    let comments = 0;
    const commentSelectors = ['.social-details-social-counts__comments', 'button[aria-label*="comentario"]', 'button.comment-button', '.social-details-social-counts__item--comments'];
    for (const selector of commentSelectors) {
      const commentsEl = postEl.querySelector(selector);
      if (commentsEl) {
        comments = this.extractNumber(commentsEl.textContent || commentsEl.getAttribute('aria-label') || '');
        if (comments > 0) break;
      }
    }
    
    let shares = 0;
    const sharesEl = postEl.querySelector('.social-details-social-counts__item--reposts, button[aria-label*="repost"]');
    if (sharesEl) shares = this.extractNumber(sharesEl.textContent || sharesEl.getAttribute('aria-label') || '');
    
    if (!text && likes === 0 && comments === 0) return null;
    
    return { caption: text, text, timestamp, postId, likes, comments, shares, engagement: likes + comments + shares };
  },
  
  decodeLinkedInPostTimestamp(postId) {
    try {
      const id = BigInt(postId);
      const timestampMs = id >> BigInt(22);
      return new Date(Number(timestampMs)).toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  },
  
  parseLinkedInRelativeDate(relativeStr) {
    const now = new Date();
    
    if (relativeStr.includes('ahora') || relativeStr.includes('now') || relativeStr.includes('just')) {
      return now.toISOString();
    }
    
    const hourMatch = relativeStr.match(/(\d+)\s*h/);
    if (hourMatch) {
      now.setHours(now.getHours() - parseInt(hourMatch[1]));
      return now.toISOString();
    }
    
    const dayMatch = relativeStr.match(/(\d+)\s*d/);
    if (dayMatch) {
      now.setDate(now.getDate() - parseInt(dayMatch[1]));
      return now.toISOString();
    }
    
    const weekMatch = relativeStr.match(/(\d+)\s*(sem|week|w)/);
    if (weekMatch) {
      now.setDate(now.getDate() - parseInt(weekMatch[1]) * 7);
      return now.toISOString();
    }
    
    const monthMatch = relativeStr.match(/(\d+)\s*(mes|month|mo)/);
    if (monthMatch) {
      now.setMonth(now.getMonth() - parseInt(monthMatch[1]));
      return now.toISOString();
    }
    
    return now.toISOString();
  },
  
  extractNumber(text) {
    if (!text) return 0;
    const cleanText = text.replace(/,/g, '.').replace(/\s/g, '');
    const match = cleanText.match(/([\d.]+)\s*([KkMm])?/);
    if (!match) return 0;
    
    let num = parseFloat(match[1]);
    if (match[2]) {
      const multiplier = match[2].toLowerCase();
      if (multiplier === 'k') num *= 1000;
      if (multiplier === 'm') num *= 1000000;
    }
    return Math.round(num);
  },
  
  calculateStats() {
    if (this.posts.length === 0) {
      return { totalPosts: 0, avgLikes: 0, avgComments: 0, avgShares: 0 };
    }
    
    const totalLikes = this.posts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = this.posts.reduce((sum, p) => sum + (p.comments || 0), 0);
    const totalShares = this.posts.reduce((sum, p) => sum + (p.shares || 0), 0);
    
    return {
      totalPosts: this.posts.length,
      avgLikes: Math.round(totalLikes / this.posts.length),
      avgComments: Math.round(totalComments / this.posts.length),
      avgShares: Math.round(totalShares / this.posts.length)
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════
// 🔍 DETECTAR TIPO DE CONEXIÓN - v16.2
// ═══════════════════════════════════════════════════════════════════════
function detectConnectionType() {
  console.log('🔍 Detectando tipo de conexión (v16.2)...');
  
  const result = {
    connectionDegree: 'unknown',
    canSendDM: false,
    canConnect: false,
    connectInOverflow: false,
    isMessageLocked: false,
    alreadyConnected: false,
    invitationSent: false,
    availableAction: 'none'
  };
  
  // ─────────────────────────────────────────────────────────────────
  // 1. Detectar grado de conexión (buscar "· 1º", "· 2º", "· 3º")
  // ─────────────────────────────────────────────────────────────────
  const profileHeader = document.querySelector('h1, .text-heading-xlarge');
  if (profileHeader) {
    const headerParent = profileHeader.parentElement?.parentElement || document.body;
    const headerText = headerParent.textContent || '';
    
    if (headerText.includes('· 1') || headerText.includes('·1') || headerText.includes('• 1')) {
      result.connectionDegree = '1st';
    } else if (headerText.includes('· 2') || headerText.includes('·2') || headerText.includes('• 2')) {
      result.connectionDegree = '2nd';
    } else if (headerText.includes('· 3') || headerText.includes('·3') || headerText.includes('• 3')) {
      result.connectionDegree = '3rd';
    }
  }
  
  console.log(`   Grado detectado: ${result.connectionDegree}`);
  
  // ─────────────────────────────────────────────────────────────────
  // 2. Buscar botón "Enviar mensaje" directo (sin candado)
  // ─────────────────────────────────────────────────────────────────
  const dmButtonSelectors = [
    'a[href*="/messaging/compose/"]',
    'button[aria-label*="Enviar mensaje"]',
    'button[aria-label*="Message"]',
    '.pvs-profile-actions button.artdeco-button--primary'
  ];
  
  for (const selector of dmButtonSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent?.toLowerCase() || '';
      const label = el.getAttribute('aria-label')?.toLowerCase() || '';
      const href = el.getAttribute('href') || '';
      
      const hasLock = el.querySelector('.lock-icon, [type="locked-small"]');
      const isLocked = label.includes('bloqueado') || label.includes('locked');
      
      if (!hasLock && !isLocked && (
        text.includes('mensaje') || text.includes('message') ||
        label.includes('mensaje') || label.includes('message') ||
        href.includes('/messaging/')
      )) {
        result.canSendDM = true;
        console.log('   ✅ Puede enviar DM directo');
        break;
      }
    }
    if (result.canSendDM) break;
  }
  
  // ─────────────────────────────────────────────────────────────────
  // 3. Buscar botón "Conectar" (directo o en overflow)
  // ─────────────────────────────────────────────────────────────────
  const connectDirectSelectors = [
    'button[aria-label*="Conectar"]',
    'button[aria-label*="Connect"]',
    'button[aria-label*="Invitar"]'
  ];
  
  for (const selector of connectDirectSelectors) {
    const btn = document.querySelector(selector);
    if (btn) {
      const text = btn.textContent?.toLowerCase() || '';
      if (text.includes('conectar') || text.includes('connect')) {
        result.canConnect = true;
        result.connectInOverflow = false;
        console.log('   ✅ Botón Conectar visible directamente');
        break;
      }
    }
  }
  
  if (!result.canConnect) {
    const connectLink = document.querySelector('a[href*="/preload/custom-invite/"]');
    if (connectLink) {
      result.canConnect = true;
      result.connectInOverflow = true;
      console.log('   ✅ Link Conectar encontrado (en overflow menu)');
    }
  }
  
  // ─────────────────────────────────────────────────────────────────
  // 4. Detectar si mensaje está bloqueado
  // ─────────────────────────────────────────────────────────────────
  const lockedSelectors = [
    'a[aria-label*="bloqueado"]',
    'a[aria-label*="locked"]',
    'a[href*="inmail-app-upsell"]',
    'a[href*="message-locked"]',
    '[type="locked-small"]'
  ];
  
  for (const selector of lockedSelectors) {
    if (document.querySelector(selector)) {
      result.isMessageLocked = true;
      console.log('   🔒 Mensaje bloqueado (requiere InMail)');
      break;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────
  // 5. Detectar si ya se envió invitación
  // ─────────────────────────────────────────────────────────────────
  const pendingEl = document.querySelector('.invite-sent-msg:not(.hidden), button[aria-label*="Pendiente"]');
  if (pendingEl && pendingEl.offsetParent !== null) {
    result.invitationSent = true;
    console.log('   📨 Invitación ya enviada (pendiente)');
  }
  
  // ─────────────────────────────────────────────────────────────────
  // 6. Determinar acción disponible
  // ─────────────────────────────────────────────────────────────────
  if (result.connectionDegree === '1st' || (result.canSendDM && !result.isMessageLocked)) {
    result.availableAction = 'dm';
    result.alreadyConnected = result.connectionDegree === '1st';
  } else if (result.canConnect && !result.invitationSent) {
    result.availableAction = 'connect';
  } else if (result.isMessageLocked) {
    result.availableAction = 'inmail';
  } else if (result.invitationSent) {
    result.availableAction = 'pending';
  }
  
  console.log('📊 Resultado detección:', result);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// 📤 ENVIAR SOLICITUD DE CONEXIÓN CON NOTA - v16.2
// Selectores basados en HTML real de LinkedIn
// ═══════════════════════════════════════════════════════════════════════
async function sendConnectionRequest(noteMessage) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📤 ENVIANDO SOLICITUD DE CONEXIÓN (v16.2)');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📝 Nota:', noteMessage ? noteMessage.substring(0, 50) + '...' : '(sin nota)');
  
  // ─────────────────────────────────────────────────────────────────
  // PASO 1: Buscar y clickear botón/link "Conectar"
  // ─────────────────────────────────────────────────────────────────
  console.log('\n[1/4] 🔍 Buscando botón Conectar...');
  
  let connectClicked = false;
  
  // Opción A: Link con href="/preload/custom-invite/" (nuevo diseño, en menú overflow)
  const connectLink = document.querySelector('a[href*="/preload/custom-invite/"]');
  if (connectLink) {
    console.log('   ✅ Encontrado link de conexión (nuevo diseño)');
    connectLink.click();
    connectClicked = true;
  }
  
  // Opción B: Botón directo con aria-label
  if (!connectClicked) {
    const connectBtnSelectors = [
      'button[aria-label*="Conectar"]',
      'button[aria-label*="Connect"]',
      'button[aria-label*="Invitar"]',
      'button[data-action="connect-btn"]'
    ];
    
    for (const selector of connectBtnSelectors) {
      const btn = document.querySelector(selector);
      if (btn) {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('conectar') || text.includes('connect')) {
          console.log('   ✅ Encontrado botón Conectar directo');
          btn.click();
          connectClicked = true;
          break;
        }
      }
    }
  }
  
  // Opción C: Buscar por texto en cualquier elemento clickeable
  if (!connectClicked) {
    const allClickables = document.querySelectorAll('button, a[role="menuitem"], div[role="menuitem"]');
    for (const el of allClickables) {
      const text = el.textContent?.trim().toLowerCase() || '';
      if (text === 'conectar' || text === 'connect') {
        console.log('   ✅ Encontrado elemento Conectar por texto');
        el.click();
        connectClicked = true;
        break;
      }
    }
  }
  
  if (!connectClicked) {
    throw new Error('No se encontró el botón Conectar. ¿El perfil ya está conectado?');
  }
  
  console.log('   ⏳ Esperando modal...');
  await new Promise(r => setTimeout(r, 2500));
  
  // ─────────────────────────────────────────────────────────────────
  // PASO 2: Detectar el modal "¿Añadir una nota a la invitación?"
  // ─────────────────────────────────────────────────────────────────
  console.log('\n[2/4] 🔍 Buscando modal de invitación...');
  
  // Modal clásico de LinkedIn
  const modal = document.querySelector('.artdeco-modal.send-invite, div[role="dialog"], .artdeco-modal');
  
  if (!modal) {
    console.log('   ⚠️ No apareció modal. Verificando si se envió directamente...');
    await new Promise(r => setTimeout(r, 1500));
    
    const pendingBtn = document.querySelector('button[aria-label*="Pendiente"], .invite-sent-msg:not(.hidden)');
    if (pendingBtn) {
      console.log('   ✅ Invitación enviada directamente (sin opción de nota)');
      return { success: true, action: 'connection_sent', withNote: false };
    }
    
    throw new Error('No apareció el modal de invitación');
  }
  
  console.log('   ✅ Modal encontrado');
  
  // ─────────────────────────────────────────────────────────────────
  // PASO 3: Añadir nota si hay mensaje
  // ─────────────────────────────────────────────────────────────────
  console.log('\n[3/4] 📝 Procesando nota...');
  
  if (noteMessage && noteMessage.trim().length > 0) {
    // Buscar botón "Añadir una nota" por aria-label o texto
    let addNoteBtn = modal.querySelector('button[aria-label*="Añadir una nota"], button[aria-label*="Add a note"]');
    
    if (!addNoteBtn) {
      const buttons = modal.querySelectorAll('button.artdeco-button--secondary, button.artdeco-button--muted');
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('añadir') && text.includes('nota')) {
          addNoteBtn = btn;
          break;
        }
        if (text.includes('add') && text.includes('note')) {
          addNoteBtn = btn;
          break;
        }
      }
    }
    
    if (addNoteBtn) {
      console.log('   📝 Clickeando "Añadir una nota"...');
      addNoteBtn.click();
      await new Promise(r => setTimeout(r, 1500));
      
      // Buscar textarea con selectores específicos del HTML
      const textarea = document.querySelector(
        'textarea#custom-message, ' +
        'textarea.connect-button-send-invite__custom-message, ' +
        'textarea[name="message"]'
      );
      
      if (textarea) {
        console.log('   ✍️ Escribiendo nota...');
        textarea.focus();
        await new Promise(r => setTimeout(r, 200));
        
        // Truncar a 300 caracteres (límite de LinkedIn)
        const noteText = noteMessage.substring(0, 300);
        textarea.value = noteText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`   ✅ Nota escrita (${noteText.length}/300 chars)`);
        await new Promise(r => setTimeout(r, 500));
      } else {
        console.log('   ⚠️ No encontré textarea para la nota');
      }
    } else {
      console.log('   ⚠️ No encontré botón "Añadir nota"');
    }
  } else {
    console.log('   ℹ️ Sin nota, enviando directamente');
  }
  
  // ─────────────────────────────────────────────────────────────────
  // PASO 4: Clickear botón Enviar
  // ─────────────────────────────────────────────────────────────────
  console.log('\n[4/4] 📤 Enviando invitación...');
  
  // Buscar modal activo
  const activeModal = document.querySelector(
    '.artdeco-modal:not(.artdeco-modal--hidden), ' +
    'div[role="dialog"]:not([aria-hidden="true"])'
  );
  
  let sendBtn = null;
  
  if (activeModal) {
    // Buscar botón primario de envío
    sendBtn = activeModal.querySelector(
      'button[aria-label*="Enviar"], ' +
      'button[aria-label*="Send"], ' +
      'button.artdeco-button--primary'
    );
    
    // Verificar que sea el correcto
    if (sendBtn) {
      const text = sendBtn.textContent?.toLowerCase() || '';
      if (!text.includes('enviar') && !text.includes('send')) {
        sendBtn = null;
      }
    }
  }
  
  // Fallback: buscar en todo el documento
  if (!sendBtn) {
    const allModals = document.querySelectorAll('.artdeco-modal');
    for (const m of allModals) {
      if (m.offsetParent === null) continue; // Saltear modales ocultos
      
      const buttons = m.querySelectorAll('button.artdeco-button--primary');
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('enviar') || text.includes('send')) {
          sendBtn = btn;
          break;
        }
      }
      if (sendBtn) break;
    }
  }
  
  if (!sendBtn) {
    throw new Error('No encontré el botón Enviar en el modal');
  }
  
  console.log('   📤 Clickeando Enviar...');
  sendBtn.click();
  
  await new Promise(r => setTimeout(r, 2500));
  
  // Verificar éxito
  const modalClosed = !document.querySelector('.artdeco-modal.send-invite:not(.artdeco-modal--hidden)');
  const pendingVisible = document.querySelector('button[aria-label*="Pendiente"], .invite-sent-msg:not(.hidden)');
  
  const success = modalClosed || pendingVisible;
  
  console.log('═══════════════════════════════════════════════════════');
  console.log(success ? '🎉 ¡INVITACIÓN ENVIADA!' : '⚠️ Estado incierto');
  console.log('═══════════════════════════════════════════════════════');
  
  return { 
    success: true, 
    action: 'connection_sent', 
    withNote: !!(noteMessage && noteMessage.trim().length > 0)
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 📨 ENVIAR DM (para 1er grado)
// ═══════════════════════════════════════════════════════════════════════
async function sendDirectMessage(messageText) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📨 ENVIANDO MENSAJE DIRECTO (v16.2)');
  console.log('═══════════════════════════════════════════════════════');
  
  await new Promise(r => setTimeout(r, 2000));
  
  let msgInput = null;
  
  const inputSelectors = [
    '.msg-form__contenteditable[contenteditable="true"]',
    'div.msg-form__contenteditable[contenteditable="true"]',
    '[role="textbox"][aria-label*="mensaje"]',
    '[role="textbox"][aria-label*="Escribe"]',
    '[role="textbox"][contenteditable="true"]',
    '.msg-form__message-texteditor [contenteditable="true"]',
    'div[contenteditable="true"][aria-multiline="true"]'
  ];
  
  for (const selector of inputSelectors) {
    const elements = document.querySelectorAll(selector);
    const visible = Array.from(elements).filter(el => {
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      const notInNav = !el.closest('#global-nav');
      const notHidden = el.offsetParent !== null || el.closest('.msg-overlay-conversation-bubble');
      return isVisible && notInNav && notHidden;
    });
    
    if (visible.length > 0) {
      msgInput = visible[visible.length - 1];
      console.log(`   ✅ Input encontrado con: ${selector}`);
      break;
    }
  }
  
  if (!msgInput) {
    console.log('   ⚠️ No hay chat abierto. Buscando botón Mensaje...');
    
    const buttonSelectors = [
      'a[href*="/messaging/compose/"]',
      'button[aria-label*="Enviar mensaje"]',
      'button[aria-label*="Message"]',
      '.pvs-profile-actions button.artdeco-button--primary',
      'button.message-anywhere-button'
    ];
    
    let msgBtn = null;
    for (const selector of buttonSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.innerText?.toLowerCase() || '';
        const label = el.getAttribute('aria-label')?.toLowerCase() || '';
        const href = el.getAttribute('href') || '';
        
        if (!el.querySelector('.lock-icon') && (
          text.includes('mensaje') || text.includes('message') ||
          label.includes('mensaje') || label.includes('message') ||
          href.includes('/messaging/')
        )) {
          msgBtn = el;
          break;
        }
      }
      if (msgBtn) break;
    }
    
    if (!msgBtn) {
      throw new Error('No encontré el botón "Enviar mensaje". ¿Es contacto de 1er grado?');
    }
    
    console.log('   📍 Clickeando botón mensaje...');
    msgBtn.click();
    await new Promise(r => setTimeout(r, 5000));
    
    for (let attempt = 0; attempt < 10; attempt++) {
      for (const selector of inputSelectors) {
        const elements = document.querySelectorAll(selector);
        const visible = Array.from(elements).filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && !el.closest('#global-nav');
        });
        
        if (visible.length > 0) {
          msgInput = visible[visible.length - 1];
          break;
        }
      }
      if (msgInput) break;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  if (!msgInput) {
    throw new Error('No pude encontrar el campo de texto del chat.');
  }
  
  console.log('   ✍️ Escribiendo mensaje...');
  msgInput.focus();
  await new Promise(r => setTimeout(r, 300));
  
  msgInput.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = messageText;
  msgInput.appendChild(p);
  
  msgInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  msgInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(msgInput);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('   📤 Enviando con ENTER...');
  
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window
  });
  
  msgInput.dispatchEvent(enterEvent);
  
  await new Promise(r => setTimeout(r, 100));
  msgInput.dispatchEvent(new KeyboardEvent('keypress', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
    bubbles: true, cancelable: true, composed: true, view: window
  }));
  
  await new Promise(r => setTimeout(r, 100));
  msgInput.dispatchEvent(new KeyboardEvent('keyup', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
    bubbles: true, cancelable: true, composed: true, view: window
  }));
  
  await new Promise(r => setTimeout(r, 2000));
  
  const remainingText = msgInput.textContent?.trim() || '';
  const wasSent = remainingText === '' || remainingText.length < messageText.length / 2;
  
  console.log('═══════════════════════════════════════════════════════');
  console.log(wasSent ? '🎉 ¡MENSAJE ENVIADO!' : '⚠️ Puede que no se haya enviado');
  console.log('═══════════════════════════════════════════════════════');
  
  return { success: true, action: 'dm_sent', verified: wasSent };
}

// ═══════════════════════════════════════════════════════════════════════
// MESSAGE LISTENER
// ═══════════════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.action === 'ANALYZE_LINKEDIN_FEED') {
    (async () => {
      try {
        const result = await LinkedInAnalyzer.startAnalysis(message.limit || 30);
        sendResponse({ success: true, ...result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (message.action === 'EXTRACT_LINKEDIN_POST_USERS') {
    (async () => {
      try {
        const users = [];
        
        if (message.type === 'reactions' || message.type === 'both') {
          const reactionsSelectors = [
            'button.social-details-social-counts__count-value',
            '.social-details-social-counts__reactions-count',
            'button[aria-label*="reaccion"]',
            'button[aria-label*="reaction"]'
          ];
          
          let reactionsBtn = null;
          for (const sel of reactionsSelectors) {
            reactionsBtn = document.querySelector(sel);
            if (reactionsBtn) break;
          }
          
          if (reactionsBtn) {
            reactionsBtn.click();
            await new Promise(r => setTimeout(r, 2500));
            
            const modal = document.querySelector('div[role="dialog"].social-details-reactors-modal, div.artdeco-modal');
            if (modal) {
              const scrollContainer = modal.querySelector('.scaffold-finite-scroll__content, .artdeco-modal__content');
              if (scrollContainer) {
                for (let i = 0; i < 10; i++) {
                  scrollContainer.scrollTop = scrollContainer.scrollHeight;
                  await new Promise(r => setTimeout(r, 500));
                }
              }
              
              const personItems = modal.querySelectorAll('ul > li');
              personItems.forEach(item => {
                const link = item.querySelector('a[href*="/in/"]');
                if (!link) return;
                
                const href = link.getAttribute('href');
                const match = href?.match(/\/in\/([^\/\?]+)/);
                if (!match) return;
                
                const username = match[1];
                if (users.find(u => u.username === username)) return;
                
                const nameEl = item.querySelector('.artdeco-entity-lockup__title span[aria-hidden="true"], .artdeco-entity-lockup__title span');
                const name = nameEl?.textContent?.trim() || username;
                
                const titleEl = item.querySelector('.artdeco-entity-lockup__caption');
                const title = titleEl?.textContent?.trim() || '';
                
                users.push({ username, name, title, type: 'reaction', platform: 'linkedin' });
              });
              
              const closeBtn = modal.querySelector('button[aria-label="Descartar"], button[aria-label="Dismiss"], button.artdeco-modal__dismiss');
              if (closeBtn) {
                closeBtn.click();
                await new Promise(r => setTimeout(r, 500));
              }
            }
          }
        }
        
        if (message.type === 'comments' || message.type === 'both') {
          const comments = document.querySelectorAll('.comments-comment-item a[href*="/in/"], .comments-comment-entity a[href*="/in/"]');
          comments.forEach(link => {
            const href = link.getAttribute('href');
            const match = href?.match(/\/in\/([^\/\?]+)/);
            if (match && !users.find(u => u.username === match[1])) {
              users.push({ username: match[1], name: link.textContent?.trim() || match[1], type: 'commenter', platform: 'linkedin' });
            }
          });
        }
        
        chrome.runtime.sendMessage({
          action: 'LI_POST_USERS_IMPORTED',
          users,
          targetList: message.targetList,
          platform: 'linkedin',
          postUrl: window.location.href
        });
        
        sendResponse({ success: true, count: users.length, users });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (message.action === 'DETECT_CONNECTION_TYPE') {
    try {
      const result = detectConnectionType();
      sendResponse({ success: true, ...result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 📨 SEND_DM: v16.2 (SMART ACTION)
  // ═══════════════════════════════════════════════════════════════════════
  if (message.action === 'SEND_DM') {
    (async () => {
      try {
        console.log('═══════════════════════════════════════════════════════');
        console.log('📨 SEND_DM v16.2 - SMART CONNECTION');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📍 Mensaje:', message.message?.substring(0, 50) + '...');
        console.log('📍 Forzar DM:', message.forceDM || false);
        console.log('📍 Forzar Connect:', message.forceConnect || false);

        const connectionInfo = detectConnectionType();
        
        let result;
        
        if (message.forceDM) {
          result = await sendDirectMessage(message.message);
        } else if (message.forceConnect) {
          result = await sendConnectionRequest(message.message);
        } else {
          switch (connectionInfo.availableAction) {
            case 'dm':
              console.log('✅ Acción: Enviar DM');
              result = await sendDirectMessage(message.message);
              break;
              
            case 'connect':
              console.log('✅ Acción: Enviar solicitud de conexión');
              result = await sendConnectionRequest(message.message);
              break;
              
            case 'inmail':
              console.log('⚠️ Requiere InMail - Saltando');
              result = { 
                success: false, 
                action: 'skipped', 
                reason: 'requires_inmail'
              };
              break;
              
            case 'pending':
              console.log('ℹ️ Invitación pendiente - Saltando');
              result = { 
                success: true, 
                action: 'skipped', 
                reason: 'invitation_pending' 
              };
              break;
              
            default:
              throw new Error('No se pudo determinar acción disponible');
          }
        }
        
        console.log('🎉 RESULTADO:', result);
        
        sendResponse({ 
          success: result.success, 
          ...result,
          connectionInfo 
        });

      } catch (error) {
        console.error('❌ ERROR:', error.message);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  return true;
});

console.log('✅ LinkedIn Analyzer v16.2 listo');