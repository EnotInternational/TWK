import { useRef, useEffect, useState, useCallback } from 'react';
import styles from './PopulationChart.module.css';

export default function PopulationChart({ history = [] }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [seriesVisible, setSeriesVisible] = useState({
    alive: true,
    births: true,
    deaths: true
  });

  const [tooltip, setTooltip] = useState(null);

  const toggleSeries = (key) => {
    setSeriesVisible(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    const w = rect.width;
    const h = rect.height;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (!history || history.length < 2) {
      ctx.fillStyle = '#718096';
      ctx.font = '12px Courier New, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Накопление телеметрии... Ожидаются тики симуляции', w / 2, h / 2);
      return;
    }

    const padding = { top: 20, right: 30, bottom: 30, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Вычисляем максимум для оси Y
    let maxVal = 10;
    history.forEach(p => {
      if (seriesVisible.alive && (p.alive || 0) > maxVal) maxVal = p.alive;
      if (seriesVisible.births && (p.cumBirths || 0) > maxVal) maxVal = p.cumBirths;
      if (seriesVisible.deaths && (p.cumDeaths || 0) > maxVal) maxVal = p.cumDeaths;
    });
    maxVal = Math.ceil(maxVal * 1.15); // запас 15% сверху

    // 1. Рисуем сетку
    const ySteps = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#718096';
    ctx.font = '10px Courier New, monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= ySteps; i++) {
      const yVal = Math.round((maxVal / ySteps) * i);
      const yPos = padding.top + chartH - (i / ySteps) * chartH;
      
      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(w - padding.right, yPos);
      ctx.stroke();

      ctx.fillText(yVal.toString(), padding.left - 8, yPos + 3);
    }

    // Временные засечки по X
    const xSteps = Math.min(6, history.length - 1);
    ctx.textAlign = 'center';
    for (let i = 0; i <= xSteps; i++) {
      const idx = Math.floor((i / xSteps) * (history.length - 1));
      const pt = history[idx];
      if (!pt) continue;
      const xPos = padding.left + (idx / (history.length - 1)) * chartW;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.moveTo(xPos, padding.top);
      ctx.lineTo(xPos, h - padding.bottom);
      ctx.stroke();

      ctx.fillStyle = '#718096';
      ctx.fillText(`t:${pt.tick}`, xPos, h - padding.bottom + 18);
    }

    // Функция преобразования координат
    const getCoords = (idx, val) => {
      const x = padding.left + (idx / (history.length - 1)) * chartW;
      const y = padding.top + chartH - (val / maxVal) * chartH;
      return { x, y };
    };

    // 2. Отрисовка серии "Живые" (с градиентной подсветкой)
    if (seriesVisible.alive) {
      // Область под графиком
      const grad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.25)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0.0)');

      ctx.beginPath();
      const first = getCoords(0, history[0].alive || 0);
      ctx.moveTo(first.x, first.y);

      for (let i = 1; i < history.length; i++) {
        const pt = getCoords(i, history[i].alive || 0);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.lineTo(padding.left + chartW, h - padding.bottom);
      ctx.lineTo(padding.left, h - padding.bottom);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Линия
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < history.length; i++) {
        const pt = getCoords(i, history[i].alive || 0);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(0, 229, 255, 0.6)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0; // сброс тени
    }

    // 3. Серия "Рождения" (накопительно)
    if (seriesVisible.births) {
      ctx.beginPath();
      const firstB = getCoords(0, history[0].cumBirths || 0);
      ctx.moveTo(firstB.x, firstB.y);
      for (let i = 1; i < history.length; i++) {
        const pt = getCoords(i, history[i].cumBirths || 0);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Серия "Смерти" (накопительно)
    if (seriesVisible.deaths) {
      ctx.beginPath();
      const firstD = getCoords(0, history[0].cumDeaths || 0);
      ctx.moveTo(firstD.x, firstD.y);
      for (let i = 1; i < history.length; i++) {
        const pt = getCoords(i, history[i].cumDeaths || 0);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#ff3344';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Отрисовка курсора/тултипа, если пользователь водит мышь
    if (tooltip && tooltip.index !== undefined && history[tooltip.index]) {
      const p = history[tooltip.index];
      const xPos = padding.left + (tooltip.index / (history.length - 1)) * chartW;

      // Вертикальная прицельная полоса
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.moveTo(xPos, padding.top);
      ctx.lineTo(xPos, h - padding.bottom);
      ctx.stroke();

      // Точка на кривой живых
      if (seriesVisible.alive) {
        const pt = getCoords(tooltip.index, p.alive || 0);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00e5ff';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [history, seriesVisible, tooltip]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  useEffect(() => {
    const handleResize = () => drawChart();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawChart]);

  const handleMouseMove = (e) => {
    const container = containerRef.current;
    if (!container || !history || history.length < 2) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const padding = { top: 20, right: 30, bottom: 30, left: 45 };
    const chartW = rect.width - padding.left - padding.right;

    if (mouseX >= padding.left && mouseX <= rect.width - padding.right) {
      const ratio = (mouseX - padding.left) / chartW;
      const index = Math.round(ratio * (history.length - 1));
      const clamped = Math.max(0, Math.min(history.length - 1, index));

      setTooltip({
        x: mouseX,
        y: mouseY,
        index: clamped,
        point: history[clamped]
      });
    } else {
      setTooltip(null);
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <div className={styles.titleArea}>
          <h3 className={styles.title}>Динамика популяции во времени</h3>
          <span className={styles.subtitle}>Хронология тиков и жизненный цикл</span>
        </div>

        <div className={styles.controls}>
          <div className={styles.legend}>
            <div 
              className={`${styles.legendItem} ${seriesVisible.alive ? styles.active : ''}`}
              onClick={() => toggleSeries('alive')}
            >
              <span className={styles.legendColor} style={{ background: '#00e5ff', opacity: seriesVisible.alive ? 1 : 0.3 }} />
              <span>Живые</span>
            </div>
            <div 
              className={`${styles.legendItem} ${seriesVisible.births ? styles.active : ''}`}
              onClick={() => toggleSeries('births')}
            >
              <span className={styles.legendColor} style={{ background: '#00ff88', opacity: seriesVisible.births ? 1 : 0.3 }} />
              <span>Рождения (накоп.)</span>
            </div>
            <div 
              className={`${styles.legendItem} ${seriesVisible.deaths ? styles.active : ''}`}
              onClick={() => toggleSeries('deaths')}
            >
              <span className={styles.legendColor} style={{ background: '#ff3344', opacity: seriesVisible.deaths ? 1 : 0.3 }} />
              <span>Смерти (накоп.)</span>
            </div>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef} 
        className={styles.canvasWrapper}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas ref={canvasRef} className={styles.canvas} />

        {tooltip && tooltip.point && (
          <div 
            className={styles.tooltip} 
            style={{ 
              left: `${tooltip.x}px`, 
              top: `${Math.max(40, tooltip.y)}px` 
            }}
          >
            <div className={styles.tooltipTitle}>Тик #{tooltip.point.tick}</div>
            <div className={styles.tooltipRow}>
              <span>Живых агентов:</span>
              <strong style={{ color: '#00e5ff' }}>{tooltip.point.alive}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Энергия (сред.):</span>
              <strong style={{ color: '#ffd000' }}>{tooltip.point.avgEnergy}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>В терминаторе:</span>
              <strong style={{ color: '#a78bfa' }}>
                {(tooltip.point.terminatorRatio * 100).toFixed(0)}%
              </strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Рождений / Смертей:</span>
              <span>
                <strong style={{ color: '#00ff88' }}>+{tooltip.point.births || 0}</strong>
                {' / '}
                <strong style={{ color: '#ff3344' }}>-{tooltip.point.deaths || 0}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
