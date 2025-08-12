// Función para obtener la URL del schedule desde el VPS
async function getScheduleUrl() {
  try {
    // Usar variable de entorno o fallback
    const configApiUrl = import.meta.env.PUBLIC_CONFIG_API_URL || 'https://url.fanstv.info/';
    
  
    
    const configRes = await fetch(configApiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!configRes.ok) {
      throw new Error(`Error obteniendo configuración: ${configRes.status}`);
    }
    
    const config = await configRes.json();
   
    
    if (!config.url) {
      throw new Error('schedule_url no encontrada en la respuesta');
    }
    
    return config.url;
  } catch (error) {
    console.warn('Error obteniendo URL del VPS, usando URL por defecto:', error);
    // Fallback a la URL original si el VPS no responde
    return 'https://thedaddy.dad/schedule/schedule-generated.php';
  }
}

// Función para obtener eventos por días (compatible con Astro y Electron)
export async function getEventsByDays() {
  try {
    // Obtener la URL dinámicamente desde el VPS
    const scheduleUrl = await getScheduleUrl();
    
    // Usar la URL obtenida con headers de navegador para evitar CORS
    const res = await fetch(scheduleUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://thedaddy.dad/',
        'Origin': 'https://thedaddy.dad'
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();

    const eventsByDay = {};
    const allCategories = new Set();
    
    // Procesar cada día en la respuesta
    Object.keys(data).forEach(dayKey => {
      const dayObj = data[dayKey];
      const events = [];
      
      // Extraer todas las categorías dinámicamente
      Object.keys(dayObj).forEach(category => {
        if (Array.isArray(dayObj[category])) {
          allCategories.add(category);
          
          dayObj[category].forEach(ev => {
            const channels = [];
            
            // Procesar channels
            if (ev.channels && Array.isArray(ev.channels)) {
              ev.channels.forEach(ch => {
                if (ch.channel_id && !isNaN(+ch.channel_id)) {
                  channels.push({
                    id: ch.channel_id,
                    name: ch.channel_name || `Canal ${ch.channel_id}`,
                    country: ch.country || 'Internacional',
                    language: ch.language || 'Multi',
                    quality: ch.quality || 'HD'
                  });
                }
              });
            }
            
            // Procesar channels2
            if (ev.channels2 && Array.isArray(ev.channels2)) {
              ev.channels2.forEach(ch => {
                if (ch.channel_id && !isNaN(+ch.channel_id)) {
                  channels.push({
                    id: ch.channel_id,
                    name: ch.channel_name || `Canal ${ch.channel_id}`,
                    country: ch.country || 'Internacional',
                    language: ch.language || 'Multi',
                    quality: ch.quality || 'HD'
                  });
                }
              });
            }
            
            // Solo agregar eventos que tengan canales
            if (channels.length > 0) {
              events.push({
                time: ev.time || 'N/A',
                title: ev.event || 'Sin título',
                channels: channels,
                category: category,
                // Canal principal (el primero) para compatibilidad
                channelId: channels[0].id
              });
            }
          });
        }
      });
      
      if (events.length > 0) {
        eventsByDay[dayKey] = events;
      }
    });

    return {
      eventsByDay,
      categories: Array.from(allCategories).sort()
    };
  } catch (error) {
    console.error('Error obteniendo eventos:', error);
    return getMockEventsByDays();
  }
}

// Función legacy para compatibilidad
export async function getTodayEvents() {
  const { eventsByDay } = await getEventsByDays();
  const firstDay = Object.keys(eventsByDay)[0];
  return firstDay ? eventsByDay[firstDay] : [];
}

// Datos mock para fallback en caso de error
function getMockEventsByDays() {
  return {
    eventsByDay: {
      'Hoy - Eventos de Prueba': [
        { 
          time: '15:00', 
          title: 'Real Madrid vs Barcelona - El Clásico', 
          channelId: '746',
          category: 'Soccer',
          channels: [
            { id: '746', name: 'ESPN España', country: '🇪🇸 España', language: 'Español', quality: 'HD' },
            { id: '747', name: 'Sky Sports UK', country: '🇬🇧 Reino Unido', language: 'Inglés', quality: 'HD' },
            { id: '748', name: 'beIN Sports FR', country: '🇫🇷 Francia', language: 'Francés', quality: 'HD' }
          ]
        },
        { 
          time: '18:30', 
          title: 'Lakers vs Warriors - NBA Finals', 
          channelId: '123',
          category: 'Basketball',
          channels: [
            { id: '123', name: 'ESPN USA', country: '🇺🇸 Estados Unidos', language: 'Inglés', quality: 'HD' },
            { id: '124', name: 'NBA TV', country: '🇺🇸 Estados Unidos', language: 'Inglés', quality: '4K' }
          ]
        }
      ]
    },
    categories: ['Soccer', 'Basketball', 'Tennis', 'MMA', 'Motorsport', 'WWE']
  };
}