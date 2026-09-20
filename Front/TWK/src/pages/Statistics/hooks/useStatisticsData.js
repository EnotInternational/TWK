import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { socket, simulationApi } from '../../../api';

// Глобальное хранилище данных телеметрии (синглтон).
// Это предотвращает мигание фейковыми данными при переключении вкладок
// и сохраняет реальную накопленную историю в памяти.
let globalTelemetryState = {
  history: [],
  agents: [],
  events: [],
  currentTick: 0,
  status: 'idle',
  isConnected: socket.connected || false,
  isLive: true,
  timeRange: '100',
  isInitialLoading: true,
  zoneDistribution: { hot: 0, terminator: 0, cold: 0 },
  stateHash: '—'
};

const subscribers = new Set();

function emitChange() {
  for (const subscriber of subscribers) {
    subscriber();
  }
}

function updateGlobalState(updater) {
  if (typeof updater === 'function') {
    globalTelemetryState = updater(globalTelemetryState);
  } else {
    globalTelemetryState = { ...globalTelemetryState, ...updater };
  }
  emitChange();
}

let isSocketInitialized = false;

function initSocketListeners() {
  if (isSocketInitialized) return;
  isSocketInitialized = true;

  socket.on('connect', () => {
    updateGlobalState({ isConnected: true });
    socket.emit('request_field');
  });

  socket.on('disconnect', () => {
    updateGlobalState({ isConnected: false });
  });

  socket.on('simulation:tick', (data) => {
    const tickNum = data.tick ?? 0;
    const agentsList = data.agents || [];
    const m = data.metrics || {};
    const aliveCount = agentsList.length || m.aliveCount || m.total_agents || 0;
    const avgEnergy = m.avg_energy ?? (agentsList.length ? agentsList.reduce((acc, a) => acc + (a.energy || 0), 0) / agentsList.length : 0);
    const terminatorRatio = m.terminator_ratio ?? 0;
    const deathsThisTick = m.deaths ?? 0;
    const birthsThisTick = m.births ?? 0;

    // Рассчитываем распределение по климатическим зонам из реальных агентов
    let hot = 0, term = 0, cold = 0;
    if (agentsList.length > 0) {
      agentsList.forEach(a => {
        const z = (a.zone || '').toLowerCase();
        if (z.includes('hot') || z.includes('sun') || z.includes('day')) hot++;
        else if (z.includes('cold') || z.includes('night') || z.includes('dark')) cold++;
        else term++;
      });
      const total = agentsList.length;
      hot = Math.round((hot / total) * 100);
      term = Math.round((term / total) * 100);
      cold = Math.round((cold / total) * 100);
    }

    updateGlobalState(prev => {
      const last = prev.history[prev.history.length - 1];
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

      // Избегаем дублирования точек с одинаковым номером тика
      let updatedHistory;
      if (last && last.tick === tickNum) {
        updatedHistory = [...prev.history.slice(0, -1), newPoint];
      } else {
        updatedHistory = [...prev.history, newPoint];
      }
      if (updatedHistory.length > 1500) updatedHistory.shift();

      // Обработка новых событий
      let updatedEvents = prev.events;
      if (deathsThisTick > 0 || birthsThisTick > 0) {
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
            text: `Погибло агентов за тик: ${deathsThisTick}`,
            time: 'Только что'
          });
        }
        updatedEvents = [...newEvs, ...prev.events].slice(0, 50);
      }

      return {
        ...prev,
        currentTick: tickNum,
        status: data.status || 'running',
        isConnected: true,
        isInitialLoading: false,
        agents: agentsList,
        history: updatedHistory,
        events: updatedEvents,
        zoneDistribution: { hot, terminator: term, cold },
        stateHash: data.state_hash || prev.stateHash
      };
    });
  });

  // Первоначальный запрос данных с сервера
  const fetchInitialData = async () => {
    try {
      const statusRes = await simulationApi.getStatus();
      if (statusRes) {
        updateGlobalState(prev => ({
          ...prev,
          status: statusRes.status || prev.status,
          currentTick: statusRes.tick !== undefined ? statusRes.tick : prev.currentTick
        }));
      }
    } catch {
      // Игнорируем сетевые сбои
    }

    try {
      const historyRes = await simulationApi.getMetricsHistory(0, 1);
      if (historyRes && Array.isArray(historyRes.history) && historyRes.history.length > 0) {
        updateGlobalState(prev => ({
          ...prev,
          history: historyRes.history,
          isInitialLoading: false
        }));
      }
    } catch {
      // Игнорируем сетевые сбои
    }

    try {
      const distRes = await simulationApi.getDistribution();
      if (distRes && distRes.zones) {
        updateGlobalState({ zoneDistribution: distRes.zones });
      }
    } catch {
      // Игнорируем
    }

    try {
      const evs = await simulationApi.getEvents(30);
      if (evs && Array.isArray(evs)) {
        updateGlobalState({ events: evs });
      }
    } catch {
      // Игнорируем
    }

    socket.emit('request_field');
  };

  fetchInitialData();
}

// Запускаем слушатели сразу при загрузке модуля, чтобы телеметрия собиралась непрерывно
initSocketListeners();

export function useStatisticsData() {
  const [localState, setLocalState] = useState(() => globalTelemetryState);

  useEffect(() => {
    const handleStoreChange = () => {
      setLocalState({ ...globalTelemetryState });
    };

    subscribers.add(handleStoreChange);
    // Принудительный запрос актуального состояния поля
    socket.emit('request_field');

    return () => {
      subscribers.delete(handleStoreChange);
    };
  }, []);

  const setTimeRange = useCallback((newRange) => {
    updateGlobalState({ timeRange: newRange });
  }, []);

  const setIsLive = useCallback((newIsLive) => {
    updateGlobalState(prev => ({
      ...prev,
      isLive: typeof newIsLive === 'function' ? newIsLive(prev.isLive) : newIsLive
    }));
  }, []);

  const history = localState.history;
  const timeRange = localState.timeRange;

  // Фильтрация истории по выбранному временному окну
  const filteredHistory = history.length > 0 ? (() => {
    if (timeRange === 'all') return history;
    const count = parseInt(timeRange, 10) || 100;
    return history.slice(-count);
  })() : [];

  // Последняя точка метрик
  const latestMetric = history.length > 0 ? history[history.length - 1] : {
    alive: localState.agents.length,
    avgEnergy: localState.agents.length 
      ? localState.agents.reduce((acc, a) => acc + (a.energy || 0), 0) / localState.agents.length 
      : 0,
    terminatorRatio: (localState.zoneDistribution?.terminator || 0) / 100,
    dominantGeneration: localState.agents.length 
      ? Math.max(...localState.agents.map(a => a.generation || 0)) 
      : 0,
    cumBirths: 0,
    cumDeaths: 0
  };

  const peakPopulation = history.length > 0 
    ? history.reduce((max, p) => Math.max(max, p.alive || 0), 0) 
    : localState.agents.length;

  const minPopulation = history.length > 0 
    ? history.reduce((min, p) => Math.min(min, p.alive || 0), 9999) 
    : localState.agents.length;

  const totalBirths = latestMetric.cumBirths || history.reduce((acc, p) => acc + (p.births || 0), 0);
  const totalDeaths = latestMetric.cumDeaths || history.reduce((acc, p) => acc + (p.deaths || 0), 0);

  // Топ-10 выживших агентов из РЕАЛЬНОГО списка агентов
  const topAgents = [...localState.agents]
    .sort((a, b) => (b.age || 0) - (a.age || 0))
    .slice(0, 10);

  // Экспорт данных в JSON
  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      exportedAt: new Date().toISOString(),
      currentTick: localState.currentTick,
      status: localState.status,
      metrics: latestMetric,
      history: filteredHistory,
      zoneDistribution: localState.zoneDistribution,
      topAgents
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `terra-nova-metrics-tick-${localState.currentTick}.json`);
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
    link.setAttribute('download', `terra-nova-metrics-tick-${localState.currentTick}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Вычисление расширенной аналитики генофонда популяции
  const geneStats = (() => {
    const agents = localState.agents || [];
    if (!agents.length) {
      return {
        count: 0,
        avgWTemp: 0,
        minWTemp: 0,
        maxWTemp: 0,
        thermophobeCount: 0,
        thermophobePercent: 0,
        avgWSwarm: 0,
        minWSwarm: 0,
        maxWSwarm: 0,
        swarmCount: 0,
        swarmPercent: 0,
        maxGeneration: 0,
        dominantGeneration: 0,
        generationDistribution: {},
        strategies: {
          cooperation_thermophobe: 0,
          lone_thermophobe: 0,
          swarm_extremophile: 0,
          lone_extremophile: 0
        },
        strategyPercents: {
          cooperation_thermophobe: 0,
          lone_thermophobe: 0,
          swarm_extremophile: 0,
          lone_extremophile: 0
        }
      };
    }

    const wTemps = agents.map(a => a.w_temp ?? a.learning?.w_temp ?? 0);
    const wSwarms = agents.map(a => a.w_swarm ?? a.learning?.w_swarm ?? 0);
    const generations = agents.map(a => a.generation || 0);

    const sumTemp = wTemps.reduce((acc, v) => acc + v, 0);
    const sumSwarm = wSwarms.reduce((acc, v) => acc + v, 0);
    const avgWTemp = sumTemp / agents.length;
    const avgWSwarm = sumSwarm / agents.length;

    const minWTemp = Math.min(...wTemps);
    const maxWTemp = Math.max(...wTemps);
    const minWSwarm = Math.min(...wSwarms);
    const maxWSwarm = Math.max(...wSwarms);

    const thermophobes = wTemps.filter(w => w < 0).length;
    const swarmers = wSwarms.filter(w => w > 0).length;

    const genDist = {};
    generations.forEach(g => {
      genDist[g] = (genDist[g] || 0) + 1;
    });

    let domGen = 0;
    let maxGenCount = 0;
    Object.entries(genDist).forEach(([g, c]) => {
      if (c > maxGenCount) {
        maxGenCount = c;
        domGen = Number(g);
      }
    });

    const strategies = {
      cooperation_thermophobe: 0,
      lone_thermophobe: 0,
      swarm_extremophile: 0,
      lone_extremophile: 0
    };

    agents.forEach(a => {
      const wt = a.w_temp ?? a.learning?.w_temp ?? 0;
      const ws = a.w_swarm ?? a.learning?.w_swarm ?? 0;
      if (wt < 0 && ws > 0) strategies.cooperation_thermophobe++;
      else if (wt < 0 && ws <= 0) strategies.lone_thermophobe++;
      else if (wt >= 0 && ws > 0) strategies.swarm_extremophile++;
      else strategies.lone_extremophile++;
    });

    const total = agents.length;
    const strategyPercents = {
      cooperation_thermophobe: Number(((strategies.cooperation_thermophobe / total) * 100).toFixed(1)),
      lone_thermophobe: Number(((strategies.lone_thermophobe / total) * 100).toFixed(1)),
      swarm_extremophile: Number(((strategies.swarm_extremophile / total) * 100).toFixed(1)),
      lone_extremophile: Number(((strategies.lone_extremophile / total) * 100).toFixed(1))
    };

    return {
      count: total,
      avgWTemp: Number(avgWTemp.toFixed(4)),
      minWTemp: Number(minWTemp.toFixed(4)),
      maxWTemp: Number(maxWTemp.toFixed(4)),
      thermophobeCount: thermophobes,
      thermophobePercent: Number(((thermophobes / total) * 100).toFixed(1)),
      avgWSwarm: Number(avgWSwarm.toFixed(4)),
      minWSwarm: Number(minWSwarm.toFixed(4)),
      maxWSwarm: Number(maxWSwarm.toFixed(4)),
      swarmCount: swarmers,
      swarmPercent: Number(((swarmers / total) * 100).toFixed(1)),
      maxGeneration: Math.max(...generations),
      dominantGeneration: domGen,
      generationDistribution: genDist,
      strategies,
      strategyPercents
    };
  })();

  // Отдельный экспорт генов в CSV
  const exportGenesCSV = () => {
    const agents = localState.agents || [];
    const headers = [
      'AgentID',
      'Generation',
      'ParentID',
      'Age',
      'HP_Energy',
      'w_temp',
      'w_swarm',
      'Strategy',
      'Zone',
      'Status',
      'Tick'
    ];
    const rows = agents.map(a => {
      const wt = a.w_temp ?? a.learning?.w_temp ?? 0;
      const ws = a.w_swarm ?? a.learning?.w_swarm ?? 0;
      let strategy = 'Кооперация (термофоб)';
      if (wt < 0 && ws > 0) strategy = 'Термофоб-стайный';
      else if (wt < 0 && ws <= 0) strategy = 'Термофоб-одиночка';
      else if (wt >= 0 && ws > 0) strategy = 'Экстремал-стайный';
      else strategy = 'Экстремал-одиночка';

      return [
        a.id,
        a.generation ?? 0,
        a.parent_id || 'Gen0',
        a.age ?? 0,
        (a.hp ?? a.energy ?? 0).toFixed(2),
        wt.toFixed(4),
        ws.toFixed(4),
        `"${strategy}"`,
        a.zone || 'unknown',
        a.is_alive !== false ? 'Alive' : 'Dead',
        localState.currentTick
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `terra-nova-genes-tick-${localState.currentTick}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Отдельный экспорт генов в JSON
  const exportGenesJSON = () => {
    const agents = localState.agents || [];
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      exportedAt: new Date().toISOString(),
      currentTick: localState.currentTick,
      status: localState.status,
      populationCount: agents.length,
      geneSummary: geneStats,
      agents: agents.map(a => {
        const wt = a.w_temp ?? a.learning?.w_temp ?? 0;
        const ws = a.w_swarm ?? a.learning?.w_swarm ?? 0;
        let strategy = 'Термофоб-стайный';
        if (wt < 0 && ws > 0) strategy = 'Термофоб-стайный';
        else if (wt < 0 && ws <= 0) strategy = 'Термофоб-одиночка';
        else if (wt >= 0 && ws > 0) strategy = 'Экстремал-стайный';
        else strategy = 'Экстремал-одиночка';

        return {
          id: a.id,
          generation: a.generation ?? 0,
          parent_id: a.parent_id || null,
          age: a.age ?? 0,
          hp: a.hp ?? a.energy ?? 0,
          energy: a.energy ?? 0,
          zone: a.zone || null,
          is_alive: a.is_alive !== false,
          w_temp: wt,
          w_swarm: ws,
          strategy,
          learning: a.learning || {
            w_temp: wt,
            w_swarm: ws,
            generation: a.generation ?? 0,
            strategy,
            mutation_rate: 0.5
          }
        };
      })
    }, null, 2));

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `terra-nova-genes-tick-${localState.currentTick}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return {
    history: filteredHistory,
    allHistory: history,
    currentTick: localState.currentTick,
    status: localState.status,
    isConnected: localState.isConnected,
    isLive: localState.isLive,
    setIsLive,
    timeRange,
    setTimeRange,
    isInitialLoading: localState.isInitialLoading && history.length === 0,
    latestMetric,
    peakPopulation,
    minPopulation: minPopulation === 9999 ? 0 : minPopulation,
    totalBirths,
    totalDeaths,
    agents: localState.agents,
    zoneDistribution: localState.zoneDistribution,
    topAgents,
    events: localState.events,
    stateHash: localState.stateHash,
    geneStats,
    exportJSON,
    exportCSV,
    exportGenesCSV,
    exportGenesJSON
  };
}
