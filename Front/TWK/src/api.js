import { io } from 'socket.io-client';

const BASE_URL = 'http://26.192.246.106:5000'; // Укажите IP сервера

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

  // Лента событий (рождения, смерти)
  getEvents: async (limit = 50) => {
    const res = await fetch(`${BASE_URL}/api/events?limit=${limit}`);
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
};