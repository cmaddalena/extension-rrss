// ═════════════════════════════════════════════════════════════════
// ACCOUNT CONFIGURATION - ANTI-BAN
// ═════════════════════════════════════════════════════════════════

// Presets
const ACCOUNT_PRESETS = {
  'ultra-safe': {
    instagram: {
      daily: {
        comments: { max: 10, perHour: 3 },
        likes: { max: 50, perHour: 10 },
        follows: { max: 20, perHour: 5 },
        dms: { max: 15, perHour: 3 }
      },
      delays: {
        comments: { min: 40, max: 120 },
        likes: { min: 15, max: 45 },
        follows: { min: 30, max: 90 },
        dms: { min: 60, max: 180 }
      }
    },
    linkedin: {
      daily: {
        comments: { max: 8, perHour: 2 },
        likes: { max: 30, perHour: 6 },
        connections: { max: 15, perHour: 3 },
        messages: { max: 10, perHour: 2 }
      },
      delays: {
        comments: { min: 60, max: 150 },
        likes: { min: 20, max: 60 },
        connections: { min: 50, max: 120 },
        messages: { min: 70, max: 180 }
      }
    }
  },
  
  'conservative': {
    instagram: {
      daily: {
        comments: { max: 20, perHour: 5 },
        likes: { max: 100, perHour: 20 },
        follows: { max: 50, perHour: 10 },
        dms: { max: 30, perHour: 5 }
      },
      delays: {
        comments: { min: 30, max: 90 },
        likes: { min: 10, max: 30 },
        follows: { min: 20, max: 60 },
        dms: { min: 40, max: 120 }
      }
    },
    linkedin: {
      daily: {
        comments: { max: 15, perHour: 3 },
        likes: { max: 50, perHour: 10 },
        connections: { max: 30, perHour: 5 },
        messages: { max: 20, perHour: 4 }
      },
      delays: {
        comments: { min: 40, max: 100 },
        likes: { min: 15, max: 40 },
        connections: { min: 30, max: 90 },
        messages: { min: 50, max: 140 }
      }
    }
  },
  
  'moderate': {
    instagram: {
      daily: {
        comments: { max: 35, perHour: 8 },
        likes: { max: 200, perHour: 35 },
        follows: { max: 80, perHour: 15 },
        dms: { max: 50, perHour: 8 }
      },
      delays: {
        comments: { min: 25, max: 70 },
        likes: { min: 8, max: 25 },
        follows: { min: 15, max: 50 },
        dms: { min: 30, max: 90 }
      }
    },
    linkedin: {
      daily: {
        comments: { max: 25, perHour: 5 },
        likes: { max: 80, perHour: 15 },
        connections: { max: 50, perHour: 8 },
        messages: { max: 35, perHour: 6 }
      },
      delays: {
        comments: { min: 30, max: 80 },
        likes: { min: 12, max: 35 },
        connections: { min: 25, max: 70 },
        messages: { min: 40, max: 110 }
      }
    }
  },
  
  'aggressive': {
    instagram: {
      daily: {
        comments: { max: 50, perHour: 12 },
        likes: { max: 300, perHour: 50 },
        follows: { max: 100, perHour: 20 },
        dms: { max: 80, perHour: 12 }
      },
      delays: {
        comments: { min: 20, max: 50 },
        likes: { min: 5, max: 15 },
        follows: { min: 10, max: 35 },
        dms: { min: 25, max: 70 }
      }
    },
    linkedin: {
      daily: {
        comments: { max: 40, perHour: 8 },
        likes: { max: 120, perHour: 20 },
        connections: { max: 70, perHour: 12 },
        messages: { max: 50, perHour: 8 }
      },
      delays: {
        comments: { min: 25, max: 60 },
        likes: { min: 10, max: 28 },
        connections: { min: 20, max: 55 },
        messages: { min: 35, max: 90 }
      }
    }
  }
};

// Load account configuration
async function loadAccountConfig() {
  const result = await chrome.storage.local.get('accountConfig');
  const config = result.accountConfig || ACCOUNT_PRESETS['conservative'];
  
  applyConfigToUI(config);
  updateUsageDashboard();
}

// Apply config to UI
function applyConfigToUI(config) {
  // Instagram limits
  document.getElementById('ig-comments-day').value = config.instagram.daily.comments.max;
  document.getElementById('ig-comments-hour').value = config.instagram.daily.comments.perHour;
  document.getElementById('ig-likes-day').value = config.instagram.daily.likes.max;
  document.getElementById('ig-likes-hour').value = config.instagram.daily.likes.perHour;
  document.getElementById('ig-follows-day').value = config.instagram.daily.follows.max;
  document.getElementById('ig-follows-hour').value = config.instagram.daily.follows.perHour;
  document.getElementById('ig-dms-day').value = config.instagram.daily.dms.max;
  document.getElementById('ig-dms-hour').value = config.instagram.daily.dms.perHour;
  
  // Instagram delays
  document.getElementById('ig-delay-comments-min').value = config.instagram.delays.comments.min;
  document.getElementById('ig-delay-comments-max').value = config.instagram.delays.comments.max;
  document.getElementById('ig-delay-likes-min').value = config.instagram.delays.likes.min;
  document.getElementById('ig-delay-likes-max').value = config.instagram.delays.likes.max;
  document.getElementById('ig-delay-follows-min').value = config.instagram.delays.follows.min;
  document.getElementById('ig-delay-follows-max').value = config.instagram.delays.follows.max;
  document.getElementById('ig-delay-dms-min').value = config.instagram.delays.dms.min;
  document.getElementById('ig-delay-dms-max').value = config.instagram.delays.dms.max;
  
  // LinkedIn limits
  document.getElementById('li-comments-day').value = config.linkedin.daily.comments.max;
  document.getElementById('li-comments-hour').value = config.linkedin.daily.comments.perHour;
  document.getElementById('li-likes-day').value = config.linkedin.daily.likes.max;
  document.getElementById('li-likes-hour').value = config.linkedin.daily.likes.perHour;
  document.getElementById('li-connections-day').value = config.linkedin.daily.connections.max;
  document.getElementById('li-connections-hour').value = config.linkedin.daily.connections.perHour;
  document.getElementById('li-messages-day').value = config.linkedin.daily.messages.max;
  document.getElementById('li-messages-hour').value = config.linkedin.daily.messages.perHour;
  
  // LinkedIn delays
  document.getElementById('li-delay-comments-min').value = config.linkedin.delays.comments.min;
  document.getElementById('li-delay-comments-max').value = config.linkedin.delays.comments.max;
  document.getElementById('li-delay-likes-min').value = config.linkedin.delays.likes.min;
  document.getElementById('li-delay-likes-max').value = config.linkedin.delays.likes.max;
  document.getElementById('li-delay-connections-min').value = config.linkedin.delays.connections.min;
  document.getElementById('li-delay-connections-max').value = config.linkedin.delays.connections.max;
  document.getElementById('li-delay-messages-min').value = config.linkedin.delays.messages.min;
  document.getElementById('li-delay-messages-max').value = config.linkedin.delays.messages.max;
}

// Save account configuration
document.getElementById('save-account-config')?.addEventListener('click', async () => {
  const config = {
    instagram: {
      daily: {
        comments: {
          max: parseInt(document.getElementById('ig-comments-day').value),
          perHour: parseInt(document.getElementById('ig-comments-hour').value)
        },
        likes: {
          max: parseInt(document.getElementById('ig-likes-day').value),
          perHour: parseInt(document.getElementById('ig-likes-hour').value)
        },
        follows: {
          max: parseInt(document.getElementById('ig-follows-day').value),
          perHour: parseInt(document.getElementById('ig-follows-hour').value)
        },
        dms: {
          max: parseInt(document.getElementById('ig-dms-day').value),
          perHour: parseInt(document.getElementById('ig-dms-hour').value)
        }
      },
      delays: {
        comments: {
          min: parseInt(document.getElementById('ig-delay-comments-min').value),
          max: parseInt(document.getElementById('ig-delay-comments-max').value)
        },
        likes: {
          min: parseInt(document.getElementById('ig-delay-likes-min').value),
          max: parseInt(document.getElementById('ig-delay-likes-max').value)
        },
        follows: {
          min: parseInt(document.getElementById('ig-delay-follows-min').value),
          max: parseInt(document.getElementById('ig-delay-follows-max').value)
        },
        dms: {
          min: parseInt(document.getElementById('ig-delay-dms-min').value),
          max: parseInt(document.getElementById('ig-delay-dms-max').value)
        }
      }
    },
    linkedin: {
      daily: {
        comments: {
          max: parseInt(document.getElementById('li-comments-day').value),
          perHour: parseInt(document.getElementById('li-comments-hour').value)
        },
        likes: {
          max: parseInt(document.getElementById('li-likes-day').value),
          perHour: parseInt(document.getElementById('li-likes-hour').value)
        },
        connections: {
          max: parseInt(document.getElementById('li-connections-day').value),
          perHour: parseInt(document.getElementById('li-connections-hour').value)
        },
        messages: {
          max: parseInt(document.getElementById('li-messages-day').value),
          perHour: parseInt(document.getElementById('li-messages-hour').value)
        }
      },
      delays: {
        comments: {
          min: parseInt(document.getElementById('li-delay-comments-min').value),
          max: parseInt(document.getElementById('li-delay-comments-max').value)
        },
        likes: {
          min: parseInt(document.getElementById('li-delay-likes-min').value),
          max: parseInt(document.getElementById('li-delay-likes-max').value)
        },
        connections: {
          min: parseInt(document.getElementById('li-delay-connections-min').value),
          max: parseInt(document.getElementById('li-delay-connections-max').value)
        },
        messages: {
          min: parseInt(document.getElementById('li-delay-messages-min').value),
          max: parseInt(document.getElementById('li-delay-messages-max').value)
        }
      }
    },
    behavior: {
      activeHours: {
        enabled: document.getElementById('active-hours-enabled').checked,
        start: document.getElementById('active-hours-start').value,
        end: document.getElementById('active-hours-end').value
      },
      breaks: {
        enabled: document.getElementById('breaks-enabled').checked,
        lunch: document.getElementById('lunch-break').checked,
        evening: document.getElementById('evening-break').checked
      },
      randomBreaks: document.getElementById('random-breaks').checked,
      weekendMode: document.getElementById('weekend-mode').checked,
      warmupMode: document.getElementById('warmup-mode').checked
    }
  };
  
  await chrome.storage.local.set({ accountConfig: config });
  
  // Update delay manager
  await updateDelayManagerConfig(config);
  
  showToast('✅ Configuración guardada', 'success');
});

// Preset buttons
document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.preset;
    
    // Update active state
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Apply preset
    const config = ACCOUNT_PRESETS[preset];
    applyConfigToUI(config);
  });
});

// Reset to recommended
document.getElementById('reset-account-config')?.addEventListener('click', () => {
  if (confirm('¿Restaurar configuración recomendada?')) {
    const config = ACCOUNT_PRESETS['conservative'];
    applyConfigToUI(config);
    
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-preset="conservative"]').classList.add('active');
  }
});

// Update usage dashboard
async function updateUsageDashboard() {
  const stats = await window.delayManager?.getDailyStats();
  
  if (!stats) return;
  
  // Instagram
  updateUsageBar('ig-comments', stats.instagram.comments);
  updateUsageBar('ig-likes', stats.instagram.likes);
  updateUsageBar('ig-follows', stats.instagram.follows);
  updateUsageBar('ig-dms', stats.instagram.dms);
  
  // LinkedIn
  updateUsageBar('li-comments', stats.linkedin.comments);
  updateUsageBar('li-likes', stats.linkedin.likes);
  updateUsageBar('li-connections', stats.linkedin.connections);
  
  // Check for alerts
  updateUsageAlerts(stats);
}

function updateUsageBar(id, stat) {
  const bar = document.getElementById(`usage-${id}`);
  const text = document.getElementById(`usage-${id}-text`);
  
  if (!bar || !text) return;
  
  const percentage = stat.percentage;
  bar.style.width = `${percentage}%`;
  text.textContent = `${stat.count}/${stat.limit}`;
  
  // Change color based on usage
  bar.classList.remove('warning', 'critical');
  if (percentage >= 100) {
    bar.classList.add('critical');
  } else if (percentage >= 80) {
    bar.classList.add('warning');
  }
}

function updateUsageAlerts(stats) {
  const alertsContainer = document.getElementById('usage-alerts');
  alertsContainer.innerHTML = '';
  
  const alerts = [];
  
  // Check all platforms and actions
  for (const platform in stats) {
    for (const action in stats[platform]) {
      const stat = stats[platform][action];
      
      if (stat.percentage >= 100) {
        alerts.push({
          level: 'critical',
          message: `🛑 ${platform} ${action}: Límite alcanzado (${stat.count}/${stat.limit})`
        });
      } else if (stat.percentage >= 80) {
        alerts.push({
          level: 'warning',
          message: `⚠️ ${platform} ${action}: ${stat.percentage}% usado (${stat.count}/${stat.limit})`
        });
      }
    }
  }
  
  // Display alerts
  alerts.forEach(alert => {
    const div = document.createElement('div');
    div.className = `usage-alert ${alert.level}`;
    div.textContent = alert.message;
    alertsContainer.appendChild(div);
  });
  
  if (alerts.length === 0) {
    const div = document.createElement('div');
    div.style.textAlign = 'center';
    div.style.color = '#4caf50';
    div.textContent = '✅ Ninguna alerta activa';
    alertsContainer.appendChild(div);
  }
}

// Update delay manager with new config
async function updateDelayManagerConfig(config) {
  // Convert to delay manager format
  const antibanConfig = {
    delays: {
      betweenComments: config.instagram.delays.comments,
      betweenLikes: config.instagram.delays.likes,
      betweenFollows: config.instagram.delays.follows,
      betweenDMs: config.instagram.delays.dms,
      betweenPageLoads: { min: 2, max: 5 }
    },
    dailyLimits: {
      instagram: config.instagram.daily,
      linkedin: config.linkedin.daily
    },
    activeHours: config.behavior.activeHours,
    breaks: config.behavior.breaks,
    randomization: {
      enabled: true,
      variability: 0.3
    }
  };
  
  await chrome.storage.local.set({ antibanConfig });
}

// Toggle sub-settings
document.getElementById('active-hours-enabled')?.addEventListener('change', (e) => {
  document.getElementById('active-hours-settings').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('breaks-enabled')?.addEventListener('change', (e) => {
  document.getElementById('breaks-settings').style.display = e.target.checked ? 'block' : 'none';
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('tab-account')) {
    loadAccountConfig();
    
    // Update dashboard every 30 seconds
    setInterval(updateUsageDashboard, 30000);
  }
});
