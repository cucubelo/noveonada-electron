// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadStream: (channelId, options = {}) => {
    console.log('Preload: Cargando stream con ID:', channelId);
    return ipcRenderer.invoke('load-url', channelId, options);
  },
  
  // Nuevas funciones para gestión de ventanas
  manageWindows: (action, data) => {
    return ipcRenderer.invoke('manage-windows', action, data);
  },
  
  // Funciones específicas para facilitar el uso
  openNewWindow: (channelId, options = {}) => {
    return ipcRenderer.invoke('load-url', channelId, { newWindow: true, ...options });
  },
  
  listWindows: () => {
    return ipcRenderer.invoke('manage-windows', 'list');
  },
  
  closeWindow: (windowId) => {
    return ipcRenderer.invoke('manage-windows', 'close', { windowId });
  },
  
  focusWindow: (windowId) => {
    return ipcRenderer.invoke('manage-windows', 'focus', { windowId });
  },
  
  closeAllWindows: () => {
    return ipcRenderer.invoke('manage-windows', 'closeAll');
  }
});