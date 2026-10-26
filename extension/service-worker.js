// Wingst Manifest V3 Service Worker
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.get(['wingst_workspace_config_v2'], (items) => {
      if (!items.wingst_workspace_config_v2) {
        const today = new Date().toISOString().slice(0, 10);
        chrome.storage.local.set({
          wingst_workspace_config_v2: {
            version: 2,
            appearance: { theme: 'dark', primaryColor: '#e11d48' },
            background: {
              type: 'image',
              mediaUrl: 'assets/wingst-default-hero.svg',
              overlayOpacity: 0.35,
              brightness: 0.95,
              heroHeight: 680
            },
            dailyActivity: {
              activities: [],
              activeDate: today,
              todayCompletedIds: [],
              history: {}
            }
          }
        });
      }
    });
  }
});
