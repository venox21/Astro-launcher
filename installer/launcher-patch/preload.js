const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astro', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (patch) => ipcRenderer.invoke('save-settings', patch),
  checkFiveMInstalled: () => ipcRenderer.invoke('check-fivem-installed'),
  browseFiveMPath: () => ipcRenderer.invoke('browse-fivem-path'),
  resetFiveMPath: () => ipcRenderer.invoke('reset-fivem-path'),
  clearFiveMCache: () => ipcRenderer.invoke('clear-fivem-cache'),
  openFiveMFolder: () => ipcRenderer.invoke('open-fivem-folder'),
  openFiveMLogs: () => ipcRenderer.invoke('open-fivem-logs'),
  openInstallDir: () => ipcRenderer.invoke('open-install-dir'),
  launchUninstaller: () => ipcRenderer.invoke('launch-uninstaller'),
  connect: (address) => ipcRenderer.invoke('connect-fivem', address),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  toggleMaximize: () => ipcRenderer.send('window-toggle-maximize'),
  toggleFullscreen: () => ipcRenderer.send('window-toggle-fullscreen'),
  onWindowState: (callback) => ipcRenderer.on('window-state-changed', (_event, data) => callback(data)),
  checkUpdate: (opts) => ipcRenderer.invoke('check-update', opts),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, data) => callback(data))
});
