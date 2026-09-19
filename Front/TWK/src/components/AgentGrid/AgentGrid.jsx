import { useEffect, useRef } from 'react';
import styles from './AgentGrid.module.css';
import { agentApi } from '../../api';

export default function AgentGrid({ onMetricsUpdate, onAgentSelect, gridWidth, gridHeight }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const latestAgentsRef = useRef([]);

  const camera = useRef({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });
  const hasDragged = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    let pollingInterval;

    container.style.cursor = 'grab';

    // Выносим рендер в отдельную функцию, чтобы вызывать её при любом движении мыши
    const draw = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Холст всегда равен физическому размеру контейнера (экрана)
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
         canvas.width = rect.width * dpr;
         canvas.height = rect.height * dpr;
         canvas.style.width = `${rect.width}px`;
         canvas.style.height = `${rect.height}px`;
      }

      // Сбрасываем все трансформации перед новым кадром
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Применяем ВЕКТОРНУЮ трансформацию камеры
      ctx.translate(camera.current.x, camera.current.y);
      ctx.scale(camera.current.scale, camera.current.scale);

      // Вычисляем базовый размер ячейки для масштаба 1:1
      const baseCellSize = Math.floor(Math.min(rect.width / gridWidth, rect.height / gridHeight));
      const actualW = baseCellSize * gridWidth;
      const actualH = baseCellSize * gridHeight;

      // Отрисовка сетки
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      // Делим толщину линии на масштаб, чтобы она не "толстела" при зуме
      ctx.lineWidth = 1 / camera.current.scale; 
      
      ctx.beginPath();
      for (let i = 0; i <= gridWidth; i++) {
        ctx.moveTo(i * baseCellSize, 0); 
        ctx.lineTo(i * baseCellSize, actualH);
      }
      for (let i = 0; i <= gridHeight; i++) {
        ctx.moveTo(0, i * baseCellSize); 
        ctx.lineTo(actualW, i * baseCellSize);
      }
      ctx.stroke();

      // Отрисовка агентов
      latestAgentsRef.current.forEach(agent => {
        ctx.fillStyle = agent.color || '#00e5ff';
        if (agent.isSelected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2 / camera.current.scale;
          ctx.strokeRect(agent.x * baseCellSize, agent.y * baseCellSize, baseCellSize, baseCellSize);
        }
        // Закрашиваем с небольшим зазором (0.5), чтобы агенты не слипались визуально
        ctx.fillRect(agent.x * baseCellSize + 0.5, agent.y * baseCellSize + 0.5, baseCellSize - 1, baseCellSize - 1);
      });
    };

    const fetchState = async () => {
      try {
        const data = await agentApi.getField();
        if (data && data.agents) {
          latestAgentsRef.current = data.agents;
          draw(); // Перерисовываем при получении данных
        }
      } catch (error) { /* Игнорируем в консоли при поллинге */ }
    };

    pollingInterval = setInterval(fetchState, 300);
    fetchState();

    // === УМНАЯ ЛОГИКА КАМЕРЫ ===
    const handleWheel = (e) => {
      e.preventDefault();
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomStep = 0.15;
      const newScale = e.deltaY < 0 
        ? camera.current.scale + zoomStep 
        : camera.current.scale - zoomStep;
      
      const clampedScale = Math.max(0.3, Math.min(newScale, 10)); // Зум от 0.3x до 10x

      // Математика для зума в точку курсора
      const scaleRatio = clampedScale / camera.current.scale;
      camera.current.x = mouseX - (mouseX - camera.current.x) * scaleRatio;
      camera.current.y = mouseY - (mouseY - camera.current.y) * scaleRatio;
      camera.current.scale = clampedScale;

      draw(); // Мгновенная перерисовка при скролле
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
      
      draw(); // Мгновенная перерисовка при перетаскивании
    };

    const handleMouseUp = (e) => {
      if (e.button !== 0) return;
      isDragging.current = false;
      container.style.cursor = 'grab';

      // Обработка клика с обратным преобразованием матрицы
      if (!hasDragged.current) {
        const rect = canvas.getBoundingClientRect();
        
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
          onAgentSelect(null);
          draw();
          return;
        }

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Переводим координаты экрана в координаты виртуального мира
        const worldX = (mouseX - camera.current.x) / camera.current.scale;
        const worldY = (mouseY - camera.current.y) / camera.current.scale;

        const baseCellSize = Math.floor(Math.min(rect.width / gridWidth, rect.height / gridHeight));
        const gridX = Math.floor(worldX / baseCellSize);
        const gridY = Math.floor(worldY / baseCellSize);

        const clickedAgent = latestAgentsRef.current.find(a => a.x === gridX && a.y === gridY);
        onAgentSelect(clickedAgent || null);
        draw();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('contextmenu', e => e.preventDefault());

    return () => {
      clearInterval(pollingInterval);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gridWidth, gridHeight, onAgentSelect]);

  return (
    <div ref={containerRef} className={styles.canvasContainer}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}