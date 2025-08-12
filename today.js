// today.js  (ES Module)
import fetch from 'cross-fetch';

export async function getTodayEvents() {
  try {
    console.log('Obteniendo eventos del día...');
    const res = await fetch('https://noveonada.com/proxy/schedule');
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('Datos recibidos:', Object.keys(data));

    // Which day key?  Grab the first one (today).
    const todayKey = Object.keys(data)[0];
    if (!todayKey) {
      throw new Error('No hay datos para hoy');
    }
    
    const dayObj = data[todayKey];
    console.log('Procesando día:', todayKey);

    // Flatten all events with a numeric channel_id
    const events = [];
    const categories = ['PPV Events', 'TV Shows', 'Soccer', 'Cricket', 'Tennis', 'Motorsport', 'WWE', 'Snooker', 'Baseball', 'Basketball', 'Cycling', 'Ice Hockey', 'Volleyball', 'MMA', 'Golf', 'Field Hockey', 'Athletics', 'Bowling', 'Water Sports', 'Squash'];
    
    categories.forEach(cat => {
      if (Array.isArray(dayObj[cat])) {
        dayObj[cat].forEach(ev => {
          if (ev.channels && Array.isArray(ev.channels)) {
            ev.channels.forEach(ch => {
              if (ch.channel_id && !isNaN(+ch.channel_id)) {
                events.push({
                  time: ev.time || 'N/A',
                  title: ev.event || 'Sin título',
                  channelId: ch.channel_id,
                  category: cat
                });
              }
            });
          }
        });
      }
    });

    console.log(`Eventos procesados: ${events.length}`);
    return events; // [{time, title, channelId, category}, …]
    
  } catch (error) {
    console.error('Error en getTodayEvents:', error);
    throw error;
  }
}