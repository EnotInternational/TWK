import { useRef, useEffect, useState, useCallback } from 'react';
import styles from './ArchetypeDistributionChart.module.css';

const ARCHETYPES_META = [
  { key: 'predator', label: 'Хищник', icon: '🥩', color: '#ff4757' },
  { key: 'grazer', label: 'Солнцеед', icon: '🌱', color: '#7bed9f' },
  { key: 'altruist_swarm', label: 'Альтруист', icon: '🤝', color: '#00d2d3' },
  { key: 'oasis_guardian', label: 'Страж оазиса', icon: '🛡️', color: '#e056fd' },
  { key: 'fleeing_prey', label: 'Беглец', icon: '🕊️', color: '#2ed573' },
  { key: 'opportunist', label: 'Оппортунист', icon: '⚖️', color: '#ffa502' },
];

export default function ArchetypeDistributionChart({ history = [] }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [visibleSeries, setVisibleSeries] = useState({
    predator: true,
    grazer: true,
    altruist_swarm: true,
    oasis_guardian: true,
    fleeing_prey: true,
    opportunist: true,
  });

  const [tooltip, setTooltip] = useState(null);

  const toggleSeries = (key) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Latest snapshot metrics
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const latestArchetypes = latest?.archetypes || {};
  const totalAlive = latest?.alive || 0;

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

    const padding = { top: 20, right: 35, bottom: 32, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Calculate max value for Y scale
    let maxVal = 5;
    history.forEach(pt => {
      const arc = pt.archetypes || {};
      ARCHETYPES_META.forEach(meta => {
        if (visibleSeries[meta.key]) {
          const val = arc[meta.key] || 0;
          if (val > maxVal) maxVal = val;
        }
      });
    });
    maxVal = Math.ceil(maxVal * 1.15) || 5;

    // 1. Grid lines and Y axis
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

    // Y Axis Label
    ctx.save();
    ctx.translate(14, padding.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Особей', 0, 0);
    ctx.restore();

    // X Axis Ticks
    const xSteps = Math.min(6, history.length - 1);
    ctx.textAlign = 'center';
    ctx.font = '10px Courier New, monospace';

    for (let i = 0; i <= xSteps; i++) {
      const idx = Math.floor((i / xSteps) * (history.length - 1));
      const pt = history[idx];
      const xPos = padding.left + (idx / (history.length - 1)) * chartW;

      ctx.beginPath();
      ctx.strokeStyle = '#1e293b';
      ctx.moveTo(xPos, padding.top + chartH);
      ctx.lineTo(xPos, padding.top + chartH + 4);
      ctx.stroke();

      ctx.fillText(`T:${pt.tick}`, xPos, padding.top + chartH + 18);
    }

    // 2. Draw lines for visible archetypes
    ARCHETYPES_META.forEach(meta => {
      if (!visibleSeries[meta.key]) return;

      const pts = history.map((pt, idx) => {
        const x = padding.left + (idx / (history.length - 1)) * chartW;
        const count = (pt.archetypes && pt.archetypes[meta.key]) || 0;
        const y = padding.top + chartH - (count / maxVal) * chartH;
        return { x, y, count };
      });

      // Line
      ctx.beginPath();
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = meta.color;
      ctx.shadowBlur = 6;

      pts.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // End point glowing dot
      const lastP = pts[pts.length - 1];
      if (lastP) {
        ctx.beginPath();
        ctx.arc(lastP.x, lastP.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = meta.color;
        ctx.shadowColor = meta.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // 3. Draw tooltip crosshair if active
    if (tooltip && tooltip.index >= 0 && tooltip.index < history.length) {
      const xPos = padding.left + (tooltip.index / (history.length - 1)) * chartW;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.setLineDash([3, 3]);
      ctx.moveTo(xPos, padding.top);
      ctx.lineTo(xPos, padding.top + chartH);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [history, visibleSeries, tooltip]);

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
    const x = e.clientX - rect.left;
    const padding = { left: 45, right: 35 };
    const chartW = rect.width - padding.left - padding.right;

    if (x < padding.left || x > rect.width - padding.right) {
      setTooltip(null);
      return;
    }

    const ratio = Math.max(0, Math.min(1, (x - padding.left) / chartW));
    const idx = Math.round(ratio * (history.length - 1));
    const pt = history[idx];

    if (pt) {
      setTooltip({
        x: padding.left + (idx / (history.length - 1)) * chartW,
        y: e.clientY - rect.top,
        index: idx,
        point: pt,
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>
            <span>🧬</span> ДИНАМИКА ЭВОЛЮЦИОННЫХ АРХЕТИПОВ (ТРОФИКА И СОЦИАЛЬНОСТЬ)
          </h2>
          <span className={styles.subtitle}>
            Временные ряды распределения 6 устойчивых жизненных стратегий в популяции
          </span>
        </div>

        <div className={styles.controls}>
          <div className={styles.legend}>
            {ARCHETYPES_META.map(meta => {
              const active = visibleSeries[meta.key];
              return (
                <div 
                  key={meta.key} 
                  className={`${styles.legendItem} ${active ? styles.active : styles.disabled}`}
                  onClick={() => toggleSeries(meta.key)}
                  title={`Нажмите, чтобы скрыть/показать ${meta.label}`}
                >
                  <span className={styles.legendColorDot} style={{ background: meta.color }} />
                  <span>{meta.icon} {meta.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Badges with live counts and percentages */}
      <div className={styles.summaryBadges}>
        {ARCHETYPES_META.map(meta => {
          const count = latestArchetypes[meta.key] || 0;
          const pct = totalAlive > 0 ? Math.round((count / totalAlive) * 100) : 0;
          return (
            <div 
              key={meta.key} 
              className={styles.badgeCard}
              style={{ borderColor: `${meta.color}55`, color: meta.color }}
            >
              <span className={styles.badgeIcon}>{meta.icon}</span>
              <span className={styles.badgeName}>{meta.label}:</span>
              <span className={styles.badgeCount}>{count}</span>
              <span className={styles.badgePct}>({pct}%)</span>
            </div>
          );
        })}
      </div>

      <div 
        ref={containerRef} 
        className={styles.canvasWrapper}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas ref={canvasRef} className={styles.canvas} />

        {tooltip && tooltip.point && (
          <div className={styles.tooltip} style={{ left: tooltip.x, top: Math.max(30, tooltip.y) }}>
            <div className={styles.tooltipTick}>Тик: {tooltip.point.tick} (Всего: {tooltip.point.alive})</div>
            {ARCHETYPES_META.map(meta => {
              if (!visibleSeries[meta.key]) return null;
              const count = (tooltip.point.archetypes && tooltip.point.archetypes[meta.key]) || 0;
              return (
                <div key={meta.key} className={styles.tooltipRow} style={{ color: meta.color }}>
                  <span>{meta.icon} {meta.label}:</span>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
