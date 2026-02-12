// ═══════════════════════════════════════════════════════════════════════
// STORAGE MANAGER - Gestión centralizada de datos
// ═══════════════════════════════════════════════════════════════════════

const StorageManager = {
  
  // ═════════════════════════════════════════════════════════════════
  // COMPETIDORES
  // ═════════════════════════════════════════════════════════════════
  
  async getCompetitors(platform) {
    const key = `competitors_${platform}`;
    const result = await chrome.storage.local.get(key);
    return result[key] || [];
  },
  
  async addCompetitor(platform, username) {
    const competitors = await this.getCompetitors(platform);
    
    if (competitors.some(c => c.username === username)) {
      return { success: false, error: 'Ya existe este competidor' };
    }
    
    competitors.push({
      username,
      platform,
      addedAt: new Date().toISOString(),
      lastAnalyzed: null,
      postCount: 0,
      avgLikes: 0,
      avgComments: 0,
      analysisCount: 0
    });
    
    await chrome.storage.local.set({ [`competitors_${platform}`]: competitors });
    return { success: true };
  },
  
  async removeCompetitor(platform, username) {
    const competitors = await this.getCompetitors(platform);
    const filtered = competitors.filter(c => c.username !== username);
    
    await chrome.storage.local.set({ [`competitors_${platform}`]: filtered });
    
    // Eliminar todos los análisis históricos
    await this.deleteAllAnalyses(platform, username);
    
    return { success: true };
  },
  
  async updateCompetitorStats(platform, username, stats) {
    const competitors = await this.getCompetitors(platform);
    const index = competitors.findIndex(c => c.username === username);
    
    if (index !== -1) {
      competitors[index] = {
        ...competitors[index],
        lastAnalyzed: new Date().toISOString(),
        postCount: stats.postCount || competitors[index].postCount,
        avgLikes: stats.avgLikes || competitors[index].avgLikes,
        avgComments: stats.avgComments || competitors[index].avgComments,
        analysisCount: (competitors[index].analysisCount || 0) + 1
      };
      
      await chrome.storage.local.set({ [`competitors_${platform}`]: competitors });
    }
  },
  
  // ═════════════════════════════════════════════════════════════════
  // ANÁLISIS HISTÓRICOS
  // ═════════════════════════════════════════════════════════════════
  
  async saveAnalysis(platform, username, posts, stats) {
    const timestamp = Date.now();
    const analysisId = `${platform}_${username}_${timestamp}`;
    
    const analysis = {
      id: analysisId,
      username,
      platform,
      analyzedAt: new Date().toISOString(),
      timestamp,
      posts,
      stats: {
        totalPosts: posts.length,
        totalLikes: stats.totalLikes || 0,
        totalComments: stats.totalComments || 0,
        avgLikes: stats.avgLikes || 0,
        avgComments: stats.avgComments || 0,
        topPost: stats.topPost || null,
        bestDay: stats.bestDay || null,
        bestHour: stats.bestHour || null,
        distribution: stats.distribution || {}
      }
    };
    
    // Guardar análisis individual
    await chrome.storage.local.set({ [analysisId]: analysis });
    
    // Actualizar lista de análisis del competidor
    await this.addToAnalysisList(platform, username, analysisId);
    
    // Actualizar stats del competidor
    await this.updateCompetitorStats(platform, username, {
      postCount: posts.length,
      avgLikes: stats.avgLikes,
      avgComments: stats.avgComments
    });
    
    // Actualizar métricas globales
    await this.updateGlobalMetrics(platform);
    
    return { success: true, analysisId };
  },
  
  async addToAnalysisList(platform, username, analysisId) {
    const listKey = `analyses_list_${platform}_${username}`;
    const result = await chrome.storage.local.get(listKey);
    const list = result[listKey] || [];
    
    list.unshift(analysisId); // Agregar al inicio (más reciente)
    
    // Limitar a últimos 20 análisis
    if (list.length > 20) {
      const removed = list.slice(20);
      // Eliminar análisis antiguos
      for (const id of removed) {
        await chrome.storage.local.remove(id);
      }
    }
    
    await chrome.storage.local.set({ [listKey]: list.slice(0, 20) });
  },
  
  async getAnalysisList(platform, username) {
    const listKey = `analyses_list_${platform}_${username}`;
    const result = await chrome.storage.local.get(listKey);
    const list = result[listKey] || [];
    
    // Obtener los análisis completos
    const analyses = [];
    for (const id of list) {
      const data = await chrome.storage.local.get(id);
      if (data[id]) {
        analyses.push(data[id]);
      }
    }
    
    return analyses;
  },
  
  async getAnalysisById(analysisId) {
    const result = await chrome.storage.local.get(analysisId);
    return result[analysisId] || null;
  },
  
  async deleteAnalysis(analysisId) {
    await chrome.storage.local.remove(analysisId);
  },
  
  async deleteAllAnalyses(platform, username) {
    const listKey = `analyses_list_${platform}_${username}`;
    const result = await chrome.storage.local.get(listKey);
    const list = result[listKey] || [];
    
    // Eliminar cada análisis
    for (const id of list) {
      await chrome.storage.local.remove(id);
    }
    
    // Eliminar la lista
    await chrome.storage.local.remove(listKey);
  },
  
  // ═════════════════════════════════════════════════════════════════
  // MÉTRICAS GLOBALES
  // ═════════════════════════════════════════════════════════════════
  
  async updateGlobalMetrics(platform) {
    const competitors = await this.getCompetitors(platform);
    
    if (competitors.length === 0) return;
    
    // Obtener todos los últimos análisis
    const allAnalyses = [];
    for (const competitor of competitors) {
      const analyses = await this.getAnalysisList(platform, competitor.username);
      if (analyses.length > 0) {
        allAnalyses.push(analyses[0]); // Solo el más reciente de cada uno
      }
    }
    
    if (allAnalyses.length === 0) return;
    
    // Calcular métricas agregadas
    let totalPosts = 0;
    let totalLikes = 0;
    let totalComments = 0;
    const dayDist = new Array(7).fill(0);
    const hourDist = new Array(24).fill(0);
    let topPost = null;
    let topCompetitor = null;
    let maxAvgLikes = 0;
    
    for (const analysis of allAnalyses) {
      totalPosts += analysis.stats.totalPosts;
      totalLikes += analysis.stats.totalLikes;
      totalComments += analysis.stats.totalComments;
      
      // Actualizar top post
      if (analysis.stats.topPost && 
          (!topPost || analysis.stats.topPost.likes > topPost.likes)) {
        topPost = {
          ...analysis.stats.topPost,
          username: analysis.username
        };
      }
      
      // Actualizar top competitor
      if (analysis.stats.avgLikes > maxAvgLikes) {
        maxAvgLikes = analysis.stats.avgLikes;
        topCompetitor = analysis.username;
      }
      
      // Agregar distribuciones
      if (analysis.stats.distribution && analysis.stats.distribution.daily) {
        analysis.stats.distribution.daily.forEach((count, day) => {
          dayDist[day] += count;
        });
      }
      
      if (analysis.stats.distribution && analysis.stats.distribution.hourly) {
        analysis.stats.distribution.hourly.forEach((count, hour) => {
          hourDist[hour] += count;
        });
      }
    }
    
    // Encontrar mejor día y hora
    const bestDayIndex = dayDist.indexOf(Math.max(...dayDist));
    const bestHourIndex = hourDist.indexOf(Math.max(...hourDist));
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    // Top 3 horas
    const topHours = hourDist
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => h.hour);
    
    const globalMetrics = {
      lastUpdated: new Date().toISOString(),
      totalCompetitors: competitors.length,
      totalPosts,
      avgLikes: totalPosts > 0 ? Math.round(totalLikes / totalPosts) : 0,
      avgComments: totalPosts > 0 ? Math.round(totalComments / totalPosts) : 0,
      bestDay: days[bestDayIndex],
      bestHour: bestHourIndex,
      topHours,
      topCompetitor,
      topPost,
      dayDistribution: dayDist,
      hourDistribution: hourDist
    };
    
    await chrome.storage.local.set({ [`global_metrics_${platform}`]: globalMetrics });
  },
  
  async getGlobalMetrics(platform) {
    const key = `global_metrics_${platform}`;
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }
};

// Export para usar en otros archivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
