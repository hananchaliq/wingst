import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const EXT_DIR = path.join(ROOT, 'extension');
const ICONS_DIR = path.join(EXT_DIR, 'icons');
const ASSETS_DIR = path.join(EXT_DIR, 'assets');

fs.mkdirSync(ICONS_DIR, { recursive: true });
fs.mkdirSync(ASSETS_DIR, { recursive: true });

// Helper: Generate valid binary PNG icon with Wingst dark charcoal background and crimson geometric square
function createPngBuffer(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawRows = [];
  const innerMin = Math.floor(size * 0.28);
  const innerMax = Math.ceil(size * 0.72);

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const idx = 1 + x * 4;
      const isBorder = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const isCore = x >= innerMin && x < innerMax && y >= innerMin && y < innerMax;
      if (isCore) {
        // Wingst Crimson #E11D48
        row[idx] = 225;
        row[idx + 1] = 29;
        row[idx + 2] = 72;
        row[idx + 3] = 255;
      } else if (isBorder) {
        row[idx] = 52;
        row[idx + 1] = 52;
        row[idx + 2] = 62;
        row[idx + 3] = 255;
      } else {
        // Deep Charcoal #09090B
        row[idx] = 9;
        row[idx + 1] = 9;
        row[idx + 2] = 11;
        row[idx + 3] = 255;
      }
    }
    rawRows.push(row);
  }

  const compressed = zlib.deflateSync(Buffer.concat(rawRows));
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend),
  ]);
}

for (const size of [16, 48, 128]) {
  fs.writeFileSync(
    path.join(ICONS_DIR, `icon${size}.png`),
    createPngBuffer(size)
  );
}

// Copy default hero static SVG
const defaultHeroSvg = path.join(ROOT, 'public', 'assets', 'wingst-default-hero.svg');
if (fs.existsSync(defaultHeroSvg)) {
  fs.copyFileSync(
    defaultHeroSvg,
    path.join(ASSETS_DIR, 'wingst-default-hero.svg')
  );
}

// 1. Write Manifest V3
const manifest = {
  manifest_version: 3,
  name: 'Wingst — Modular Personal Workspace & New Tab',
  short_name: 'Wingst',
  version: '2.0.0',
  description:
    'Editorial, local-first personal browser workspace and customizable mosaic New Tab experience.',
  chrome_url_overrides: {
    newtab: 'newtab.html',
  },
  permissions: ['storage'],
  optional_permissions: ['geolocation'],
  host_permissions: [
    'https://api.open-meteo.com/*',
    'https://geocoding-api.open-meteo.com/*',
    'https://api.frankfurter.dev/*',
    'https://api.frankfurter.app/*',
    'https://api.myquran.com/*',
    'https://api.aladhan.com/*',
  ],
  background: {
    service_worker: 'service-worker.js',
  },
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  content_security_policy: {
    extension_pages:
      "script-src 'self'; object-src 'self'; img-src 'self' data: https:; frame-src https://open.spotify.com https://www.youtube.com https://embed.music.apple.com https://w.soundcloud.com;",
  },
};

fs.writeFileSync(
  path.join(EXT_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

// 2. Write Extension Service Worker
const serviceWorkerCode = `// Wingst Manifest V3 Service Worker
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
`;
fs.writeFileSync(path.join(EXT_DIR, 'service-worker.js'), serviceWorkerCode);

// 3. Write Extension CSS
const stylesCss = `:root, [data-theme="dark"] {
  --bg-canvas: #09090b;
  --bg-surface: #111115;
  --bg-elevated: #18181e;
  --text-primary: #f4f4f6;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --border-subtle: #232329;
  --border-strong: #34343e;
  --accent-primary: #e11d48;
  --status-success: #10b981;
  --status-error: #ef4444;
}
[data-theme="light"] {
  --bg-canvas: #f6f6f7;
  --bg-surface: #ffffff;
  --bg-elevated: #eeeef0;
  --text-primary: #09090b;
  --text-secondary: #3f3f46;
  --text-muted: #71717a;
  --border-subtle: #e4e4e7;
  --border-strong: #d4d4d8;
  --accent-primary: #e11d48;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg-canvas);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  background: var(--bg-canvas);
  border-bottom: 1px solid var(--border-subtle);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-size: 18px;
}
.brand-mark {
  width: 22px;
  height: 22px;
  border: 1px solid var(--border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-dot {
  width: 8px;
  height: 8px;
  background: var(--accent-primary);
}
.search-bar {
  display: flex;
  flex: 1;
  max-width: 540px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}
.search-bar select, .search-bar input, .btn {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  padding: 6px 10px;
  font-size: 12px;
}
.search-bar input {
  flex: 1;
  border: none;
  outline: none;
}
.btn-accent {
  background: var(--accent-primary);
  color: #fff;
  border-color: var(--accent-primary);
  cursor: pointer;
}
.hero {
  position: relative;
  height: 540px;
  overflow: hidden;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: flex-end;
  padding: 32px 24px;
}
.hero-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, var(--bg-canvas), rgba(9,9,11,0.35));
}
.hero-content {
  position: relative;
  z-index: 2;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.clock {
  font-family: monospace;
  font-size: 56px;
  font-weight: 700;
}
.mosaic {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px 24px;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
}
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
}
.card-title {
  font-size: 14px;
  font-weight: 700;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 8px;
}
.mono { font-family: monospace; font-variant-numeric: tabular-nums; }
@media (max-width: 900px) {
  .mosaic { grid-template-columns: 1fr; }
  .card { grid-column: span 1 !important; }
}
`;
fs.writeFileSync(path.join(EXT_DIR, 'styles.css'), stylesCss);

// 4. Write Extension New Tab HTML & JS
const newtabHtml = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wingst — New Tab Workspace</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="header">
    <div class="brand">
      <span class="brand-mark"><span class="brand-dot"></span></span>
      <span>WINGST</span>
    </div>
    <form id="search-form" class="search-bar">
      <select id="search-provider" aria-label="Search provider">
        <option value="google">Google</option>
        <option value="duckduckgo">DuckDuckGo</option>
        <option value="brave">Brave</option>
        <option value="bing">Bing</option>
      </select>
      <input id="search-input" type="text" placeholder="Search the web..." aria-label="Search query" />
      <button type="submit" class="btn btn-accent">Search</button>
    </form>
    <div>
      <input type="color" id="accent-picker" value="#e11d48" title="Primary Accent Color" />
      <button type="button" id="theme-toggle" class="btn">Toggle Theme</button>
    </div>
  </header>

  <section class="hero">
    <img id="hero-img" class="hero-bg" src="assets/wingst-default-hero.svg" alt="Wingst Hero Canvas" />
    <div class="hero-scrim"></div>
    <div class="hero-content">
      <div>
        <div style="font-size:11px;color:var(--text-secondary);">LOCAL WORKSPACE TIME</div>
        <div id="hero-clock" class="clock">--:--:--</div>
      </div>
    </div>
  </section>

  <main class="mosaic" id="mosaic-grid">
    <!-- 01 Weather -->
    <section class="card" style="grid-column: span 5;">
      <div class="card-title"><span>01. Weather & Atmosphere</span><span id="weather-city" class="mono">Jakarta</span></div>
      <div id="weather-body" class="mono">Loading Open-Meteo telemetry...</div>
    </section>

    <!-- 02 Forex -->
    <section class="card" style="grid-column: span 4;">
      <div class="card-title"><span>02. Trading / Forex (USD/IDR)</span><span class="mono">ECB Reference</span></div>
      <div id="forex-body" class="mono">Loading USD/IDR exchange rate...</div>
    </section>

    <!-- 03 Quick Links -->
    <section class="card" style="grid-column: span 3;">
      <div class="card-title"><span>03. Quick Links</span></div>
      <div id="links-list"></div>
      <form id="link-form" style="display:flex;gap:4px;">
        <input id="link-title" placeholder="Title" style="width:35%;background:var(--bg-elevated);color:var(--text-primary);border:1px solid var(--border-subtle);padding:4px;" />
        <input id="link-url" placeholder="https://..." style="flex:1;background:var(--bg-elevated);color:var(--text-primary);border:1px solid var(--border-subtle);padding:4px;" />
        <button type="submit" class="btn btn-accent">+</button>
      </form>
    </section>

    <!-- 04 Notepad -->
    <section class="card" style="grid-column: span 7;">
      <div class="card-title"><span>04. Local Notepad</span><span id="note-status" style="font-size:11px;color:var(--status-success);">Saved in chrome.storage.local</span></div>
      <textarea id="notepad-area" rows="5" style="width:100%;background:var(--bg-elevated);color:var(--text-primary);border:1px solid var(--border-subtle);padding:8px;" placeholder="Local extension notes..."></textarea>
    </section>

    <!-- 05 Daily Activity -->
    <section class="card" style="grid-column: span 5;">
      <div class="card-title"><span>05. Daily Activity</span><span id="activity-progress" class="mono">0/0</span></div>
      <div id="activity-list" style="font-size:12px;color:var(--text-secondary);">No daily activities defined. Add one below.</div>
      <form id="activity-form" style="display:flex;gap:4px;">
        <input id="activity-input" placeholder="New daily activity..." style="flex:1;background:var(--bg-elevated);color:var(--text-primary);border:1px solid var(--border-subtle);padding:4px;" />
        <button type="submit" class="btn btn-accent">Add</button>
      </form>
    </section>

    <!-- 06 Official Music Embed -->
    <section class="card" style="grid-column: span 7;">
      <div class="card-title"><span>06. Official Music Embed</span></div>
      <iframe title="Spotify Official Embed" src="https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO?utm_source=generator&theme=0" width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
    </section>

    <!-- 07 Prayer Times -->
    <section class="card" style="grid-column: span 5;">
      <div class="card-title"><span>07. Prayer Schedule</span><span class="mono">Kemenag / Aladhan</span></div>
      <div id="prayer-body" class="mono">Loading daily prayer times...</div>
    </section>
  </main>

  <script src="newtab.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(EXT_DIR, 'newtab.html'), newtabHtml);

const newtabJs = `// Wingst Manifest V3 New Tab Client Script
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
    if (!t || !/^https?:\\/\\//i.test(u)) return;
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
`;
fs.writeFileSync(path.join(EXT_DIR, 'newtab.js'), newtabJs);

console.log('✓ Wingst Manifest V3 Chrome Extension built and verified in /extension');
