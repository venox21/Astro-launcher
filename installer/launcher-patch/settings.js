const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CACHE_SUBDIRS = ['cache', 'server-cache', 'server-cache-priv'];

const DEFAULT_SETTINGS = {
  customFiveMPath: '',
  minimizeOnLaunch: false,
  autoCheckUpdates: true,
  defaultServer: 'last',
  openAtLogin: false
};

function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const defServer = ['last', 'de', 'en'].includes(src.defaultServer) ? src.defaultServer : 'last';
  return {
    customFiveMPath: typeof src.customFiveMPath === 'string' ? src.customFiveMPath.trim() : '',
    minimizeOnLaunch: Boolean(src.minimizeOnLaunch),
    autoCheckUpdates: src.autoCheckUpdates !== false,
    defaultServer: defServer,
    openAtLogin: Boolean(src.openAtLogin)
  };
}

function getSettingsFilePath(userDataDir) {
  return path.join(userDataDir, 'launcher-settings.json');
}

function loadSettings(userDataDir) {
  const file = getSettingsFilePath(userDataDir);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return normalizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(userDataDir, patch) {
  const current = loadSettings(userDataDir);
  const next = normalizeSettings({ ...current, ...(patch || {}) });
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(getSettingsFilePath(userDataDir), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function findFiveM(customPath = '') {
  if (customPath) {
    try {
      if (fs.existsSync(customPath) && path.extname(customPath).toLowerCase() === '.exe') {
        return customPath;
      }
    } catch {}
  }

  const localAppData = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  const programFiles = process.env.ProgramFiles || '';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || '';

  const candidates = [
    path.join(localAppData, 'FiveM', 'FiveM.app', 'FiveM.exe'),
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

function resolveFiveMAppDir(fiveMExePath) {
  if (fiveMExePath) {
    const dir = path.dirname(fiveMExePath);
    if (path.basename(dir).toLowerCase() === 'fivem.app') {
      return dir;
    }
    const nested = path.join(dir, 'FiveM.app');
    if (fs.existsSync(nested)) {
      return nested;
    }
    if (fs.existsSync(path.join(dir, 'data'))) {
      return dir;
    }
  }

  const localDefault = path.join(process.env.LOCALAPPDATA || '', 'FiveM', 'FiveM.app');
  return fs.existsSync(localDefault) ? localDefault : null;
}

function getDirectorySize(dirPath) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySize(full);
    } else if (entry.isFile()) {
      try {
        total += fs.statSync(full).size;
      } catch {}
    }
  }
  return total;
}

function getCacheStats(fiveMAppDir) {
  if (!fiveMAppDir) return { bytes: 0, mb: 0, dirs: [] };
  const dataDir = path.join(fiveMAppDir, 'data');
  let bytes = 0;
  const dirs = [];

  for (const sub of CACHE_SUBDIRS) {
    const target = path.join(dataDir, sub);
    if (fs.existsSync(target)) {
      dirs.push(target);
      bytes += getDirectorySize(target);
    }
  }

  return { bytes, mb: Math.round(bytes / (1024 * 1024)), dirs };
}

function isFiveMRunning() {
  try {
    const out = execFileSync('tasklist', ['/FO', 'CSV', '/NH'], {
      windowsHide: true,
      encoding: 'utf8'
    });
    return out
      .split(/\r?\n/)
      .some(line => /^"FiveM/i.test(line.trim()));
  } catch {
    return false;
  }
}

function clearFiveMCache(fiveMAppDir) {
  if (!fiveMAppDir) {
    return { ok: false, code: 'FIVEM_NOT_FOUND' };
  }

  if (isFiveMRunning()) {
    return { ok: false, code: 'FIVEM_RUNNING' };
  }

  const dataDir = path.join(fiveMAppDir, 'data');
  let freedBytes = 0;
  let clearedCount = 0;

  for (const sub of CACHE_SUBDIRS) {
    const target = path.join(dataDir, sub);
    if (!fs.existsSync(target)) continue;
    const sizeBefore = getDirectorySize(target);
    try {
      fs.rmSync(target, { recursive: true, force: true });
      freedBytes += sizeBefore;
      clearedCount++;
    } catch {
      const sizeAfter = fs.existsSync(target) ? getDirectorySize(target) : 0;
      freedBytes += Math.max(0, sizeBefore - sizeAfter);
    }
  }

  return {
    ok: true,
    freedBytes,
    freedMb: Math.round(freedBytes / (1024 * 1024)),
    clearedCount
  };
}

function findFiveMLogsTarget(fiveMAppDir) {
  if (!fiveMAppDir) return null;
  const logsDir = path.join(fiveMAppDir, 'logs');
  if (fs.existsSync(logsDir)) return logsDir;
  const logFile = path.join(fiveMAppDir, 'CitizenFX.log');
  if (fs.existsSync(logFile)) return logFile;
  return fs.existsSync(fiveMAppDir) ? fiveMAppDir : null;
}

module.exports = {
  CACHE_SUBDIRS,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  findFiveM,
  resolveFiveMAppDir,
  getCacheStats,
  isFiveMRunning,
  clearFiveMCache,
  findFiveMLogsTarget
};
