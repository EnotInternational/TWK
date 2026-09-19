import styles from './StatsOverview.module.css';

export default function StatsOverview({ 
  latestMetric, 
  peakPopulation, 
  minPopulation, 
  totalBirths, 
  totalDeaths, 
  currentTick,
  status 
}) {
  const alive = latestMetric?.alive ?? 0;
  const avgEnergy = latestMetric?.avgEnergy ?? 0;
  const terminatorRatio = latestMetric?.terminatorRatio !== undefined 
    ? (latestMetric.terminatorRatio * 100).toFixed(1) 
    : '0';
  const dominantGen = latestMetric?.dominantGeneration ?? 0;

  // Energy status determination
  let energyBadge = { text: 'Норма', class: styles.badgeYellow };
  if (avgEnergy >= 110) {
    energyBadge = { text: 'Изобилие', class: styles.badgeGreen };
  } else if (avgEnergy < 65) {
    energyBadge = { text: 'Критический', class: styles.badgeRed };
  }

  // Population delta determination
  const mortalityRate = (totalBirths + totalDeaths) > 0 
    ? ((totalDeaths / (totalBirths + totalDeaths)) * 100).toFixed(0) 
    : '0';

  return (
    <div className={styles.overviewGrid}>
      {/* 1. Текущая популяция */}
      <div className={styles.kpiCard}>
        <div className={styles.header}>
          <span className={styles.title}>Живая популяция</span>
          <span className={styles.icon}>👥</span>
        </div>
        <div className={styles.mainValue}>
          <span className={styles.number}>{alive}</span>
          <span className={styles.unit}>агентов</span>
        </div>
        <div className={styles.footer}>
          <span>Статус: {status}</span>
          <span className={alive > 0 ? styles.badgeGreen : styles.badgeRed}>
            {alive > 0 ? 'Активна' : 'Вымирание'}
          </span>
        </div>
      </div>

      {/* 2. Пик и минимум популяции */}
      <div className={styles.kpiCard}>
        <div className={styles.header}>
          <span className={styles.title}>Экстремумы численности</span>
          <span className={styles.icon}>📈</span>
        </div>
        <div className={styles.mainValue}>
          <span className={styles.number} style={{ color: '#00e5ff' }}>{peakPopulation}</span>
          <span className={styles.unit}>макс</span>
        </div>
        <div className={styles.footer}>
          <span>Минимум: <strong style={{ color: '#fff' }}>{minPopulation}</strong></span>
          <span className={styles.badgeCyan}>Тик {currentTick}</span>
        </div>
      </div>

      {/* 3. Средняя энергия */}
      <div className={styles.kpiCard}>
        <div className={styles.header}>
          <span className={styles.title}>Средняя энергия</span>
          <span className={styles.icon}>⚡</span>
        </div>
        <div className={styles.mainValue}>
          <span className={styles.number} style={{ color: avgEnergy > 100 ? '#00ff88' : avgEnergy < 60 ? '#ff3344' : '#ffd000' }}>
            {avgEnergy.toFixed(1)}
          </span>
          <span className={styles.unit}>e-units</span>
        </div>
        <div className={styles.footer}>
          <span>Порог репродукции: 140</span>
          <span className={`${styles.badge} ${energyBadge.class}`}>
            {energyBadge.text}
          </span>
        </div>
      </div>

      {/* 4. Пояс терминатора */}
      <div className={styles.kpiCard}>
        <div className={styles.header}>
          <span className={styles.title}>Доля в терминаторе</span>
          <span className={styles.icon}>🌓</span>
        </div>
        <div className={styles.mainValue}>
          <span className={styles.number} style={{ color: '#00e5ff' }}>{terminatorRatio}%</span>
          <span className={styles.unit}>в поясе</span>
        </div>
        <div className={styles.footer}>
          <span>Сумеречная полоса</span>
          <span className={styles.badgeCyan}>Комфортная зона</span>
        </div>
      </div>

      {/* 5. Доминирующее поколение */}
      <div className={styles.kpiCard}>
        <div className={styles.header}>
          <span className={styles.title}>Макс. поколение</span>
          <span className={styles.icon}>🧬</span>
        </div>
        <div className={styles.mainValue}>
          <span className={styles.number} style={{ color: '#a78bfa' }}>Gen {dominantGen}</span>
          <span className={styles.unit}>эволюция</span>
        </div>
        <div className={styles.footer}>
          <span>Рождений всего: <strong style={{ color: '#00ff88' }}>{totalBirths}</strong></span>
          <span className={styles.badgeCyan}>Линия предков</span>
        </div>
      </div>

      {/* 6. Баланс рождаемости и смертей */}
      <div className={styles.kpiCard}>
        <div className={styles.header}>
          <span className={styles.title}>Демографический баланс</span>
          <span className={styles.icon}>⚖️</span>
        </div>
        <div className={styles.mainValue}>
          <span className={styles.number} style={{ color: totalBirths >= totalDeaths ? '#00ff88' : '#ff3344' }}>
            +{totalBirths - totalDeaths}
          </span>
          <span className={styles.unit}>сальдо</span>
        </div>
        <div className={styles.footer}>
          <span>🐣 {totalBirths} / 💀 {totalDeaths}</span>
          <span className={Number(mortalityRate) > 50 ? styles.badgeRed : styles.badgeGreen}>
            Смертность {mortalityRate}%
          </span>
        </div>
      </div>
    </div>
  );
}
