import { useState, useEffect, useRef, useCallback } from 'react';
import { socket, simulationApi } from '../../../api';

// Генератор реалистичных начальных данных для превью/оффлайн-режима
const generateInitialHistory = (count = 60) => {
  const history = [];
  let pop = 40;
  let totalB = 0;
  let totalD = 0;
  for (let t = 0; t <= count; t++) {
    const deltaB = Math.floor(Math.random() * 3);
    const deltaD = Math.random() > 0.4 ? Math.floor(Math.random() * 2) : 0;
    pop = Math.max(8, pop + deltaB - deltaD);
    totalB += deltaB;
    totalD += deltaD;
    const termRatio = 0.55 + Math.sin(t / 15) * 0.2;
    const energy = 85 + Math.cos(t / 10) * 20;

    history.push({
      tick: t,
      alive: pop,
      deaths: deltaD,
      births: deltaB,
      cumBirths: totalB,
      cumDeaths: totalD,
      avgEnergy: Number(energy.toFixed(1)),
      terminatorRatio: Number(Math.max(0, Math.min(1, termRatio)).toFixed(2)),
      dominantGeneration: Math.min(6, Math.floor(t / 12)),
      stateHash: `0x${(100000 + t * 47).toString(16)}`
    });
  }
  return history;
};

export function useStatisticsData() {
  const [history, setHistory] = useState(() => generateInitialHistory(60));
  const [timeRange, setTimeRange] = useState('100'); // '50' | '100' | '500' | 'all'
  const [isConnected, setIsConnected] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [status, setStatus] = useState('idle');
  const [currentTick, setCurrentTick] = useState(60);
  const [agents, setAgents] = useState([]);
  const [events, setEvents] = useState([
    { id: 1, tick: 58, type: 'birth', text: 'Агент #84 рождён в сумеречной зоне (Gen 4)', time: '1 мин назад' },
    { id: 2, tick: 52, type: 'death', text: 'Агент #19 погиб от истощения энергии (x: 12, y: 15)', time: '3 мин назад' },
    { id: 3, tick: 45, type: 'disaster', text: 'Солнечная вспышка в зоне Zenith, рост температуры', time: '5 мин назад' },
    { id: 4, tick: 38, type: 'evolution', text: 'Зафиксировано 3-е поколение агентов-терминаторов', time: '8 мин назад' },
    { id: 5, tick: 24, type: 'death', text: 'Агент #07 замерз в ночном секторе Mercury Cold', time: '12 мин назад' }
  ]);

  const [zoneDistribution, setZoneDistribution] = useState({
    hot: 15,
    terminator: 65,
    cold: 20
  });

  const [mortalityStats, setMortalityStats] = useState({
    starvation: 45,
    heatShock: 28,
    freezing: 18,
    oldAge: 9
  });

  const hasReceivedSocketData = useRef(false);

  // Обработка входящего тика сокета
  const handleTick = useCallback((data) => {
    hasReceivedSocketData.current = true;
    setIsConnected(true);

    const tickNum = data.tick ?? 0;
    setCurrentTick(tickNum);
    setStatus(data.status || 'running');

    const agentsList = data.agents || [];
    setAgents(agentsList);

    const m = data.metrics || {};
    const aliveCount = agentsList.length || m.aliveCount || m.total_agents || 0;
    const avgEnergy = m.avg_energy ?? (agentsList.length ? agentsList.reduce((acc, a) => acc + (a.energy || 0), 0) / agentsList.length : 0);
    const terminatorRatio = m.terminator_ratio ?? 0.6;
    const deathsThisTick = m.deaths ?? 0;
    const birthsThisTick = m.births ?? 0;

    // Рассчитываем распределение по зонам из живых агентов
    if (agentsList.length > 0) {
      let hot = 0;
      let term = 0;
      let cold = 0;
      agentsList.forEach(a => {
        const z = (a.zone || '').toLowerCase();
        if (z.includes('hot') || z.includes('sun') || z.includes('day')) hot++;
        else if (z.includes('cold') || z.includes('night') || z.includes('dark')) cold++;
        else term++;
      });
      const total = agentsList.length || 1;
      setZoneDistribution({
        hot: Math.round((hot / total) * 100),
        terminator: Math.round((term / total) * 100),
        cold: Math.round((cold / total) * 100)
      });
    }

    setHistory(prev => {
      const last = prev[prev.length - 1];
      const cumB = (last?.cumBirths || 0) + birthsThisTick;
      const cumD = (last?.cumDeaths || 0) + deathsThisTick;
      const dominantGen = agentsList.length 
        ? Math.max(...agentsList.map(a => a.generation || 0)) 
        : (last?.dominantGeneration || 0);

      const newPoint = {
        tick: tickNum,
        alive: aliveCount,
        deaths: deathsThisTick,
        births: birthsThisTick,
        cumBirths: cumB,
        cumDeaths: cumD,
        avgEnergy: Number(avgEnergy.toFixed(1)),
        terminatorRatio: Number(terminatorRatio.toFixed(2)),
        dominantGeneration: dominantGen,
        stateHash: data.state_hash || `0x${tickNum.toString(16)}`
      };

      // Добавляем точку и отсекаем избыточную историю (до 1500 тиков)
      const updated = [...prev, newPoint];
      if (updated.length > 1500) updated.shift();
      return updated;
    });

    // Добавляем новые события, если есть гибели или рождения
    if (deathsThisTick > 0 || birthsThisTick > 0) {
      setEvents(prev => {
        const newEvs = [];
        if (birthsThisTick > 0) {
          newEvs.push({
            id: Date.now() + Math.random(),
            tick: tickNum,
            type: 'birth',
            text: `Рождений за тик: +${birthsThisTick}`,
            time: 'Только что'
          });
        }
        if (deathsThisTick > 0) {
          newEvs.push({
            id: Date.now() + Math.random() + 1,
            tick: tickNum,
            type: 'death',
            text: `Погибло агентов: ${deathsThisTick}`,
            time: 'Только что'
          });
        }
        return [...newEvs, ...prev].slice(0, 40);
      });
    }
  }, []);

  // Подписка на сокет
  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('simulation:tick', handleTick);

    // Запрос статуса и истории при монтировании
    const fetchInitialData = async () => {
      try {
        const statusRes = await simulationApi.getStatus();
        if (statusRes) {
          setStatus(statusRes.status || 'idle');
          if (statusRes.tick !== undefined) setCurrentTick(statusRes.tick);
        }
      } catch {
        // Сервер оффлайн - используем демонстрационные данные
      }

      try {
        const historyRes = await simulationApi.getMetricsHistory(0, 1);
        if (historyRes && Array.isArray(historyRes.history) && historyRes.history.length > 0) {
          setHistory(historyRes.history);
          hasReceivedSocketData.current = true;
        }
      } catch {
        // Сервер оффлайн
      }

      try {
        const distRes = await simulationApi.getDistribution();
        if (distRes && distRes.zones) {
          setZoneDistribution(distRes.zones);
        }
      } catch {
        // Оставляем дефолт
      }

      try {
        const evs = await simulationApi.getEvents(20);
        if (evs && Array.isArray(evs)) {
          setEvents(evs);
        }
      } catch {
        // Оставляем дефолт
      }
    };

    fetchInitialData();
    socket.emit('request_field');

    return () => {
      socket.off('simulation:tick', handleTick);
    };
  }, [handleTick]);

  // Демо-таймер, если сокет не подключен, чтобы страница жила и дышала при тестировании
  useEffect(() => {
    if (isConnected || hasReceivedSocketData.current || !isLive) return;

    const interval = setInterval(() => {
      setCurrentTick(t => {
        const nextTick = t + 1;
        setHistory(prev => {
          const last = prev[prev.length - 1] || { alive: 40, cumBirths: 10, cumDeaths: 5 };
          const deltaB = Math.random() > 0.6 ? 1 : 0;
          const deltaD = Math.random() > 0.7 ? 1 : 0;
          const alive = Math.max(10, last.alive + deltaB - deltaD);
          const energy = Math.max(40, Math.min(140, (last.avgEnergy || 90) + (Math.random() - 0.5) * 6));
          const term = Math.max(0.3, Math.min(0.9, (last.terminatorRatio || 0.6) + (Math.random() - 0.5) * 0.05));

          const point = {
            tick: nextTick,
            alive,
            deaths: deltaD,
            births: deltaB,
            cumBirths: (last.cumBirths || 0) + deltaB,
            cumDeaths: (last.cumDeaths || 0) + deltaD,
            avgEnergy: Number(energy.toFixed(1)),
            terminatorRatio: Number(term.toFixed(2)),
            dominantGeneration: Math.min(10, Math.floor(nextTick / 15)),
            stateHash: `0x${(100000 + nextTick * 47).toString(16)}`
          };
          return [...prev.slice(-300), point];
        });
        return nextTick;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isConnected, isLive]);

  // Фильтрация истории по выбранному диапазону
  const filteredHistory = history.length > 0 ? (() => {
    if (timeRange === 'all') return history;
    const count = parseInt(timeRange, 10) || 100;
    return history.slice(-count);
  })() : [];

  // Расчёт ключевых показателей
  const latestMetric = history[history.length - 1] || {
    alive: 0,
    avgEnergy: 0,
    terminatorRatio: 0,
    dominantGeneration: 0,
    cumBirths: 0,
    cumDeaths: 0
  };

  const peakPopulation = history.reduce((max, p) => Math.max(max, p.alive || 0), 0);
  const minPopulation = history.reduce((min, p) => Math.min(min, p.alive || 9999), 9999);
  const totalBirths = latestMetric.cumBirths || history.reduce((acc, p) => acc + (p.births || 0), 0);
  const totalDeaths = latestMetric.cumDeaths || history.reduce((acc, p) => acc + (p.deaths || 0), 0);

  // Таблица топ-выживших (лидерборд)
  const topAgents = (agents.length > 0 ? agents : [
    { id: 'AG-042', age: 184, energy: 138.4, generation: 5, zone: 'terminator', parent_id: 'AG-012' },
    { id: 'AG-107', age: 142, energy: 125.0, generation: 4, zone: 'terminator', parent_id: 'AG-031' },
    { id: 'AG-089', age: 119, energy: 98.7, generation: 4, zone: 'night', parent_id: 'AG-019' },
    { id: 'AG-215', age: 95, energy: 144.2, generation: 6, zone: 'terminator', parent_id: 'AG-107' },
    { id: 'AG-055', age: 88, energy: 112.5, generation: 3, zone: 'sun', parent_id: 'AG-008' },
    { id: 'AG-304', age: 76, energy: 130.8, generation: 6, zone: 'terminator', parent_id: 'AG-215' }
  ]).sort((a, b) => (b.age || 0) - (a.age || 0)).slice(0, 10);

  // Экспорт данных в JSON
  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      exportedAt: new Date().toISOString(),
      currentTick,
      status,
      metrics: latestMetric,
      history: filteredHistory,
      zoneDistribution,
      topAgents
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `terra-nova-metrics-tick-${currentTick}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Экспорт данных в CSV
  const exportCSV = () => {
    const headers = ['Tick', 'Alive', 'Births', 'Deaths', 'AvgEnergy', 'TerminatorRatio', 'DominantGen', 'StateHash'];
    const rows = filteredHistory.map(p => [
      p.tick,
      p.alive,
      p.births || 0,
      p.deaths || 0,
      p.avgEnergy,
      p.terminatorRatio,
      p.dominantGeneration || 0,
      p.stateHash || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `terra-nova-metrics-tick-${currentTick}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return {
    history: filteredHistory,
    allHistory: history,
    currentTick,
    status,
    isConnected,
    isLive,
    setIsLive,
    timeRange,
    setTimeRange,
    latestMetric,
    peakPopulation,
    minPopulation: minPopulation === 9999 ? 0 : minPopulation,
    totalBirths,
    totalDeaths,
    zoneDistribution,
    mortalityStats,
    topAgents,
    events,
    exportJSON,
    exportCSV
  };
}
