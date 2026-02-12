// ═══════════════════════════════════════════════════════════════════════
// LINKEDIN AUTOMATION SCRIPT - v16.4 (SHADOW DOM SUPPORT)
// ═══════════════════════════════════════════════════════════════════════

console.log('🔷 LinkedIn Automation v16.4 (Shadow DOM Support) cargado');

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
// 🔍 BUSCAR EN SHADOW DOM - v16.4
// ═══════════════════════════════════════════════════════════════════════
function querySelectorAllDeep(selector, root = document) {
  const results = [];
  
  // Buscar en el documento/root actual
  results.push(...root.querySelectorAll(selector));
  
  // Buscar en todos los Shadow DOMs
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      results.push(...querySelectorAllDeep(selector, el.shadowRoot));
    }
  }
  
  return results;
}

function querySelectorDeep(selector, root = document) {
  // Primero buscar en el documento principal
  const result = root.querySelector(selector);
  if (result) return result;
  
  // Buscar en Shadow DOMs
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const shadowResult = querySelectorDeep(selector, el.shadowRoot);
      if (shadowResult) return shadowResult;
    }
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// 🔍 ENCONTRAR INPUT DE CHAT - v16.4 CON SHADOW DOM
// ═══════════════════════════════════════════════════════════════════════
function findChatInput() {
  console.log('🔍 [findChatInput v16.4] Buscando en DOM y Shadow DOM...');
  
  const selectors = [
    'div.msg-form__contenteditable[contenteditable="true"]',
    '.msg-form__contenteditable[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][aria-label*="mensaje"]',
    '[contenteditable="true"][aria-label*="Escribe"]',
    'div[contenteditable="true"][aria-multiline="true"]'
  ];
  
  // Primero buscar en DOM normal
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`   ✅ Encontrado en DOM normal: ${selector} (${elements.length})`);
      return elements[elements.length - 1];
    }
  }
  
  console.log('   📦 Buscando en Shadow DOM...');
  
  // Buscar en Shadow DOMs
  for (const selector of selectors) {
    const elements = querySelectorAllDeep(selector);
    if (elements.length > 0) {
      console.log(`   ✅ Encontrado en Shadow DOM: ${selector} (${elements.length})`);
      return elements[elements.length - 1];
    }
  }
  
  // Último recurso: buscar cualquier contenteditable en Shadow DOM
  console.log('   🔎 Buscando cualquier contenteditable...');
  const allContentEditable = querySelectorAllDeep('[contenteditable="true"]');
  console.log(`   📊 Total contenteditable encontrados: ${allContentEditable.length}`);
  
  if (allContentEditable.length > 0) {
    // Filtrar para encontrar el del chat (no el de búsqueda)
    for (const el of allContentEditable) {
      const isInChat = el.closest('.msg-form') || 
                       el.getAttribute('aria-label')?.includes('mensaje') ||
                       el.getAttribute('aria-label')?.includes('Escribe');
      if (isInChat || allContentEditable.length === 1) {
        console.log('   ✅ Usando contenteditable encontrado');
        return el;
      }
    }
    // Si no encontramos uno específico de chat, usar el último
    console.log('   ⚠️ Usando último contenteditable');
    return allContentEditable[allContentEditable.length - 1];
  }
  
  console.log('   ❌ No se encontró ningún input');
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// ✍️ ESCRIBIR EN INPUT
// ═══════════════════════════════════════════════════════════════════════
async function writeToInput(input, text) {
  console.log('✍️ [writeToInput] Escribiendo mensaje...');
  
  input.focus();
  await new Promise(r => setTimeout(r, 300));
  
  // Limpiar
  input.innerHTML = '<p></p>';
  await new Promise(r => setTimeout(r, 100));
  
  // Escribir
  const p = input.querySelector('p') || input;
  p.textContent = text;
  
  // Disparar eventos
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  input.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: 'insertText',
    data: text
  }));
  
  console.log(`   ✅ Texto escrito: "${text.substring(0, 30)}..."`);
  await new Promise(r => setTimeout(r, 500));
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// 📤 ENVIAR CON ENTER
// ═══════════════════════════════════════════════════════════════════════
async function sendWithEnter(input) {
  console.log('📤 [sendWithEnter] Enviando...');
  
  input.focus();
  await new Promise(r => setTimeout(r, 200));
  
 const eventProps = {
  key: 'Enter',
  code: 'Enter',
  keyCode: 13,
  which: 13,
  ctrlKey: true,
  bubbles: true,
  cancelable: true,
  composed: true,
  view: window
};
  
  input.dispatchEvent(new KeyboardEvent('keydown', eventProps));
  await new Promise(r => setTimeout(r, 50));
  input.dispatchEvent(new KeyboardEvent('keypress', eventProps));
  await new Promise(r => setTimeout(r, 50));
  input.dispatchEvent(new KeyboardEvent('keyup', eventProps));
  
  console.log('   ✅ ENTER enviado');
  await new Promise(r => setTimeout(r, 1500));
  
  const remaining = input.textContent?.trim() || '';
  return remaining.length < 5;
}

// ═══════════════════════════════════════════════════════════════════════
// 🔍 DETECTAR TIPO DE CONEXIÓN
// ═══════════════════════════════════════════════════════════════════════
function detectConnectionType() {
  console.log('🔍 Detectando tipo de conexión...');
  
  const result = {
    connectionDegree: 'unknown',
    canSendDM: false,
    canConnect: false,
    isMessageLocked: false,
    availableAction: 'none'
  };
  
  const bodyText = document.body.textContent || '';
  if (bodyText.includes('· 1') || bodyText.includes('• 1')) {
    result.connectionDegree = '1st';
  } else if (bodyText.includes('· 2') || bodyText.includes('• 2')) {
    result.connectionDegree = '2nd';
  } else if (bodyText.includes('· 3') || bodyText.includes('• 3')) {
    result.connectionDegree = '3rd';
  }
  
  // Buscar botón mensaje (también en Shadow DOM)
  const msgBtns = querySelectorAllDeep('a[href*="/messaging/"], button[aria-label*="mensaje"], button[aria-label*="Message"]');
  for (const btn of msgBtns) {
    if (!btn.querySelector('[type="locked"]') && !btn.getAttribute('aria-label')?.includes('bloqueado')) {
      result.canSendDM = true;
      break;
    }
  }
  
  const connectLink = querySelectorDeep('a[href*="/preload/custom-invite/"], button[aria-label*="Conectar"]');
  if (connectLink) {
    result.canConnect = true;
  }
  
  if (querySelectorDeep('[type="locked-small"], a[href*="inmail-app-upsell"]')) {
    result.isMessageLocked = true;
  }
  
  if (result.canSendDM && !result.isMessageLocked) {
    result.availableAction = 'dm';
  } else if (result.canConnect) {
    result.availableAction = 'connect';
  } else if (result.isMessageLocked) {
    result.availableAction = 'inmail';
  }
  
  console.log('📊 Conexión:', result);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// 📨 ENVIAR DM
// ═══════════════════════════════════════════════════════════════════════
async function sendDirectMessage(messageText) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📨 SEND DM v16.4 (Shadow DOM Support)');
  console.log('═══════════════════════════════════════════════════════');
  
  // PASO 1: Buscar input existente
  console.log('\n[1/4] Buscando chat abierto...');
  let input = findChatInput();
  
  // PASO 2: Si no hay input, abrir chat
  if (!input) {
    console.log('\n[2/4] Abriendo chat...');
    
    // Buscar botón mensaje (también en Shadow DOM)
    const msgBtn = querySelectorDeep('a[href*="/messaging/compose/"]') ||
                   querySelectorDeep('button[aria-label*="Enviar mensaje"]') ||
                   querySelectorDeep('button[aria-label*="Message"]');
    
    if (!msgBtn) {
      throw new Error('No encontré botón de mensaje');
    }
    
    console.log('   Clickeando botón mensaje...');
    msgBtn.click();
    
    console.log('   ⏳ Esperando que abra el chat...');
    await new Promise(r => setTimeout(r, 3000));
    
    // Buscar input de nuevo
    console.log('\n[3/4] Buscando input post-apertura...');
    
    for (let i = 0; i < 10; i++) {
      input = findChatInput();
      if (input) break;
      console.log(`   Intento ${i + 1}/10...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  if (!input) {
    throw new Error('No pude encontrar el campo de texto del chat');
  }
  
  // PASO 3: Escribir
  console.log('\n[4/4] Escribiendo y enviando...');
  await writeToInput(input, messageText);
  
  // PASO 4: Enviar
  const sent = await sendWithEnter(input);
  
  console.log('═══════════════════════════════════════════════════════');
  console.log(sent ? '🎉 ¡MENSAJE ENVIADO!' : '⚠️ Puede que no se haya enviado');
  console.log('═══════════════════════════════════════════════════════');
  
  return { success: true, action: 'dm_sent', verified: sent };
}

// ═══════════════════════════════════════════════════════════════════════
// 📤 ENVIAR CONEXIÓN CON NOTA
// ═══════════════════════════════════════════════════════════════════════
async function sendConnectionRequest(noteMessage) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📤 SEND CONNECTION v16.4');
  console.log('═══════════════════════════════════════════════════════');
  
  const clickTarget = querySelectorDeep('a[href*="/preload/custom-invite/"]') ||
                      querySelectorDeep('button[aria-label*="Conectar"]');
  
  if (!clickTarget) {
    throw new Error('No encontré botón Conectar');
  }
  
  console.log('[1/3] Clickeando Conectar...');
  clickTarget.click();
  await new Promise(r => setTimeout(r, 2500));
  
  const modal = querySelectorDeep('.artdeco-modal, div[role="dialog"]');
  if (!modal) {
    console.log('   No apareció modal, verificando...');
    await new Promise(r => setTimeout(r, 1500));
    return { success: true, action: 'connection_sent', withNote: false };
  }
  
  if (noteMessage && noteMessage.trim()) {
    console.log('[2/3] Añadiendo nota...');
    
    const addNoteBtn = Array.from(modal.querySelectorAll('button')).find(b => 
      b.textContent?.toLowerCase().includes('añadir') && b.textContent?.toLowerCase().includes('nota')
    );
    
    if (addNoteBtn) {
      addNoteBtn.click();
      await new Promise(r => setTimeout(r, 1500));
      
      const textarea = querySelectorDeep('textarea#custom-message, textarea[name="message"]');
      if (textarea) {
        textarea.focus();
        textarea.value = noteMessage.substring(0, 300);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('   ✅ Nota escrita');
      }
    }
  }
  
  console.log('[3/3] Enviando...');
  const sendBtn = Array.from(querySelectorAllDeep('.artdeco-modal button')).find(b => 
    b.textContent?.toLowerCase().includes('enviar')
  );
  
  if (sendBtn) {
    sendBtn.click();
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎉 ¡CONEXIÓN ENVIADA!');
  console.log('═══════════════════════════════════════════════════════');
  
  return { success: true, action: 'connection_sent', withNote: !!(noteMessage?.trim()) };
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
          const reactionsBtn = querySelectorDeep('button.social-details-social-counts__count-value, .social-details-social-counts__reactions-count');
          
          if (reactionsBtn) {
            reactionsBtn.click();
            await new Promise(r => setTimeout(r, 2500));
            
            const modal = querySelectorDeep('div[role="dialog"], div.artdeco-modal');
            if (modal) {
              const scrollContainer = modal.querySelector('.scaffold-finite-scroll__content, .artdeco-modal__content');
              if (scrollContainer) {
                for (let i = 0; i < 10; i++) {
                  scrollContainer.scrollTop = scrollContainer.scrollHeight;
                  await new Promise(r => setTimeout(r, 500));
                }
              }
              
              modal.querySelectorAll('a[href*="/in/"]').forEach(link => {
                const href = link.getAttribute('href');
                const match = href?.match(/\/in\/([^\/\?]+)/);
                if (match && !users.find(u => u.username === match[1])) {
                  users.push({ 
                    username: match[1], 
                    name: link.textContent?.trim() || match[1], 
                    type: 'reaction', 
                    platform: 'linkedin' 
                  });
                }
              });
              
              const closeBtn = modal.querySelector('button[aria-label="Descartar"], button[aria-label="Dismiss"]');
              if (closeBtn) closeBtn.click();
            }
          }
        }
        
        if (message.type === 'comments' || message.type === 'both') {
          querySelectorAllDeep('.comments-comment-item a[href*="/in/"]').forEach(link => {
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
  
  if (message.action === 'SEND_DM') {
    (async () => {
      try {
        console.log('═══════════════════════════════════════════════════════');
        console.log('📨 SEND_DM v16.4 (Shadow DOM)');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📍 Mensaje:', message.message?.substring(0, 50));
        
        const connectionInfo = detectConnectionType();
        let result;
        
        if (message.forceDM || connectionInfo.availableAction === 'dm') {
          result = await sendDirectMessage(message.message);
        } else if (message.forceConnect || connectionInfo.availableAction === 'connect') {
          result = await sendConnectionRequest(message.message);
        } else if (connectionInfo.availableAction === 'inmail') {
          result = { success: false, action: 'skipped', reason: 'requires_inmail' };
        } else {
          throw new Error('No se pudo determinar acción');
        }
        
        sendResponse({ success: result.success, ...result, connectionInfo });
        
      } catch (error) {
        console.error('❌ ERROR:', error.message);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  return true;
});

console.log('✅ LinkedIn Analyzer v16.4 listo');