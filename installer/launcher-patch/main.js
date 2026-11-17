const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { createUpdater, normalizeVersion } = require('./updater');
const {
  loadSettings,
  saveSettings,
  findFiveM,
  resolveFiveMAppDir,
  getCacheStats,
  clearFiveMCache,
  findFiveMLogsTarget
} = require('./settings');

let mainWindow;
const updater = createUpdater();

function loadConfig() {
  const externalFile = path.join(process.resourcesPath, 'config.json');
  const file = app.isPackaged && fs.existsSync(externalFile) ? externalFile : path.join(__dirname, 'config.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {
      serverName: 'ASTRO',
      servers: { de: { name: 'Server #1 | DE', address: '127.0.0.1:30120' }, en: { name: 'Server #1 | EN', address: '127.0.0.1:30121' } },
      version: 'v1.0',
      discord: 'https://discord.gg/hTQmhY35V2',
      forum: 'https://gta5astro.eu/',
      website: '',
      news: [],
      update: {
        enabled: true,
        checkOnStartup: true,
        provider: 'github',
        owner: 'venox21',
        repo: 'Astro-launcher'
      }
    };
  }
}

function getLauncherInstallDir() {
  return path.dirname(process.execPath);
}

function getFiveMStatus() {
  const settings = loadSettings(app.getPath('userData'));
  const fiveMExe = findFiveM(settings.customFiveMPath);
  const fiveMAppDir = resolveFiveMAppDir(fiveMExe);
  const cache = getCacheStats(fiveMAppDir);
  return {
    installed: Boolean(fiveMExe),
    path: fiveMExe || null,
    appDir: fiveMAppDir || null,
    customPath: settings.customFiveMPath || '',
    cacheMb: cache.mb
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 820,
    minWidth: 1080,
    minHeight: 680,
    frame: false,
    resizable: true,
    maximizable: true,
    backgroundColor: '#050a0e',
    icon: path.join(__dirname, 'assets', 'astro.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('maximize', () => sendWindowState(true));
  mainWindow.on('unmaximize', () => sendWindowState(false));

  mainWindow.loadFile('index.html');
}

function sendWindowState(maximized) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('window-state-changed', { maximized });
  }
}

function sendUpdateStatus(status, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, ...data });
  }
}

async function connectToFiveM(address) {
  const clean = String(address || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^fivem:\/\/connect\//i, '')
    .replace(/^connect\//i, '');

  if (!clean) {
    return { ok: false, code: 'NO_SERVER', error: 'Keine FiveM Server-Adresse gesetzt.' };
  }

  const uri = `fivem://connect/${clean}`;

  try {
    const child = spawn('explorer.exe', [uri], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore'
    });
    child.unref();
    return { ok: true, method: 'windows-shell', uri };
  } catch (e) {
    return {
      ok: false,
      code: 'FIVEM_START_FAILED',
      error: `FiveM konnte nicht über die Windows-Shell gestartet werden: ${e.message || e}`
    };
  }
}

async function runUpdateCheck(manual = false) {
  const cfg = loadConfig();
  const update = cfg.update || {};
  if (update.enabled === false && !manual) {
    return { ok: true, skipped: true };
  }

  const currentVersion = normalizeVersion(cfg.version || '1.0');

  return await updater.checkAndUpdate({
    currentVersion,
    updateConfig: update,
    manual,
    onStatus: (status, data) => sendUpdateStatus(status, data),
    onBeforeInstallQuit: () => {
      setTimeout(() => {
        app.quit();
      }, 350);
    }
  });
}

function setupStartupUpdateCheck() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.once('did-finish-load', () => {
    const cfg = loadConfig();
    const update = cfg.update || {};
    const settings = loadSettings(app.getPath('userData'));
    if (update.enabled === false || update.checkOnStartup === false || settings.autoCheckUpdates === false) {
      return;
    }

    setTimeout(() => {
      runUpdateCheck(false).catch(() => {});
    }, 500);
  });
}

app.whenReady().then(() => {
  ipcMain.handle('get-config', () => loadConfig());

  ipcMain.handle('get-settings', () => {
    const settings = loadSettings(app.getPath('userData'));
    const installDir = getLauncherInstallDir();
    const uninstallerExists = fs.existsSync(path.join(installDir, 'Uninstall ASTRO Launcher.exe'));
    return {
      ...settings,
      installDir,
      canUninstall: uninstallerExists
    };
  });

  ipcMain.handle('save-settings', (_event, patch) => {
    const updated = saveSettings(app.getPath('userData'), patch);
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'openAtLogin') && app.isPackaged) {
      try {
        app.setLoginItemSettings({ openAtLogin: updated.openAtLogin });
      } catch {}
    }
    return updated;
  });

  ipcMain.on('window-minimize', event => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.on('window-close', event => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  const toggleMaximize = event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  };

  ipcMain.on('window-toggle-maximize', toggleMaximize);
  ipcMain.on('window-toggle-fullscreen', toggleMaximize);

  ipcMain.handle('check-fivem-installed', () => getFiveMStatus());

  ipcMain.handle('browse-fivem-path', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'FiveM.exe auswählen',
      properties: ['openFile'],
      filters: [{ name: 'FiveM Executable', extensions: ['exe'] }]
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true, status: getFiveMStatus() };
    }
    const chosen = result.filePaths[0];
    saveSettings(app.getPath('userData'), { customFiveMPath: chosen });
    return { canceled: false, status: getFiveMStatus() };
  });

  ipcMain.handle('reset-fivem-path', () => {
    saveSettings(app.getPath('userData'), { customFiveMPath: '' });
    return getFiveMStatus();
  });

  ipcMain.handle('clear-fivem-cache', () => {
    const status = getFiveMStatus();
    const res = clearFiveMCache(status.appDir);
    return { ...res, status: getFiveMStatus() };
  });

  ipcMain.handle('open-fivem-folder', async () => {
    const status = getFiveMStatus();
    const target = status.appDir || (status.path ? path.dirname(status.path) : null);
    if (!target || !fs.existsSync(target)) {
      return { ok: false, code: 'FIVEM_NOT_FOUND' };
    }
    const err = await shell.openPath(target);
    return { ok: !err, error: err || null };
  });

  ipcMain.handle('open-fivem-logs', async () => {
    const status = getFiveMStatus();
    const target = findFiveMLogsTarget(status.appDir);
    if (!target || !fs.existsSync(target)) {
      return { ok: false, code: 'LOGS_NOT_FOUND' };
    }
    const err = await shell.openPath(target);
    return { ok: !err, error: err || null };
  });

  ipcMain.handle('open-install-dir', async () => {
    const dir = getLauncherInstallDir();
    const err = await shell.openPath(dir);
    return { ok: !err, error: err || null };
  });

  ipcMain.handle('launch-uninstaller', () => {
    const installDir = getLauncherInstallDir();
    const uninstaller = path.join(installDir, 'Uninstall ASTRO Launcher.exe');
    if (!fs.existsSync(uninstaller)) {
      return { ok: false, code: 'UNINSTALLER_NOT_FOUND' };
    }
    const child = spawn(uninstaller, [], {
      cwd: installDir,
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return { ok: true };
  });

  ipcMain.handle('connect-fivem', async (_event, address) => {
    return await connectToFiveM(address);
  });

  ipcMain.handle('open-external', async (_event, url) => {
    if (!url) return { ok: false };
    try {
      const parsed = new URL(String(url));
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { ok: false, error: 'Unsupported URL protocol.' };
      }
      await shell.openExternal(parsed.toString());
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('check-update', async (_event, opts = {}) => {
    return await runUpdateCheck(Boolean(opts && opts.manual));
  });

  createWindow();
  setupStartupUpdateCheck();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      setupStartupUpdateCheck();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
