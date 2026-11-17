const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astro', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  checkFiveMInstalled: () => ipcRenderer.invoke('check-fivem-installed'),
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
