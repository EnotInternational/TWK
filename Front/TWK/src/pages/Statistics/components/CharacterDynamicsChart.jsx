import { useRef, useEffect, useState, useCallback } from 'react';
import styles from './CharacterDynamicsChart.module.css';

const TRAITS_META = [
  { key: 'avg_ferocity', label: 'Свирепость', icon: '🔥', color: '#ff4757', desc: 'Усиливается боями и охотой' },
  { key: 'avg_friendliness', label: 'Дружелюбие', icon: '🤝', color: '#00d2d3', desc: 'Растет при выборе союза' },
  { key: 'avg_courage', label: 'Храбрость', icon: '🛡️', color: '#ffa502', desc: 'Закаляется при отпоре хищнику' },
  { key: 'avg_diplomacy', label: 'Дипломатия', icon: '📜', color: '#e056fd', desc: 'Развивается при откупе данью' },
  { key: 'avg_caution', label: 'Осторожность', icon: '👁️', color: '#2ed573', desc: 'Формируется успешным бегством' },
];

export default function CharacterDynamicsChart({ history = [] }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [visibleTraits, setVisibleTraits] = useState({
    avg_ferocity: true,
    avg_friendliness: true,
    avg_courage: true,
    avg_diplomacy: true,
    avg_caution: true,
  });

  const [tooltip, setTooltip] = useState(null);

  const toggleTrait = (key) => {
    setVisibleTraits(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const latest = history.length > 0 ? history[history.length - 1] : null;
  const latestCharacter = latest?.character || {};
  const castes = latest?.castes || { predator: 0, peaceful: 0 };
  const totalCastes = (castes.predator || 0) + (castes.peaceful || 0);
  const predatorPct = totalCastes > 0 ? Math.round(((castes.predator || 0) / totalCastes) * 100) : 25;
  const peacefulPct = 100 - predatorPct;

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
      ctx.fillText('[ Ожидание данных: нужно хотя бы 2 тика симуляции ]', w / 2, h / 2);
      return;
    }

    const padding = { top: 20, right: 35, bottom: 32, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Normalization range: 0.0 to 1.0
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
    ctx.fillText('Индекс черты [0..1]', 0, 0);
    ctx.restore();

    // X Axis Ticks
    const xSteps = Math.min(6, history.length - 1);
    ctx.textAlign = 'center';
    ctx.font = '10px Courier New, monospace';

    for (let i = 0; i <= xSteps; i++) {
      const idx = Math.round((i / xSteps) * (history.length - 1));
      const pt = history[idx];
      if (!pt) continue;

      const xPos = padding.left + (idx / (history.length - 1)) * chartW;

      ctx.beginPath();
      ctx.strokeStyle = '#1e293b';
      ctx.moveTo(xPos, padding.top + chartH);
      ctx.lineTo(xPos, padding.top + chartH + 5);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.fillText(`T${pt.tick}`, xPos, padding.top + chartH + 18);
    }

    // Draw Trait Lines
    TRAITS_META.forEach(meta => {
      if (!visibleTraits[meta.key]) return;

      ctx.beginPath();
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      let started = false;
      for (let i = 0; i < history.length; i++) {
        const pt = history[i];
        const val = pt.character ? pt.character[meta.key] : 0.5;
        if (val === undefined || isNaN(val)) continue;

        const x = padding.left + (i / (history.length - 1)) * chartW;
        const norm = Math.max(0, Math.min(1, val));
        const y = padding.top + chartH - norm * chartH;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Soft glow aura
      ctx.save();
      ctx.shadowColor = meta.color;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });

    // Draw Crosshair if hovering
    if (tooltip && tooltip.index !== undefined && history[tooltip.index]) {
      const hoverX = padding.left + (tooltip.index / (history.length - 1)) * chartW;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(hoverX, padding.top);
      ctx.lineTo(hoverX, padding.top + chartH);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [history, visibleTraits, tooltip]);

  useEffect(() => {
    drawChart();
    const handleResize = () => drawChart();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawChart]);

  const handleMouseMove = (e) => {
    if (!history || history.length < 2 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padding = { left: 45, right: 35 };
    const chartW = rect.width - padding.left - padding.right;

    const relX = mouseX - padding.left;
    if (relX < 0 || relX > chartW) {
      setTooltip(null);
      return;
    }

    const ratio = relX / chartW;
    const index = Math.min(history.length - 1, Math.max(0, Math.round(ratio * (history.length - 1))));
    const point = history[index];

    if (point) {
      setTooltip({
        x: mouseX,
        y: e.clientY - rect.top,
        index,
        tick: point.tick,
        character: point.character || {},
        cumFriendships: point.cumFriendships ?? 0,
        cumBribes: point.cumBribes ?? 0,
        cumFlees: point.cumFlees ?? 0,
        cumRetaliations: point.cumRetaliations ?? 0,
        cumFights: point.cumFights ?? 0,
      });
    }
  };

  const handleMouseLeave = () => setTooltip(null);

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <div className={styles.titleArea}>
          <h3 className={styles.chartTitle}>
            <span>🎭 ДИНАМИКА ХАРАКТЕРА И ВЫБОРОВ</span>
          </h3>
          <p className={styles.chartSubtitle}>
            Характер формируется поведенческим выбором в столкновениях (хищники: дружба vs бой; мирные: откуп vs побег vs отпор)
          </p>
        </div>

        {/* Real-time choice HUD counters */}
        <div className={styles.hudBar}>
          <div className={styles.hudPill} title="Всего решений хищников о дружбе">
            <span>🤝 Дружба:</span>
            <strong style={{ color: '#00d2d3' }}>{latest?.cumFriendships ?? 0}</strong>
          </div>
          <div className={styles.hudPill} title="Всего мирных откупилось данью энергией">
            <span>💰 Откупы:</span>
            <strong style={{ color: '#e056fd' }}>{latest?.cumBribes ?? 0}</strong>
          </div>
          <div className={styles.hudPill} title="Всего успешных уклонений и побегов">
            <span>🏃 Побеги:</span>
            <strong style={{ color: '#2ed573' }}>{latest?.cumFlees ?? 0}</strong>
          </div>
          <div className={styles.hudPill} title="Всего мирных дали решительный отпор хищнику">
            <span>🛡️ Отпор:</span>
            <strong style={{ color: '#ffa502' }}>{latest?.cumRetaliations ?? 0}</strong>
          </div>
          <div className={styles.hudPill} title="Всего боевых схваток">
            <span>⚔️ Схватки:</span>
            <strong style={{ color: '#ff4757' }}>{latest?.cumFights ?? 0}</strong>
          </div>
        </div>
      </div>

      {/* Caste Balance Split */}
      <div className={styles.casteBar}>
        <div className={styles.casteItem} style={{ color: '#ff4757' }}>
          <span>🥩 Хищники:</span>
          <strong>{castes.predator || 0} ({predatorPct}%)</strong>
        </div>
        <div className={styles.casteTrack} title="Соотношение каст: Хищники vs Мирные">
          <div 
            className={styles.casteFillPredator} 
            style={{ width: `${predatorPct}%` }}
          />
        </div>
        <div className={styles.casteItem} style={{ color: '#2ed573' }}>
          <span>🕊️ Мирные:</span>
          <strong>{castes.peaceful || 0} ({peacefulPct}%)</strong>
        </div>
      </div>

      {/* Trait Toggles */}
      <div className={styles.controlsRow}>
        <span className={styles.filterLabel}>Черты характера:</span>
        {TRAITS_META.map(meta => {
          const isActive = visibleTraits[meta.key];
          const val = latestCharacter[meta.key] !== undefined ? (latestCharacter[meta.key] * 100).toFixed(0) : '—';
          return (
            <button
              key={meta.key}
              className={`${styles.traitBtn} ${isActive ? styles.traitBtnActive : ''}`}
              style={{
                borderColor: isActive ? meta.color : 'rgba(255,255,255,0.1)',
                color: isActive ? meta.color : '#64748b'
              }}
              onClick={() => toggleTrait(meta.key)}
              title={meta.desc}
            >
              <span>{meta.icon} {meta.label}</span>
              <span className={styles.traitVal}>{val}%</span>
            </button>
          );
        })}
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className={styles.canvasWrapper}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas ref={canvasRef} className={styles.canvas} />

        {tooltip && (
          <div className={styles.tooltip} style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}>
            <div className={styles.tooltipTitle}>Тик {tooltip.tick} // Характер</div>
            {TRAITS_META.map(m => {
              const val = tooltip.character[m.key];
              if (val === undefined) return null;
              return (
                <div key={m.key} className={styles.tooltipRow} style={{ color: m.color }}>
                  <span>{m.icon} {m.label}:</span>
                  <strong>{(val * 100).toFixed(1)}% ({val.toFixed(3)})</strong>
                </div>
              );
            })}
            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.7rem', color: '#94a3b8' }}>
              Выборы к тику: 🤝 {tooltip.cumFriendships} | 💰 {tooltip.cumBribes} | 🏃 {tooltip.cumFlees} | 🛡️ {tooltip.cumRetaliations}
            </div>
          </div>
        )}
      </div>

      {/* Emergent Archetypes Lore */}
      <div className={styles.loreCards}>
        <div className={styles.loreCard}>
          <div className={styles.loreTitle} style={{ color: '#ff4757' }}>
            <span>⚔️ Кровожадный хищник</span>
          </div>
          <div className={styles.loreDesc}>
            Высокая свирепость. Предпочитает охоту и схватки, подавляя попытки союза.
          </div>
        </div>
        <div className={styles.loreCard}>
          <div className={styles.loreTitle} style={{ color: '#00d2d3' }}>
            <span>🤝 Благородный хищник</span>
          </div>
          <div className={styles.loreDesc}>
            Высокое дружелюбие. Заключает пакты о ненападении и мирно сосуществует с мирными.
          </div>
        </div>
        <div className={styles.loreCard}>
          <div className={styles.loreTitle} style={{ color: '#ffa502' }}>
            <span>🛡️ Боевой защитник</span>
          </div>
          <div className={styles.loreDesc}>
            Мирный с высокой храбростью. Не откупается, а дает яростный отпор нападающим хищникам.
          </div>
        </div>
        <div className={styles.loreCard}>
          <div className={styles.loreTitle} style={{ color: '#e056fd' }}>
            <span>💰 Хитрый дипломат</span>
          </div>
          <div className={styles.loreDesc}>
            Высокая дипломатия. Избегает смертоносных боев, откупаясь небольшой данью энергией.
          </div>
        </div>
        <div className={styles.loreCard}>
          <div className={styles.loreTitle} style={{ color: '#2ed573' }}>
            <span>🏃 Осторожный беглец</span>
          </div>
          <div className={styles.loreDesc}>
            Высокая осторожность. Мгновенно уклоняется на свободную соседнюю клетку при угрозе.
          </div>
        </div>
      </div>
    </div>
  );
}
