const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const { createUpdater, normalizeVersion } = require('./updater');

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 820,
    minWidth: 1080,
    minHeight: 680,
    frame: false,
    resizable: true,
    backgroundColor: '#050a0e',
    icon: path.join(__dirname, 'assets', 'astro.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

function sendUpdateStatus(status, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, ...data });
  }
}

function findFiveM() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  const programFiles = process.env.ProgramFiles || '';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || '';

  const candidates = [
    path.join(localAppData, 'FiveM', 'FiveM.app', 'FiveM.exe'),
    path.join(localAppData, 'FiveM', 'FiveM.app', 'FiveM_bXXXX_GTAProcess.exe'),
    path.join(localAppData, 'FiveM', 'FiveM.exe'),
    path.join(appData, 'FiveM', 'FiveM.app', 'FiveM.exe'),
    path.join(appData, 'FiveM', 'FiveM.exe'),
    path.join(programFiles, 'FiveM', 'FiveM.app', 'FiveM.exe'),
    path.join(programFiles, 'FiveM', 'FiveM.exe'),
    path.join(programFilesX86, 'FiveM', 'FiveM.app', 'FiveM.exe'),
    path.join(programFilesX86, 'FiveM', 'FiveM.exe')
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && path.basename(candidate).toLowerCase() === 'fivem.exe') {
        return candidate;
      }
    } catch {}
  }

  try {
    const result = execFileSync('where.exe', ['FiveM.exe'], {
      windowsHide: true,
      encoding: 'utf8'
    });
    const found = result.split(/\r?\n/).map(x => x.trim()).find(Boolean);
    if (found && fs.existsSync(found)) return found;
  } catch {}

  return null;
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
    if (update.enabled === false || update.checkOnStartup === false) return;

    setTimeout(() => {
      runUpdateCheck(false).catch(() => {});
    }, 500);
  });
}

app.whenReady().then(() => {
  ipcMain.handle('get-config', () => loadConfig());

  ipcMain.on('window-minimize', event => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.on('window-close', event => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.on('window-toggle-fullscreen', event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setFullScreen(!win.isFullScreen());
  });

  ipcMain.handle('check-fivem-installed', () => {
    const fiveMPath = findFiveM();
    return { installed: Boolean(fiveMPath), path: fiveMPath || null };
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
