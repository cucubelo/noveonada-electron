// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadStream: (channelId) => {
    console.log('Preload: Cargando stream con ID:', channelId);
    // PASAR SOLO EL ID, NO LA URL COMPLETA
    return ipcRenderer.invoke('load-url', channelId);
  }
});