import { useEffect, useRef } from 'react';
import styles from './EnergyDistributionChart.module.css';

export default function EnergyDistributionChart({ history = [], latestMetric = {}, agents = [] }) {
  const canvasRef = useRef(null);
  const avgEnergy = latestMetric?.avgEnergy || 0;

  // Точный расчёт по реальным особям
  let lowPct = 0;
  let midPct = 0;
  let highPct = 0;
  let lowCount = 0;
  let midCount = 0;
  let highCount = 0;

  if (agents && agents.length > 0) {
    agents.forEach(a => {
      const e = a.energy ?? 0;
      if (e < 60) lowCount++;
      else if (e >= 120) highCount++;
      else midCount++;
    });
    const total = agents.length;
    lowPct = Math.round((lowCount / total) * 100);
    midPct = Math.round((midCount / total) * 100);
    highPct = Math.round((highCount / total) * 100);
  }

  // Тренд среднего энергетического уровня
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !history || history.length < 2) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const maxE = 180;
    const minE = 0;

    // Контрольная линия порога репродукции E=140
    const repY = h - ((140 - minE) / (maxE - minE)) * h;
    ctx.beginPath();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = '#334155';
    ctx.moveTo(0, repY);
    ctx.lineTo(w, repY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    history.forEach((pt, idx) => {
      const val = pt.avgEnergy || 0;
      const x = (idx / (history.length - 1)) * w;
      const y = h - ((val - minE) / (maxE - minE)) * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.06)';
    ctx.fill();
  }, [history]);

  return (
    <div className={styles.card}>
      <h4 className={styles.title}>
        <span>Метаболический профиль</span>
        <span className={styles.paramTag}>⟨E⟩ = {avgEnergy > 0 ? avgEnergy.toFixed(1) : '0.0'}</span>
      </h4>

      <div className={styles.barsList}>
        {/* Репродуктивный резерв E >= 120 */}
        <div className={styles.barItem}>
          <div className={styles.barHeader}>
            <span className={styles.barLabel}>Репродуктивный резерв (E ≥ 120)</span>
            <span className={styles.barValue}>
              {highPct}% <span style={{ color: '#64748b', fontSize: '0.68rem' }}>({highCount})</span>
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div 
              className={styles.progressBar} 
              style={{ width: `${highPct}%`, background: '#10b981' }} 
            />
          </div>
        </div>

        {/* Гомеостатическая норма 60 - 120 */}
        <div className={styles.barItem}>
          <div className={styles.barHeader}>
            <span className={styles.barLabel}>Гомеостатический оптимум (60 ≤ E &lt; 120)</span>
            <span className={styles.barValue}>
              {midPct}% <span style={{ color: '#64748b', fontSize: '0.68rem' }}>({midCount})</span>
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div 
              className={styles.progressBar} 
              style={{ width: `${midPct}%`, background: '#f59e0b' }} 
            />
          </div>
        </div>

        {/* Энергетический дефицит E < 60 */}
        <div className={styles.barItem}>
          <div className={styles.barHeader}>
            <span className={styles.barLabel}>Критический дефицит (E &lt; 60)</span>
            <span className={styles.barValue}>
              {lowPct}% <span style={{ color: '#64748b', fontSize: '0.68rem' }}>({lowCount})</span>
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div 
              className={styles.progressBar} 
              style={{ width: `${lowPct}%`, background: '#ef4444' }} 
            />
          </div>
        </div>
      </div>

      <div className={styles.miniChartArea}>
        <div className={styles.miniChartHeader}>
          <span>Динамика среднего потенциала ⟨E(t)⟩</span>
          <span>E_rep = 140</span>
        </div>
        <canvas ref={canvasRef} className={styles.sparklineCanvas} />
      </div>
    </div>
  );
}
