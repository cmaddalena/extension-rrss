// ═════════════════════════════════════════════════════════════════
// COMENTADOR INTELIGENTE - ORCHESTRATOR
// ═════════════════════════════════════════════════════════════════

class CommentOrchestrator {
  constructor() {
    this.isRunning = false;
    this.currentIndex = 0;
    this.results = [];
  }

  async commentAll() {
    if (this.isRunning) {
      console.log('⚠️ Ya hay un proceso de comentarios corriendo');
      return;
    }

    this.isRunning = true;
    this.currentIndex = 0;
    this.results = [];

    try {
      // 1. Cargar referentes
      const stored = await chrome.storage.local.get(['referentes', 'aiConfig', 'globalPrompt']);
      
      if (!stored.referentes || stored.referentes.length === 0) {
        throw new Error('No hay referentes configurados');
      }

      const enabledReferentes = stored.referentes.filter(r => r.enabled);
      
      if (enabledReferentes.length === 0) {
        throw new Error('No hay referentes habilitados');
      }

      console.log(`🚀 Comentando en ${enabledReferentes.length} referentes...`);

      // 2. Procesar cada referente
      for (const referente of enabledReferentes) {
        this.currentIndex++;
        
        try {
          await this.commentOnReferente(referente, stored.aiConfig, stored.globalPrompt);
          await this.wait(5000); // 5 segundos entre referentes
          
        } catch (error) {
          console.error(`❌ Error con @${referente.username}:`, error);
          
          // Log error to Sheets
          if (window.sheetsConnector?.isConnected()) {
            await window.sheetsConnector.logComment({
              platform: referente.platform,
              username: referente.username,
              postUrl: '',
              postPreview: '',
              comment: '',
              liked: false,
              status: 'error',
              errorMessage: error.message,
              notes: `Failed at: ${new Date().toISOString()}`
            });
          }
          
          this.results.push({
            referente: referente.username,
            success: false,
            error: error.message
          });
        }
      }

      console.log('✅ Proceso completado');
      return this.results;

    } finally {
      this.isRunning = false;
    }
  }

  async commentOnReferente(referente, aiConfig, globalPrompt) {
    console.log(`\n💬 Procesando @${referente.username}...`);

    let postData = null;
    let comment = null;
    let tab = null;
    let errorStep = '';

    try {
      // 1. Verificar límites anti-ban
      errorStep = 'anti-ban check';
      const canComment = await window.delayManager?.canPerformAction(
        referente.platform,
        'comments'
      );

      if (!canComment || !canComment.allowed) {
        throw new Error(canComment?.reason || 'Límite alcanzado');
      }

      // 2. Abrir tab con la plataforma
      errorStep = 'opening tab';
      tab = await this.openPlatformTab(referente.platform);

      // 3. Scrapear último post
      errorStep = 'scraping post';
      console.log('📊 Scrapeando último post...');
      postData = await this.scrapeLastPost(tab.id, referente);

      // 4. Generar comentario con IA
      errorStep = 'generating comment with AI';
      console.log('🤖 Generando comentario con IA...');
      comment = await this.generateComment(postData, referente, aiConfig, globalPrompt);

      // 5. Like + Comment
      errorStep = 'liking post';
      console.log('❤️ Dando like...');
      await this.likePost(tab.id, referente.platform);

      await this.wait(2000);

      errorStep = 'posting comment';
      console.log('💬 Posteando comentario...');
      await this.postComment(tab.id, referente.platform, comment);

      // 6. Incrementar contador anti-ban
      errorStep = 'updating counters';
      await window.delayManager?.incrementAction(referente.platform, 'comments');

      // 7. Log SUCCESS to Sheets
      errorStep = 'logging to sheets';
      if (window.sheetsConnector?.isConnected()) {
        await window.sheetsConnector.logComment({
          platform: referente.platform,
          username: referente.username,
          postUrl: postData.url,
          postPreview: postData.caption?.substring(0, 100),
          comment: comment,
          liked: true,
          status: 'success',
          errorMessage: '',
          notes: ''
        });
      }

      // 8. Guardar en local storage
      errorStep = 'saving to history';
      await this.saveToHistory({
        timestamp: new Date().toISOString(),
        referente: referente.username,
        platform: referente.platform,
        postUrl: postData.url,
        comment: comment,
        liked: true
      });

      // 9. Success
      this.results.push({
        referente: referente.username,
        success: true,
        comment: comment
      });

      console.log(`✅ Comentario exitoso en @${referente.username}`);

    } catch (error) {
      // Log detailed error
      console.error(`❌ Error en paso "${errorStep}":`, error);
      
      // Log ERROR to Sheets with details
      if (window.sheetsConnector?.isConnected()) {
        await window.sheetsConnector.logComment({
          platform: referente.platform,
          username: referente.username,
          postUrl: postData?.url || '',
          postPreview: postData?.caption?.substring(0, 100) || '',
          comment: comment || '',
          liked: false,
          status: 'error',
          errorMessage: `${errorStep}: ${error.message}`,
          notes: `Stack: ${error.stack?.substring(0, 200)}`
        });
      }
      
      throw error; // Re-throw para que el catch superior lo maneje
      
    } finally {
      // Cerrar tab SIEMPRE
      if (tab?.id) {
        try {
          await chrome.tabs.remove(tab.id);
        } catch (e) {
          console.warn('Error cerrando tab:', e);
        }
      }
    }
  }

  async openPlatformTab(platform) {
    const url = platform === 'instagram' 
      ? 'https://www.instagram.com/'
      : 'https://www.linkedin.com/';

    const tab = await chrome.tabs.create({
      url: url,
      active: false
    });

    // Esperar a que cargue
    await this.waitForTabLoad(tab.id);

    return tab;
  }

  async scrapeLastPost(tabId, referente) {
    const action = referente.platform === 'instagram' 
      ? 'SCRAPE_LAST_POST_IG'
      : 'SCRAPE_LAST_POST_LI';

    const response = await chrome.tabs.sendMessage(tabId, {
      action: action,
      username: referente.username
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return response.data;
  }

  async generateComment(postData, referente, aiConfig, globalPrompt) {
    // Construir prompt
    const prompt = this.buildPrompt(postData, referente, globalPrompt);

    // Llamar a IA
    const response = await this.callAI(prompt, aiConfig, postData.mediaUrl);

    return response;
  }

  buildPrompt(postData, referente, globalPrompt) {
    const customPrompt = referente.customPrompt || null;

    const basePrompt = customPrompt || `
Eres un experto en ${globalPrompt.expertise || 'tu industria'}.
Tu objetivo es: ${globalPrompt.objective || 'generar autoridad'}.
Tono: ${globalPrompt.tone || 'profesional'}.

${globalPrompt.instructions || ''}
`;

    const fullPrompt = `
${basePrompt}

Contexto del post:
- Autor: @${postData.username}
- Plataforma: ${postData.platform}
- Contenido: "${postData.caption}"
- Likes: ${postData.likesCount}
- Comentarios: ${postData.commentsCount}

Tarea:
Genera un comentario inteligente y valioso para este post.

Requisitos:
- Máximo 2-3 líneas
- Aporta valor real
- Relacionado con el contenido del post
- Natural y conversacional (NO usar emojis excesivos)
- NO uses hashtags
- NO hagas autopromoción descarada
- SÉ específico sobre el contenido del post

Responde SOLO con el comentario, sin comillas ni introducción.
`;

    return fullPrompt;
  }

  async callAI(prompt, aiConfig, imageUrl = null) {
    const provider = aiConfig.provider || 'anthropic';
    const apiKey = aiConfig.apiKey;
    const model = aiConfig.model;

    if (!apiKey) {
      throw new Error('API key no configurada');
    }

    if (provider === 'anthropic') {
      return await this.callAnthropic(prompt, apiKey, model, imageUrl);
    } else {
      return await this.callOpenAI(prompt, apiKey, model, imageUrl);
    }
  }

  async callAnthropic(prompt, apiKey, model, imageUrl) {
    const messages = [
      {
        role: 'user',
        content: []
      }
    ];

    // Agregar imagen si hay
    if (imageUrl) {
      try {
        // Fetch image as base64
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const base64 = await this.blobToBase64(blob);
        
        messages[0].content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: blob.type,
            data: base64.split(',')[1]
          }
        });
      } catch (error) {
        console.warn('No se pudo cargar la imagen:', error);
      }
    }

    // Agregar texto
    messages[0].content.push({
      type: 'text',
      text: prompt
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Error llamando a Anthropic');
    }

    const data = await response.json();
    return data.content[0].text.trim();
  }

  async callOpenAI(prompt, apiKey, model, imageUrl) {
    const messages = [
      {
        role: 'user',
        content: []
      }
    ];

    // Agregar imagen si hay
    if (imageUrl) {
      messages[0].content.push({
        type: 'image_url',
        image_url: { url: imageUrl }
      });
    }

    // Agregar texto
    messages[0].content.push({
      type: 'text',
      text: prompt
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        max_tokens: 500,
        messages: messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Error llamando a OpenAI');
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  async likePost(tabId, platform) {
    const action = platform === 'instagram' ? 'LIKE_POST_IG' : 'LIKE_POST_LI';

    const response = await chrome.tabs.sendMessage(tabId, { action });

    if (!response.success && !response.result?.alreadyLiked) {
      console.warn('⚠️ Like falló pero continuamos');
    }
  }

  async postComment(tabId, platform, text) {
    const action = platform === 'instagram' ? 'POST_COMMENT_IG' : 'POST_COMMENT_LI';

    const response = await chrome.tabs.sendMessage(tabId, {
      action,
      text
    });

    if (!response.success) {
      throw new Error(response.error);
    }
  }

  async saveToHistory(data) {
    const stored = await chrome.storage.local.get('commentHistory');
    const history = stored.commentHistory || [];
    
    history.unshift(data);
    
    // Mantener solo últimos 100
    if (history.length > 100) {
      history.splice(100);
    }
    
    await chrome.storage.local.set({ commentHistory: history });
  }

  async waitForTabLoad(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(resolve, 2000); // Extra wait
        }
      });
    });
  }

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton
const commentOrchestrator = new CommentOrchestrator();

// Make available globally
if (typeof window !== 'undefined') {
  window.commentOrchestrator = commentOrchestrator;
}
