import { io } from 'socket.io-client';

const BASE_URL = 'http://localhost:5000'; // Укажите IP сервера

export const socket = io(BASE_URL, {
  transports: ['websocket', 'polling']
});

export const simulationApi = {
  // Инициализировать симуляцию с параметрами и сидом
  init: async (params = {}) => {
    const res = await fetch(`${BASE_URL}/api/simulation/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed: params.seed ?? 42,
        width: params.width ?? 60,
        height: params.height ?? 30,
        initial_agents: params.initialAgents ?? 40,
        starting_energy: params.startingEnergy ?? 100,
        reproduction_threshold: params.reproductionThreshold ?? 140,
        reproduction_cost: params.reproductionCost ?? 50,
        cycle_ticks: params.cycleTicks ?? 200,
        terminator_width: params.terminatorWidth ?? 4,
        wind_penalty: params.windPenalty ?? 0.0,
        rocks_count: params.rocksCount ?? 0,
      }),
    });
    return res.json();
  },

  // Запуск непрерывной авто-симуляции
  start: async (intervalSec = 0.2) => {
    const res = await fetch(`${BASE_URL}/api/simulation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval_sec: intervalSec }),
    });
    return res.json();
  },

  // Пауза
  pause: async () => {
    const res = await fetch(`${BASE_URL}/api/simulation/pause`, { method: 'POST' });
    return res.json();
  },

  // Один ручной шаг (покадровый режим)
  step: async () => {
    const res = await fetch(`${BASE_URL}/api/simulation/step`, { method: 'POST' });
    return res.json();
  },

  // Сброс к тику 0
  reset: async () => {
    const res = await fetch(`${BASE_URL}/api/simulation/reset`, { method: 'POST' });
    return res.json();
  },

  // Изменение скорости на лету
  setSpeed: async (intervalSec) => {
    const res = await fetch(`${BASE_URL}/api/simulation/speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval_sec: intervalSec }),
    });
    return res.json();
  },

  // Получить статус
  getStatus: async () => {
    const res = await fetch(`${BASE_URL}/api/simulation/status`);
    return res.json();
  },

  // История для графиков (численность, энергия, доля в терминаторе)
  getMetricsHistory: async (fromTick = 0, step = 1) => {
    const res = await fetch(`${BASE_URL}/api/metrics/history?from_tick=${fromTick}&step=${step}`);
    return res.json();
  },

  // Распределение по зонам (Hot/Cold/Terminator)
  getDistribution: async () => {
    const res = await fetch(`${BASE_URL}/api/metrics/distribution`);
    return res.json();
  },

  // Метрики генов и эволюционной адаптации
  getGeneMetrics: async () => {
    const res = await fetch(`${BASE_URL}/api/metrics/genes`);
    return res.json();
  },

  // Лента событий (рождения, смерти)
  getEvents: async (limit = 50) => {
    const res = await fetch(`${BASE_URL}/api/events?limit=${limit}`);
    return res.json();
  },

  // Получить детальные данные об агенте по ID
  getAgent: async (agentId) => {
    const res = await fetch(`${BASE_URL}/api/agents/${agentId}`);
    if (!res.ok) return null;
    return res.json();
  },

  // Получить список агентов с опциональными фильтрами
  getAgents: async (zone, aliveOnly = true) => {
    let url = `${BASE_URL}/api/agents?alive_only=${aliveOnly}`;
    if (zone) url += `&zone=${encodeURIComponent(zone)}`;
    const res = await fetch(url);
    if (!res.ok) return { agents: [] };
    return res.json();
  },

  // Проверка научной воспроизводимости (одинаковый seed)
  verifyReproducibility: async (seed = 42, ticks = 50) => {
    const res = await fetch(`${BASE_URL}/api/experiments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed, ticks }),
    });
    return res.json();
  },

  // Вызов катастрофы на бэкенде
  triggerDisaster: async (disasterType, x, y, params) => {
    if (disasterType === 'meteorite') {
      const res = await fetch(`${BASE_URL}/api/simulation/meteorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, radius: params?.radius || 3.0 }),
      });
      return res.json();
    }

    if (disasterType === 'rocks') {
      const res = await fetch(`${BASE_URL}/api/simulation/rocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, size: params?.size || 3 }),
      });
      return res.json();
    }

    if (disasterType === 'depression') {
      const res = await fetch(`${BASE_URL}/api/simulation/depression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, level: params?.level || 1, size: params?.size || 1 }),
      });
      return res.json();
    }

    if (disasterType === 'wind') {
      const res = await fetch(`${BASE_URL}/api/simulation/wind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, strength: params?.strength ?? 7 }),
      });
      return res.json();
    }

    if (disasterType === 'eraser') {
      const res = await fetch(`${BASE_URL}/api/simulation/eraser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, radius: params?.radius || 2 }),
      });
      return res.json();
    }

    console.warn(`[Stub API] Катастрофа ${disasterType} не реализована на бэкенде.`);
    return { success: true };
  }
};

window.triggerDisaster = simulationApi.triggerDisaster;