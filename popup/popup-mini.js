// ═════════════════════════════════════════════════════════════════
// POPUP MINI - EXTERNAL SCRIPT
// ═════════════════════════════════════════════════════════════════

console.log('🎯 Popup Mini loading...');

// Open dashboard
document.getElementById('open-dashboard')?.addEventListener('click', () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('dashboard/dashboard.html')
  });
});

// Quick actions
document.getElementById('quick-comment')?.addEventListener('click', () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('dashboard/dashboard.html#commentor')
  });
});

document.getElementById('quick-extract')?.addEventListener('click', () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('dashboard/dashboard.html#leads')
  });
});

// Load stats
async function loadStats() {
  try {
    const stats = await window.delayManager?.getDailyStats();
    
    if (!stats) {
      console.log('No stats available yet');
      return;
    }
    
    document.getElementById('stat-comments').textContent = 
      `${stats.instagram.comments.count}/${stats.instagram.comments.limit}`;
    document.getElementById('stat-likes').textContent = 
      `${stats.instagram.likes.count}/${stats.instagram.likes.limit}`;
    document.getElementById('stat-follows').textContent = 
      `${stats.instagram.follows.count}/${stats.instagram.follows.limit}`;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Load on ready
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  console.log('✅ Popup Mini ready');
});
