import { useEffect, useRef } from 'react';
import styles from './EnergyDistributionChart.module.css';

export default function EnergyDistributionChart({ history = [], latestMetric = {}, agents = [] }) {
  const canvasRef = useRef(null);

  const avgEnergy = latestMetric?.avgEnergy || 0;

  // Рассчитываем точные процентные доли из реального списка агентов
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
      else if (e > 120) highCount++;
      else midCount++;
    });
    const total = agents.length;
    lowPct = Math.round((lowCount / total) * 100);
    midPct = Math.round((midCount / total) * 100);
    highPct = Math.round((highCount / total) * 100);
  }

  // Рисуем мини-спарклайн средней энергии за тики
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

    ctx.beginPath();
    history.forEach((pt, idx) => {
      const val = pt.avgEnergy || 0;
      const x = (idx / (history.length - 1)) * w;
      const y = h - ((val - minE) / (maxE - minE)) * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = '#ffd000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Закраска под спарклайном
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 208, 0, 0.1)';
    ctx.fill();
  }, [history]);

  return (
    <div className={styles.card}>
      <h4 className={styles.title}>
        <span>⚡ Энергетический баланс</span>
        <span style={{ fontSize: '0.8rem', color: '#ffd000' }}>
          {avgEnergy > 0 ? `${avgEnergy.toFixed(1)} E` : '—'}
        </span>
      </h4>

      <div className={styles.barsList}>
        {/* Готовы к размножению > 120 */}
        <div className={styles.barItem}>
          <div className={styles.barHeader}>
            <span className={styles.barLabel}>
              <span style={{ color: '#00ff88' }}>●</span> Репродукция (&gt; 120 E)
            </span>
            <span className={styles.barValue} style={{ color: '#00ff88' }}>
              {highPct}% <span style={{ color: '#718096', fontSize: '0.7rem' }}>({highCount})</span>
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div 
              className={styles.progressBar} 
              style={{ width: `${highPct}%`, background: 'linear-gradient(90deg, #00bb66, #00ff88)' }} 
            />
          </div>
        </div>

        {/* Стабильное состояние 60 - 120 */}
        <div className={styles.barItem}>
          <div className={styles.barHeader}>
            <span className={styles.barLabel}>
              <span style={{ color: '#ffd000' }}>●</span> Стабильный (60 - 120 E)
            </span>
            <span className={styles.barValue} style={{ color: '#ffd000' }}>
              {midPct}% <span style={{ color: '#718096', fontSize: '0.7rem' }}>({midCount})</span>
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div 
              className={styles.progressBar} 
              style={{ width: `${midPct}%`, background: 'linear-gradient(90deg, #d9a800, #ffd000)' }} 
            />
          </div>
        </div>

        {/* Риск истощения < 60 */}
        <div className={styles.barItem}>
          <div className={styles.barHeader}>
            <span className={styles.barLabel}>
              <span style={{ color: '#ff3344' }}>●</span> Критическое (&lt; 60 E)
            </span>
            <span className={styles.barValue} style={{ color: '#ff3344' }}>
              {lowPct}% <span style={{ color: '#718096', fontSize: '0.7rem' }}>({lowCount})</span>
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div 
              className={styles.progressBar} 
              style={{ width: `${lowPct}%`, background: 'linear-gradient(90deg, #bb2233, #ff3344)' }} 
            />
          </div>
        </div>
      </div>

      <div className={styles.miniChartArea}>
        <div className={styles.miniChartHeader}>
          <span>Тренд средней энергии</span>
          <span>{history.length > 1 ? `${history.length} тиков` : 'Накопление...'}</span>
        </div>
        <canvas ref={canvasRef} className={styles.sparklineCanvas} />
      </div>
    </div>
  );
}
