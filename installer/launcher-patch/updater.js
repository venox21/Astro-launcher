const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DEFAULT_OWNER = 'venox21';
const DEFAULT_REPO = 'Astro-launcher';
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'raw.githubusercontent.com'
]);

function normalizeVersion(raw) {
  const cleaned = String(raw || '').trim().replace(/^v/i, '');
  const core = cleaned.split(/[-+]/)[0];
  if (!core) return '0.0.0';
  return core;
}

function parseVersionParts(raw) {
  const core = normalizeVersion(raw);
  const parts = core.split('.').map(part => {
    const num = parseInt(part, 10);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  });
  while (parts.length < 3) parts.push(0);
  return parts;
}

function compareVersions(a, b) {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function resolveRepoConfig(updateCfg = {}) {
  const rawOwner = String(updateCfg.owner || '').trim();
  const rawRepo = String(updateCfg.repo || '').trim();
  const isPlaceholderOwner = !rawOwner || rawOwner === 'DEIN-GITHUB-NAME' || rawOwner === 'omgnocap-commits';
  const owner = isPlaceholderOwner ? DEFAULT_OWNER : rawOwner;
  const repo = isPlaceholderOwner || !rawRepo ? DEFAULT_REPO : rawRepo;
  return { owner, repo };
}

function isAllowedHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (ALLOWED_DOWNLOAD_HOSTS.has(host)) return true;
  return host.endsWith('.githubusercontent.com') || host.endsWith('.github.com');
}

function requestJson(url, options = {}) {
  const timeoutMs = options.timeoutMs || 10000;
  const maxRedirects = options.maxRedirects ?? 5;

  return new Promise((resolve, reject) => {
    let settled = false;
    const parsed = new URL(url);
    const req = https.request(
      parsed,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'ASTRO-Launcher-Updater/1.0',
          Accept: 'application/vnd.github+json',
          ...(options.headers || {})
        }
      },
      res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
          res.resume();
          const nextUrl = new URL(res.headers.location, parsed).toString();
          settled = true;
          resolve(requestJson(nextUrl, { ...options, maxRedirects: maxRedirects - 1 }));
          return;
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          if (settled) return;
          settled = true;
          const bodyText = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = bodyText ? JSON.parse(bodyText) : null;
          } catch {
            json = null;
          }
          resolve({ statusCode: res.statusCode || 0, headers: res.headers, bodyText, json });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      if (settled) return;
      settled = true;
      req.destroy(new Error('Zeitüberschreitung bei der GitHub-Anfrage.'));
    });

    req.on('error', err => {
      if (settled) return;
      settled = true;
      reject(err);
    });

    req.end();
  });
}

function selectInstallerAsset(assets) {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const exeAssets = assets.filter(asset => {
    const name = String(asset?.name || '').toLowerCase();
    return name.endsWith('.exe') && !name.includes('uninstall') && Boolean(asset?.browser_download_url);
  });
  if (exeAssets.length === 0) return null;

  const preferred = exeAssets.find(asset => {
    const name = String(asset.name || '').toLowerCase();
    return name.includes('setup') || name.includes('installer') || name.includes('astro');
  });
  return preferred || exeAssets[0];
}

function downloadFileWithProgress(url, destPath, expectedSize, onProgress, maxRedirects = 6) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !isAllowedHost(parsed.hostname)) {
      reject(new Error(`Nicht vertrauenswürdige Download-Domain: ${parsed.hostname}`));
      return;
    }

    let settled = false;
    const req = https.request(
      parsed,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'ASTRO-Launcher-Updater/1.0',
          Accept: 'application/octet-stream'
        }
      },
      res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (maxRedirects <= 0) {
            settled = true;
            reject(new Error('Zu viele Weiterleitungen beim Download.'));
            return;
          }
          const nextUrl = new URL(res.headers.location, parsed).toString();
          settled = true;
          resolve(downloadFileWithProgress(nextUrl, destPath, expectedSize, onProgress, maxRedirects - 1));
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          settled = true;
          reject(new Error(`Download fehlgeschlagen (HTTP ${res.statusCode}).`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10) || expectedSize || 0;
        let receivedBytes = 0;
        let lastReportedPercent = -1;

        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        const fileStream = fs.createWriteStream(destPath);

        res.on('data', chunk => {
          receivedBytes += chunk.length;
          if (totalBytes > 0 && typeof onProgress === 'function') {
            const pct = Math.min(100, Math.round((receivedBytes * 100) / totalBytes));
            if (pct !== lastReportedPercent) {
              lastReportedPercent = pct;
              onProgress(pct, receivedBytes, totalBytes);
            }
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            if (settled) return;
            settled = true;
            resolve({ path: destPath, bytes: receivedBytes });
          });
        });

        const failStream = err => {
          if (settled) return;
          settled = true;
          try {
            fileStream.destroy();
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          } catch {}
          reject(err);
        };

        res.on('error', failStream);
        fileStream.on('error', failStream);
      }
    );

    req.setTimeout(30000, () => {
      if (settled) return;
      settled = true;
      req.destroy(new Error('Zeitüberschreitung beim Herunterladen des Updates.'));
    });

    req.on('error', err => {
      if (settled) return;
      settled = true;
      reject(err);
    });

    req.end();
  });
}

function verifyPeExecutable(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size < 102400) {
    throw new Error('Heruntergeladene Update-Datei ist ungültig oder unvollständig.');
  }
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(2);
    fs.readSync(fd, header, 0, 2, 0);
    if (header[0] !== 0x4d || header[1] !== 0x5a) {
      throw new Error('Heruntergeladene Datei ist keine gültige Windows-Setup-.exe.');
    }
  } finally {
    fs.closeSync(fd);
  }
}

function sanitizeAssetFileName(name) {
  const base = path.basename(String(name || 'ASTRO Launcher Setup.exe'));
  return base.replace(/[^a-zA-Z0-9._ -]/g, '_') || 'ASTRO Launcher Setup.exe';
}

function createUpdater(deps = {}) {
  const apiBaseUrl = (deps.apiBaseUrl || 'https://api.github.com').replace(/\/+$/, '');
  const rawBaseUrl = (deps.rawBaseUrl || 'https://raw.githubusercontent.com').replace(/\/+$/, '');
  const fetchJson = deps.requestJson || requestJson;
  const downloadFile = deps.downloadFile || downloadFileWithProgress;
  const launchInstaller = deps.launchInstaller || ((installerPath) => {
    const child = spawn(installerPath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    child.unref();
  });

  let activePromise = null;

  async function inspectRemoteRelease(owner, repo) {
    const latestUrl = `${apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`;
    const releaseRes = await fetchJson(latestUrl);

    if (releaseRes.statusCode === 200 && releaseRes.json) {
      return {
        kind: 'release',
        tag: releaseRes.json.tag_name || releaseRes.json.name || '',
        assets: releaseRes.json.assets || []
      };
    }

    if (releaseRes.statusCode !== 404) {
      if (releaseRes.statusCode === 403) {
        throw new Error('GitHub API-Limit erreicht. Bitte später erneut versuchen.');
      }
      throw new Error(`GitHub-Antwort unerwartet (HTTP ${releaseRes.statusCode}).`);
    }

    // No published release yet: verify if the repo itself exists and optionally check branch config/version.
    const repoUrl = `${apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const repoRes = await fetchJson(repoUrl);
    if (repoRes.statusCode === 404) {
      return { kind: 'repo-not-found' };
    }
    if (repoRes.statusCode !== 200 || !repoRes.json) {
      throw new Error(`GitHub-Repository konnte nicht geprüft werden (HTTP ${repoRes.statusCode}).`);
    }

    const defaultBranch = repoRes.json.default_branch || 'main';
    for (const relFile of ['resources/config.json', 'config.json', 'version.json']) {
      try {
        const rawUrl = `${rawBaseUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(defaultBranch)}/${relFile}`;
        const rawRes = await fetchJson(rawUrl, { timeoutMs: 6000 });
        if (rawRes.statusCode === 200 && rawRes.json && rawRes.json.version) {
          return {
            kind: 'branch-version',
            tag: String(rawRes.json.version),
            defaultBranch
          };
        }
      } catch {
        // Continue checking fallback version files.
      }
    }

    return { kind: 'no-releases', defaultBranch };
  }

  async function checkAndUpdate({ currentVersion, updateConfig, manual = false, onStatus, onBeforeInstallQuit }) {
    if (activePromise) {
      return await activePromise;
    }

    const emit = (status, data = {}) => {
      if (typeof onStatus === 'function') {
        onStatus(status, { manual, ...data });
      }
    };

    const { owner, repo } = resolveRepoConfig(updateConfig);
    const localVersion = normalizeVersion(currentVersion);

    activePromise = (async () => {
      emit('checking', { version: localVersion, owner, repo });

      try {
        const remote = await inspectRemoteRelease(owner, repo);

        if (remote.kind === 'repo-not-found') {
          const msg = `GitHub-Repository ${owner}/${repo} wurde nicht gefunden oder ist privat.`;
          emit('error', { code: 'REPO_NOT_FOUND', message: msg, version: localVersion });
          return { ok: false, updateAvailable: false, code: 'REPO_NOT_FOUND', error: msg };
        }

        if (remote.kind === 'no-releases') {
          emit('none', { version: localVersion, latestVersion: localVersion, reason: 'no-releases' });
          return { ok: true, updateAvailable: false, version: localVersion, latestVersion: localVersion };
        }

        const remoteVersion = normalizeVersion(remote.tag);
        if (compareVersions(remoteVersion, localVersion) <= 0) {
          emit('none', { version: localVersion, latestVersion: remoteVersion });
          return { ok: true, updateAvailable: false, version: localVersion, latestVersion: remoteVersion };
        }

        if (remote.kind === 'branch-version') {
          const msg = `Neue Version v${remoteVersion} im Repo erkannt, aber es existiert noch kein GitHub Release mit Setup-.exe.`;
          emit('error', { code: 'NO_RELEASE_ASSET', message: msg, version: remoteVersion });
          return { ok: false, updateAvailable: true, code: 'NO_RELEASE_ASSET', error: msg };
        }

        const asset = selectInstallerAsset(remote.assets);
        if (!asset) {
          const msg = `Update v${remoteVersion} auf GitHub gefunden, aber keine Installer-.exe im Release angehängt.`;
          emit('error', { code: 'NO_ASSET', message: msg, version: remoteVersion });
          return { ok: false, updateAvailable: true, code: 'NO_ASSET', error: msg };
        }

        emit('available', { version: remoteVersion, assetName: asset.name });

        const updateDir = path.join(os.tmpdir(), 'astro-launcher-update');
        const destPath = path.join(updateDir, sanitizeAssetFileName(asset.name));

        await downloadFile(asset.browser_download_url, destPath, asset.size || 0, percent => {
          emit('downloading', { version: remoteVersion, percent });
        });

        verifyPeExecutable(destPath);
        emit('downloaded', { version: remoteVersion });

        launchInstaller(destPath);
        if (typeof onBeforeInstallQuit === 'function') {
          onBeforeInstallQuit(remoteVersion);
        }

        return { ok: true, updateAvailable: true, installing: true, version: remoteVersion };
      } catch (err) {
        const message = err && err.message ? err.message : String(err);
        emit('error', { message, version: localVersion });
        return { ok: false, updateAvailable: false, error: message };
      } finally {
        activePromise = null;
      }
    })();

    return await activePromise;
  }

  return {
    checkAndUpdate,
    compareVersions,
    normalizeVersion,
    resolveRepoConfig
  };
}

module.exports = {
  createUpdater,
  compareVersions,
  normalizeVersion,
  resolveRepoConfig,
  selectInstallerAsset
};
