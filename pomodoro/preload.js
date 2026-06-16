const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pomodoro', {
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body),
  flashWindow: () => ipcRenderer.invoke('flash-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
});
