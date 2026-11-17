let config = {};
let launcherSettings = {
  customFiveMPath: '',
  minimizeOnLaunch: false,
  autoCheckUpdates: true,
  defaultServer: 'last',
  openAtLogin: false,
  installDir: '',
  canUninstall: false
};
let language = localStorage.getItem('astroLanguage') || 'de';
let lastServer = localStorage.getItem('astroLastServer') || 'de';
let toastTimer = null;
let updateBusy = false;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const T = {
  de: {
    play: 'Spielen',
    news: 'Nachrichten',
    discord: 'Discord',
    forum: 'Forum',
    topup: 'Konto aufladen',
    wiki: 'Wiki',
    settings: 'Einstellungen',
    online: 'Launcher online',
    nowPlaying: 'Jetzt spielen:',
    chooseServer: 'Wählen Sie einen Server:',
    lastVisited: 'LETZTES MAL BESUCHT',
    germanServers: 'DEUTSCHE SERVER',
    englishServers: 'ENGLISCHE SERVER',
    clickToConnect: 'Klicken zum Verbinden',
    guide: 'KURZLEITFADEN ZUM SPIEL',
    watchVideo: 'Video ansehen',
    latestUpdates: 'NEUESTE UPDATES',
    languageLabel: 'Sprache & Verhalten',
    defaultServerLabel: 'Schnellstart-Server',
    defaultServerLast: 'Zuletzt besuchter Server',
    minimizeOnLaunchLabel: 'Nach Spielstart minimieren',
    minimizeOnLaunchHint: 'Minimiert den Launcher automatisch beim Verbinden.',
    openAtLoginLabel: 'Mit Windows starten',
    openAtLoginHint: 'Startet den ASTRO Launcher automatisch beim Anmelden.',
    autoCheckLabel: 'Automatisch beim Start prüfen',
    autoCheckHint: 'Sucht bei jedem Launcher-Start still nach Updates.',
    fivemLabel: 'FiveM-Verwaltung & Support',
    browseFiveM: 'Pfad wählen',
    resetFiveM: 'Zurücksetzen',
    openFiveMFolder: 'Ordner öffnen',
    openFiveMLogs: 'Logs öffnen',
    clearCache: 'Cache leeren',
    clearingCache: 'Leere …',
    systemLabel: 'Installation & System',
    systemHint: 'Hier liegen die lokalen Dateien des ASTRO Launchers.',
    openInstallDir: 'Installationsordner öffnen',
    uninstallLauncher: 'Deinstallieren',
    fivemFound: 'Gefunden',
    fivemMissingPill: 'Nicht gefunden',
    fivemPathMissing: 'Kein FiveM-Pfad gefunden – bitte manuell wählen oder installieren.',
    cacheLabel: 'Bereinigbarer Cache: {mb} MB',
    cacheEmpty: 'Bereinigbarer Cache: 0 MB (sauber)',
    cacheCleared: 'FiveM-Cache geleert ({mb} MB entfernt).',
    cacheRunning: 'Bitte schließe zuerst FiveM, bevor du den Cache leerst.',
    cacheNoDir: 'Kein FiveM-Ordner zum Bereinigen gefunden.',
    pathSaved: 'FiveM-Pfad gespeichert.',
    pathReset: 'Automatische FiveM-Erkennung aktiviert.',
    logsMissing: 'Noch keine FiveM-Logs vorhanden.',
    folderMissing: 'FiveM-Ordner wurde nicht gefunden.',
    settingsSaved: 'Einstellung gespeichert.',
    saved: 'Sprache gespeichert.',
    connecting: 'Prüfe FiveM und verbinde …',
    started: 'FiveM wird gestartet …',
    missing: 'FiveM wurde nicht gefunden',
    missingText: 'Bitte installiere FiveM oder wähle unten den Pfad zu deiner FiveM.exe aus.',
    close: 'Schließen',
    download: 'FiveM herunterladen',
    wikiPlaceholder: 'Hier kannst du später Regeln, Jobs und Server-Infos anzeigen.',
    topupSoon: 'Konto aufladen: Hier kannst du später deinen Shop verknüpfen.',
    videoMissing: 'Video-Link noch nicht konfiguriert.',
    checkUpdates: 'Update suchen',
    checkingUpdates: 'Suche läuft …',
    updatesLabel: 'Auto-Updater',
    updateIdle: 'Prüft automatisch beim Start auf neue Updates.',
    noUpdate: 'Du nutzt bereits die aktuelle Version (v{v}).',
    updateFound: 'Update v{v} gefunden – wird heruntergeladen …',
    updateDownloading: 'Update v{v} wird heruntergeladen: {p}%',
    updateDownloaded: 'Update v{v} bereit – wird installiert …',
    updateError: 'Update-Prüfung fehlgeschlagen: {m}',
    minimizeTip: 'Minimieren',
    maximizeTip: 'Maximieren',
    restoreTip: 'Wiederherstellen',
    closeTip: 'Schließen'
  },
  en: {
    play: 'Play',
    news: 'News',
    discord: 'Discord',
    forum: 'Forum',
    topup: 'Top up account',
    wiki: 'Wiki',
    settings: 'Settings',
    online: 'Launcher online',
    nowPlaying: 'Now playing:',
    chooseServer: 'Choose a server:',
    lastVisited: 'LAST VISITED',
    germanServers: 'GERMAN SERVERS',
    englishServers: 'ENGLISH SERVERS',
    clickToConnect: 'Click to connect',
    guide: 'QUICK GUIDE',
    watchVideo: 'Watch video',
    latestUpdates: 'LATEST UPDATES',
    languageLabel: 'Language & Behavior',
    defaultServerLabel: 'Quick-launch server',
    defaultServerLast: 'Last visited server',
    minimizeOnLaunchLabel: 'Minimize on game launch',
    minimizeOnLaunchHint: 'Automatically minimizes the launcher when connecting.',
    openAtLoginLabel: 'Start with Windows',
    openAtLoginHint: 'Launches ASTRO Launcher automatically at sign-in.',
    autoCheckLabel: 'Check automatically on startup',
    autoCheckHint: 'Quietly checks for updates when the launcher opens.',
    fivemLabel: 'FiveM & Support Tools',
    browseFiveM: 'Choose path',
    resetFiveM: 'Reset',
    openFiveMFolder: 'Open folder',
    openFiveMLogs: 'Open logs',
    clearCache: 'Clear cache',
    clearingCache: 'Clearing …',
    systemLabel: 'Installation & System',
    systemHint: 'Local installation directory of ASTRO Launcher.',
    openInstallDir: 'Open install folder',
    uninstallLauncher: 'Uninstall',
    fivemFound: 'Found',
    fivemMissingPill: 'Not found',
    fivemPathMissing: 'No FiveM path found – choose FiveM.exe manually or install FiveM.',
    cacheLabel: 'Clearable cache: {mb} MB',
    cacheEmpty: 'Clearable cache: 0 MB (clean)',
    cacheCleared: 'FiveM cache cleared ({mb} MB freed).',
    cacheRunning: 'Please close FiveM first before clearing the cache.',
    cacheNoDir: 'No FiveM folder found to clear.',
    pathSaved: 'FiveM path saved.',
    pathReset: 'Automatic FiveM detection restored.',
    logsMissing: 'No FiveM logs found yet.',
    folderMissing: 'FiveM folder was not found.',
    settingsSaved: 'Setting saved.',
    saved: 'Language saved.',
    connecting: 'Checking FiveM and connecting …',
    started: 'FiveM is starting …',
    missing: 'FiveM was not found',
    missingText: 'Please install FiveM or select the path to your FiveM.exe below.',
    close: 'Close',
    download: 'Download FiveM',
    wikiPlaceholder: 'Rules, jobs and server information can be shown here later.',
    topupSoon: 'Top up account: You can connect your shop here later.',
    videoMissing: 'Video link is not configured yet.',
    checkUpdates: 'Check for updates',
    checkingUpdates: 'Checking …',
    updatesLabel: 'Auto-Updater',
    updateIdle: 'Automatically checks for updates on startup.',
    noUpdate: 'You are already on the latest version (v{v}).',
    updateFound: 'Update v{v} found – downloading …',
    updateDownloading: 'Downloading update v{v}: {p}%',
    updateDownloaded: 'Update v{v} ready – installing …',
    updateError: 'Update check failed: {m}',
    minimizeTip: 'Minimize',
    maximizeTip: 'Maximize',
    restoreTip: 'Restore',
    closeTip: 'Close'
  }
};

const t = k => T[language][k] || T.de[k] || k;

function applyWindowState(maximized) {
  document.body.classList.toggle('maximized', Boolean(maximized));
  const maxBtn = $('#fullscreenBtn');
  if (maxBtn) {
    maxBtn.textContent = maximized ? '❐' : '□';
    maxBtn.title = t(maximized ? 'restoreTip' : 'maximizeTip');
  }
}

function applyLanguage() {
  $$('[data-i18n]').forEach(e => {
    if ((e.id === 'checkUpdateBtn' || e.id === 'settingsUpdateBtn') && updateBusy) return;
    if (e.id === 'updateStatusText' && e.dataset.locked === '1') return;
    e.textContent = t(e.dataset.i18n);
  });
  $('#languageSelect').value = language;
  $('#fivemModalTitle').textContent = t('missing');
  $('#fivemModalText').textContent = t('missingText');
  $('#fivemClose').textContent = t('close');
  $('#fivemPickPath').textContent = t('browseFiveM');
  $('#fivemDownload').textContent = t('download');
  if ($('#minBtn')) $('#minBtn').title = t('minimizeTip');
  if ($('#closeBtn')) $('#closeBtn').title = t('closeTip');
  applyWindowState(document.body.classList.contains('maximized'));
  document.documentElement.lang = language;
  renderNews();
}

function toast(m) {
  const e = $('#toast');
  e.textContent = m;
  e.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.classList.remove('show'), 3600);
}

function showPage(p) {
  $$('.nav-item[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === p));
  $$('.page').forEach(x => x.classList.remove('active'));
  $('#page-' + p)?.classList.add('active');
  if (p === 'settings') refreshFiveMStatus();
}

function servers() {
  return config.servers || {
    de: { name: 'Server #1 | DE', address: '127.0.0.1:30120' },
    en: { name: 'Server #1 | EN', address: '127.0.0.1:30121' }
  };
}

function updateLastServer() {
  const s = servers()[lastServer] || servers().de;
  $('#lastServerName').textContent = s.name;
  $('#lastFlag').src = lastServer === 'en' ? 'assets/flag-gb.svg' : 'assets/flag-de.svg';
}

function getHeroServerKey() {
  const def = launcherSettings.defaultServer || 'last';
  return def === 'de' || def === 'en' ? def : lastServer;
}

async function connect(key) {
  const s = servers()[key];
  if (!s?.address) {
    toast('No server address configured.');
    return;
  }
  const fiveM = await window.astro.checkFiveMInstalled();
  if (!fiveM.installed) {
    showModal();
    return;
  }

  lastServer = key;
  localStorage.setItem('astroLastServer', key);
  updateLastServer();
  toast(t('connecting'));
  const r = await window.astro.connect(s.address);
  if (!r.ok) {
    if (r.code === 'FIVEM_NOT_FOUND') showModal();
    else toast(r.error || 'FiveM connection failed.');
  } else {
    toast(t('started'));
    if (launcherSettings.minimizeOnLaunch) {
      setTimeout(() => window.astro.minimize(), 450);
    }
  }
}

function renderNews() {
  const n = config.news || [];
  $('#newsList').innerHTML = n
    .map(x => `<article class="news-card"><div class="update-date">${x.date}</div><h3>${language === 'en' ? (x.title === 'Willkommen bei ASTRO' ? 'Welcome to ASTRO' : x.title === 'Neues Update' ? 'New Update' : x.title) : x.title}</h3><p>${language === 'en' ? (x.text === 'Verbinde dich direkt mit unserem FiveM-Server.' ? 'Connect directly to our FiveM server.' : x.text === 'Neue Features und Verbesserungen für ASTRO.' ? 'New features and improvements for ASTRO.' : x.text) : x.text}</p></article>`)
    .join('');
  $('#updates').innerHTML = n
    .slice(0, 2)
    .map(x => `<article class="update-card"><div class="update-date">${x.date}</div><div class="update-title">${language === 'en' ? (x.title === 'Willkommen bei ASTRO' ? 'Welcome to ASTRO' : x.title === 'Neues Update' ? 'New Update' : x.title) : x.title}</div><div class="update-text">${language === 'en' ? (x.text === 'Verbinde dich direkt mit unserem FiveM-Server.' ? 'Connect directly with our FiveM server.' : x.text === 'Neue Features und Verbesserungen für ASTRO.' ? 'New features and improvements for ASTRO.' : x.text) : x.text}</div></article>`)
    .join('');
}

function showModal() {
  const m = $('#fivemModal');
  m.classList.add('visible');
  m.setAttribute('aria-hidden', 'false');
  applyLanguage();
}

function hideModal() {
  const m = $('#fivemModal');
  m.classList.remove('visible');
  m.setAttribute('aria-hidden', 'true');
}

function setUpdateBusy(busy) {
  updateBusy = busy;
  for (const id of ['#checkUpdateBtn', '#settingsUpdateBtn']) {
    const btn = $(id);
    if (!btn) continue;
    btn.disabled = busy;
    btn.textContent = busy ? t('checkingUpdates') : t('checkUpdates');
  }
}

function setUpdateStatusText(msg, tone = 'neutral') {
  const box = $('#updateStatusText');
  if (!box) return;
  box.dataset.locked = '1';
  box.textContent = msg;
  box.classList.remove('ok', 'warn', 'err');
  if (tone !== 'neutral') box.classList.add(tone);
}

function setDownloadProgress(percent, visible) {
  const track = $('#updateProgressTrack');
  const fill = $('#updateProgressFill');
  if (!track || !fill) return;
  track.classList.toggle('visible', Boolean(visible));
  track.setAttribute('aria-hidden', visible ? 'false' : 'true');
  fill.style.width = `${Math.max(0, Math.min(100, percent || 0))}%`;
}

function cleanVersionLabel(ver) {
  const raw = String(ver || config.version || '1.0').trim().replace(/^v/i, '');
  const parts = raw.split('.');
  if (parts.length === 3 && parts[2] === '0') {
    return `${parts[0]}.${parts[1]}`;
  }
  return raw || '1.0';
}

function updateVersionDisplays(ver) {
  const label = 'v' + cleanVersionLabel(ver);
  if ($('#version')) $('#version').textContent = label;
  if ($('#sidebarVersion')) $('#sidebarVersion').textContent = label;
  if ($('#settingsVersionBadge')) $('#settingsVersionBadge').textContent = label;
}

function renderFiveMStatus(status) {
  const pill = $('#fivemStatusPill');
  const pathBox = $('#fivemPathText');
  const cacheText = $('#fivemCacheText');
  const resetBtn = $('#resetFiveMBtn');
  const openFolderBtn = $('#openFiveMFolderBtn');
  const openLogsBtn = $('#openFiveMLogsBtn');
  const clearBtn = $('#clearCacheBtn');
  if (!pill || !pathBox || !cacheText) return;

  pill.classList.remove('ok', 'err');
  pill.classList.add(status.installed ? 'ok' : 'err');
  pill.textContent = t(status.installed ? 'fivemFound' : 'fivemMissingPill');
  pathBox.textContent = status.path || t('fivemPathMissing');
  pathBox.title = status.path || '';

  const mb = Number(status.cacheMb || 0);
  cacheText.textContent = mb > 0 ? t('cacheLabel').replace('{mb}', String(mb)) : t('cacheEmpty');

  if (resetBtn) resetBtn.style.display = status.customPath ? 'inline-flex' : 'none';
  if (openFolderBtn) openFolderBtn.disabled = !status.installed && !status.appDir;
  if (openLogsBtn) openLogsBtn.disabled = !status.installed && !status.appDir;
  if (clearBtn) clearBtn.disabled = !status.installed && !status.appDir;
}

async function refreshFiveMStatus() {
  const status = await window.astro.checkFiveMInstalled();
  renderFiveMStatus(status);
  return status;
}

async function updateSetting(patch, silentToast = false) {
  launcherSettings = { ...launcherSettings, ...(await window.astro.saveSettings(patch)) };
  if (!silentToast) toast(t('settingsSaved'));
}

window.astro.onUpdateStatus(d => {
  if (!d) return;
  const ver = cleanVersionLabel(d.version);

  if (d.status === 'checking') {
    setUpdateBusy(true);
    setDownloadProgress(0, false);
    setUpdateStatusText(t('checkingUpdates'));
    if (d.manual) toast(t('checkingUpdates'));
    return;
  }

  if (d.status === 'none') {
    setUpdateBusy(false);
    setDownloadProgress(0, false);
    const msg = t('noUpdate').replace('{v}', ver);
    setUpdateStatusText(msg, 'ok');
    if (d.manual) toast(msg);
    return;
  }

  if (d.status === 'available') {
    setUpdateBusy(true);
    setDownloadProgress(0, true);
    const msg = t('updateFound').replace('{v}', ver);
    setUpdateStatusText(msg, 'warn');
    toast(msg);
    return;
  }

  if (d.status === 'downloading') {
    setUpdateBusy(true);
    const pct = d.percent || 0;
    setDownloadProgress(pct, true);
    const msg = t('updateDownloading').replace('{v}', ver).replace('{p}', String(pct));
    setUpdateStatusText(msg, 'warn');
    toast(msg);
    return;
  }

  if (d.status === 'downloaded') {
    setUpdateBusy(true);
    setDownloadProgress(100, true);
    const msg = t('updateDownloaded').replace('{v}', ver);
    setUpdateStatusText(msg, 'ok');
    toast(msg);
    return;
  }

  if (d.status === 'error') {
    setUpdateBusy(false);
    setDownloadProgress(0, false);
    const msg = t('updateError').replace('{m}', d.message || 'Unknown error');
    setUpdateStatusText(msg, 'err');
    if (d.manual) toast(msg);
  }
});

async function triggerManualUpdateCheck() {
  if (updateBusy) return;
  await window.astro.checkUpdate({ manual: true });
}

async function init() {
  config = await window.astro.getConfig();
  launcherSettings = await window.astro.getSettings();

  updateVersionDisplays(config.version || '1.0');
  $('#deServerName').textContent = servers().de.name;
  $('#enServerName').textContent = servers().en.name;

  if ($('#defaultServerSelect')) $('#defaultServerSelect').value = launcherSettings.defaultServer || 'last';
  if ($('#minimizeOnLaunchToggle')) $('#minimizeOnLaunchToggle').checked = Boolean(launcherSettings.minimizeOnLaunch);
  if ($('#openAtLoginToggle')) $('#openAtLoginToggle').checked = Boolean(launcherSettings.openAtLogin);
  if ($('#autoCheckUpdatesToggle')) $('#autoCheckUpdatesToggle').checked = launcherSettings.autoCheckUpdates !== false;
  if ($('#installDirText')) {
    $('#installDirText').textContent = launcherSettings.installDir || '–';
    $('#installDirText').title = launcherSettings.installDir || '';
  }
  if ($('#uninstallBtn')) {
    $('#uninstallBtn').style.display = launcherSettings.canUninstall ? 'inline-flex' : 'none';
  }

  updateLastServer();
  applyLanguage();
  refreshFiveMStatus();

  $$('.nav-item[data-page]').forEach(b => (b.onclick = () => showPage(b.dataset.page)));
  $('#deServerCard').onclick = () => connect('de');
  $('#enServerCard').onclick = () => connect('en');
  $('#lastServerCard').onclick = () => connect(lastServer);
  $('#lastServerCard').onkeydown = e => {
    if (e.key === 'Enter' || e.key === ' ') connect(lastServer);
  };

  window.astro.onWindowState?.(s => applyWindowState(Boolean(s && s.maximized)));
  $('#fullscreenBtn').onclick = () => window.astro.toggleMaximize();
  $('#minBtn').onclick = () => window.astro.minimize();
  $('#closeBtn').onclick = () => window.astro.close();
  $('#checkUpdateBtn').onclick = triggerManualUpdateCheck;
  $('#settingsUpdateBtn').onclick = triggerManualUpdateCheck;

  $('#languageSelect').onchange = e => {
    language = e.target.value;
    localStorage.setItem('astroLanguage', language);
    applyLanguage();
    refreshFiveMStatus();
    toast(t('saved'));
  };
  $('#defaultServerSelect').onchange = e => updateSetting({ defaultServer: e.target.value });
  $('#minimizeOnLaunchToggle').onchange = e => updateSetting({ minimizeOnLaunch: e.target.checked });
  $('#openAtLoginToggle').onchange = e => updateSetting({ openAtLogin: e.target.checked });
  $('#autoCheckUpdatesToggle').onchange = e => updateSetting({ autoCheckUpdates: e.target.checked });

  const pickFiveMPath = async () => {
    const res = await window.astro.browseFiveMPath();
    if (res && res.status) renderFiveMStatus(res.status);
    if (res && !res.canceled) {
      toast(t('pathSaved'));
      hideModal();
    }
  };

  $('#browseFiveMBtn').onclick = pickFiveMPath;
  $('#fivemPickPath').onclick = pickFiveMPath;

  $('#resetFiveMBtn').onclick = async () => {
    const status = await window.astro.resetFiveMPath();
    renderFiveMStatus(status);
    toast(t('pathReset'));
  };

  $('#openFiveMFolderBtn').onclick = async () => {
    const res = await window.astro.openFiveMFolder();
    if (!res.ok) toast(t('folderMissing'));
  };

  $('#openFiveMLogsBtn').onclick = async () => {
    const res = await window.astro.openFiveMLogs();
    if (!res.ok) toast(t('logsMissing'));
  };

  $('#clearCacheBtn').onclick = async () => {
    const btn = $('#clearCacheBtn');
    btn.disabled = true;
    btn.textContent = t('clearingCache');
    try {
      const res = await window.astro.clearFiveMCache();
      if (res.status) renderFiveMStatus(res.status);
      if (!res.ok) {
        if (res.code === 'FIVEM_RUNNING') toast(t('cacheRunning'));
        else toast(t('cacheNoDir'));
      } else {
        toast(t('cacheCleared').replace('{mb}', String(res.freedMb || 0)));
      }
    } finally {
      btn.textContent = t('clearCache');
      await refreshFiveMStatus();
    }
  };

  $('#openInstallDirBtn').onclick = () => window.astro.openInstallDir();
  $('#uninstallBtn').onclick = () => window.astro.launchUninstaller();

  $('#discordBtn').onclick = () => window.astro.openExternal(config.discord || 'https://discord.gg/hTQmhY35V2');
  $('#forumBtn').onclick = () => window.astro.openExternal(config.forum || 'https://gta5astro.eu/');
  $('#topupBtn').onclick = () => toast(t('topupSoon'));
  $('#videoBtn').onclick = () =>
    config.website && config.website !== 'https://example.com'
      ? window.astro.openExternal(config.website)
      : toast(t('videoMissing'));
  $('#heroCard').onclick = () => connect(getHeroServerKey());
  $('#fivemClose').onclick = hideModal;
  $('#fivemDownload').onclick = () => window.astro.openExternal('https://fivem.net/');
  $('#fivemModal').onclick = e => {
    if (e.target.id === 'fivemModal') hideModal();
  };
}

init();
