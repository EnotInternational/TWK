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
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Courier New, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[ Ожидание данных: нужно хотя бы 2 тика ]', w / 2, h / 2);
      return;
    }

    const padding = { top: 20, right: 35, bottom: 32, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Расчёт динамического масштаба оси Y
    let maxVal = 10;
    history.forEach(p => {
      if (seriesVisible.alive && (p.alive || 0) > maxVal) maxVal = p.alive;
      if (seriesVisible.births && (p.cumBirths || 0) > maxVal) maxVal = p.cumBirths;
      if (seriesVisible.deaths && (p.cumDeaths || 0) > maxVal) maxVal = p.cumDeaths;
    });
    maxVal = Math.ceil(maxVal * 1.12);

    // 1. Координатная сетка
    const ySteps = 4;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Courier New, monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= ySteps; i++) {
      const yVal = Math.round((maxVal / ySteps) * i);
      const yPos = padding.top + chartH - (i / ySteps) * chartH;
      
      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(w - padding.right, yPos);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillText(yVal.toString(), padding.left - 8, yPos + 3);
    }

    // Подпись оси ординат
    ctx.save();
    ctx.translate(14, padding.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Агенты', 0, 0);
    ctx.restore();

    // Засечки оси абсцисс (время в тиках)
    const xSteps = Math.min(7, history.length - 1);
    ctx.textAlign = 'center';
    ctx.font = '10px Courier New, monospace';

    for (let i = 0; i <= xSteps; i++) {
      const idx = Math.floor((i / xSteps) * (history.length - 1));
      const pt = history[idx];
      if (!pt) continue;
      const xPos = padding.left + (idx / (history.length - 1)) * chartW;

      ctx.beginPath();
      ctx.strokeStyle = '#1e293b';
      ctx.moveTo(xPos, padding.top);
      ctx.lineTo(xPos, h - padding.bottom);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.fillText(`t=${pt.tick}`, xPos, h - padding.bottom + 16);
    }

    // Вспомогательная функция координат
    const getCoords = (idx, val) => {
      const x = padding.left + (idx / (history.length - 1)) * chartW;
      const y = padding.top + chartH - (val / maxVal) * chartH;
      return { x, y };
    };

    // 2. Кривая N(t) — численность популяции
    if (seriesVisible.alive) {
      // Область под кривой
      const grad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

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

      // Линия N(t)
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < history.length; i++) {
        const pt = getCoords(i, history[i].alive || 0);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // 3. Кривая ΣB(t) — кумулятивная рождаемость
    if (seriesVisible.births) {
      ctx.beginPath();
      const firstB = getCoords(0, history[0].cumBirths || 0);
      ctx.moveTo(firstB.x, firstB.y);
      for (let i = 1; i < history.length; i++) {
        const pt = getCoords(i, history[i].cumBirths || 0);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Кривая ΣD(t) — кумулятивная элиминация
    if (seriesVisible.deaths) {
      ctx.beginPath();
      const firstD = getCoords(0, history[0].cumDeaths || 0);
      ctx.moveTo(firstD.x, firstD.y);
      for (let i = 1; i < history.length; i++) {
        const pt = getCoords(i, history[i].cumDeaths || 0);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Визир перекрестья и инспектор точки
    if (tooltip && tooltip.index !== undefined && history[tooltip.index]) {
      const p = history[tooltip.index];
      const xPos = padding.left + (tooltip.index / (history.length - 1)) * chartW;

      ctx.beginPath();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.moveTo(xPos, padding.top);
      ctx.lineTo(xPos, h - padding.bottom);
      ctx.stroke();

      if (seriesVisible.alive) {
        const pt = getCoords(tooltip.index, p.alive || 0);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
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

    const padding = { top: 20, right: 35, bottom: 32, left: 50 };
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
          <h3 className={styles.title}>График динамики популяции</h3>
          <span className={styles.subtitle}>Количество живых агентов, рождений и смертей по тикам</span>
        </div>

        <div className={styles.controls}>
          <div className={styles.legend}>
            <div 
              className={`${styles.legendItem} ${seriesVisible.alive ? styles.active : ''}`}
              onClick={() => toggleSeries('alive')}
              title="Показать / скрыть живых"
            >
              <span className={styles.legendLineSample} style={{ background: '#38bdf8', opacity: seriesVisible.alive ? 1 : 0.25 }} />
              <span>Живые агенты</span>
            </div>
            <div 
              className={`${styles.legendItem} ${seriesVisible.births ? styles.active : ''}`}
              onClick={() => toggleSeries('births')}
              title="Показать / скрыть рождаемость"
            >
              <span className={styles.legendLineSample} style={{ background: '#10b981', borderTop: '1px dashed #10b981', opacity: seriesVisible.births ? 1 : 0.25 }} />
              <span>Всего родилось</span>
            </div>
            <div 
              className={`${styles.legendItem} ${seriesVisible.deaths ? styles.active : ''}`}
              onClick={() => toggleSeries('deaths')}
              title="Показать / скрыть смертность"
            >
              <span className={styles.legendLineSample} style={{ background: '#ef4444', borderTop: '1px dotted #ef4444', opacity: seriesVisible.deaths ? 1 : 0.25 }} />
              <span>Всего погибло</span>
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
              top: `${Math.max(35, tooltip.y)}px` 
            }}
          >
            <div className={styles.tooltipTitle}>Тик {tooltip.point.tick}</div>
            <div className={styles.tooltipRow}>
              <span>Живых агентов:</span>
              <strong style={{ color: '#38bdf8' }}>{tooltip.point.alive}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>Средняя энергия:</span>
              <strong style={{ color: '#f59e0b' }}>{tooltip.point.avgEnergy}</strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>В терминаторе:</span>
              <strong style={{ color: '#a78bfa' }}>
                {(tooltip.point.terminatorRatio * 100).toFixed(1)}%
              </strong>
            </div>
            <div className={styles.tooltipRow}>
              <span>За этот тик (+ / -):</span>
              <span>
                <strong style={{ color: '#10b981' }}>+{tooltip.point.births || 0}</strong>
                {' / '}
                <strong style={{ color: '#ef4444' }}>-{tooltip.point.deaths || 0}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
