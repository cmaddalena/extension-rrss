// ═══════════════════════════════════════════════════════════════════════
// LINKEDIN AUTOMATION SCRIPT - v16.0 (NATIVE INPUT + ENTER SEND)
// ═══════════════════════════════════════════════════════════════════════

console.log('🔷 LinkedIn Automation v16.0 (Native Input) cargado');

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
  
  // ═══════════════════════════════════════════════════════════════════════
  // 📨 SEND_DM: v16.0 (NATIVE INPUT + ENTER SEND)
  // ═══════════════════════════════════════════════════════════════════════
  if (message.action === 'SEND_DM') {
    (async () => {
      try {
        console.log('═══════════════════════════════════════════════════════');
        console.log('📨 SEND_DM v16.0 - NATIVE INPUT + ENTER SEND');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📍 Mensaje a enviar:', message.message);

        // ─────────────────────────────────────────────────────────────────
        // PASO 1: Buscar campo de texto de chat existente
        // ─────────────────────────────────────────────────────────────────
        console.log('\n[1/5] 🔍 Buscando campo de texto de chat...');
        
        // Esperar a que la página esté lista
        await new Promise(r => setTimeout(r, 2000));
        
        let msgInput = null;
        
        // Lista de selectores para el campo de mensaje (del más específico al más general)
        const inputSelectors = [
          // Selector exacto del HTML que pasaste
          '.msg-form__contenteditable[contenteditable="true"]',
          // Alternativas
          'div.msg-form__contenteditable[contenteditable="true"]',
          '[role="textbox"][aria-label*="mensaje"]',
          '[role="textbox"][aria-label*="Escribe"]',
          '[role="textbox"][contenteditable="true"]',
          '.msg-form__message-texteditor [contenteditable="true"]',
          'div[contenteditable="true"][aria-multiline="true"]'
        ];
        
        // Intentar cada selector
        for (const selector of inputSelectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`   Selector "${selector}": ${elements.length} elementos`);
          
          // Filtrar solo los visibles (no en nav, no ocultos)
          const visible = Array.from(elements).filter(el => {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const notInNav = !el.closest('#global-nav');
            const notHidden = el.offsetParent !== null || el.closest('.msg-overlay-conversation-bubble');
            return isVisible && notInNav && notHidden;
          });
          
          if (visible.length > 0) {
            // Tomar el último (chat más reciente/activo)
            msgInput = visible[visible.length - 1];
            console.log(`   ✅ Encontrado con: ${selector}`);
            break;
          }
        }
        
        // ─────────────────────────────────────────────────────────────────
        // PASO 2: Si no hay input, intentar abrir chat con botón
        // ─────────────────────────────────────────────────────────────────
        if (!msgInput) {
          console.log('\n[2/5] ⚠️ No hay chat abierto. Buscando botón "Enviar mensaje"...');
          
          const buttonSelectors = [
            // Botón principal en perfil
            'button.pvs-profile-actions__action[aria-label*="enviar mensaje"]',
            'button.pvs-profile-actions__action[aria-label*="Enviar mensaje"]',
            'button[aria-label*="Enviar mensaje"]',
            'button[aria-label*="Message"]',
            // Botón verde/turquesa que se ve en la imagen
            '.pvs-profile-actions button.artdeco-button--primary',
            // Message anywhere
            'button.message-anywhere-button',
            // Fallback: buscar por texto
            'button.artdeco-button--primary'
          ];
          
          let msgBtn = null;
          
          for (const selector of buttonSelectors) {
            const buttons = document.querySelectorAll(selector);
            console.log(`   Selector "${selector}": ${buttons.length} botones`);
            
            for (const btn of buttons) {
              const text = btn.innerText?.toLowerCase() || '';
              const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
              
              if (text.includes('mensaje') || text.includes('message') || 
                  label.includes('mensaje') || label.includes('message')) {
                msgBtn = btn;
                console.log(`   ✅ Botón encontrado: "${btn.innerText?.trim()}"`);
                break;
              }
            }
            if (msgBtn) break;
          }
          
          if (!msgBtn) {
            throw new Error('No encontré el botón "Enviar mensaje" ni chat abierto. ¿Estás en un perfil de LinkedIn?');
          }
          
          console.log('   📍 Clickeando botón...');
          msgBtn.click();
          
          // Esperar a que se abra el chat
          console.log('   ⏳ Esperando que abra el chat (5 segundos)...');
          await new Promise(r => setTimeout(r, 5000));
          
          // Buscar el input nuevamente
          console.log('\n[3/5] 🔍 Buscando campo de texto después de abrir chat...');
          
          for (let attempt = 0; attempt < 10; attempt++) {
            for (const selector of inputSelectors) {
              const elements = document.querySelectorAll(selector);
              const visible = Array.from(elements).filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && !el.closest('#global-nav');
              });
              
              if (visible.length > 0) {
                msgInput = visible[visible.length - 1];
                console.log(`   ✅ Input encontrado en intento ${attempt + 1}`);
                break;
              }
            }
            if (msgInput) break;
            
            console.log(`   ⏳ Intento ${attempt + 1}/10...`);
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        
        if (!msgInput) {
          throw new Error('No pude encontrar el campo de texto del chat después de varios intentos.');
        }
        
        // ─────────────────────────────────────────────────────────────────
        // PASO 3: Escribir el mensaje usando método NATIVO
        // ─────────────────────────────────────────────────────────────────
        console.log('\n[4/5] ✍️ Escribiendo mensaje...');
        
        // Hacer focus en el input
        msgInput.focus();
        await new Promise(r => setTimeout(r, 300));
        
        // Limpiar contenido existente
        msgInput.innerHTML = '';
        
        // MÉTODO NATIVO: Crear un párrafo con el texto
        const p = document.createElement('p');
        p.textContent = message.message;
        msgInput.appendChild(p);
        
        // Disparar eventos para que LinkedIn detecte el cambio
        msgInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        msgInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        
        // Mover cursor al final
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(msgInput);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        console.log('   ✅ Mensaje escrito');
        
        // Pequeña espera para que LinkedIn procese
        await new Promise(r => setTimeout(r, 1000));
        
        // ─────────────────────────────────────────────────────────────────
        // PASO 4: Enviar con ENTER
        // ─────────────────────────────────────────────────────────────────
        console.log('\n[5/5] 📤 Enviando con ENTER...');
        
        // Crear evento Enter con todas las propiedades necesarias
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
        
        // Disparar el evento
        msgInput.dispatchEvent(enterEvent);
        
        // También disparar keypress y keyup por si acaso
        await new Promise(r => setTimeout(r, 100));
        
        msgInput.dispatchEvent(new KeyboardEvent('keypress', {
          key: 'Enter',
          code: 'Enter', 
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window
        }));
        
        await new Promise(r => setTimeout(r, 100));
        
        msgInput.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window
        }));
        
        // Esperar para verificar
        await new Promise(r => setTimeout(r, 2000));
        
        // Verificar si se envió (el campo debería estar vacío o tener solo <p><br></p>)
        const remainingText = msgInput.textContent?.trim() || '';
        const wasSent = remainingText === '' || remainingText.length < message.message.length / 2;
        
        console.log('═══════════════════════════════════════════════════════');
        console.log(wasSent ? '🎉 ¡MENSAJE ENVIADO!' : '⚠️ Puede que no se haya enviado');
        console.log('═══════════════════════════════════════════════════════');
        
        sendResponse({ success: true, verified: wasSent });

      } catch (error) {
        console.error('═══════════════════════════════════════════════════════');
        console.error('❌ ERROR:', error.message);
        console.error('═══════════════════════════════════════════════════════');
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  return true;
});

console.log('✅ LinkedIn Analyzer v16.0 listo');