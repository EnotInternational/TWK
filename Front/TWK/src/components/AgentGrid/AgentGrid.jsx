import { useEffect, useRef } from 'react';
import styles from './AgentGrid.module.css';
import { socket } from '../../api';

export default function AgentGrid({ onMetricsUpdate, onAgentSelect, gridWidth = 60, gridHeight = 30 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // Refs to hold the latest state without triggering React re-renders on 60FPS ticks
  const latestAgentsRef = useRef([]);
  const latestEnvRef = useRef(null);

  const camera = useRef({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });
  const hasDragged = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');

    container.style.cursor = 'grab';

    const drawEnvironment = (baseCellSize, actualH, actualW) => {
      const env = latestEnvRef.current;
      if (!env) return;

      // Draw Terminator bands
      if (env.terminator_bands) {
        env.terminator_bands.forEach((band) => {
          const xStart = band.min_x * baseCellSize;
          let width = band.width * baseCellSize;

          ctx.fillStyle = 'rgba(0, 229, 255, 0.15)'; // Turquoise Terminator glow
          
          // Handle wrap-around for terminator band
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

      // Draw Sun line (Zenith)
      if (env.sun_x !== undefined) {
        ctx.strokeStyle = 'rgba(255, 190, 0, 0.7)';
        ctx.lineWidth = 2 / camera.current.scale;
        ctx.setLineDash([10 / camera.current.scale, 10 / camera.current.scale]);
        ctx.beginPath();
        ctx.moveTo(env.sun_x * baseCellSize, 0);
        ctx.lineTo(env.sun_x * baseCellSize, actualH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    const draw = () => {
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

      // Use env width/height if available, fallback to props
      const env = latestEnvRef.current;
      const w = env?.width || gridWidth;
      const h = env?.height || gridHeight;

      const baseCellSize = Math.floor(Math.min(rect.width / w, rect.height / h)) || 10;
      const actualW = baseCellSize * w;
      const actualH = baseCellSize * h;

      // Draw Environment Background
      drawEnvironment(baseCellSize, actualH, actualW);

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
        // Color based on energy
        if (agent.energy > 120) {
           ctx.fillStyle = '#00ff88'; // Bright green (ready to reproduce)
        } else if (agent.energy >= 60) {
           ctx.fillStyle = '#ffd000'; // Yellow (stable)
        } else {
           ctx.fillStyle = '#ff3344'; // Red (exhaustion risk)
        }

        if (agent.isSelected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2 / camera.current.scale;
          ctx.strokeRect(agent.x * baseCellSize, agent.y * baseCellSize, baseCellSize, baseCellSize);
        }
        
        ctx.fillRect(agent.x * baseCellSize + 0.5, agent.y * baseCellSize + 0.5, baseCellSize - 1, baseCellSize - 1);
      });
    };

    // Socket.io event listeners
    const handleTick = (data) => {
      latestAgentsRef.current = data.agents || [];
      latestEnvRef.current = data.environment;
      
      if (data.metrics) {
        onMetricsUpdate({ ...data.metrics, tick: data.tick, status: data.status, hash: data.state_hash, aliveCount: data.agents ? data.agents.length : 0 });
      }
      draw();
    };

    socket.on('simulation:tick', handleTick);

    // Camera Logic
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
      draw(); 
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
      draw(); 
    };

    const handleMouseUp = (e) => {
      if (e.button !== 0) return;
      isDragging.current = false;
      container.style.cursor = 'grab';

      if (!hasDragged.current) {
        const rect = canvas.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
          onAgentSelect(null);
          draw();
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
           // Highlight selection visually
           latestAgentsRef.current.forEach(a => a.isSelected = false);
           clickedAgent.isSelected = true;
           onAgentSelect(clickedAgent);
        } else {
           latestAgentsRef.current.forEach(a => a.isSelected = false);
           onAgentSelect(null);
        }
        draw();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('contextmenu', e => e.preventDefault());

    // Initial draw
    setTimeout(() => {
        socket.emit('request_field');
        draw();
    }, 100);

    return () => {
      socket.off('simulation:tick', handleTick);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gridWidth, gridHeight, onAgentSelect, onMetricsUpdate]);

  return (
    <div ref={containerRef} className={styles.canvasContainer}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}