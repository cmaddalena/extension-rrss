// ═══════════════════════════════════════════════════════════════════════
// BACKGROUND SERVICE WORKER - Automation Engine
// ═══════════════════════════════════════════════════════════════════════

console.log('🤖 Background Worker iniciado');

// State management
const analysisQueue = [];
let currentAnalysis = null;

// Persistent analysis state
let analysisState = {
  active: false,
  platform: null,
  username: null,
  total: 0,
  current: 0,
  status: '',
  startedAt: null
};

// ═════════════════════════════════════════════════════════════════
// GET ANALYSIS STATE (para que el popup lo pida)
// ═════════════════════════════════════════════════════════════════

function getAnalysisState() {
  return { ...analysisState };
}

// ═════════════════════════════════════════════════════════════════
// MESSAGE LISTENER
// ═════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Mensaje recibido en background:', message.action);
  
  if (message.action === 'GET_ANALYSIS_STATE') {
    sendResponse(getAnalysisState());
    return true;
  }
  
  if (message.action === 'START_ANALYSIS') {
    startAutomatedAnalysis(message.platform, message.username, message.postCount);
    sendResponse({ success: true });
  }
  
  if (message.action === 'ANALYSIS_COMPLETE_FROM_CONTENT') {
    handleAnalysisComplete(message);
    sendResponse({ success: true });
  }
  
  if (message.action === 'ANALYSIS_ERROR_FROM_CONTENT') {
    handleAnalysisError(message);
    sendResponse({ success: true });
  }
  
  if (message.action === 'ANALYSIS_PROGRESS_FROM_CONTENT') {
    updateAnalysisState(message);
    
    // Reenviar al popup
    chrome.runtime.sendMessage({
      action: 'ANALYSIS_PROGRESS',
      platform: message.platform,
      current: message.current,
      total: message.total,
      status: message.status
    }).catch(() => {
      console.log('Popup cerrado, estado guardado en background');
    });
    
    sendResponse({ success: true });
  }
  
  return true;
});

// ═════════════════════════════════════════════════════════════════
// AUTOMATED ANALYSIS
// ═════════════════════════════════════════════════════════════════

async function startAutomatedAnalysis(platform, username, postCount) {
  console.log(`🚀 Iniciando análisis automático: ${platform}/${username} - ${postCount} posts`);
  
  // Actualizar estado
  analysisState = {
    active: true,
    platform,
    username,
    total: postCount,
    current: 0,
    status: '🔍 Abriendo perfil...',
    startedAt: Date.now()
  };
  
  currentAnalysis = { platform, username, postCount };
  
  try {
    let url;
    
    if (platform === 'instagram') {
      // Instagram: Abrir perfil
      url = `https://www.instagram.com/${username}/`;
    } else if (platform === 'linkedin') {
      // LinkedIn: Ir directo a recent activity
      url = `https://www.linkedin.com/in/${username}/recent-activity/all/`;
    }
    
    // Crear pestaña en background
    const tab = await chrome.tabs.create({
      url: url,
      active: false // No mostrar la pestaña
    });
    
    console.log(`✅ Pestaña creada: ${tab.id}`);
    
    // Esperar que cargue
    await waitForTabLoad(tab.id);
    
    // Instagram necesita abrir el primer post
    if (platform === 'instagram') {
      analysisState.status = '📸 Abriendo primer post...';
      await openFirstPost(tab.id);
    }
    
    analysisState.status = '📊 Analizando posts...';
    
    // Iniciar análisis en content script
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'START_ANALYSIS',
        platform,
        username,
        postCount
      });
      console.log('✅ Mensaje START_ANALYSIS enviado');
    } catch (msgError) {
      console.error('⚠️ Error enviando mensaje (puede que la pestaña se haya cerrado):', msgError);
      throw new Error('No se pudo comunicar con la pestaña');
    }
    
  } catch (error) {
    console.error('❌ Error en análisis automático:', error);
    
    // Reset estado
    analysisState.active = false;
    
    // Notificar error al popup (con try-catch porque el popup puede estar cerrado)
    chrome.runtime.sendMessage({
      action: 'ANALYSIS_ERROR',
      platform,
      username,
      error: error.message
    }).catch(() => console.log('⚠️ Popup cerrado, no se pudo notificar error'));
  }
}

// ═════════════════════════════════════════════════════════════════
// INSTAGRAM: OPEN FIRST POST
// ═════════════════════════════════════════════════════════════════

async function openFirstPost(tabId) {
  console.log('📸 Instagram: Abriendo primer post...');
  
  // Esperar que cargue el perfil completamente
  await sleep(4000);
  
  // Intentar múltiples selectores
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      console.log('🔍 Buscando primer post...');
      
      // Intentar diferentes selectores
      const selectors = [
        'article a[href*="/p/"]',  // Posts normales
        'article a[href*="/reel/"]', // Reels
        'a[href*="/p/"]',  // Fallback genérico
        'div._aagw a' // Grid de posts
      ];
      
      for (const selector of selectors) {
        const firstPost = document.querySelector(selector);
        if (firstPost) {
          console.log(`✅ Post encontrado con selector: ${selector}`);
          console.log('URL del post:', firstPost.href);
          
          // Clickear
          firstPost.click();
          
          return { 
            success: true, 
            url: firstPost.href,
            selector: selector
          };
        }
      }
      
      console.error('❌ No se encontró ningún post');
      return { success: false, error: 'No se encontró el primer post' };
    }
  });
  
  console.log('Resultado de apertura:', result[0].result);
  
  if (!result[0].result.success) {
    throw new Error(result[0].result.error || 'No se pudo abrir el primer post');
  }
  
  // Esperar que abra el modal
  await sleep(3000);
}

// ═════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═════════════════════════════════════════════════════════════════
// UPDATE ANALYSIS STATE
// ═════════════════════════════════════════════════════════════════

function updateAnalysisState(message) {
  if (analysisState.active) {
    analysisState.current = message.current;
    analysisState.status = message.status || '📊 Analizando...';
  }
}

// ═════════════════════════════════════════════════════════════════
// HANDLE COMPLETION
// ═════════════════════════════════════════════════════════════════

async function handleAnalysisComplete(message) {
  console.log('✅ Análisis completado:', message);
  
  // Reset estado
  analysisState.active = false;
  analysisState.status = '✅ Completado';
  
  // Guardar análisis con StorageManager (importar desde shared/storage.js)
  try {
    // Como no podemos importar en service worker fácilmente, 
    // replicamos la lógica de guardar aquí
    const timestamp = Date.now();
    const analysisId = `${message.platform}_${message.username}_${timestamp}`;
    
    const analysis = {
      id: analysisId,
      username: message.username,
      platform: message.platform,
      analyzedAt: new Date().toISOString(),
      timestamp,
      posts: message.posts || [],
      stats: message.stats || {}
    };
    
    // Guardar análisis
    await chrome.storage.local.set({ [analysisId]: analysis });
    
    // Actualizar lista de análisis del usuario
    const listKey = `analyses_list_${message.platform}_${message.username}`;
    const result = await chrome.storage.local.get(listKey);
    const list = result[listKey] || [];
    list.unshift(analysisId);
    await chrome.storage.local.set({ [listKey]: list.slice(0, 20) });
    
    // Actualizar competidor
    const competitorsKey = `competitors_${message.platform}`;
    const compResult = await chrome.storage.local.get(competitorsKey);
    const competitors = compResult[competitorsKey] || [];
    
    const compIndex = competitors.findIndex(c => c.username === message.username);
    if (compIndex !== -1) {
      competitors[compIndex] = {
        ...competitors[compIndex],
        lastAnalyzed: new Date().toISOString(),
        postCount: message.posts?.length || 0,
        avgLikes: message.stats?.avgLikes || 0,
        avgComments: message.stats?.avgComments || 0,
        analysisCount: (competitors[compIndex].analysisCount || 0) + 1
      };
      await chrome.storage.local.set({ [competitorsKey]: competitors });
    }
    
    // CALCULAR Y GUARDAR MÉTRICAS GLOBALES
    await updateGlobalMetrics(message.platform);
    
    console.log('✅ Datos guardados correctamente');
  } catch (error) {
    console.error('❌ Error guardando datos:', error);
  }
  
  // Cerrar la pestaña
  if (message.tabId) {
    try {
      await chrome.tabs.remove(message.tabId);
      console.log('✅ Pestaña cerrada');
    } catch (e) {
      console.log('⚠️ No se pudo cerrar la pestaña');
    }
  }
  
  // Notificar al popup
  chrome.runtime.sendMessage({
    action: 'ANALYSIS_COMPLETE',
    platform: message.platform,
    username: message.username,
    postCount: message.postCount
  }).catch(() => console.log('Popup cerrado'));
  
  // Mostrar notificación desktop
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../assets/icon128.png',
    title: 'Análisis Completado',
    message: `✅ @${message.username}: ${message.postCount} posts analizados`
  });
  
  currentAnalysis = null;
}

// ═════════════════════════════════════════════════════════════════
// UPDATE GLOBAL METRICS
// ═════════════════════════════════════════════════════════════════

async function updateGlobalMetrics(platform) {
  console.log('📊 Calculando métricas globales para', platform);
  
  try {
    // Obtener todos los competidores
    const competitorsKey = `competitors_${platform}`;
    const compResult = await chrome.storage.local.get(competitorsKey);
    const competitors = compResult[competitorsKey] || [];
    
    console.log(`🔍 Competidores encontrados: ${competitors.length}`, competitors);
    
    if (competitors.length === 0) {
      console.log('⚠️ No hay competidores, no se calculan métricas');
      return;
    }
    
    // Variables para métricas
    let totalPosts = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let allPosts = [];
    const dayDistribution = new Array(7).fill(0);
    const hourDistribution = new Array(24).fill(0);
    
    // Procesar cada competidor
    for (const comp of competitors) {
      console.log(`🔍 Procesando competidor: ${comp.username}, analysisCount: ${comp.analysisCount}`);
      
      const listKey = `analyses_list_${platform}_${comp.username}`;
      const listResult = await chrome.storage.local.get(listKey);
      const analysisList = listResult[listKey] || [];
      
      console.log(`  📋 Análisis encontrados: ${analysisList.length}`);
      
      if (analysisList.length === 0) continue;
      
      // Obtener el análisis más reciente
      const latestId = analysisList[0];
      const analysisResult = await chrome.storage.local.get(latestId);
      const analysis = analysisResult[latestId];
      
      if (!analysis) continue;
      
      // Agregar posts
      const posts = analysis.posts || [];
      allPosts.push(...posts.map(p => ({ ...p, username: comp.username })));
      
      totalPosts += posts.length;
      totalLikes += analysis.stats?.totalLikes || 0;
      totalComments += analysis.stats?.totalComments || 0;
      
      // Distribución
      if (analysis.stats?.distribution) {
        analysis.stats.distribution.daily?.forEach((count, i) => {
          dayDistribution[i] += count;
        });
        analysis.stats.distribution.hourly?.forEach((count, i) => {
          hourDistribution[i] += count;
        });
      }
    }
    
    // Calcular promedios
    const avgLikes = totalPosts > 0 ? Math.round(totalLikes / totalPosts) : 0;
    const avgComments = totalPosts > 0 ? Math.round(totalComments / totalPosts) : 0;
    
    // Mejor día y hora
    const bestDayIndex = dayDistribution.indexOf(Math.max(...dayDistribution));
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const bestDay = days[bestDayIndex];
    const bestHour = hourDistribution.indexOf(Math.max(...hourDistribution));
    
    // Top 3 horarios
    const hourIndices = hourDistribution
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => h.hour);
    
    // Top post global
    const topPost = allPosts.length > 0
      ? allPosts.sort((a, b) => b.likes - a.likes)[0]
      : null;
    
    // Top competidor (mayor avg likes)
    const topCompetitor = competitors.length > 0
      ? competitors.sort((a, b) => (b.avgLikes || 0) - (a.avgLikes || 0))[0]?.username
      : null;
    
    // Guardar métricas globales
    const globalMetrics = {
      lastUpdated: new Date().toISOString(),
      totalCompetitors: competitors.filter(c => c.analysisCount > 0).length,
      totalPosts,
      totalLikes,
      totalComments,
      avgLikes,
      avgComments,
      bestDay,
      bestHour,
      topHours: hourIndices,
      topCompetitor,
      topPost,
      dayDistribution,
      hourDistribution
    };
    
    await chrome.storage.local.set({ [`global_metrics_${platform}`]: globalMetrics });
    
    console.log('✅ Métricas globales actualizadas:', globalMetrics);
  } catch (error) {
    console.error('❌ Error calculando métricas globales:', error);
  }
}

function handleAnalysisError(message) {
  console.error('❌ Error en análisis:', message);
  
  // Reset estado
  analysisState.active = false;
  analysisState.status = '❌ Error';
  
  // Cerrar pestaña si existe
  if (message.tabId) {
    chrome.tabs.remove(message.tabId).catch(() => {});
  }
  
  // Notificar al popup
  chrome.runtime.sendMessage({
    action: 'ANALYSIS_ERROR',
    platform: message.platform,
    username: message.username,
    error: message.error
  }).catch(() => console.log('Popup cerrado'));
  
  currentAnalysis = null;
}
