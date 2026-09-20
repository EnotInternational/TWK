import { useRef, useEffect, useState, useCallback } from 'react';
import styles from './GeneEvolutionChart.module.css';

const GENES_META = [
  { key: 'avgAggression', label: 'Агрессия', icon: '️', color: '#ff4757', min: 0.0, max: 1.0 },
  { key: 'avgFear', label: 'Страх', icon: '', color: '#70a1ff', min: 0.0, max: 1.0 },
  { key: 'avgCarnivore', label: 'Плотоядность', icon: '', color: '#ff9f43', min: 0.0, max: 1.0 },
  { key: 'avgAltruism', label: 'Альтруизм', icon: '', color: '#00d2d3', min: 0.0, max: 1.0 },
  { key: 'avgTerritorial', label: 'Оазисы', icon: '️', color: '#e056fd', min: -1.0, max: 1.0 },
];

export default function GeneEvolutionChart({ history = [] }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [visibleGenes, setVisibleGenes] = useState({
    avgAggression: true,
    avgFear: true,
    avgCarnivore: true,
    avgAltruism: true,
    avgTerritorial: true,
  });

  const [tooltip, setTooltip] = useState(null);

  const toggleGene = (key) => {
    setVisibleGenes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const latest = history.length > 0 ? history[history.length - 1] : null;

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

    // Normalization range: [0.0, 1.0] (for territorial [-1, 1] we map: (val + 1) / 2)
    const ySteps = 4;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Courier New, monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= ySteps; i++) {
      const yVal = (i / ySteps).toFixed(2);
      const yPos = padding.top + chartH - (i / ySteps) * chartH;

      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(w - padding.right, yPos);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillText(yVal, padding.left - 8, yPos + 3);
    }

    // Y Axis label
    ctx.save();
    ctx.translate(14, padding.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Индекс гена [0..1]', 0, 0);
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

    // 2. Draw lines for visible genes
    GENES_META.forEach(meta => {
      if (!visibleGenes[meta.key]) return;

      const pts = history.map((pt, idx) => {
        const x = padding.left + (idx / (history.length - 1)) * chartW;
        let val = pt[meta.key] ?? 0;
        // Normalize territorial from [-1, 1] to [0, 1] for unified chart view
        if (meta.key === 'avgTerritorial') {
          val = Math.max(0, Math.min(1, (val + 1) / 2));
        } else {
          val = Math.max(0, Math.min(1, val));
        }
        const y = padding.top + chartH - val * chartH;
        return { x, y, rawVal: pt[meta.key] ?? 0 };
      });

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

    // 3. Tooltip crosshair
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
  }, [history, visibleGenes, tooltip]);

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
            <span></span> ГЕНЕТИЧЕСКИЙ ДРЕЙФ И ЭВОЛЮЦИОННЫЙ ОТБОР
          </h2>
          <span className={styles.subtitle}>
            Динамика средних популяционных частот поведенческих, трофических и социальных генов
          </span>
        </div>

        <div className={styles.controls}>
          <div className={styles.legend}>
            {GENES_META.map(meta => {
              const active = visibleGenes[meta.key];
              return (
                <div 
                  key={meta.key} 
                  className={`${styles.legendItem} ${active ? styles.active : styles.disabled}`}
                  onClick={() => toggleGene(meta.key)}
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

      {/* Summary Badges with current gene averages */}
      <div className={styles.summaryBadges}>
        {GENES_META.map(meta => {
          const val = latest ? latest[meta.key] ?? 0 : 0;
          return (
            <div 
              key={meta.key} 
              className={styles.badgeCard}
              style={{ borderColor: `${meta.color}55`, color: meta.color }}
            >
              <span className={styles.badgeIcon}>{meta.icon}</span>
              <span className={styles.badgeName}>{meta.label}:</span>
              <span className={styles.badgeValue}>
                {meta.key === 'avgTerritorial' 
                  ? (val >= 0 ? `+${val.toFixed(3)}` : val.toFixed(3))
                  : val.toFixed(3)}
              </span>
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
            <div className={styles.tooltipTick}>Тик: {tooltip.point.tick}</div>
            {GENES_META.map(meta => {
              if (!visibleGenes[meta.key]) return null;
              const val = tooltip.point[meta.key] ?? 0;
              return (
                <div key={meta.key} className={styles.tooltipRow} style={{ color: meta.color }}>
                  <span>{meta.icon} {meta.label}:</span>
                  <strong>{meta.key === 'avgTerritorial' ? (val >= 0 ? `+${val.toFixed(3)}` : val.toFixed(3)) : val.toFixed(3)}</strong>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Evolutionary & Behavioral Activity Summary */}
      <div className={styles.activityStrip}>
        <div className={styles.activityCard} title="Суммарное количество боевых столкновений">
          <span className={styles.activityLabel}>️ Всего стычек</span>
          <span className={styles.activityValue} style={{ color: '#ff4757' }}>
            {latest?.cumFights ?? 0}
          </span>
        </div>
        <div className={styles.activityCard} title="Гибель агентов в результате боевых столкновений">
          <span className={styles.activityLabel}> Боевых потерь</span>
          <span className={styles.activityValue} style={{ color: '#ff6b81' }}>
            {latest?.cumCombatDeaths ?? 0}
          </span>
        </div>
        <div className={styles.activityCard} title="Энергия, переданная альтруистами голодающим сородичам">
          <span className={styles.activityLabel}> Энергия помощи</span>
          <span className={styles.activityValue} style={{ color: '#00d2d3' }}>
            {latest?.cumEnergyShared ? Number(latest.cumEnergyShared).toFixed(1) : '0.0'} HP
          </span>
        </div>
        <div className={styles.activityCard} title="Энергия, поглощенная хищниками при охоте и каннибализме">
          <span className={styles.activityLabel}> Энергия охоты</span>
          <span className={styles.activityValue} style={{ color: '#ffa502' }}>
            {latest?.cumPredationEnergy ? Number(latest.cumPredationEnergy).toFixed(1) : '0.0'} HP
          </span>
        </div>
      </div>
    </div>
  );
}
