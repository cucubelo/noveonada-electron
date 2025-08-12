// main.js
import { app, BrowserWindow, ipcMain, session } from 'electron';
import { ElectronBlocker } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv'

// Obtener __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let win;
// Cambiar de una sola ventana a un array de ventanas
let streamWindows = new Map(); // Map para gestionar múltiples ventanas por ID
let windowCounter = 0; // Contador para IDs únicos

async function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools:false
    }
  });

  // Detectar si estamos en desarrollo (sin variables de entorno)
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // En desarrollo: usar servidor de Astro
    await win.loadURL('http://localhost:4321');
  } else {
    // En producción: usar archivos estáticos
    await win.loadFile('dist/index.html');
  }
}

// Función para crear ventana de stream con bloqueo agresivo - MODIFICADA PARA MÚLTIPLES VENTANAS
async function createStreamWindow(url, windowId = null, options = {}) {
  // Si no se proporciona windowId, generar uno único
  if (!windowId) {
    windowId = `stream_${Date.now()}`;
  }
  
  // Si la ventana ya existe, enfocarla
  if (streamWindows.has(windowId)) {
    streamWindows.get(windowId).focus();
    return { windowId, action: 'focused' };
  }
  
  // Crear nueva ventana
  const streamWin = new BrowserWindow({
    width: 1200,
    height: 800,
   backgroundColor:"#000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    title: options.title || 'Stream Player', // Usar título personalizado
    icon: path.join(__dirname, 'assets/icon.png')
  });
  
  // Guardar referencia
  streamWindows.set(windowId, streamWin);
  
  // Limpiar referencia cuando se cierre
  streamWin.on('closed', () => {
    streamWindows.delete(windowId);
  });
  
  // Motor de filtros - BLOQUEO AGRESIVO
  const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  blocker.enableBlockingInSession(session.defaultSession);

  // Máximo bloqueo: anular window.open y pop-ups
  streamWin.webContents.on('new-window', (e) => {
    console.log('new-window bloqueado');
    e.preventDefault();
  });
  
  streamWin.webContents.on('will-navigate', (e, navigationUrl) => {
    // Solo permitir navegación a la URL original
    if (!navigationUrl.includes('thedaddy.to')) {
      console.log('Navegación bloqueada:', navigationUrl);
      e.preventDefault();
    }
  });

  // BLOQUEO TOTAL de popups
  streamWin.webContents.setWindowOpenHandler(() => {
    console.log('setWindowOpenHandler: popup bloqueado');
    return { action: 'deny' };
  });

  // Inyectar ANTES que cualquier script del sitio
  streamWin.webContents.on('dom-ready', () => {
    console.log('Inyectando scripts anti-popup...');
    streamWin.webContents.executeJavaScript(`
      console.log('Scripts anti-popup cargados');
      
      // Al inicio del archivo, después de los imports
      require('dotenv').config();
      
      // Luego puedes usar process.env.VITE_CONFIG_API_URL
      // Anula window.open y sus alias COMPLETAMENTE
      window.open = function() {
        console.log('window.open bloqueado');
        return null;
      };
      
      // Anula otras trampas comunes
      window.alert = function() { console.log('alert bloqueado'); return false; };
      window.confirm = function() { console.log('confirm bloqueado'); return false; };
      window.prompt = function() { console.log('prompt bloqueado'); return null; };
      
      // Bloquear eventos de click maliciosos
      document.addEventListener('click', function(e) {
        const element = e.target;
        const tagName = element.tagName.toLowerCase();
        
        // Bloquear clicks en divs y spans sospechosos
        if (tagName === 'div' || tagName === 'span') {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          
          // Detectar overlays y elementos flotantes
          if ((style.position === 'fixed' || style.position === 'absolute') &&
              (parseInt(style.zIndex) > 1000 || 
               element.className.toLowerCase().includes('overlay') ||
               element.className.toLowerCase().includes('popup') ||
               element.className.toLowerCase().includes('ad'))) {
            
            console.log('Click en overlay/popup bloqueado:', element);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            element.style.display = 'none';
            return false;
          }
          
          // Bloquear elementos que cubren toda la pantalla
          if (rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.8) {
            console.log('Click en elemento de pantalla completa bloqueado');
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }
      }, true);
      
      // Remover anuncios agresivamente
      function removeAdsAggressively() {
        const adSelectors = [
          '[id*="ad"]', '[class*="ad"]', '[data-ad]',
          '[id*="banner"]', '[class*="banner"]',
          '[id*="popup"]', '[class*="popup"]', 
          '[id*="overlay"]', '[class*="overlay"]',
          '.advertisement', '#advertisement',
          '.ads', '#ads', '.sponsor', '#sponsor',
          '.modal', '.popup-overlay', '.popup-container'
        ];
        
        let removedCount = 0;
        
        adSelectors.forEach(selector => {
          try {
            document.querySelectorAll(selector).forEach(el => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              const text = el.textContent.toLowerCase();
              
              // Criterios para detectar anuncios
              const isAd = (
                text.includes('ad') || text.includes('sponsor') || 
                text.includes('click') || text.includes('popup') ||
                (rect.width > window.innerWidth * 0.7) ||
                (parseInt(style.zIndex) > 1000 && style.position !== 'static')
              );
              
              if (isAd && (rect.width > 0 || rect.height > 0)) {
                el.remove();
                removedCount++;
              }
            });
          } catch (e) {
            console.log('Error removiendo selector:', selector);
          }
        });
        
        if (removedCount > 0) {
          console.log('Elementos publicitarios removidos:', removedCount);
        }
      }
      
      // Ejecutar inmediatamente y cada segundo
      removeAdsAggressively();
      setInterval(removeAdsAggressively, 1000);
      
      console.log('Bloqueo agresivo activado');
    `);
  });

  try {
    await streamWin.loadURL(url);
    console.log('Stream cargado exitosamente:', url);
    return { windowId, action: 'created' };
  } catch (error) {
    console.error('Error cargando stream:', error);
    streamWindows.delete(windowId);
    throw error;
  }
}

// Manejar la carga de streams - MODIFICADO PARA SOPORTAR TÍTULOS PERSONALIZADOS
ipcMain.handle('load-url', async (_, channelId, options = {}) => {
  try {
    const url = `https://thedaddy.to/embed/stream-${channelId}.php`;
    console.log('Cargando stream con ID:', channelId);
    console.log('URL generada:', url);
    console.log('Opciones:', options);
    
    // Si se especifica replaceWindow, reemplazar contenido en ventana existente
    if (options.replaceWindow && streamWindows.has(options.replaceWindow)) {
      const existingWindow = streamWindows.get(options.replaceWindow);
      console.log('Reemplazando contenido en ventana:', options.replaceWindow);
      
      // Actualizar título si se proporciona
      if (options.title) {
        existingWindow.setTitle(options.title);
      }
      
      try {
        await existingWindow.loadURL(url);
        console.log('Contenido reemplazado exitosamente en ventana existente');
        return { success: true, windowId: options.replaceWindow, action: 'replaced' };
      } catch (error) {
        console.error('Error reemplazando contenido:', error);
        throw error;
      }
    }
    
    // Lógica original para crear nueva ventana
    const windowId = options.newWindow ? null : `channel_${channelId}`;
    const result = await createStreamWindow(url, windowId, options);
    return { success: true, ...result };
    
  } catch (error) {
    console.error('Error en load-url handler:', error);
    return { success: false, error: error.message };
  }
});

// Nuevo handler para gestionar ventanas
ipcMain.handle('manage-windows', async (_, action, data) => {
  try {
    switch (action) {
      case 'list':
        return {
          success: true,
          windows: Array.from(streamWindows.keys()).map(id => ({
            id,
            title: streamWindows.get(id).getTitle()
          }))
        };
        
      case 'close':
        if (streamWindows.has(data.windowId)) {
          streamWindows.get(data.windowId).close();
          return { success: true };
        }
        return { success: false, error: 'Ventana no encontrada' };
        
      case 'focus':
        if (streamWindows.has(data.windowId)) {
          streamWindows.get(data.windowId).focus();
          return { success: true };
        }
        return { success: false, error: 'Ventana no encontrada' };
        
      case 'closeAll':
        streamWindows.forEach(window => {
          if (!window.isDestroyed()) {
            window.close();
          }
        });
        streamWindows.clear();
        return { success: true };
        
      default:
        return { success: false, error: 'Acción no reconocida' };
    }
  } catch (error) {
    console.error('Error en manage-windows handler:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cerrar todas las ventanas de stream al salir
  streamWindows.forEach(window => {
    if (!window.isDestroyed()) {
      window.close();
    }
  });
});