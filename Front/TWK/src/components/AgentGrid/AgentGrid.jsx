import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './AgentGrid.module.css';
import { socket } from '../../api';
import Planet3D from './Planet3D';

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
  const [agents, setAgents] = useState([]);
  const [environment, setEnvironment] = useState(null);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
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

  useEffect(() => {
    selectedAgentIdRef.current = selectedAgent ? selectedAgent.id : null;
  }, [selectedAgent]);

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
      if (agent.energy > 120) {
        ctx.fillStyle = '#00ff88';
      } else if (agent.energy >= 60) {
        ctx.fillStyle = '#ffd000';
      } else {
        ctx.fillStyle = '#ff3344';
      }

      if (agent.isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 / camera.current.scale;
        ctx.strokeRect(agent.x * baseCellSize, agent.y * baseCellSize, baseCellSize, baseCellSize);
      }

      ctx.fillRect(agent.x * baseCellSize + 0.5, agent.y * baseCellSize + 0.5, baseCellSize - 1, baseCellSize - 1);
    });
  }, [gridWidth, gridHeight]);

  // Socket listener & data management
  useEffect(() => {
    const handleTick = (data) => {
      const currentAgents = data.agents || [];
      const currentEnv = data.environment || null;

      latestAgentsRef.current = currentAgents;
      latestEnvRef.current = currentEnv;

      setAgents(currentAgents);
      setEnvironment(currentEnv);

      if (data.tick === 0) {
        cratersRef.current = [];
        craterEpicentersRef.current.clear();
        windsRef.current = [];
        selectedAgentIdRef.current = null;
        onAgentSelect(null);
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
        const notifyUpdate = onAgentUpdate || onAgentSelect;
        if (updatedAgent) {
          updatedAgent.isSelected = true;
          notifyUpdate(updatedAgent);
        } else {
          notifyUpdate(prev => {
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
        onMetricsUpdate({
          ...data.metrics,
          tick: data.tick,
          status: data.status,
          hash: data.state_hash,
          aliveCount: currentAgents.length
        });
      }

      if (viewMode === '2d') {
        draw2D();
      }
    };

    socket.on('simulation:tick', handleTick);

    // Initial request
    socket.emit('request_field');

    return () => {
      socket.off('simulation:tick', handleTick);
    };
  }, [viewMode, draw2D, onMetricsUpdate, onAgentSelect, onAgentUpdate]);

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
      {/* View Switcher Controls */}
      <div className={styles.viewToggleBar}>
        <button 
          className={`${styles.viewToggleBtn} ${viewMode === '3d' ? styles.viewToggleBtnActive : ''}`}
          onClick={() => setViewMode('3d')}
        >
          🪐 3D Планета
        </button>
        <button 
          className={`${styles.viewToggleBtn} ${viewMode === '2d' ? styles.viewToggleBtnActive : ''}`}
          onClick={() => {
            setViewMode('2d');
            setTimeout(draw2D, 50);
          }}
        >
          🗺️ 2D Сетка
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
        />
      ) : (
        <div ref={containerRef} className={styles.canvasContainer}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
      )}
    </div>
  );
}