// Anti-Ban & Delay Manager
// Maneja todos los delays y límites para evitar bans

class DelayManager {
  constructor() {
    this.config = null;
    this.dailyCounters = null;
    this.loadConfig();
  }

  async loadConfig() {
    const result = await chrome.storage.local.get(['antibanConfig', 'dailyCounters']);
    
    // Config por defecto
    this.config = result.antibanConfig || {
      delays: {
        betweenComments: { min: 30, max: 90 },
        betweenLikes: { min: 10, max: 30 },
        betweenFollows: { min: 20, max: 60 },
        afterLogin: { min: 5, max: 10 },
        betweenPageLoads: { min: 2, max: 5 }
      },
      dailyLimits: {
        instagram: {
          comments: 20,
          likes: 100,
          follows: 50,
          dms: 30
        },
        linkedin: {
          comments: 15,
          likes: 50,
          follows: 30,
          messages: 20
        }
      },
      activeHours: {
        enabled: true,
        start: '09:00',
        end: '21:00',
        timezone: 'America/Argentina/Buenos_Aires'
      },
      breaks: {
        enabled: true,
        lunch: { start: '12:00', end: '14:00' },
        evening: { start: '18:00', duration: 30 }
      },
      randomization: {
        enabled: true,
        variability: 0.3
      }
    };
    
    // Contadores diarios
    this.dailyCounters = result.dailyCounters || this.getEmptyCounters();
    
    // Reset diario si cambió el día
    const today = new Date().toDateString();
    if (this.dailyCounters.date !== today) {
      this.dailyCounters = this.getEmptyCounters();
      this.dailyCounters.date = today;
      await this.saveCounters();
    }
  }

  getEmptyCounters() {
    return {
      date: new Date().toDateString(),
      instagram: {
        comments: 0,
        likes: 0,
        follows: 0,
        dms: 0
      },
      linkedin: {
        comments: 0,
        likes: 0,
        follows: 0,
        messages: 0
      }
    };
  }

  async saveCounters() {
    await chrome.storage.local.set({ dailyCounters: this.dailyCounters });
  }

  // Obtener delay aleatorio
  getDelay(action) {
    const delayConfig = this.config.delays[action];
    if (!delayConfig) {
      console.warn(`No delay config for action: ${action}`);
      return 2000; // Default 2 segundos
    }
    
    const min = delayConfig.min * 1000; // Convertir a ms
    const max = delayConfig.max * 1000;
    
    let delay = Math.random() * (max - min) + min;
    
    // Aplicar randomización adicional si está habilitado
    if (this.config.randomization.enabled) {
      const variability = this.config.randomization.variability;
      const randomFactor = 1 + (Math.random() * 2 - 1) * variability; // ±30%
      delay *= randomFactor;
    }
    
    return Math.round(delay);
  }

  // Esperar con delay aleatorio
  async wait(action) {
    const delay = this.getDelay(action);
    console.log(`⏱️ Esperando ${(delay/1000).toFixed(1)}s antes de ${action}...`);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  // Verificar si podemos ejecutar una acción
  async canPerformAction(platform, action) {
    await this.loadConfig(); // Reload por si cambió
    
    // 1. Verificar horario permitido
    if (!this.isWithinActiveHours()) {
      return { allowed: false, reason: 'Fuera de horario permitido' };
    }
    
    // 2. Verificar pausas
    if (this.isInBreak()) {
      return { allowed: false, reason: 'En pausa obligatoria' };
    }
    
    // 3. Verificar límites diarios
    const limit = this.config.dailyLimits[platform]?.[action];
    const count = this.dailyCounters[platform]?.[action];
    
    if (limit && count >= limit) {
      return { 
        allowed: false, 
        reason: `Límite diario alcanzado (${count}/${limit})`
      };
    }
    
    return { allowed: true };
  }

  // Incrementar contador de acción
  async incrementAction(platform, action) {
    await this.loadConfig();
    
    if (!this.dailyCounters[platform]) {
      this.dailyCounters[platform] = {};
    }
    
    if (!this.dailyCounters[platform][action]) {
      this.dailyCounters[platform][action] = 0;
    }
    
    this.dailyCounters[platform][action]++;
    await this.saveCounters();
    
    console.log(`📊 ${platform} ${action}: ${this.dailyCounters[platform][action]}/${this.config.dailyLimits[platform][action]}`);
  }

  // Verificar si estamos en horario permitido
  isWithinActiveHours() {
    if (!this.config.activeHours.enabled) {
      return true;
    }
    
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit'
    });
    
    const start = this.config.activeHours.start;
    const end = this.config.activeHours.end;
    
    return currentTime >= start && currentTime <= end;
  }

  // Verificar si estamos en pausa
  isInBreak() {
    if (!this.config.breaks.enabled) {
      return false;
    }
    
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit'
    });
    
    // Verificar almuerzo
    if (this.config.breaks.lunch) {
      const lunchStart = this.config.breaks.lunch.start;
      const lunchEnd = this.config.breaks.lunch.end;
      if (currentTime >= lunchStart && currentTime <= lunchEnd) {
        return true;
      }
    }
    
    // Verificar pausa tarde
    if (this.config.breaks.evening) {
      const eveningStart = this.config.breaks.evening.start;
      const eveningDuration = this.config.breaks.evening.duration;
      
      // Calcular fin de pausa
      const [hour, min] = eveningStart.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(hour);
      endDate.setMinutes(min + eveningDuration);
      const eveningEnd = endDate.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit'
      });
      
      if (currentTime >= eveningStart && currentTime <= eveningEnd) {
        return true;
      }
    }
    
    return false;
  }

  // Obtener stats del día
  async getDailyStats() {
    await this.loadConfig();
    
    const stats = {};
    
    for (const platform in this.config.dailyLimits) {
      stats[platform] = {};
      
      for (const action in this.config.dailyLimits[platform]) {
        const limit = this.config.dailyLimits[platform][action];
        const count = this.dailyCounters[platform]?.[action] || 0;
        const percentage = Math.round((count / limit) * 100);
        
        stats[platform][action] = {
          count,
          limit,
          percentage,
          remaining: limit - count
        };
      }
    }
    
    return stats;
  }

  // Reset manual de contadores (para testing)
  async resetCounters() {
    this.dailyCounters = this.getEmptyCounters();
    this.dailyCounters.date = new Date().toDateString();
    await this.saveCounters();
    console.log('🔄 Contadores reseteados');
  }
}

// Exportar instancia singleton
const delayManager = new DelayManager();

// Para usar en content scripts
if (typeof window !== 'undefined') {
  window.delayManager = delayManager;
}

// Para usar en background
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Ya está disponible globalmente
}
