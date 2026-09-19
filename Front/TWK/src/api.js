// api.js
const BASE_URL = 'http://26.192.246.106:5000'; // Актуальный IP вашего бэкенда

// Вспомогательная функция для обработки ответов
const fetchApi = async (endpoint, options = {}) => {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Ошибка API: ${response.status}`);
  return response.json();
};

export const api = {
  // === 1. УПРАВЛЕНИЕ СИМУЛЯЦИЕЙ ===
  simulation: {
    // Инициализация с новыми научными параметрами
    init: (config) => fetchApi('/api/simulation/init', { 
      method: 'POST', 
      body: JSON.stringify(config) 
    }),
    start: (interval_sec) => fetchApi('/api/simulation/start', { 
      method: 'POST', 
      body: JSON.stringify({ interval_sec }) 
    }),
    pause: () => fetchApi('/api/simulation/pause', { method: 'POST' }),
    step: () => fetchApi('/api/simulation/step', { method: 'POST' }),
    reset: () => fetchApi('/api/simulation/reset', { method: 'POST' }),
    setSpeed: (interval_sec) => fetchApi('/api/simulation/speed', { 
      method: 'POST', 
      body: JSON.stringify({ interval_sec }) 
    }),
    getStatus: () => fetchApi('/api/simulation/status')
  },

  // === 2. АГЕНТЫ (Формы жизни) ===
  agents: {
    // Получение списка с фильтрами по зоне Меркурия (hot, cold, terminator)[cite: 13]
    getAll: (zone, alive_only = true) => {
      const params = new URLSearchParams();
      if (zone) params.append('zone', zone);
      params.append('alive_only', alive_only);
      return fetchApi(`/api/agents?${params.toString()}`);
    },
    // Детальная инфа по одному агенту[cite: 14]
    getById: (id) => fetchApi(`/api/agents/${id}`)
  },

  // === 3. СРЕДА И КЛИМАТ ===
  environment: {
    // Координаты Солнца и терминатора[cite: 15]
    getGlobal: () => fetchApi('/api/environment'),
    // Инспекция конкретной клетки[cite: 15]
    getCell: (x, y) => fetchApi(`/api/environment/cell?x=${x}&y=${y}`)
  },

  // === 4. АНАЛИТИКА И МЕТРИКИ ===
  metrics: {
    // Сводка за последний тик[cite: 20]
    getCurrent: () => fetchApi('/api/metrics/current'),
    // Распределение по температурным зонам[cite: 20]
    getDistribution: () => fetchApi('/api/metrics/distribution'),
    // Исторические данные для графиков с шагом прореживания[cite: 21]
    getHistory: (fromTick = 0, toTick, step = 1) => {
      const params = new URLSearchParams({ from_tick: fromTick, step });
      if (toTick) params.append('to_tick', toTick);
      return fetchApi(`/api/metrics/history?${params.toString()}`);
    },
    // Журнал рождений, смертей и вымираний[cite: 16, 17]
    getEvents: (since_tick, type, limit = 50, offset = 0) => {
      const params = new URLSearchParams({ limit, offset });
      if (since_tick) params.append('since_tick', since_tick);
      if (type) params.append('type', type);
      return fetchApi(`/api/events?${params.toString()}`);
    }
  },

  // === 5. НАУЧНЫЕ ЭКСПЕРИМЕНТЫ ===
  experiments: {
    // Запуск N тиков без графики (Headless)[cite: 18]
    runBatch: (ticks) => fetchApi('/api/experiments/run', { 
      method: 'POST', 
      body: JSON.stringify({ ticks }) 
    }),
    // Экспорт датасета для Jupyter/pandas[cite: 17]
    exportData: () => fetchApi('/api/experiments/export'),
    // Проверка воспроизводимости по сиду[cite: 19]
    verify: (seed, ticks) => fetchApi('/api/experiments/verify', { 
      method: 'POST', 
      body: JSON.stringify({ seed, ticks }) 
    })
  },

  // === 6. ЛЕГАСИ (Оставлено для совместимости, если бэк еще требует) ===
  field: {
    init: (width, height, agents_count, seed) => fetchApi('/api/field', { 
      method: 'POST', 
      body: JSON.stringify({ width, height, agents_count, seed }) 
    }),
    get: () => fetchApi('/api/field'),
    clear: () => fetchApi('/api/field', { method: 'DELETE' })
  }
};