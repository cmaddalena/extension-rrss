/*
 * INSTAGRAM CONTENT SCRIPT v2.1 - ROBUST VERSION
 * Fixes: duplicate listeners, React input handling, publish button, followers modal
 * Added: Retry logic, detailed logging, pre-checks, timeouts
 */

console.log('🚀 Instagram Content Script v2.1 loading...');

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ═════════════════════════════════════════════════════════════════
// LOGGING SYSTEM - Detailed logs for debugging
// ═════════════════════════════════════════════════════════════════

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
let currentLogLevel = LOG_LEVELS.DEBUG;

function log(level, emoji, message, data = null) {
  const timestamp = new Date().toLocaleTimeString('es-AR');
  const prefix = `[${timestamp}] ${emoji}`;
  
  if (level >= currentLogLevel) {
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }
  
  // Store in session for later retrieval
  if (!window._igExtLogs) window._igExtLogs = [];
  window._igExtLogs.push({ timestamp, level, message, data });
  if (window._igExtLogs.length > 100) window._igExtLogs.shift();
}

const logger = {
  debug: (msg, data) => log(LOG_LEVELS.DEBUG, '🔍', msg, data),
  info: (msg, data) => log(LOG_LEVELS.INFO, 'ℹ️', msg, data),
  success: (msg, data) => log(LOG_LEVELS.INFO, '✅', msg, data),
  warn: (msg, data) => log(LOG_LEVELS.WARN, '⚠️', msg, data),
  error: (msg, data) => log(LOG_LEVELS.ERROR, '❌', msg, data),
  step: (num, msg) => log(LOG_LEVELS.INFO, `📍 [${num}]`, msg)
};

// ═════════════════════════════════════════════════════════════════
// PRE-CHECKS - Verify environment before actions
// ═════════════════════════════════════════════════════════════════

function checkIfLoggedIn() {
  // Check for login indicators
  const profileLink = document.querySelector('a[href*="/accounts/"], svg[aria-label="Configuración"]');
  const loginButton = document.querySelector('button:has-text("Iniciar sesión"), a[href*="/accounts/login"]');
  
  if (loginButton && !profileLink) {
    return { ok: false, reason: 'No estás logueado en Instagram' };
  }
  return { ok: true };
}

function checkIfCommentsEnabled() {
  // Check if comments are disabled on the post
  const disabledText = document.body.textContent?.includes('Los comentarios de esta publicación están desactivados') ||
                       document.body.textContent?.includes('Comments on this post have been limited');
  
  if (disabledText) {
    return { ok: false, reason: 'Los comentarios están desactivados en este post' };
  }
  
  // Check if comment input exists
  const commentInput = document.querySelector('textarea[aria-label*="comentario" i], textarea[aria-label*="comment" i]');
  if (!commentInput) {
    return { ok: false, reason: 'No se encontró el campo de comentarios (puede estar deshabilitado)' };
  }
  
  return { ok: true };
}

function checkPostLoaded() {
  const article = document.querySelector('article');
  const dialog = document.querySelector('div[role="dialog"]');
  
  if (!article && !dialog) {
    return { ok: false, reason: 'El post no se cargó correctamente' };
  }
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════════
// RETRY LOGIC - Attempt actions multiple times with backoff
// ═════════════════════════════════════════════════════════════════

async function retry(fn, options = {}) {
  const { maxAttempts = 3, initialDelay = 1000, backoffMultiplier = 2, actionName = 'action' } = options;
  
  let lastError;
  let delay = initialDelay;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug(`Intento ${attempt}/${maxAttempts} de ${actionName}`);
      const result = await fn();
      if (attempt > 1) {
        logger.success(`${actionName} exitoso en intento ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      logger.warn(`${actionName} falló (intento ${attempt}/${maxAttempts}): ${error.message}`);
      
      if (attempt < maxAttempts) {
        logger.debug(`Esperando ${delay}ms antes de reintentar...`);
        await wait(delay);
        delay *= backoffMultiplier;
      }
    }
  }
  
  throw lastError;
}

// ═════════════════════════════════════════════════════════════════
// REACT INPUT HELPER - Instagram uses React, .value= doesn't work
// ═════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════
// REACT INPUT HELPER - FIX CRÍTICO (Illegal Invocation)
// ═════════════════════════════════════════════════════════════════
function setNativeValue(element, value) {
  if (!element) return;
  try {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      const proto = element.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
      const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (valueSetter) {
        valueSetter.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
      // Para contenteditable simulamos tipeo real/pegado
      element.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } catch (error) {
    logger.error('Error en setNativeValue:', error.message);
  }
}
// ═════════════════════════════════════════════════════════════════
// FIND PUBLISH/POST BUTTON - Instagram specific (EXACT from HTML)
// ═════════════════════════════════════════════════════════════════

function findPublishButton() {
  // Method 1: Look for span with exact class that contains "Publicar" or "Post"
  // From HTML: <span class="x16xky2k">Publicar</span>
  const spanWithText = document.querySelector('span.x16xky2k');
  if (spanWithText) {
    const text = spanWithText.textContent?.trim().toLowerCase();
    if (text === 'publicar' || text === 'post') {
      const btn = spanWithText.closest('div[role="button"]');
      if (btn) {
        console.log('✅ Publish button found via span.x16xky2k');
        return btn;
      }
    }
  }
  
  // Method 2: Look for div[role="button"] containing Publicar/Post text in form/section
  const allButtons = document.querySelectorAll('section div[role="button"], form div[role="button"]');
  for (const btn of allButtons) {
    const text = btn.textContent?.trim().toLowerCase();
    if (text === 'publicar' || text === 'post' || text === 'enviar' || text === 'send') {
      console.log('✅ Publish button found in section/form:', text);
      return btn;
    }
  }
  
  // Method 3: form submit button
  const submitBtn = document.querySelector('form button[type="submit"]');
  if (submitBtn) {
    console.log('✅ Form submit button found');
    return submitBtn;
  }
  
  console.log('❌ No publish button found');
  return null;
}

// ═════════════════════════════════════════════════════════════════
// FIND COMMENT INPUT
// ═════════════════════════════════════════════════════════════════

function findCommentInput() {
  // Instagram 2025 - EXACT selectors from real HTML
  
  // Method 1: Textarea with specific aria-label (CONFIRMED from HTML)
  const textareaSelectors = [
    'textarea[aria-label="Añade un comentario..."]',
    'textarea[aria-label="Add a comment..."]',
    'textarea[placeholder="Añade un comentario..."]',
    'textarea[placeholder="Add a comment..."]',
    'form textarea[autocomplete="off"]',
    'section form textarea'
  ];
  
  for (const sel of textareaSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      console.log('✅ Comment textarea found with:', sel);
      return { element: el, type: 'textarea' };
    }
  }
  
  // Method 2: Contenteditable (Instagram DMs use this)
  const editableSelectors = [
    'div[contenteditable="true"][role="textbox"][data-lexical-editor="true"]',
    'div[contenteditable="true"][aria-label*="mensaje" i]',
    'div[contenteditable="true"][aria-placeholder*="mensaje" i]'
  ];
  
  for (const sel of editableSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      console.log('✅ Comment input (contenteditable) found with:', sel);
      return { element: el, type: 'contenteditable' };
    }
  }
  
  return null;
}

// ═════════════════════════════════════════════════════════════════
// POST COMMENT - Fixed for React + Instagram UI
// ═════════════════════════════════════════════════════════════════

async function postComment(text, options = {}) {
  const { maxRetries = 2 } = options;
  
  logger.step(1, 'Iniciando postComment');
  logger.debug('Texto a comentar:', text.substring(0, 50) + '...');
  
  // Pre-checks
  logger.step(2, 'Verificando requisitos previos');
  
  const postCheck = checkPostLoaded();
  if (!postCheck.ok) {
    logger.error('Post check failed:', postCheck.reason);
    throw new Error(postCheck.reason);
  }
  
  const commentCheck = checkIfCommentsEnabled();
  if (!commentCheck.ok) {
    logger.error('Comment check failed:', commentCheck.reason);
    throw new Error(commentCheck.reason);
  }
  
  logger.success('Pre-checks pasados');
  
  // Find input with retry
  logger.step(3, 'Buscando campo de comentarios');
  
  let inputData = null;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    inputData = findCommentInput();
    
    if (inputData) {
      logger.success(`Input encontrado (intento ${attempt})`, { type: inputData.type });
      break;
    }
    
    logger.debug(`Input no encontrado (intento ${attempt}), intentando activar...`);
    
    // Try clicking areas that might reveal the input
    const activators = [
      'section[class*="x5ur3kl"]', // Comment section
      '[aria-label*="comentario" i]',
      '[aria-label*="comment" i]',
      'form'
    ];
    
    for (const sel of activators) {
      const el = document.querySelector(sel);
      if (el) {
        el.click();
        await wait(800);
        inputData = findCommentInput();
        if (inputData) break;
      }
    }
    
    if (!inputData) await wait(1000);
  }
  
  if (!inputData) {
    logger.error('No se encontró campo de comentarios después de 3 intentos');
    logger.debug('HTML del post para debug:', document.querySelector('article')?.innerHTML?.substring(0, 500));
    throw new Error('No se encontró el campo de comentarios. ¿El post permite comentarios?');
  }
  
  const { element: input, type } = inputData;
  
  // Focus and prepare input
  logger.step(4, 'Preparando input para escribir');
  
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await wait(500);
  input.focus();
  await wait(300);
  input.click();
  await wait(300);
  
  // Insert text with multiple methods
  logger.step(5, 'Insertando texto');
  
  if (type === 'textarea') {
    // Method 1: setNativeValue (React-compatible)
    setNativeValue(input, text);
    await wait(500);
    
    // Verify and retry with execCommand if needed
    if (!input.value || input.value !== text) {
      logger.debug('setNativeValue no funcionó, probando execCommand');
      input.focus();
      input.select();
      document.execCommand('insertText', false, text);
      await wait(500);
    }
    
    // Method 3: Direct assignment + events
    if (!input.value || input.value !== text) {
      logger.debug('execCommand no funcionó, probando asignación directa');
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } else {
    // Contenteditable (for DMs)
    input.innerHTML = '';
    input.focus();
    document.execCommand('insertText', false, text);
    await wait(500);
    
    if (!input.textContent?.trim()) {
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  
  await wait(800);
  
  // Verify text was inserted
  const currentText = type === 'textarea' ? input.value?.trim() : input.textContent?.trim();
  logger.debug('Texto en input:', currentText?.substring(0, 30) + '...');
  
  if (!currentText || currentText.length < 3) {
    logger.error('No se pudo insertar el texto');
    logger.debug('Input state:', { value: input.value, textContent: input.textContent });
    throw new Error('No se pudo escribir el texto en el campo. Instagram puede haber bloqueado la entrada.');
  }
  
  logger.success('Texto insertado correctamente');
  
  // Find publish button
  logger.step(6, 'Buscando botón Publicar');
  
  await wait(500);
  const publishBtn = findPublishButton();
  
  if (!publishBtn) {
    logger.warn('Botón Publicar no encontrado, intentando con Enter');
    input.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true 
    }));
    await wait(2000);
  } else {
    // Check button state
    const isDisabled = publishBtn.getAttribute('aria-disabled') === 'true';
    logger.debug('Estado del botón:', { isDisabled, classes: publishBtn.className.substring(0, 50) });
    
    if (isDisabled) {
      logger.warn('Botón deshabilitado, esperando...');
      await wait(2000);
      
      // Re-check
      const stillDisabled = publishBtn.getAttribute('aria-disabled') === 'true';
      if (stillDisabled) {
        logger.error('Botón sigue deshabilitado después de esperar');
        throw new Error('El botón Publicar está deshabilitado. Instagram puede estar limitando tus acciones.');
      }
    }
    
    // Click with multiple methods
    logger.step(7, 'Clickeando Publicar');
    
    // Method 1: Direct click
    publishBtn.click();
    await wait(1500);
    
    // Method 2: MouseEvent
    publishBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    await wait(1500);
  }
  
  // Verify comment was posted
  logger.step(8, 'Verificando publicación');
  
  await wait(1000);
  const newInputData = findCommentInput();
  const finalText = newInputData ? 
    (newInputData.type === 'textarea' ? newInputData.element.value?.trim() : newInputData.element.textContent?.trim()) 
    : '';
  
  // Success indicators:
  // 1. Input is now empty
  // 2. Input text is different from what we wrote
  // 3. Input element is gone
  
  if (!finalText || finalText !== currentText) {
    logger.success('✅ COMENTARIO VERIFICADO COMO PUBLICADO');
    return { success: true, verified: true };
  }
  
  // Check if comment appears in the comments section
  const commentsSection = document.querySelector('ul[class*="x78zum5"]');
  if (commentsSection?.textContent?.includes(text.substring(0, 20))) {
    logger.success('✅ Comentario encontrado en la sección de comentarios');
    return { success: true, verified: true };
  }
  
  // Comment might not have posted
  logger.warn('El texto sigue en el input - posible fallo');
  logger.debug('Estado final:', { 
    inputText: finalText?.substring(0, 30),
    expectedText: currentText?.substring(0, 30)
  });
  
  throw new Error('El comentario no se publicó. El texto sigue en el campo. Puede que Instagram esté bloqueando tus acciones.');
}

// ═════════════════════════════════════════════════════════════════
// LIKE POST
// ═════════════════════════════════════════════════════════════════

async function likePost() {
  console.log('❤️ Liking post...');
  
  let likeButton = document.querySelector('[aria-label="Me gusta"]') 
    || document.querySelector('[aria-label="Like"]');
  
  if (!likeButton) {
    const svgs = document.querySelectorAll('svg');
    for (const svg of svgs) {
      const label = svg.getAttribute('aria-label');
      if (label && (label.includes('Me gusta') || label === 'Like')) {
        likeButton = svg.closest('button') || svg.closest('span[role="button"]') || svg.closest('div[role="button"]');
        break;
      }
    }
  }
  
  if (!likeButton) {
    console.warn('⚠️ Like button not found');
    return { success: false, reason: 'Like button not found' };
  }
  
  // Check if already liked (filled heart = red)
  const svg = likeButton.querySelector('svg');
  if (svg) {
    const fill = svg.getAttribute('fill') || svg.querySelector('[fill]')?.getAttribute('fill');
    if (fill === '#FF3040' || fill === 'rgb(255, 48, 64)') {
      return { alreadyLiked: true };
    }
  }
  
  likeButton.click();
  await wait(1000);
  return { success: true };
}

// ═════════════════════════════════════════════════════════════════
// OPEN FOLLOWERS MODAL - Navigate to profile, click "Seguidores"
// ═════════════════════════════════════════════════════════════════

async function openFollowersModal() {
  console.log('👥 Opening followers modal...');
  
  // Look for the "seguidores" / "followers" link/button on the profile page
  const allLinks = document.querySelectorAll('a[href*="/followers"], a[href*="/followers/"]');
  if (allLinks.length > 0) {
    console.log('✅ Found followers link, clicking...');
    allLinks[0].click();
    await wait(2000);
    return true;
  }
  
  // Fallback: look for span with follower count text
  const spans = document.querySelectorAll('span, a');
  for (const el of spans) {
    const text = el.textContent?.toLowerCase() || '';
    if (text.includes('seguidores') || text.includes('followers')) {
      // Make sure it's the clickable element on the profile header
      const clickable = el.closest('a') || el.closest('div[role="button"]') || el.closest('[tabindex]') || el;
      console.log('✅ Found followers text element, clicking...');
      clickable.click();
      await wait(2000);
      return true;
    }
  }
  
  console.log('❌ Could not find followers link');
  return false;
}

// ═════════════════════════════════════════════════════════════════
// SCROLL MODAL AND EXTRACT USERS
// ═════════════════════════════════════════════════════════════════

async function scrollAndExtractUsers(max = 50) {
  const dialog = document.querySelector('div[role="dialog"]');
  if (!dialog) {
    throw new Error('No se abrió el modal de seguidores/likers');
  }
  
  // Find the scrollable container inside the dialog
  const scrollContainer = dialog.querySelector('div[style*="overflow"]') 
    || dialog.querySelector('div[class*="scroll"]')
    || dialog;
  
  const users = new Map();
  let prevSize = 0;
  let noNewCount = 0;
  
  for (let attempt = 0; attempt < Math.ceil(max / 5) + 10; attempt++) {
    // Extract visible user links
    const userLinks = dialog.querySelectorAll('a[href^="/"][role="link"]');
    
    for (const link of userLinks) {
      const href = link.getAttribute('href');
      const username = href?.replace(/\//g, '');
      
      if (!username || username.length < 2 || username.includes('?') || username.includes('explore') || username.includes('accounts')) continue;
      
      if (!users.has(username)) {
        // Try to get display name
        const nameEl = link.querySelector('span span') || link.querySelector('span');
        const name = nameEl?.textContent?.trim() || username;
        users.set(username, { username, nombre: name });
      }
      
      if (users.size >= max) break;
    }
    
    if (users.size >= max) break;
    
    // Check if we're getting new users
    if (users.size === prevSize) {
      noNewCount++;
      if (noNewCount >= 5) {
        console.log('⚠️ No new users found after 5 scrolls, stopping');
        break;
      }
    } else {
      noNewCount = 0;
      prevSize = users.size;
    }
    
    // Scroll
    scrollContainer.scrollTop += 400;
    await wait(800);
    
    // Log progress
    if (attempt % 5 === 0) {
      console.log(`📊 Extracted so far: ${users.size}/${max}`);
    }
  }
  
  return Array.from(users.values());
}

// ═════════════════════════════════════════════════════════════════
// CLOSE MODAL
// ═════════════════════════════════════════════════════════════════

function closeModal() {
  const dialog = document.querySelector('div[role="dialog"]');
  if (!dialog) return;
  
  const closeBtn = dialog.querySelector('button[aria-label*="Cerrar"]')
    || dialog.querySelector('button[aria-label*="Close"]')
    || dialog.querySelector('svg[aria-label*="Cerrar"]')?.closest('button')
    || dialog.querySelector('svg[aria-label*="Close"]')?.closest('button');
  
  if (closeBtn) {
    closeBtn.click();
  } else {
    // Try pressing Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }
}

// ═════════════════════════════════════════════════════════════════
// ANALYZER - unchanged core logic, extracted for clarity
// ═════════════════════════════════════════════════════════════════

function generateFullHTML(posts, username) {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const postsWithLikes = posts.filter(p => p.likes > 0);
  const totalLikes = postsWithLikes.reduce((sum, p) => sum + p.likes, 0);
  const avgLikes = postsWithLikes.length > 0 ? Math.round(totalLikes / postsWithLikes.length) : 0;
  const topPosts = [...posts].filter(p => p.likes > 0).sort((a, b) => b.likes - a.likes).slice(0, 10);
  
  const dailyDist = new Array(7).fill(0);
  const hourlyDist = new Array(24).fill(0);
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  
  posts.forEach(p => {
    const date = new Date(p.timestamp);
    dailyDist[date.getDay()]++;
    hourlyDist[date.getHours()]++;
    heatmap[date.getDay()][date.getHours()]++;
  });
  
  const bestDayIndex = dailyDist.indexOf(Math.max(...dailyDist));
  const bestDay = days[bestDayIndex];
  
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Análisis Instagram - @${username}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #fafafa; color: #262626; padding: 40px 20px; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 50px; }
    h1 { font-size: 36px; margin-bottom: 10px; }
    .account-link { color: #0095f6; text-decoration: none; font-weight: 600; font-size: 20px; }
    .subtitle { color: #8e8e8e; font-size: 14px; margin-top: 10px; }
    .section { background: white; border-radius: 12px; padding: 30px; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h2 { font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .metric-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; }
    .metric-card.pink { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .metric-card.green { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .metric-card.orange { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
    .metric-label { font-size: 14px; opacity: 0.9; margin-bottom: 10px; text-transform: uppercase; }
    .metric-value { font-size: 32px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    table th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; }
    table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
    .post-link { color: #0095f6; text-decoration: none; }
    .day-chart { display: flex; justify-content: space-around; align-items: flex-end; height: 250px; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .day-bar { flex: 1; display: flex; flex-direction: column; align-items: center; margin: 0 5px; }
    .bar { width: 100%; max-width: 60px; background: linear-gradient(180deg, #667eea 0%, #764ba2 100%); border-radius: 6px 6px 0 0; min-height: 20px; display: flex; align-items: flex-start; justify-content: center; padding-top: 8px; }
    .bar-count { color: white; font-weight: 700; font-size: 14px; }
    .bar-label { margin-top: 10px; font-size: 12px; color: #8e8e8e; }
    .heatmap { border-collapse: collapse; margin: 20px auto; font-size: 11px; }
    .heatmap th { padding: 8px; text-align: center; color: #8e8e8e; }
    .heatmap td { width: 30px; height: 30px; text-align: center; border: 1px solid #f0f0f0; font-size: 10px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Análisis de Instagram</h1>
      <a href="https://instagram.com/${username}" target="_blank" class="account-link">@${username}</a>
      <div class="subtitle">Generado el ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
    <div class="section">
      <h2>📈 Métricas Generales</h2>
      <div class="metrics">
        <div class="metric-card"><div class="metric-label">Posts Analizados</div><div class="metric-value">${posts.length}</div></div>
        <div class="metric-card pink"><div class="metric-label">Total Likes</div><div class="metric-value">${totalLikes.toLocaleString('es-AR')}</div></div>
        <div class="metric-card green"><div class="metric-label">Promedio Likes</div><div class="metric-value">${avgLikes.toLocaleString('es-AR')}</div></div>
        <div class="metric-card orange"><div class="metric-label">Mejor Día</div><div class="metric-value">${bestDay}</div></div>
      </div>
    </div>
    <div class="section">
      <h2>📅 Distribución por Día</h2>
      <div class="day-chart">
        ${dailyDist.map((count, i) => {
          const maxCount = Math.max(...dailyDist);
          const height = maxCount > 0 ? (count / maxCount * 100) : 0;
          return `<div class="day-bar"><div class="bar" style="height: ${height}%;"><span class="bar-count">${count}</span></div><div class="bar-label">${days[i]}</div></div>`;
        }).join('')}
      </div>
    </div>
    <div class="section">
      <h2>🕐 Heatmap Día × Hora</h2>
      <table class="heatmap">
        <tr><th></th>${Array.from({ length: 24 }, (_, h) => `<th>${h}h</th>`).join('')}</tr>
        ${heatmap.map((row, d) => `<tr><th>${days[d]}</th>${row.map(count => {
          const pct = posts.length > 0 ? ((count / posts.length) * 100).toFixed(0) : 0;
          let color = '#f5f5f5';
          if (pct >= 25) color = '#ff6b6b';
          else if (pct >= 15) color = '#ffb84d';
          else if (pct >= 10) color = '#ffeb99';
          else if (pct >= 5) color = '#7cd97c';
          else if (pct > 0) color = '#d4edda';
          return `<td style="background-color: ${color}">${count > 0 ? `${pct}%` : ''}</td>`;
        }).join('')}</tr>`).join('')}
      </table>
    </div>
    <div class="section">
      <h2>🏆 Top 10 Posts</h2>
      <table>
        <thead><tr><th>#</th><th>Fecha</th><th>Caption</th><th>❤️</th><th>🔗</th></tr></thead>
        <tbody>
          ${topPosts.map((p, i) => {
            const d = new Date(p.timestamp);
            const postUrl = p.postId ? `https://instagram.com/p/${p.postId}/` : `https://instagram.com/${username}`;
            return `<tr><td>${i + 1}</td><td>${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td><td>${(p.caption || '').substring(0, 80)}...</td><td><strong>${p.likes.toLocaleString('es-AR')}</strong></td><td><a href="${postUrl}" target="_blank" class="post-link">Ver</a></td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="section">
      <h2>📝 Todos (${posts.length})</h2>
      <table>
        <thead><tr><th>#</th><th>Fecha</th><th>Caption</th><th>❤️</th><th>🔗</th></tr></thead>
        <tbody>
          ${posts.map((p, i) => {
            const d = new Date(p.timestamp);
            const postUrl = p.postId ? `https://instagram.com/p/${p.postId}/` : `https://instagram.com/${username}`;
            return `<tr><td>${i + 1}</td><td>${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td><td>${(p.caption || '').substring(0, 100)}...</td><td>${p.likes.toLocaleString('es-AR')}</td><td><a href="${postUrl}" target="_blank" class="post-link">Ver</a></td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

// ═════════════════════════════════════════════════════════════════
// INSTAGRAM ANALYZER OBJECT
// ═════════════════════════════════════════════════════════════════

if (!window.location.href.includes('instagram.com')) {
  console.log('❌ Not on Instagram');
} else {
  console.log('✅ On Instagram');
}

window.InstagramAnalyzer = {
  version: '2.0',
  loaded: true,
  
  test() {
    console.log('✅ InstagramAnalyzer v2.0 working!');
    return 'OK';
  },
  
  detectUsername() {
    const authorLink = document.querySelector('header a[href^="/"]');
    if (authorLink) {
      const match = authorLink.getAttribute('href').match(/^\/([^\/\?]+)/);
      if (match?.[1]) return match[1];
    }
    // Fallback: from URL
    const urlMatch = window.location.pathname.match(/^\/([^\/\?]+)/);
    if (urlMatch?.[1] && !['p', 'reel', 'explore', 'direct', 'accounts', 'stories'].includes(urlMatch[1])) {
      return urlMatch[1];
    }
    return null;
  },
  
  async analyzeCurrentPost() {
    console.log('📊 Analyzing post...');
    try {
      const timeEl = document.querySelector('time[datetime]');
      if (!timeEl) { console.log('⏳ Post not loaded yet'); return null; }
      
      const timestamp = timeEl.getAttribute('datetime');
      const postUrl = window.location.href;
      const postId = postUrl.match(/\/(p|reel)\/([^\/\?]+)/)?.[2] || '';
      
      const h1 = document.querySelector('h1[dir="auto"]');
      const caption = h1 ? h1.textContent.substring(0, 100) : '';
      
      // Detect likes
      let likesFromCounter = 0;
      let likesFromText = 0;
      
      const article = document.querySelector('article');
      const articleText = article ? article.innerText : '';
      
      // Method 1: Direct counter
      const counterSelectors = ['section span', 'button span', 'a[href*="/liked_by/"] span'];
      for (const selector of counterSelectors) {
        const elements = article?.querySelectorAll(selector) || [];
        for (const el of elements) {
          const text = el.textContent.trim();
          if (/^\d+(?:[.,]\d+)*$/.test(text)) {
            const num = parseInt(text.replace(/[.,]/g, ''));
            if (num > likesFromCounter) likesFromCounter = num;
          }
        }
      }
      
      // Method 2: Text patterns
      const likePatterns = [
        { pattern: /Les gusta a\s+[^\s]+\s+y\s+(\d+(?:[.,]\d+)*)\s*personas?\s*más/i, addOne: true },
        { pattern: /(\d+(?:[.,]\d+)*)\s*personas?\s*más/i, addOne: false },
        { pattern: /(\d+(?:[.,]\d+)*)\s*Me gusta/i, addOne: false },
        { pattern: /(\d+(?:[.,]\d+)*)\s*likes?/i, addOne: false },
        { pattern: /Les gusta a\s+(\d+(?:[.,]\d+)*)/i, addOne: false },
        { pattern: /y\s+otras?\s+(\d+(?:[.,]\d+)*)\s*personas?/i, addOne: false }
      ];
      
      for (const { pattern, addOne } of likePatterns) {
        const match = articleText.match(pattern);
        if (match) {
          const num = parseInt(match[1].replace(/[.,]/g, ''));
          const total = addOne ? num + 1 : num;
          if (total > likesFromText) likesFromText = total;
        }
      }
      
      const likes = Math.max(likesFromCounter, likesFromText);
      console.log(`📊 Likes: counter=${likesFromCounter}, text=${likesFromText}, final=${likes}`);
      
      return { timestamp, postId, postUrl, caption: caption.substring(0, 50), likes };
    } catch (error) {
      console.error('❌ Error:', error);
      return null;
    }
  },
  
  navigateNext() {
    // Find next-post button OUTSIDE article (not carousel)
    const allButtons = document.querySelectorAll('button[aria-label*="Siguiente"], button[aria-label*="Next"]');
    for (const btn of allButtons) {
      if (!btn.closest('article')) {
        console.log('✅ Click next post button');
        btn.click();
        return true;
      }
    }
    // Fallback: dialog next button
    const dialogNext = document.querySelector('div[role="dialog"] button[aria-label*="Siguiente"]');
    if (dialogNext && !dialogNext.closest('article')) {
      dialogNext.click();
      return true;
    }
    // Fallback: Arrow key
    console.log('⌨️ Using arrow key');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
    return true;
  },
  
  async openFirstPost() {
    console.log('🔍 Looking for first post...');
    await wait(2000);
    
    const selectors = [
      'article a[href*="/p/"]',
      'article a[href*="/reel/"]',
      'div[role="button"] a[href*="/p/"]',
      'a[href*="/p/"]',
      'a[href*="/reel/"]'
    ];
    
    for (const sel of selectors) {
      const firstPost = document.querySelector(sel);
      if (firstPost) {
        console.log(`✅ First post found: ${sel}`);
        firstPost.click();
        await wait(2000);
        return;
      }
    }
    throw new Error('No se encontraron posts. ¿Cuenta privada o sin posts?');
  },
  
  async startAnalysis(limit, skipCount = 0) {
    console.log(`\n🚀 STARTING ANALYSIS: ${limit} posts (skip ${skipCount})\n`);
    
    try {
      await this.openFirstPost();
      
      if (skipCount > 0) {
        console.log(`⏭️ Skipping ${skipCount} pinned posts...`);
        for (let i = 0; i < skipCount; i++) {
          this.navigateNext();
          await wait(1500);
        }
      }
    } catch (error) {
      console.error('❌ Error opening first post:', error);
      return { posts: [], stats: { totalPosts: 0, error: error.message } };
    }
    
    const posts = [];
    let loopCount = 0;
    let lastTimestamp = null;
    
    while (posts.length < limit && loopCount < 8) {
      console.log(`\n--- Post ${posts.length + 1}/${limit} ---`);
      
      const post = await this.analyzeCurrentPost();
      
      if (post) {
        if (lastTimestamp === post.timestamp) {
          loopCount++;
          if (loopCount >= 8) break;
        } else {
          loopCount = 0;
          lastTimestamp = post.timestamp;
        }
        
        if (!posts.some(p => p.timestamp === post.timestamp)) {
          posts.push(post);
          try {
            chrome.runtime.sendMessage({
              action: 'ANALYSIS_PROGRESS_FROM_CONTENT',
              platform: 'instagram',
              current: posts.length,
              total: limit,
              status: `📊 Post ${posts.length}/${limit}...`
            });
          } catch (e) {}
        }
      }
      
      this.navigateNext();
      await wait(2000);
    }
    
    console.log(`\n✅ ANALYSIS COMPLETE: ${posts.length} posts\n`);
    
    // Calculate stats
    const postsWithLikes = posts.filter(p => p.likes > 0);
    const totalLikes = postsWithLikes.reduce((sum, p) => sum + p.likes, 0);
    const avgLikes = postsWithLikes.length > 0 ? Math.round(totalLikes / postsWithLikes.length) : 0;
    const topPost = [...posts].filter(p => p.likes > 0).sort((a, b) => b.likes - a.likes)[0] || null;
    
    const dailyDist = new Array(7).fill(0);
    const hourlyDist = new Array(24).fill(0);
    posts.forEach(p => {
      const d = new Date(p.timestamp);
      dailyDist[d.getDay()]++;
      hourlyDist[d.getHours()]++;
    });
    
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const bestDay = days[dailyDist.indexOf(Math.max(...dailyDist))];
    const bestHour = hourlyDist.indexOf(Math.max(...hourlyDist));
    
    const stats = {
      totalPosts: posts.length, totalLikes, avgLikes, avgComments: 0,
      topPost, bestDay, bestHour,
      distribution: { daily: dailyDist, hourly: hourlyDist }
    };
    
    chrome.storage.local.set({ analyzedPosts: posts, analyzedAt: new Date().toISOString() });
    
    return { posts, stats };
  }
};

// ═════════════════════════════════════════════════════════════════
// EXTRACT POST DATA (for commentor)
// ═════════════════════════════════════════════════════════════════

async function extractPostData() {
  const article = document.querySelector('article');
  if (!article) throw new Error('No article found');
  
  let caption = '';
  const captionEl = article.querySelector('h1') || article.querySelector('span[dir="auto"]');
  if (captionEl) {
    const spans = article.querySelectorAll('span');
    for (const span of spans) {
      if (span.textContent.length > caption.length && !span.querySelector('a')) {
        caption = span.textContent.trim();
      }
    }
  }
  
  const timeEl = document.querySelector('time');
  const timestamp = timeEl?.getAttribute('datetime') || new Date().toISOString();
  
  return { caption: caption || '', timestamp };
}

// ═════════════════════════════════════════════════════════════════
// HELPER: Wait for selector
// ═════════════════════════════════════════════════════════════════

function waitForSelector(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout: ${selector}`)); }, timeout);
  });
}

// ═════════════════════════════════════════════════════════════════
// SINGLE MESSAGE LISTENER (no duplicates!)
// ═════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 IG received:', message.action);
  
  // ── PING ──
  if (message.action === 'PING') {
    sendResponse({ success: true, version: '2.0' });
    return true;
  }
  
  // ── ANALYZE_PROFILE (from popup/dashboard) ──
  if (message.action === 'ANALYZE_PROFILE') {
    const postCount = message.postCount || 12;
    InstagramAnalyzer.startAnalysis(postCount)
      .then(result => {
        let username = message.username || InstagramAnalyzer.detectUsername() || 'instagram_user';
        const totalPosts = result.posts.length;
        const postsWithLikes = result.posts.filter(p => p.likes > 0);
        const totalLikes = postsWithLikes.reduce((sum, p) => sum + p.likes, 0);
        const avgLikes = postsWithLikes.length > 0 ? Math.round(totalLikes / postsWithLikes.length) : 0;
        const bestPost = Math.max(...result.posts.map(p => p.likes), 0);
        sendResponse({ success: true, data: { username, totalPosts, avgLikes, bestPost, posts: result.posts } });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // ── START_ANALYSIS (from background worker) ──
  if (message.action === 'START_ANALYSIS') {
    InstagramAnalyzer.startAnalysis(message.postCount, message.skipCount || 0)
      .then(result => {
        const username = message.username || InstagramAnalyzer.detectUsername() || 'instagram_user';
        chrome.runtime.sendMessage({
          action: 'ANALYSIS_COMPLETE_FROM_CONTENT',
          platform: 'instagram', username,
          posts: result.posts, stats: result.stats,
          postCount: result.posts.length
        });
      })
      .catch(error => {
        chrome.runtime.sendMessage({
          action: 'ANALYSIS_ERROR_FROM_CONTENT',
          platform: 'instagram', username: message.username, error: error.message
        });
      });
    sendResponse({ success: true });
    return true;
  }
  
  // ── GENERATE_REPORT ──
  if (message.action === 'GENERATE_REPORT') {
    chrome.storage.local.get(['analyzedPosts'], result => {
      console.log('📊 Saved posts:', result.analyzedPosts?.length || 0);
    });
    sendResponse({ success: true });
    return true;
  }
  
  // ── DOWNLOAD_HTML ──
  if (message.action === 'DOWNLOAD_HTML') {
    chrome.storage.local.get(['analyzedPosts'], result => {
      if (!result.analyzedPosts?.length) return;
      const username = InstagramAnalyzer.detectUsername() || 'instagram_user';
      const html = generateFullHTML(result.analyzedPosts, username);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `instagram_${username}_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    sendResponse({ success: true });
    return true;
  }
  
  // ── CLEAN_ALL ──
  if (message.action === 'CLEAN_ALL') {
    chrome.storage.local.clear();
    sendResponse({ success: true });
    return true;
  }
  
  // ── FIND_AND_COMMENT (AI commentor) ──
  if (message.action === 'FIND_AND_COMMENT') {
    (async () => {
      try {
        logger.step(1, 'FIND_AND_COMMENT iniciando');
        logger.debug('Config recibida:', { hasAiConfig: !!message.aiConfig, hasNotes: !!message.personNotes });
        
        await wait(3000);
        
        // Pre-check: Are we on a profile page?
        const isProfilePage = window.location.pathname.match(/^\/[^\/]+\/?$/) && 
                              !window.location.pathname.includes('/p/') &&
                              !window.location.pathname.includes('/reel/');
        
        if (!isProfilePage) {
          logger.warn('No parece ser una página de perfil:', window.location.pathname);
        }
        
        // Find first post with retry
        logger.step(2, 'Buscando posts en el perfil');
        
        const postSelectors = [
          'article a[href*="/p/"]', 'main a[href*="/p/"]',
          'a[href*="/p/"][role="link"]', 'a[href^="/p/"]', 'a[href*="/reel/"]'
        ];
        
        let postLink = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          for (const sel of postSelectors) {
            postLink = document.querySelector(sel);
            if (postLink) {
              logger.success(`Post encontrado con selector: ${sel}`);
              break;
            }
          }
          
          if (postLink) break;
          
          logger.debug(`Intento ${attempt}/3: No se encontró post, esperando...`);
          await wait(2000);
          
          // Try scrolling down to load posts
          window.scrollBy(0, 300);
          await wait(1000);
        }
        
        if (!postLink) {
          logger.error('No se encontraron posts');
          logger.debug('HTML del main:', document.querySelector('main')?.innerHTML?.substring(0, 300));
          throw new Error('No se encontró ningún post en el perfil. ¿El perfil es privado o no tiene posts?');
        }
        
        logger.info('Abriendo post:', postLink.href);
        postLink.click();
        await wait(3500);
        
        // Verify post opened (should be in a dialog or /p/ URL)
        const postOpened = document.querySelector('div[role="dialog"]') || 
                          window.location.pathname.includes('/p/') ||
                          window.location.pathname.includes('/reel/');
        
        if (!postOpened) {
          logger.warn('El post puede no haberse abierto correctamente');
          // Try clicking again
          postLink.click();
          await wait(3000);
        }
        
        // CHECK: Have we already commented on this post?
        logger.step('2.5', 'Verificando comentarios previos');
        
        const currentPostUrl = window.location.href;
        const postId = currentPostUrl.match(/\/(p|reel)\/([^\/\?]+)/)?.[2] || '';
        
        logger.debug('Post ID:', postId);
        logger.debug('URL completa:', currentPostUrl);
        
        // METHOD 1: Check chrome.storage for commented posts (PERSISTENT)
        let commentedPosts = [];
        try {
          const stored = await new Promise(resolve => {
            chrome.storage.local.get('ig_commented_posts', data => {
              resolve(data.ig_commented_posts || []);
            });
          });
          commentedPosts = stored;
          logger.debug(`Posts comentados previamente: ${commentedPosts.length}`);
        } catch (e) {
          logger.warn('Error leyendo posts comentados:', e.message);
        }
        
        if (postId && commentedPosts.includes(postId)) {
          logger.warn('⚠️ Ya comentaste en este post (registro persistente)');
          logger.debug('Post ID bloqueado:', postId);
          sendResponse({ 
            success: false, 
            error: 'Ya comentaste en este post anteriormente',
            skipped: true,
            reason: 'already_commented',
            postId: postId
          });
          return;
        }
        
        // METHOD 2: Get my username (multiple methods)
        let myUsername = '';
        
        // Method 2a: From profile link in navigation
        const profileLinks = document.querySelectorAll('a[href^="/"][role="link"]');
        for (const link of profileLinks) {
          const img = link.querySelector('img[alt]');
          if (img && img.alt && !img.alt.includes('Instagram')) {
            myUsername = img.alt.toLowerCase();
            break;
          }
        }
        
        // Method 2b: From Stories section (usually shows your profile)
        if (!myUsername) {
          const storyImg = document.querySelector('img[alt][draggable="false"][crossorigin="anonymous"]');
          if (storyImg?.alt && storyImg.alt.length > 1 && storyImg.alt.length < 50) {
            myUsername = storyImg.alt.toLowerCase();
          }
        }
        
        // Method 2c: From URL if on own profile
        if (!myUsername && window.location.pathname.match(/^\/[a-zA-Z0-9_.]+\/?$/)) {
          const pathUser = window.location.pathname.replace(/\//g, '');
          if (pathUser && !['explore', 'reels', 'direct', 'p', 'accounts'].includes(pathUser)) {
            // This might be own profile or someone else's - can't be sure
          }
        }
        
        logger.debug('Mi username detectado:', myUsername || '(no detectado)');
        
        // METHOD 3: Look for my comments in the comments section
        if (myUsername) {
          const existingComments = document.querySelectorAll('article a[href*="/"][role="link"], div[role="dialog"] a[href*="/"][role="link"]');
          let alreadyCommented = false;
          
          for (const commentLink of existingComments) {
            const href = commentLink.getAttribute('href')?.toLowerCase() || '';
            // Check if it's exactly my username (not just contains)
            if (href === `/${myUsername}/` || href === `/${myUsername}`) {
              // Verify this is in comments area, not just anywhere
              const parent = commentLink.closest('ul, div[role="dialog"]');
              if (parent) {
                alreadyCommented = true;
                logger.debug('Comentario encontrado de:', href);
                break;
              }
            }
          }
          
          if (alreadyCommented) {
            logger.warn('⚠️ Ya comentaste en este post (encontrado en DOM)');
            // Close the post dialog if open
            const closeBtn = document.querySelector('div[role="dialog"] svg[aria-label*="Cerrar"], div[role="dialog"] button[aria-label*="Close"]');
            if (closeBtn) closeBtn.closest('button')?.click() || closeBtn.click();
            
            // Save to chrome.storage (persistent)
            if (postId && !commentedPosts.includes(postId)) {
              chrome.storage.local.get('ig_commented_posts', data => {
                const posts = data.ig_commented_posts || [];
                if (!posts.includes(postId)) {
                  posts.push(postId);
                  chrome.storage.local.set({ ig_commented_posts: posts.slice(-500) });
                }
              });
            }
            
            sendResponse({ 
              success: false, 
              error: 'Ya comentaste en este post anteriormente',
              skipped: true,
              reason: 'already_commented'
            });
            return;
          }
        } else {
          logger.warn('No se pudo detectar tu username, continuando sin verificar...');
        }
        
        logger.success('No hay comentarios previos detectados, continuando...');
        
        // Extract caption for AI context
        logger.step(3, 'Extrayendo caption del post');
        
        const captionSelectors = ['h1', 'article span[dir="auto"]', 'div[role="dialog"] h1', 'div[role="dialog"] span[dir="auto"]'];
        let postContent = '';
        for (const sel of captionSelectors) {
          const el = document.querySelector(sel);
          if (el?.textContent?.length > 20) { 
            postContent = el.textContent; 
            logger.debug('Caption encontrada con:', sel);
            break; 
          }
        }
        
        const postUrl = window.location.href;
        logger.info('Caption:', postContent.substring(0, 80) + '...');
        
        // Generate AI comment
        logger.step(4, 'Generando comentario con IA');
        
        const aiConfig = message.aiConfig;
        let comentario = '';
        
        if (aiConfig?.apiKey) {
          const prompt = `Genera un comentario corto, genuino y relevante (máximo 2 oraciones) para este post de Instagram.
En español, natural, aporta valor. No uses emojis excesivos.
${aiConfig.expertise ? `Tu expertise: ${aiConfig.expertise}` : ''}
${message.personNotes ? `Contexto: ${message.personNotes}` : ''}

Contenido: ${postContent.substring(0, 500)}

Responde SOLO con el comentario.`;

          try {
            logger.debug('Llamando API:', aiConfig.provider);
            
            const apiUrl = aiConfig.provider === 'anthropic'
              ? 'https://api.anthropic.com/v1/messages'
              : 'https://api.openai.com/v1/chat/completions';
            
            const headers = aiConfig.provider === 'anthropic'
              ? { 'Content-Type': 'application/json', 'x-api-key': aiConfig.apiKey, 'anthropic-version': '2023-06-01' }
              : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiConfig.apiKey}` };
            
            const body = aiConfig.provider === 'anthropic'
              ? { model: 'claude-3-haiku-20240307', max_tokens: 150, messages: [{ role: 'user', content: prompt }] }
              : { model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 150 };
            
            const response = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) });
            
            if (!response.ok) {
              const errorText = await response.text();
              logger.error('API error:', { status: response.status, body: errorText.substring(0, 200) });
              throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            comentario = aiConfig.provider === 'anthropic'
              ? data.content?.[0]?.text || ''
              : data.choices?.[0]?.message?.content || '';
            
            comentario = comentario.trim().replace(/^["']|["']$/g, '');
            logger.success('Comentario generado:', comentario.substring(0, 50) + '...');
            
          } catch (aiError) {
            logger.error('Error de IA:', aiError.message);
            comentario = '¡Excelente contenido! 👏';
            logger.info('Usando comentario fallback');
          }
        } else {
          logger.warn('No hay API key configurada, usando comentario genérico');
          comentario = '¡Muy interesante! Gracias por compartir 🙌';
        }
        
        // Post the comment with retry
        logger.step(5, 'Publicando comentario');
        
        const result = await retry(
          () => postComment(comentario),
          { maxAttempts: 2, initialDelay: 2000, actionName: 'postComment' }
        );
        
        // Save post as commented in chrome.storage (PERSISTENT)
        if (result.success || result.verified) {
          try {
            const postIdMatch = postUrl.match(/\/(p|reel)\/([^\/\?]+)/);
            const postIdToSave = postIdMatch?.[2];
            
            if (postIdToSave) {
              chrome.storage.local.get('ig_commented_posts', data => {
                const posts = data.ig_commented_posts || [];
                if (!posts.includes(postIdToSave)) {
                  posts.push(postIdToSave);
                  // Keep only last 500 posts
                  const trimmed = posts.slice(-500);
                  chrome.storage.local.set({ ig_commented_posts: trimmed });
                  logger.debug('Post guardado como comentado:', postIdToSave);
                }
              });
            }
          } catch (e) {
            logger.warn('Error guardando post comentado:', e.message);
          }
        }
        
        // Report result
        if (result.verified) {
          logger.success('🎉 COMENTARIO VERIFICADO Y PUBLICADO');
          sendResponse({ success: true, comment: comentario, postUrl, verified: true });
        } else if (result.success) {
          logger.warn('Comentario enviado pero no verificado');
          sendResponse({ success: true, comment: comentario, postUrl, verified: false });
        } else {
          logger.error('El comentario no se publicó');
          sendResponse({ success: false, error: 'El comentario no se publicó correctamente' });
        }
        
      } catch (error) {
        logger.error('FIND_AND_COMMENT falló:', error.message);
        logger.debug('Stack:', error.stack?.substring(0, 200));
        
        // Provide context in error
        sendResponse({ 
          success: false, 
          error: error.message,
          logs: window._igExtLogs?.slice(-20) // Send last 20 logs for debugging
        });
      }
    })();
    return true;
  }
  
  // ── POST_COMMENT (direct comment) ──
  if (message.action === 'POST_COMMENT' || message.action === 'POST_COMMENT_IG') {
    (async () => {
      try {
        const result = await postComment(message.comment || message.text);
        sendResponse({ success: true, result });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
  
  // ── LIKE_POST_IG ──
  if (message.action === 'LIKE_POST_IG') {
    (async () => {
      try {
        const result = await likePost();
        sendResponse({ success: true, result });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
  
  // ── SCRAPE_LAST_POST_IG ──
  if (message.action === 'SCRAPE_LAST_POST_IG') {
    (async () => {
      try {
        // Navigate to profile if needed
        if (!window.location.pathname.includes(`/${message.username}`)) {
          window.location.href = `https://www.instagram.com/${message.username}/`;
          await waitForSelector('article', 10000);
        }
        await wait(2000);
        
        const firstPost = document.querySelector('article a[href*="/p/"]');
        if (!firstPost) throw new Error('No posts found');
        
        const postUrl = firstPost.href;
        window.location.href = postUrl;
        await waitForSelector('article', 10000);
        await wait(2000);
        
        const data = await extractPostData();
        sendResponse({ success: true, data: { url: postUrl, username: message.username, platform: 'instagram', ...data } });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
 // ── SEND_DM (Instagram Direct Message) - VIA INBOX ──
  if (message.action === 'SEND_DM') {
    (async () => {
      try {
        logger.step(1, 'Iniciando flujo de envío DM simulando humano');

        // 1. Verificar si estamos en el Inbox
        if (!window.location.pathname.includes('/direct/inbox')) {
          logger.info('Navegando al inbox...');
          window.location.href = 'https://www.instagram.com/direct/inbox/';
          await wait(5000); // Esperar que cargue React
        } else {
          await wait(2000);
        }

        // 2. Buscar y clickear botón "Nuevo Mensaje"
        logger.step(2, 'Buscando ícono de Nuevo Mensaje');
        const newMsgIcon = document.querySelector('svg[aria-label="Nuevo mensaje"], svg[aria-label="New message"], svg[aria-label*="Redactar"]');
        if (!newMsgIcon) throw new Error('No se encontró el ícono de Nuevo Mensaje. ¿Estás en /direct/inbox/?');

        const newMsgBtn = newMsgIcon.closest('div[role="button"], button') || newMsgIcon.parentElement;
        newMsgBtn.click();
        await wait(2500);

        // 3. Buscar input "Para:" y escribir usuario
        logger.step(3, `Buscando buscador y escribiendo username: ${message.username}`);
        let modal = document.querySelector('div[role="dialog"]');
        if (!modal) throw new Error('El modal de nuevo mensaje no se abrió.');

        const searchInput = modal.querySelector('input[name="queryBox"], input[placeholder*="Busca"], input[placeholder*="Search"]');
        if (!searchInput) throw new Error('No se encontró el input buscador en el modal');

        searchInput.focus();
        await wait(500);
        setNativeValue(searchInput, message.username);

        await wait(3500); // Esperar que Instagram traiga los resultados

        // 4. Seleccionar el usuario de la lista
        logger.step(4, 'Seleccionando usuario de la lista');
        modal = document.querySelector('div[role="dialog"]'); // Re-query just in case
        const userRows = modal.querySelectorAll('div[role="button"], div[role="option"], div[role="listitem"], [tabindex="0"]');
        let userFound = false;

        const usernameToFind = message.username.toLowerCase().replace('@', '');

        for (const row of userRows) {
          const rowText = row.textContent.toLowerCase();
          if (rowText.includes(usernameToFind) && rowText.length < 200) {
            // Buscamos si tiene el círculo de checkbox adentro
            const circle = row.querySelector('circle') || row.querySelector('input[type="checkbox"]');
            if (circle) {
              const clickTarget = circle.closest('div[role="button"]') || circle.closest('label') || row;
              clickTarget.click();
            } else {
              row.click();
            }
            userFound = true;
            logger.success(`Usuario @${usernameToFind} tildado exitosamente.`);
            break;
          }
        }

        if (!userFound) throw new Error(`No se encontró a ${message.username} en los resultados. Verificá que exista.`);
        await wait(1500);

        // 5. Click en "Chat" / "Siguiente"
        logger.step(5, 'Clickeando botón Chat');
        let chatBtn = null;
        const dialogButtons = modal.querySelectorAll('button, div[role="button"]');

        for (const btn of dialogButtons) {
          const text = btn.textContent?.toLowerCase().trim();
          if (text === 'chat' || text === 'siguiente' || text === 'next') {
            chatBtn = btn;
            break;
          }
        }

        if (!chatBtn) throw new Error('No se encontró el botón Chat/Siguiente');
        chatBtn.click();
        await wait(4000); // Dar tiempo para abrir el thread

        // 6. Escribir el mensaje
        logger.step(6, 'Escribiendo el mensaje en el chat');
        const msgInputSelectors = [
          'div[contenteditable="true"][role="textbox"]',
          'div[aria-label*="mensaje" i][contenteditable="true"]',
          'textarea[placeholder*="mensaje" i]'
        ];

        let msgInput = null;
        for (const sel of msgInputSelectors) {
          msgInput = document.querySelector(sel);
          if (msgInput) break;
        }

        if (!msgInput) throw new Error('No se encontró la caja de texto del chat');

        msgInput.focus();
        await wait(500);
        setNativeValue(msgInput, message.message);
        await wait(1500);

        // 7. Click Enviar / Enter
        logger.step(7, 'Enviando el mensaje');
        const sendBtn = document.querySelector('button[type="submit"], div[role="button"] svg[aria-label*="Enviar"], div[role="button"] svg[aria-label*="Send"]');

        if (sendBtn) {
            const finalBtn = sendBtn.closest('button') || sendBtn.closest('div[role="button"]') || sendBtn;
            finalBtn.click();
        } else {
            msgInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        }

        await wait(2000);
        logger.success('✅ MENSAJE ENVIADO');
        sendResponse({ success: true, verified: true });

      } catch (e) {
        logger.error('SEND_DM falló:', e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }  
  // ── EXTRACT_FOLLOWERS ──
  if (message.action === 'EXTRACT_FOLLOWERS') {
    (async () => {
      try {
        console.log('👥 Extracting followers...');
        const max = message.max || 50;
        
        // Check if modal is already open, if not try to open it
        let dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) {
          console.log('📂 Modal not open, trying to click followers link...');
          const opened = await openFollowersModal();
          if (!opened) throw new Error('No se pudo abrir el modal de seguidores. Hacé click en "Seguidores" manualmente.');
          await wait(2000);
        }
        
        const users = await scrollAndExtractUsers(max);
        console.log(`✅ Extracted ${users.length} followers`);
        
        // Send to dashboard
        chrome.runtime.sendMessage({
          action: 'IG_FOLLOWERS_IMPORTED',
          users,
          targetList: message.targetList
        });
        
        sendResponse({ success: true, count: users.length });
      } catch (e) {
        console.error('❌ Error:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
  
  // ── EXTRACT_POST_ENGAGERS / EXTRACT_POST_INTERACTIONS ──
  if (message.action === 'EXTRACT_POST_ENGAGERS' || message.action === 'EXTRACT_POST_INTERACTIONS') {
    (async () => {
      try {
        logger.step(1, 'Extrayendo engagers del post');
        const users = new Map();
        const type = message.type || message.extractType || 'likers';
        
        // Check if we're on a post page
        const isPostPage = window.location.pathname.includes('/p/') || window.location.pathname.includes('/reel/');
        const isInModal = !!document.querySelector('div[role="dialog"] article');
        
        logger.debug('Ubicación:', { isPostPage, isInModal, pathname: window.location.pathname });
        
        if (!isPostPage && !isInModal) {
          logger.error('No estás en un post');
          throw new Error('Abrí un post primero (URL /p/xxx o modal desde el perfil)');
        }
        
        await wait(2000);
        
        // Extract likers with ROBUST FALLBACK SYSTEM
        if (type === 'likers' || type === 'both') {
          logger.step(2, 'Buscando sección de likes (sistema de fallbacks)');
          
          let likesButton = null;
          let attemptCount = 0;
          const maxAttempts = 3;
          
          while (!likesButton && attemptCount < maxAttempts) {
            attemptCount++;
            logger.debug(`Intento ${attemptCount}/${maxAttempts}`);
            
            // ═══════════════════════════════════════════════════════════
            // FALLBACK 1: Selector exacto del usuario (Feb 2026)
            // <span class="x1ypdohk..." role="button" tabindex="0">17</span>
            // ═══════════════════════════════════════════════════════════
            if (!likesButton) {
              const likesSpans = document.querySelectorAll('span[role="button"][tabindex="0"]');
              for (const span of likesSpans) {
                const text = span.textContent?.trim();
                // Solo números (likes count)
                if (text && /^\d+$/.test(text)) {
                  logger.success(`FALLBACK 1: Encontrado span con ${text} likes`);
                  likesButton = span;
                  break;
                }
              }
            }
            
            // ═══════════════════════════════════════════════════════════
            // FALLBACK 2: Link directo a /liked_by/
            // ═══════════════════════════════════════════════════════════
            if (!likesButton) {
              likesButton = document.querySelector('a[href*="/liked_by/"]');
              if (likesButton) logger.success('FALLBACK 2: Link /liked_by/ encontrado');
            }
            
            // ═══════════════════════════════════════════════════════════
            // FALLBACK 3: Texto "Les gusta a" o "X personas más"
            // ═══════════════════════════════════════════════════════════
            if (!likesButton) {
              const allSpans = document.querySelectorAll('span, a');
              for (const el of allSpans) {
                const text = el.textContent?.toLowerCase() || '';
                if ((text.includes('les gusta a') || text.includes('personas más') || text.includes('others')) && 
                    text.length < 100) {
                  const clickable = el.closest('a') || el.closest('span[role="button"]') || el.closest('button');
                  if (clickable) {
                    likesButton = clickable;
                    logger.success('FALLBACK 3: Texto "les gusta" encontrado');
                    break;
                  }
                }
              }
            }
            
            // ═══════════════════════════════════════════════════════════
            // FALLBACK 4: Buscar cerca del corazón (icono de like)
            // ═══════════════════════════════════════════════════════════
            if (!likesButton) {
              const heartIcons = document.querySelectorAll('svg[aria-label*="gusta"], svg[aria-label*="like"], svg[aria-label*="Me gusta"]');
              for (const heart of heartIcons) {
                const section = heart.closest('section');
                if (section) {
                  // Buscar el span/link con número cerca del corazón
                  const nearbySpans = section.querySelectorAll('span[role="button"], a, span[tabindex]');
                  for (const span of nearbySpans) {
                    const text = span.textContent?.trim();
                    if (text && (/^\d+$/.test(text) || text.includes('gusta') || text.includes('like'))) {
                      likesButton = span;
                      logger.success('FALLBACK 4: Encontrado cerca del corazón');
                      break;
                    }
                  }
                }
                if (likesButton) break;
              }
            }
            
            // ═══════════════════════════════════════════════════════════
            // FALLBACK 5: Cualquier span clickeable con número en section
            // ═══════════════════════════════════════════════════════════
            if (!likesButton) {
              const sections = document.querySelectorAll('section');
              for (const section of sections) {
                const spans = section.querySelectorAll('span[tabindex], span[role="button"], button');
                for (const span of spans) {
                  const text = span.textContent?.trim();
                  if (text && /^\d+$/.test(text) && parseInt(text) > 0) {
                    likesButton = span;
                    logger.success(`FALLBACK 5: Span con número ${text} en section`);
                    break;
                  }
                }
                if (likesButton) break;
              }
            }
            
            // Si no encontramos nada, esperar y reintentar
            if (!likesButton && attemptCount < maxAttempts) {
              logger.warn(`No se encontró botón de likes, esperando y reintentando...`);
              await wait(2000);
              
              // En el último intento antes de fallar, intentar refresh suave
              if (attemptCount === maxAttempts - 1) {
                logger.debug('Intentando scroll para forzar render...');
                window.scrollBy(0, 100);
                await wait(500);
                window.scrollBy(0, -100);
                await wait(1500);
              }
            }
          }
          
          if (!likesButton) {
            logger.error('No se encontró botón de likes después de todos los intentos');
            logger.debug('HTML de sections:', Array.from(document.querySelectorAll('section')).map(s => s.innerHTML.substring(0, 200)));
            throw new Error('No se encontró el botón de likes. Verificá que el post tenga likes visibles.');
          }
          
          // Click en el botón encontrado
          logger.step(3, 'Abriendo modal de likes');
          likesButton.click();
          
          // Esperar que se abra el modal con retry
          let modalOpened = false;
          for (let i = 0; i < 5; i++) {
            await wait(1000);
            const dialog = document.querySelector('div[role="dialog"]');
            if (dialog && dialog.textContent?.length > 50) {
              modalOpened = true;
              logger.success('Modal de likes abierto');
              break;
            }
            logger.debug(`Esperando modal... intento ${i + 1}/5`);
          }
          
          if (!modalOpened) {
            // Intentar click de nuevo
            logger.warn('Modal no se abrió, reintentando click...');
            likesButton.click();
            await wait(2000);
            
            const dialog = document.querySelector('div[role="dialog"]');
            if (!dialog) {
              throw new Error('El modal de likes no se abrió. Intentá refrescar la página (F5) y volver a extraer.');
            }
          }
          
          // Extraer usuarios del modal
          logger.step(4, 'Extrayendo usuarios del modal');
          const extracted = await scrollAndExtractUsers(200);
          extracted.forEach(u => users.set(u.username, { ...u, type: 'liker' }));
          
          logger.success(`Extraídos ${users.size} likers`);
          
          closeModal();
          await wait(1000);
        }
        
        // Extract commenters
        if (type === 'commenters' || type === 'both') {
          logger.step(5, 'Extrayendo comentadores');
          await wait(1000);
          const commentLinks = document.querySelectorAll('article a[href^="/"][role="link"], div[role="dialog"] a[href^="/"][role="link"]');
          for (const link of commentLinks) {
            const username = link.getAttribute('href')?.replace(/\//g, '');
            if (username && username.length > 1 && !['p', 'reel', 'explore', 'liked_by'].includes(username) && !users.has(username)) {
              users.set(username, { username, nombre: username, type: 'commenter' });
            }
          }
          logger.success(`Total con comentadores: ${users.size}`);
        }
        
        const result = Array.from(users.values());
        logger.success(`✅ Extracción completa: ${result.length} usuarios`);
        
        if (result.length === 0) {
          throw new Error('No se encontraron usuarios. ¿El post tiene likes/comentarios?');
        }
        
        chrome.runtime.sendMessage({
          action: 'IG_POST_USERS_IMPORTED',
          users: result,
          targetList: message.targetList,
          platform: message.platform || 'instagram',
          postUrl: window.location.href
        });
        
        sendResponse({ success: true, count: result.length, users: result });
      } catch (e) {
        logger.error('Extracción falló:', e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
  
  return true;
});

console.log('✅ Instagram Content Script v2.1 loaded');
