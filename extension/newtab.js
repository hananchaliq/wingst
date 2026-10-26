// Wingst Manifest V3 New Tab Client Script
(function () {
  const STORAGE_KEY = 'wingst_workspace_config_v2';
  const PROVIDERS = {
    google: 'https://www.google.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    brave: 'https://search.brave.com/search?q=',
    bing: 'https://www.bing.com/search?q='
  };

  let state = {
    theme: 'dark',
    primaryColor: '#e11d48',
    provider: 'google',
    note: '',
    links: [
      { title: 'GitHub', url: 'https://github.com' },
      { title: 'MDN Docs', url: 'https://developer.mozilla.org' }
    ],
    activities: [],
    completedIds: []
  };

  function saveState() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: state });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }

  function loadState(cb) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        if (res && res[STORAGE_KEY]) {
          state = Object.assign({}, state, res[STORAGE_KEY]);
        }
        cb();
      });
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try { state = Object.assign({}, state, JSON.parse(raw)); } catch {}
      }
      cb();
    }
  }

  function updateClock() {
    const el = document.getElementById('hero-clock');
    if (el) el.textContent = new Date().toLocaleTimeString([], { hour12: false });
  }
  setInterval(updateClock, 1000);
  updateClock();

  function renderUI() {
    document.documentElement.setAttribute('data-theme', state.theme || 'dark');
    document.documentElement.style.setProperty('--accent-primary', state.primaryColor || '#e11d48');
    document.getElementById('accent-picker').value = state.primaryColor || '#e11d48';
    document.getElementById('search-provider').value = state.provider || 'google';
    document.getElementById('notepad-area').value = state.note || '';

    // Links with automatic favicon from link URL
    const linksEl = document.getElementById('links-list');
    linksEl.innerHTML = '';
    (state.links || []).forEach((l) => {
      const a = document.createElement('a');
      a.href = l.url;
      a.style.display = 'flex';
      a.style.alignItems = 'center';
      a.style.gap = '8px';
      a.style.color = 'var(--text-primary)';
      a.style.textDecoration = 'none';
      a.style.fontSize = '12px';
      a.style.padding = '5px 6px';
      a.style.border = '1px solid var(--border-subtle)';
      a.style.marginBottom = '4px';
      a.style.background = 'var(--bg-elevated)';

      let domain = '';
      try {
        domain = new URL(l.url).hostname;
      } catch {}

      if (domain) {
        const img = document.createElement('img');
        img.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=64';
        img.alt = '';
        img.width = 16;
        img.height = 16;
        img.style.borderRadius = '2px';
        img.onerror = function () {
          this.style.display = 'none';
        };
        a.appendChild(img);
      }

      const span = document.createElement('span');
      span.textContent = l.title || domain || l.url;
      a.appendChild(span);
      linksEl.appendChild(a);
    });

    // Daily Activity (empty by default)
    const actEl = document.getElementById('activity-list');
    const progEl = document.getElementById('activity-progress');
    const acts = state.activities || [];
    const done = state.completedIds || [];
    progEl.textContent = done.length + '/' + acts.length;
    if (acts.length === 0) {
      actEl.textContent = 'No daily activities defined. Add your own below.';
    } else {
      actEl.innerHTML = '';
      acts.forEach((act) => {
        const btn = document.createElement('button');
        const isDone = done.includes(act.id);
        btn.type = 'button';
        btn.className = 'btn';
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.textAlign = 'left';
        btn.style.marginBottom = '4px';
        btn.textContent = (isDone ? '[x] ' : '[ ] ') + act.title;
        btn.onclick = () => {
          state.completedIds = isDone
            ? done.filter((id) => id !== act.id)
            : [...done, act.id];
          saveState();
          renderUI();
        };
        actEl.appendChild(btn);
      });
    }
  }

  loadState(renderUI);

  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('search-input').value.trim();
    if (!q) return;
    const prov = document.getElementById('search-provider').value;
    state.provider = prov;
    saveState();
    window.location.assign((PROVIDERS[prov] || PROVIDERS.google) + encodeURIComponent(q));
  });

  document.getElementById('theme-toggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    saveState();
    renderUI();
  });

  document.getElementById('accent-picker').addEventListener('input', (e) => {
    state.primaryColor = e.target.value;
    saveState();
    renderUI();
  });

  document.getElementById('notepad-area').addEventListener('input', (e) => {
    state.note = e.target.value;
    saveState();
  });

  document.getElementById('link-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = document.getElementById('link-title').value.trim();
    const u = document.getElementById('link-url').value.trim();
    if (!t || !/^https?:\/\//i.test(u)) return;
    state.links = [...(state.links || []), { title: t, url: u }];
    document.getElementById('link-title').value = '';
    document.getElementById('link-url').value = '';
    saveState();
    renderUI();
  });

  document.getElementById('activity-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = document.getElementById('activity-input').value.trim();
    if (!t) return;
    state.activities = [...(state.activities || []), { id: 'a-' + Date.now(), title: t }];
    document.getElementById('activity-input').value = '';
    saveState();
    renderUI();
  });

  // Live API fetches for Extension New Tab
  fetch('https://api.open-meteo.com/v1/forecast?latitude=-6.2088&longitude=106.8456&current=temperature_2m,relative_humidity_2m,wind_speed_10m')
    .then((r) => r.json())
    .then((d) => {
      if (d && d.current) {
        document.getElementById('weather-body').textContent =
          d.current.temperature_2m + '°C · Humidity ' + d.current.relative_humidity_2m + '% · Wind ' + d.current.wind_speed_10m + ' km/h';
      }
    })
    .catch(() => {
      document.getElementById('weather-body').textContent = 'Weather feed offline.';
    });

  fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR')
    .then((r) => r.json())
    .then((d) => {
      if (d && d.rates && d.rates.IDR) {
        document.getElementById('forex-body').textContent =
          '1 USD = ' + Number(d.rates.IDR).toLocaleString() + ' IDR (' + d.date + ')';
      }
    })
    .catch(() => {
      document.getElementById('forex-body').textContent = 'Forex reference feed offline.';
    });

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  fetch('https://api.myquran.com/v2/sholat/jadwal/1301/' + y + '/' + m + '/' + d)
    .then((r) => r.json())
    .then((res) => {
      const j = res && res.data && res.data.jadwal;
      if (j) {
        document.getElementById('prayer-body').textContent =
          'Subuh ' + j.subuh + ' · Dzuhur ' + j.dzuhur + ' · Ashar ' + j.ashar + ' · Maghrib ' + j.maghrib + ' · Isya ' + j.isya;
      }
    })
    .catch(() => {
      document.getElementById('prayer-body').textContent = 'Prayer schedule offline.';
    });
})();
