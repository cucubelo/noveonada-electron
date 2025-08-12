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
let streamWin;

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

// Función para crear ventana de stream con bloqueo agresivo - CORREGIDA
async function createStreamWindow(url) {
  console.log('Creando ventana de stream para:', url);
  
  // VERIFICAR Y CERRAR VENTANA ANTERIOR CORRECTAMENTE
  if (streamWin && !streamWin.isDestroyed()) {
    console.log('Cerrando ventana anterior...');
    streamWin.close();
    streamWin = null;
    // Esperar un poco para asegurar que se cierre completamente
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // CREAR NUEVA VENTANA
  streamWin = new BrowserWindow({
    width: 1000,
    height: 700,
    backgroundColor: '#000',
    webPreferences: {
      preload: undefined,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // MANEJAR CIERRE DE VENTANA
  streamWin.on('closed', () => {
    console.log('Ventana de stream cerrada');
    streamWin = null;
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
  } catch (error) {
    console.error('Error cargando stream:', error);
  }
}

// Manejar la carga de streams - CORREGIDO
ipcMain.handle('load-url', async (_, channelId) => {
  try {
    // CORREGIR LA GENERACIÓN DE URL
    const url = `https://thedaddy.to/embed/stream-${channelId}.php`;
    console.log('Cargando stream con ID:', channelId);
    console.log('URL generada:', url);
    
    await createStreamWindow(url);
    return { success: true };
    
  } catch (error) {
    console.error('Error en load-url handler:', error);
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
  // Cerrar ventana de stream al salir
  if (streamWin && !streamWin.isDestroyed()) {
    streamWin.close();
  }
});