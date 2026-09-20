import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './AgentGrid.module.css';
import { socket } from '../../api';
import Planet3D from './Planet3D';

export const ARCHETYPE_INFO = {
  predator: { label: 'Хищник', icon: '🥩', color: '#ff4757', desc: 'Плотоядный охотник' },
  grazer: { label: 'Солнцеед', icon: '🌱', color: '#7bed9f', desc: 'Чистый фотосинтез' },
  altruist_swarm: { label: 'Альтруист', icon: '🤝', color: '#00d2d3', desc: 'Спасатель сородичей' },
  oasis_guardian: { label: 'Страж оазиса', icon: '🛡️', color: '#e056fd', desc: 'Оборона кратеров' },
  fleeing_prey: { label: 'Беглец', icon: '🕊️', color: '#2ed573', desc: 'Пацифист-беглец' },
  opportunist: { label: 'Оппортунист', icon: '⚖️', color: '#ffa502', desc: 'Сбалансированный' },
};

export function resolveAgentArchetype(a) {
  if (a.archetype) return a.archetype;
  const carnivore = a.carnivore ?? a.learning?.carnivore ?? 0.0;
  const aggression = a.aggression ?? a.learning?.aggression ?? 0.3;
  const fear = a.fear ?? a.learning?.fear ?? 0.5;
  const altruism = a.altruism ?? a.learning?.altruism ?? 0.1;
  const territorial = a.territorial ?? a.learning?.territorial ?? 0.0;
  const wSwarm = a.w_swarm ?? a.learning?.w_swarm ?? 0.0;

  if (territorial >= 0.35 && aggression >= 0.35 && carnivore < 0.6) return 'oasis_guardian';
  if ((carnivore >= 0.45 && aggression >= 0.4) || (aggression >= 0.75 && aggression > fear)) return 'predator';
  if (altruism >= 0.45 && wSwarm > 0.0) return 'altruist_swarm';
  if ((fear >= 0.55 && aggression < 0.4) || (fear >= 0.65 && fear > aggression)) return 'fleeing_prey';
  if (carnivore <= 0.2 && aggression <= 0.25 && territorial <= 0.2) return 'grazer';
  return 'opportunist';
}

export function getAgentColor(agent, mode = 'archetypes') {
  if (mode === 'energy') {
    const energy = agent.energy ?? agent.hp ?? 0;
    if (energy > 120) return '#00ff88';
    if (energy >= 60) return '#ffd000';
    return '#ff3344';
  }
  if (mode === 'trophic') {
    const carnivore = Math.min(1.0, Math.max(0.0, agent.carnivore ?? agent.learning?.carnivore ?? 0.0));
    const hue = Math.round(140 - carnivore * 145);
    return `hsl(${hue}, 90%, 62%)`;
  }
  // Archetypes mode (default)
  const arc = resolveAgentArchetype(agent);
  return ARCHETYPE_INFO[arc]?.color || ARCHETYPE_INFO.opportunist.color;
}

export default function AgentGrid({ 
  onMetricsUpdate, 
  onAgentSelect, 
  onAgentUpdate,
  selectedAgent = null,
  gridWidth = 60, 
  gridHeight = 30, 
  selectedDisaster = null, 
  disasterParams = {} 
}) {
  const [viewMode, setViewMode] = useState('3d'); // '3d' | '2d'
  const [colorMode, setColorMode] = useState('archetypes'); // 'archetypes' | 'energy' | 'trophic'
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [agents, setAgents] = useState([]);
  const [environment, setEnvironment] = useState(null);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const colorModeRef = useRef(colorMode);
  
  const selectedDisasterRef = useRef(selectedDisaster);
  const disasterParamsRef = useRef(disasterParams);

  useEffect(() => {
    selectedDisasterRef.current = selectedDisaster;
    disasterParamsRef.current = disasterParams;
    
    if (containerRef.current) {
      containerRef.current.style.cursor = selectedDisaster ? 'crosshair' : 'grab';
    }
  }, [selectedDisaster, disasterParams]);

  // Shared crater and disaster state between 2D and 3D
  const latestAgentsRef = useRef([]);
  const latestEnvRef = useRef(null);
  const cratersRef = useRef([]);
  const craterEpicentersRef = useRef(new Set());
  const windsRef = useRef([]);
  const selectedAgentIdRef = useRef(null);

  const lastTickRef = useRef(0);
  const onAgentSelectRef = useRef(onAgentSelect);
  const onAgentUpdateRef = useRef(onAgentUpdate);
  const onMetricsUpdateRef = useRef(onMetricsUpdate);
  const draw2DRef = useRef(null);
  const viewModeRef = useRef(viewMode);

  useEffect(() => {
    selectedAgentIdRef.current = selectedAgent ? selectedAgent.id : null;
  }, [selectedAgent]);

  useEffect(() => {
    onAgentSelectRef.current = onAgentSelect;
    onAgentUpdateRef.current = onAgentUpdate;
    onMetricsUpdateRef.current = onMetricsUpdate;
    draw2DRef.current = draw2D;
    viewModeRef.current = viewMode;
  });

  const addCrater = useCallback((crater) => {
    const id = crater.id || `crater_${crater.x}_${crater.y}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newCrater = {
      id,
      x: crater.x,
      y: crater.y,
      radius: crater.radius || 3.0,
      createdAt: crater.createdAt || Date.now(),
      duration: crater.duration || 25000,
    };
    if (!cratersRef.current.some(c => c.id === id)) {
      cratersRef.current.push(newCrater);
    }
    craterEpicentersRef.current.add(`${crater.x},${crater.y}`);
    return newCrater;
  }, []);

  const removeCratersNear = useCallback((gridX, gridY, radius, width) => {
    const w = width || gridWidth;
    cratersRef.current = cratersRef.current.filter(c => {
      let dx = Math.abs(c.x - gridX);
      dx = Math.min(dx, w - dx);
      const dy = Math.abs(c.y - gridY);
      return Math.sqrt(dx * dx + dy * dy) > radius;
    });
  }, [gridWidth]);

  const camera = useRef({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });
  const hasDragged = useRef(false);

  const draw2D = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.translate(camera.current.x, camera.current.y);
    ctx.scale(camera.current.scale, camera.current.scale);

    const env = latestEnvRef.current;
    const w = env?.width || gridWidth;
    const h = env?.height || gridHeight;

    const baseCellSize = Math.floor(Math.min(rect.width / w, rect.height / h)) || 10;
    const actualW = baseCellSize * w;
    const actualH = baseCellSize * h;

    // Draw Cold Zone
    ctx.fillStyle = 'rgba(0, 100, 255, 0.05)';
    ctx.fillRect(0, 0, actualW, actualH);

    // Draw Hot Zone
    if (env?.sun_x !== undefined) {
      const quarter = env.width / 4;
      const hotStart = (env.sun_x - quarter + env.width) % env.width;
      const hotWidth = env.width / 2;

      ctx.fillStyle = 'rgba(255, 100, 0, 0.06)';
      if (hotStart + hotWidth > env.width) {
        const overflow = (hotStart + hotWidth) - env.width;
        ctx.fillRect(hotStart * baseCellSize, 0, (hotWidth - overflow) * baseCellSize, actualH);
        ctx.fillRect(0, 0, overflow * baseCellSize, actualH);
      } else {
        ctx.fillRect(hotStart * baseCellSize, 0, hotWidth * baseCellSize, actualH);
      }
    }

    // Draw Terminator bands
    if (env?.terminator_bands) {
      env.terminator_bands.forEach((band) => {
        const xStart = band.min_x * baseCellSize;
        const width = band.width * baseCellSize;

        ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
        if (band.min_x + band.width > env.width) {
          const overflow = (band.min_x + band.width) - env.width;
          ctx.fillRect(xStart, 0, (band.width - overflow) * baseCellSize, actualH);
          ctx.fillRect(0, 0, overflow * baseCellSize, actualH);
        } else {
          ctx.fillRect(xStart, 0, width, actualH);
        }

        // Terminator center line
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
        ctx.lineWidth = 1 / camera.current.scale;
        ctx.beginPath();
        ctx.moveTo(band.center_x * baseCellSize, 0);
        ctx.lineTo(band.center_x * baseCellSize, actualH);
        ctx.stroke();
      });
    }

    // Draw Sun line
    if (env?.sun_x !== undefined) {
      ctx.strokeStyle = 'rgba(255, 190, 0, 0.7)';
      ctx.lineWidth = 2 / camera.current.scale;
      ctx.setLineDash([10 / camera.current.scale, 10 / camera.current.scale]);
      ctx.beginPath();
      ctx.moveTo(env.sun_x * baseCellSize, 0);
      ctx.lineTo(env.sun_x * baseCellSize, actualH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Winds (Bottom layer)
    windsRef.current.forEach(wind => {
      const r = Math.floor(wind.strength || 7);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= r) {
            const cx = (wind.x + dx + w) % w;
            const cy = wind.y + dy;
            if (cy >= 0 && cy < h) {
              const opacity = (wind.ticksLeft !== undefined ? wind.ticksLeft / 20 : 1) * 0.5;
              ctx.fillStyle = `rgba(211, 211, 211, ${opacity})`;
              ctx.fillRect(cx * baseCellSize, cy * baseCellSize, baseCellSize, baseCellSize);
            }
          }
        }
      }
    });

    // Draw Depressions (Углубления: оазисы на свету, холодные впадины в темноте)
    if (env?.depressions) {
      env.depressions.forEach(dep => {
        let dx = Math.abs(dep.x - (env.sun_x ?? 0));
        dx = Math.min(dx, w - dx);
        const isSunlit = dx <= (w / 4);

        const px = dep.x * baseCellSize;
        const py = dep.y * baseCellSize;

        if (isSunlit) {
          // Habitable Oasis where cold depression meets hot sunlight
          if (dep.level === 2) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.45)'; // emerald oasis
            ctx.fillRect(px, py, baseCellSize, baseCellSize);
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
            ctx.lineWidth = 1.5 / camera.current.scale;
            ctx.strokeRect(px + 1, py + 1, baseCellSize - 2, baseCellSize - 2);
            // Center spring pool
            ctx.fillStyle = 'rgba(6, 182, 212, 0.6)';
            ctx.fillRect(px + baseCellSize * 0.25, py + baseCellSize * 0.25, baseCellSize * 0.5, baseCellSize * 0.5);
          } else {
            ctx.fillStyle = 'rgba(20, 184, 166, 0.35)'; // cyan-teal oasis
            ctx.fillRect(px, py, baseCellSize, baseCellSize);
            ctx.strokeStyle = 'rgba(45, 212, 191, 0.65)';
            ctx.lineWidth = 1 / camera.current.scale;
            ctx.strokeRect(px + 0.5, py + 0.5, baseCellSize - 1, baseCellSize - 1);
          }
        } else {
          // Cold pit in dark hemisphere
          if (dep.level === 2) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // deep dark pit
            ctx.fillRect(px, py, baseCellSize, baseCellSize);
            ctx.strokeStyle = 'rgba(30, 58, 138, 0.8)';
            ctx.lineWidth = 1.5 / camera.current.scale;
            ctx.strokeRect(px + 1, py + 1, baseCellSize - 2, baseCellSize - 2);
            ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
            ctx.fillRect(px + baseCellSize * 0.2, py + baseCellSize * 0.2, baseCellSize * 0.6, baseCellSize * 0.6);
          } else {
            ctx.fillStyle = 'rgba(30, 41, 59, 0.6)'; // sunken shadowed cell
            ctx.fillRect(px, py, baseCellSize, baseCellSize);
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
            ctx.lineWidth = 1 / camera.current.scale;
            ctx.strokeRect(px + 0.5, py + 0.5, baseCellSize - 1, baseCellSize - 1);
          }
        }
      });
    }

    // Draw Rocks
    if (env?.rocks) {
      env.rocks.forEach(r => {
        const isCraterEpicenter = craterEpicentersRef.current.has(`${r.x},${r.y}`) ||
          cratersRef.current.some(c => c.x === r.x && c.y === r.y);

        if (isCraterEpicenter) {
          // Large prominent meteorite rock ("камень остающийся в краторе сделать больше")
          const bigSize = Math.max(10, baseCellSize * 1.6);
          const bigOffset = (baseCellSize - bigSize) / 2;
          const rx = r.x * baseCellSize + bigOffset;
          const ry = r.y * baseCellSize + bigOffset;

          ctx.fillStyle = '#1c1917'; // Deep charred basalt
          ctx.fillRect(rx, ry, bigSize, bigSize);

          ctx.strokeStyle = '#44403c';
          ctx.lineWidth = Math.max(1, baseCellSize * 0.15);
          ctx.strokeRect(rx, ry, bigSize, bigSize);

          ctx.fillStyle = '#292524';
          ctx.fillRect(rx + bigSize * 0.2, ry + bigSize * 0.2, bigSize * 0.6, bigSize * 0.6);
        } else {
          ctx.fillStyle = '#666';
          ctx.fillRect(r.x * baseCellSize, r.y * baseCellSize, baseCellSize, baseCellSize);
        }
      });
    }

    // Draw Craters (fade over time with central stone)
    const now = Date.now();
    cratersRef.current = cratersRef.current.filter(c => !c.createdAt || (now - c.createdAt < (c.duration || 25000)));

    cratersRef.current.forEach(crater => {
      const elapsed = crater.createdAt ? now - crater.createdAt : 0;
      const duration = crater.duration || 25000;
      const progress = elapsed / duration;
      const fade = progress > 0.5 ? Math.max(0, 1 - (progress - 0.5) / 0.5) : 1.0;

      const r = Math.floor(crater.radius);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= r) {
            const cx = (crater.x + dx + w) % w;
            const cy = crater.y + dy;
            if (cy >= 0 && cy < h) {
              if (dist < r * 0.3) {
                ctx.fillStyle = `rgba(255, 69, 0, ${0.6 * fade})`; // red
              } else if (dist < r * 0.7) {
                ctx.fillStyle = `rgba(255, 140, 0, ${0.6 * fade})`; // orange
              } else {
                ctx.fillStyle = `rgba(139, 69, 19, ${0.6 * fade})`; // brown
              }
              ctx.fillRect(cx * baseCellSize, cy * baseCellSize, baseCellSize, baseCellSize);
            }
          }
        }
      }

      // Draw central stone ("посреди кратера должен быть камень" - "камень остающийся в краторе сделать больше")
      const stoneSize = Math.max(10, baseCellSize * 1.6);
      const stoneOffset = (baseCellSize - stoneSize) / 2;
      const sx = crater.x * baseCellSize + stoneOffset;
      const sy = crater.y * baseCellSize + stoneOffset;

      ctx.fillStyle = `rgba(28, 25, 23, ${fade * 0.98})`;
      ctx.fillRect(sx, sy, stoneSize, stoneSize);

      ctx.strokeStyle = `rgba(12, 10, 9, ${fade})`;
      ctx.lineWidth = Math.max(1, baseCellSize * 0.15);
      ctx.strokeRect(sx, sy, stoneSize, stoneSize);

      ctx.fillStyle = `rgba(68, 64, 60, ${fade * 0.85})`;
      ctx.fillRect(sx + stoneSize * 0.15, sy + stoneSize * 0.15, stoneSize * 0.5, stoneSize * 0.5);

      if (progress < 0.25) {
        const emberAlpha = (1 - progress / 0.25) * 0.9;
        ctx.fillStyle = `rgba(255, 69, 0, ${emberAlpha})`;
        ctx.fillRect(sx + stoneSize * 0.35, sy + stoneSize * 0.35, stoneSize * 0.3, stoneSize * 0.3);
      }
    });

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1 / camera.current.scale;
    ctx.beginPath();
    for (let i = 0; i <= w; i++) {
      ctx.moveTo(i * baseCellSize, 0);
      ctx.lineTo(i * baseCellSize, actualH);
    }
    for (let i = 0; i <= h; i++) {
      ctx.moveTo(0, i * baseCellSize);
      ctx.lineTo(actualW, i * baseCellSize);
    }
    ctx.stroke();

    // Draw Agents
    latestAgentsRef.current.forEach(agent => {
      ctx.fillStyle = getAgentColor(agent, colorModeRef.current);

      if (agent.isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 / camera.current.scale;
        ctx.strokeRect(agent.x * baseCellSize, agent.y * baseCellSize, baseCellSize, baseCellSize);
      }

      ctx.fillRect(agent.x * baseCellSize + 0.5, agent.y * baseCellSize + 0.5, baseCellSize - 1, baseCellSize - 1);
    });
  }, [gridWidth, gridHeight]);
  draw2DRef.current = draw2D;

  useEffect(() => {
    colorModeRef.current = colorMode;
    draw2D();
  }, [colorMode, draw2D]);

  // Socket listener & data management
  useEffect(() => {
    const handleTick = (data) => {
      const currentAgents = data.agents || [];
      const currentEnv = data.environment || null;

      latestAgentsRef.current = currentAgents;
      latestEnvRef.current = currentEnv;

      setAgents(currentAgents);
      setEnvironment(currentEnv);

      const isReset = lastTickRef.current > 0 && data.tick === 0;
      lastTickRef.current = data.tick;

      if (isReset) {
        cratersRef.current = [];
        craterEpicentersRef.current.clear();
        windsRef.current = [];
      } else {
        windsRef.current = windsRef.current.filter(w => {
          if (w.ticksLeft !== undefined) {
            w.ticksLeft -= 1;
            return w.ticksLeft > 0;
          }
          return true;
        });
      }

      if (selectedAgentIdRef.current !== null) {
        const updatedAgent = currentAgents.find(a => a.id === selectedAgentIdRef.current);
        const notifyUpdate = onAgentUpdateRef.current || onAgentSelectRef.current;
        if (updatedAgent) {
          updatedAgent.isSelected = true;
          notifyUpdate?.(updatedAgent);
        } else if (isReset) {
          selectedAgentIdRef.current = null;
          onAgentSelectRef.current?.(null);
        } else {
          notifyUpdate?.(prev => {
            if (prev && prev.id === selectedAgentIdRef.current) {
              return {
                ...prev,
                is_alive: false,
                energy: 0,
                hp: 0,
                death_reason: prev.death_reason || 'Погиб (истощение / среда)',
                death_tick: data.tick,
              };
            }
            return null;
          });
        }
      }

      if (data.metrics) {
        onMetricsUpdateRef.current?.({
          ...data.metrics,
          tick: data.tick,
          status: data.status,
          hash: data.state_hash,
          aliveCount: currentAgents.length
        });
      }

      if (viewModeRef.current === '2d') {
        draw2DRef.current?.();
      }
    };

    socket.on('simulation:tick', handleTick);

    // Initial request
    socket.emit('request_field');

    return () => {
      socket.off('simulation:tick', handleTick);
    };
  }, []);

  // 2D animation loop for smooth crater/wind fading
  useEffect(() => {
    if (viewMode !== '2d') return;
    let animId;
    const loop = () => {
      draw2D();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [viewMode, draw2D]);

  const applyDisasterLocal = useCallback((type, gridX, gridY, params) => {
    if (window.triggerDisaster) {
      window.triggerDisaster(type, gridX, gridY, params);
    }
    const w = gridWidth;
    const h = gridHeight;

    if (type === 'meteorite') {
      const rad = params?.radius || 3.0;
      addCrater({
        x: gridX,
        y: gridY,
        radius: rad,
        createdAt: Date.now(),
        duration: 25000,
      });
      if (latestEnvRef.current) {
        if (!latestEnvRef.current.rocks) latestEnvRef.current.rocks = [];
        latestEnvRef.current.rocks = latestEnvRef.current.rocks.filter(r => {
          let dx = Math.abs(r.x - gridX);
          dx = Math.min(dx, w - dx);
          const dy = Math.abs(r.y - gridY);
          return Math.sqrt(dx * dx + dy * dy) > rad;
        });
        // Leave permanent rock in the center
        latestEnvRef.current.rocks.push({ x: gridX, y: gridY });

        // Add depression cells (level 2 near center, level 1 further out)
        if (!latestEnvRef.current.depressions) latestEnvRef.current.depressions = [];
        const rInt = Math.ceil(rad);
        for (let dy = -rInt; dy <= rInt; dy++) {
          for (let dx = -rInt; dx <= rInt; dx++) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= rad) {
              const nx = (gridX + dx + w) % w;
              const ny = gridY + dy;
              if (ny >= 0 && ny < h) {
                const lvl = d <= rad * 0.5 ? 2 : 1;
                const ex = latestEnvRef.current.depressions.findIndex(dep => dep.x === nx && dep.y === ny);
                if (ex >= 0) {
                  latestEnvRef.current.depressions[ex].level = Math.max(latestEnvRef.current.depressions[ex].level, lvl);
                } else {
                  latestEnvRef.current.depressions.push({ x: nx, y: ny, level: lvl });
                }
              }
            }
          }
        }
      }
    } else if (type === 'depression') {
      const lvl = parseInt(params?.level || 1);
      const sz = parseInt(params?.size || 2);
      const offset = Math.floor(sz / 2);
      if (latestEnvRef.current) {
        if (!latestEnvRef.current.depressions) latestEnvRef.current.depressions = [];
        for (let dy = -offset; dy < sz - offset; dy++) {
          for (let dx = -offset; dx < sz - offset; dx++) {
            const nx = (gridX + dx + w) % w;
            const ny = gridY + dy;
            if (ny >= 0 && ny < h) {
              const ex = latestEnvRef.current.depressions.findIndex(d => d.x === nx && d.y === ny);
              if (ex >= 0) {
                latestEnvRef.current.depressions[ex].level = lvl;
              } else {
                latestEnvRef.current.depressions.push({ x: nx, y: ny, level: lvl });
              }
            }
          }
        }
      }
    } else if (type === 'eraser') {
      const rad = params?.radius || 2.0;
      if (latestEnvRef.current && latestEnvRef.current.rocks) {
        latestEnvRef.current.rocks = latestEnvRef.current.rocks.filter(r => {
          let dx = Math.abs(r.x - gridX);
          dx = Math.min(dx, w - dx);
          const dy = Math.abs(r.y - gridY);
          return Math.sqrt(dx * dx + dy * dy) > rad;
        });
      }
      if (latestEnvRef.current && latestEnvRef.current.depressions) {
        latestEnvRef.current.depressions = latestEnvRef.current.depressions.filter(d => {
          let dx = Math.abs(d.x - gridX);
          dx = Math.min(dx, w - dx);
          const dy = Math.abs(d.y - gridY);
          return Math.sqrt(dx * dx + dy * dy) > rad;
        });
      }
      removeCratersNear(gridX, gridY, rad, w);
    } else if (type === 'wind') {
      windsRef.current.push({
        x: gridX,
        y: gridY,
        strength: params?.strength ?? 7,
        direction: params?.direction || 'east',
        ticksLeft: 20
      });
    } else if (type === 'rocks') {
      const size = params?.size || 3;
      const half = Math.floor(size / 2);
      if (latestEnvRef.current) {
        if (!latestEnvRef.current.rocks) latestEnvRef.current.rocks = [];
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            const rx = (gridX + dx + w) % w;
            const ry = gridY + dy;
            if (ry >= 0 && ry < h) {
              if (!latestEnvRef.current.rocks.some(r => r.x === rx && r.y === ry)) {
                latestEnvRef.current.rocks.push({ x: rx, y: ry });
              }
            }
          }
        }
      }
    }
  }, [gridWidth, gridHeight, addCrater, removeCratersNear]);

  useEffect(() => {
    if (viewMode !== '2d') return;
    const handleAutoDisaster = (e) => {
      const { type, x, y, params } = e.detail;
      applyDisasterLocal(type, x, y, params);
      draw2D();
    };
    window.addEventListener('autoDisaster', handleAutoDisaster);
    return () => window.removeEventListener('autoDisaster', handleAutoDisaster);
  }, [applyDisasterLocal, viewMode, draw2D]);

  // 2D Mouse & Interaction listeners
  useEffect(() => {
    if (viewMode !== '2d') return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomStep = 0.15;
      const newScale = e.deltaY < 0 
        ? camera.current.scale + zoomStep 
        : camera.current.scale - zoomStep;
      
      const clampedScale = Math.max(0.3, Math.min(newScale, 15)); 
      const scaleRatio = clampedScale / camera.current.scale;

      camera.current.x = mouseX - (mouseX - camera.current.x) * scaleRatio;
      camera.current.y = mouseY - (mouseY - camera.current.y) * scaleRatio;
      camera.current.scale = clampedScale;
      draw2D(); 
    };

    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      isDragging.current = true;
      hasDragged.current = false;
      dragStart.current = { 
        x: e.clientX - camera.current.x, 
        y: e.clientY - camera.current.y,
        initialX: e.clientX,
        initialY: e.clientY
      };
      container.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = Math.abs(e.clientX - dragStart.current.initialX);
      const dy = Math.abs(e.clientY - dragStart.current.initialY);
      if (dx > 3 || dy > 3) hasDragged.current = true; 
      
      camera.current.x = e.clientX - dragStart.current.x;
      camera.current.y = e.clientY - dragStart.current.y;
      draw2D(); 
    };

    const handleMouseUp = (e) => {
      if (e.button !== 0) return;
      isDragging.current = false;
      
      const currentSelectedDisaster = selectedDisasterRef.current;
      const currentDisasterParams = disasterParamsRef.current;
      
      container.style.cursor = currentSelectedDisaster ? 'crosshair' : 'grab';

      if (!hasDragged.current) {
        const rect = canvas.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
          onAgentSelect(null);
          draw2D();
          return;
        }

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - camera.current.x) / camera.current.scale;
        const worldY = (mouseY - camera.current.y) / camera.current.scale;

        const env = latestEnvRef.current;
        const w = env?.width || gridWidth;
        const h = env?.height || gridHeight;
        const baseCellSize = Math.floor(Math.min(rect.width / w, rect.height / h)) || 10;
        
        const gridX = Math.floor(worldX / baseCellSize);
        const gridY = Math.floor(worldY / baseCellSize);

        const clickedAgent = latestAgentsRef.current.find(a => a.x === gridX && a.y === gridY);
        
        if (clickedAgent) {
          latestAgentsRef.current.forEach(a => a.isSelected = false);
          clickedAgent.isSelected = true;
          selectedAgentIdRef.current = clickedAgent.id;
          onAgentSelect(clickedAgent);
        } else if (!currentSelectedDisaster) {
          latestAgentsRef.current.forEach(a => a.isSelected = false);
          selectedAgentIdRef.current = null;
          onAgentSelect(null);
        }

        if (currentSelectedDisaster) {
          applyDisasterLocal(currentSelectedDisaster, gridX, gridY, currentDisasterParams);
          draw2D();
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    draw2D();

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [viewMode, draw2D, gridWidth, gridHeight, onAgentSelect, addCrater, removeCratersNear]);

  const handlePlanetAgentSelect = useCallback((ag) => {
    selectedAgentIdRef.current = ag ? ag.id : null;
    onAgentSelect?.(ag);
  }, [onAgentSelect]);

  return (
    <div className={styles.wrapper}>
      {/* Top Controls: View Switcher (3D / 2D) + Color Mode Switcher + Legend */}
      <div className={styles.topControlWrapper}>
        <div className={styles.topControlContainer}>
          {/* Color Mode Switcher */}
          <div className={styles.colorModeBar}>
            <span className={styles.colorModeLabel}>Окраска:</span>
            <button 
              className={`${styles.colorModeBtn} ${colorMode === 'archetypes' ? styles.colorModeBtnActive : ''}`}
              onClick={() => setColorMode('archetypes')}
              title="Цвета по 6 эволюционным архетипам (Хищник, Солнцеед, Альтруист и др.)"
            >
              🧬 Архетипы
            </button>
            <button 
              className={`${styles.colorModeBtn} ${colorMode === 'energy' ? styles.colorModeBtnActive : ''}`}
              onClick={() => setColorMode('energy')}
              title="Цвета по уровню энергии (Зеленый / Желтый / Красный)"
            >
              ⚡ HP
            </button>
            <button 
              className={`${styles.colorModeBtn} ${colorMode === 'trophic' ? styles.colorModeBtnActive : ''}`}
              onClick={() => setColorMode('trophic')}
              title="Цвета по трофической специализации (Солнцеед ↔ Хищник)"
            >
              🥩 Трофика
            </button>
            <button 
              className={`${styles.legendToggleBtn} ${isLegendOpen ? styles.legendToggleBtnActive : ''}`}
              onClick={() => setIsLegendOpen(prev => !prev)}
              title="Показать / скрыть легенду цветов"
            >
              🎨 Легенда
            </button>
          </div>
        </div>

        {/* Floating Interactive Legend Overlay */}
        {isLegendOpen && (
          <div className={styles.legendPanel}>
            <div className={styles.legendHeader}>
              <span className={styles.legendTitle}>
                {colorMode === 'archetypes' ? '🧬 Легенда архетипов' :
                 colorMode === 'energy' ? '⚡ Шкала энергии (HP)' :
                 '🥩 Трофический градиент'}
              </span>
              <button className={styles.legendCloseBtn} onClick={() => setIsLegendOpen(false)}>✕</button>
            </div>

            {colorMode === 'archetypes' && (
              <div className={styles.legendGrid}>
                {Object.entries(ARCHETYPE_INFO).map(([key, info]) => {
                  const count = (latestAgentsRef.current || []).filter(a => resolveAgentArchetype(a) === key).length;
                  return (
                    <div key={key} className={styles.legendItem} title={info.desc}>
                      <span className={styles.legendSwatch} style={{ background: info.color }} />
                      <span className={styles.legendIcon}>{info.icon}</span>
                      <span className={styles.legendName}>{info.label}</span>
                      <span className={styles.legendCount}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {colorMode === 'energy' && (
              <div className={styles.energyLegend}>
                <div className={styles.energyRow}>
                  <span className={styles.legendSwatch} style={{ background: '#00ff88' }} />
                  <span>Высокая (&gt; 120 HP) — размножение</span>
                </div>
                <div className={styles.energyRow}>
                  <span className={styles.legendSwatch} style={{ background: '#ffd000' }} />
                  <span>Стабильная (60–120 HP) — норма</span>
                </div>
                <div className={styles.energyRow}>
                  <span className={styles.legendSwatch} style={{ background: '#ff3344' }} />
                  <span>Критическая (&lt; 60 HP) — истощение</span>
                </div>
              </div>
            )}

            {colorMode === 'trophic' && (
              <div className={styles.trophicLegend}>
                <div className={styles.trophicBar} />
                <div className={styles.trophicLabels}>
                  <span>🌱 0.0 Солнцеед</span>
                  <span>⚖️ 0.5 Смешанный</span>
                  <span>🥩 1.0 Хищник</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* View Mode Toggle (Bottom Right) */}
      <div className={styles.viewToggleBar}>
        <button 
          className={`${styles.viewToggleBtn} ${viewMode === '3d' ? styles.viewToggleBtnActive : ''}`}
          onClick={() => setViewMode('3d')}
          title="3D Сферическая модель Меркурия"
        >
          🪐 3D
        </button>
        <button 
          className={`${styles.viewToggleBtn} ${viewMode === '2d' ? styles.viewToggleBtnActive : ''}`}
          onClick={() => {
            setViewMode('2d');
            setTimeout(draw2D, 50);
          }}
          title="2D Цилиндрическая развертка"
        >
          🗺️ 2D
        </button>
      </div>

      {viewMode === '3d' ? (
        <Planet3D 
          agents={agents}
          environment={environment}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
          onAgentSelect={handlePlanetAgentSelect}
          selectedDisaster={selectedDisaster}
          disasterParams={disasterParams}
          cratersRef={cratersRef}
          onAddCrater={addCrater}
          onRemoveCratersNear={removeCratersNear}
          craterEpicentersRef={craterEpicentersRef}
          colorMode={colorMode}
        />
      ) : (
        <div ref={containerRef} className={styles.canvasContainer}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
      )}
    </div>
  );
}