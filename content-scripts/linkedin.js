// ═══════════════════════════════════════════════════════════════════════
// LINKEDIN AUTOMATION SCRIPT - v15.0 (GREEDY MODE + ENTER FORCE)
// ═══════════════════════════════════════════════════════════════════════

console.log('🔷 LinkedIn Automation v15.0 (Greedy Mode) cargado');

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
  
  parseLinkedInRelativeDate(timeText) {
    const now = new Date();
    if (timeText.includes('min')) now.setMinutes(now.getMinutes() - parseInt(timeText.match(/\d+/)?.[0] || '0'));
    else if (timeText.includes('hora')) now.setHours(now.getHours() - parseInt(timeText.match(/\d+/)?.[0] || '0'));
    else if (timeText.includes('día') || timeText.includes('dia')) now.setDate(now.getDate() - parseInt(timeText.match(/\d+/)?.[0] || '0'));
    else if (timeText.includes('semana')) now.setDate(now.getDate() - (parseInt(timeText.match(/\d+/)?.[0] || '0') * 7));
    else if (timeText.includes('mes')) now.setMonth(now.getMonth() - parseInt(timeText.match(/\d+/)?.[0] || '0'));
    else if (timeText.includes('año')) now.setFullYear(now.getFullYear() - parseInt(timeText.match(/\d+/)?.[0] || '0'));
    return now.toISOString();
  },
  
  extractNumber(text) {
    if (!text) return 0;
    const cleanText = text.replace(/\./g, '').replace(/,/g, '');
    const match = cleanText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  },
  
  calculateStats() {
    const totalPosts = this.posts.length;
    const totalLikes = this.posts.reduce((sum, p) => sum + p.likes, 0);
    const totalComments = this.posts.reduce((sum, p) => sum + p.comments, 0);
    const totalShares = this.posts.reduce((sum, p) => sum + p.shares, 0);
    
    const avgLikes = totalPosts > 0 ? Math.round(totalLikes / totalPosts) : 0;
    const avgComments = totalPosts > 0 ? Math.round(totalComments / totalPosts) : 0;
    const avgShares = totalPosts > 0 ? Math.round(totalShares / totalPosts) : 0;
    
    const topPost = [...this.posts].sort((a, b) => b.engagement - a.engagement)[0] || null;
    
    const dailyDist = new Array(7).fill(0);
    const hourlyDist = new Array(24).fill(0);
    
    this.posts.forEach(p => {
      const date = new Date(p.timestamp);
      dailyDist[date.getDay()]++;
      hourlyDist[date.getHours()]++;
    });
    
    const bestDayIndex = dailyDist.indexOf(Math.max(...dailyDist));
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    return {
      totalPosts, totalLikes, totalComments, totalShares, avgLikes, avgComments, avgShares,
      topPost, bestDay: days[bestDayIndex], bestHour: hourlyDist.indexOf(Math.max(...hourlyDist)),
      distribution: { daily: dailyDist, hourly: hourlyDist }
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════
// BACKGROUND COMMUNICATION LISTENER
// ═══════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Mensaje recibido:', message.action);
  
  if (message.action === 'ANALYZE_PROFILE_LI' || message.action === 'START_ANALYSIS') {
    const postCount = message.postCount || 12;
    LinkedInAnalyzer.startAnalysis(postCount)
      .then((result) => {
        const url = window.location.href;
        const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
        const username = match ? match[1] : message.username || 'linkedin_user';
        
        chrome.runtime.sendMessage({
          action: 'ANALYSIS_COMPLETE_FROM_CONTENT',
          platform: 'linkedin',
          username: username,
          posts: result.posts,
          stats: result.stats,
          postCount: result.posts.length
        });
        
        if (message.action === 'ANALYZE_PROFILE_LI') {
          const postsWithReactions = result.posts.filter(p => p.reactions > 0);
          const totalReactions = postsWithReactions.reduce((sum, p) => sum + p.reactions, 0);
          sendResponse({
            success: true,
            data: { username, totalPosts: result.posts.length, avgReactions: postsWithReactions.length > 0 ? Math.round(totalReactions / postsWithReactions.length) : 0, bestPost: Math.max(...result.posts.map(p => p.reactions), 0), posts: result.posts }
          });
        } else {
          sendResponse({ success: true });
        }
      })
      .catch(error => {
        console.error('❌ LinkedIn analysis error:', error);
        chrome.runtime.sendMessage({
          action: 'ANALYSIS_ERROR_FROM_CONTENT',
          platform: 'linkedin',
          username: message.username,
          error: error.message
        });
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'EXTRACT_POST_ENGAGERS') {
    (async () => {
      try {
        console.log('📥 Extrayendo engagers del post de LinkedIn...');
        const users = [];
        await new Promise(r => setTimeout(r, 3000));
        
        if (message.type === 'reactions' || message.type === 'both') {
          const reactionsSelectors = [
            'span.social-details-social-counts__social-proof-text',
            'button[aria-label*="reaction"]',
            'button[aria-label*="reaccion"]',
            '.social-details-social-counts__reactions',
            'span.reactions-react-button'
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
  // 📨 SEND_DM: v15.0 (GREEDY MODE + ENTER FORCE)
  // ═══════════════════════════════════════════════════════════════════════
  if (message.action === 'SEND_DM') {
    (async () => {
      try {
        console.log('📍 [1] Iniciando DM (v15.0 Greedy Mode)...');

        let msgInput = null;
        let chatAlreadyOpen = false;

        // 1. Detección AGRESIVA de Chat (Greedy)
        // No miramos nombres. Si hay una caja de texto visible, es nuestra.
        console.log('📍 [2] Buscando cualquier chat visible...');
        
        // Buscamos todas las cajas contenteditable
        const allInputs = document.querySelectorAll('.msg-form__contenteditable[contenteditable="true"]');
        
        // Filtramos las que son visibles (offsetParent no nulo) y no son del buscador
        const visibleInputs = Array.from(allInputs).filter(el => {
            return el.offsetParent !== null && !el.closest('#global-nav');
        });

        if (visibleInputs.length > 0) {
            // Agarramos el último (la ventana más reciente)
            msgInput = visibleInputs[visibleInputs.length - 1];
            chatAlreadyOpen = true;
            console.log('✅ ¡Caja de chat detectada directamente! Saltando botón.');
        }

        // 2. Si no hay nada, intentamos abrirlo con el botón (Selector Estricto)
        if (!msgInput) {
            console.log('📍 [3] Chat no detectado. Buscando botón Mensaje...');
            let msgBtn = null;
            
            // Prioridad: Botón azul en el perfil
            const profileActions = document.querySelector('.pvs-profile-actions');
            if (profileActions) {
                msgBtn = profileActions.querySelector('button.artdeco-button--primary[aria-label*="Mensaje"], button.artdeco-button--primary[aria-label*="Message"]');
                
                // Fallback: Cualquier botón que diga Mensaje dentro de las acciones
                if (!msgBtn) {
                    const buttons = Array.from(profileActions.querySelectorAll('button'));
                    msgBtn = buttons.find(b => {
                        const t = b.innerText.toLowerCase();
                        return (t.includes('mensaje') || t.includes('message')) && !t.includes('compartir');
                    });
                }
            }

            // Último recurso: Message Anywhere
            if (!msgBtn) msgBtn = document.querySelector('button.message-anywhere-button');

            if (!msgBtn) throw new Error('No encontré el botón de Mensaje ni chat abierto.');

            console.log('✅ Clickeando botón...');
            msgBtn.click();
            await new Promise(r => setTimeout(r, 4000)); // Espera larga
        }

        // 3. Buscar Input post-click (Greedy again)
        if (!msgInput) {
            console.log('📍 [4] Buscando input post-apertura...');
            for (let i = 0; i < 8; i++) {
                const retryInputs = document.querySelectorAll('.msg-form__contenteditable[contenteditable="true"]');
                const validRetry = Array.from(retryInputs).filter(el => el.offsetParent !== null && !el.closest('#global-nav'));
                
                if (validRetry.length > 0) {
                    msgInput = validRetry[validRetry.length - 1];
                    console.log('✅ Caja encontrada.');
                    break;
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (!msgInput) throw new Error('Caja de chat no disponible.');

        // 4. Escribir
        console.log('📍 [5] Escribiendo...');
        msgInput.focus();
        
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, message.message);
        
        msgInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Hack Espacio
        document.execCommand('insertText', false, ' ');
        await new Promise(r => setTimeout(r, 50));
        document.execCommand('delete', false, null);

        await new Promise(r => setTimeout(r, 1500));

        // 5. ENVIAR (Con Bombardeo de ENTER)
        console.log('📍 [6] Enviando...');
        const container = msgInput.closest('form') || msgInput.closest('.msg-overlay-conversation-bubble');
        const sendBtn = container ? container.querySelector('button[type="submit"], .msg-form__send-button') : null;

        if (sendBtn && !sendBtn.disabled) {
            console.log('✅ Click en botón enviar.');
            sendBtn.click();
            await new Promise(r => setTimeout(r, 300));
            if(!sendBtn.disabled) sendBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, view: window }));
        } else {
            console.warn('⚠️ Botón no disponible. FORZANDO ENTER...');
            // Simulamos Enter de todas las formas posibles
            const events = [
                new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }),
                new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }),
                new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 })
            ];
            events.forEach(e => msgInput.dispatchEvent(e));
        }

        await new Promise(r => setTimeout(r, 2000));
        console.log('🎉 PROCESO TERMINADO');
        sendResponse({ success: true, verified: true });

      } catch (error) {
        console.error('❌ Error fatal:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  return true;
});

console.log('✅ LinkedIn Analyzer listo');