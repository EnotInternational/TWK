import styles from './ZoneDistributionCard.module.css';

export default function ZoneDistributionCard({ zoneDistribution = { hot: 15, terminator: 65, cold: 20 } }) {
  const hot = zoneDistribution.hot ?? 15;
  const terminator = zoneDistribution.terminator ?? 65;
  const cold = zoneDistribution.cold ?? 20;

  return (
    <div className={styles.card}>
      <h4 className={styles.title}>
        <span>🪐 Планетарные зоны (Меркурий)</span>
        <span style={{ fontSize: '0.8rem', color: '#00e5ff' }}>Обитаемость</span>
      </h4>

      {/* Градиентная полоса зон планеты */}
      <div className={styles.planetStrip}>
        <div 
          className={`${styles.zoneSegment} ${styles.zoneHot}`} 
          style={{ width: `${hot}%` }}
          title={`Дневная сторона (Hot): ${hot}%`}
        >
          {hot > 10 ? `${hot}%` : ''}
        </div>
        <div 
          className={`${styles.zoneSegment} ${styles.zoneTerminator}`} 
          style={{ width: `${terminator}%` }}
          title={`Пояс терминатора: ${terminator}%`}
        >
          {terminator > 10 ? `Терминатор ${terminator}%` : ''}
        </div>
        <div 
          className={`${styles.zoneSegment} ${styles.zoneCold}`} 
          style={{ width: `${cold}%` }}
          title={`Ночная сторона (Cold): ${cold}%`}
        >
          {cold > 10 ? `${cold}%` : ''}
        </div>
      </div>

      <div className={styles.zonesList}>
        {/* Пояс Терминатора */}
        <div className={styles.zoneRow} style={{ borderColor: 'rgba(0, 229, 255, 0.3)' }}>
          <div className={styles.zoneInfo}>
            <span className={styles.zoneIcon}>🌓</span>
            <div className={styles.zoneTexts}>
              <span className={styles.zoneName}>Сумеречный пояс (Терминатор)</span>
              <span className={styles.zoneDesc}>+20°C ... +45°C • Умеренная среда</span>
            </div>
          </div>
          <div className={styles.zoneStats}>
            <span className={styles.zonePercent} style={{ color: '#00e5ff' }}>{terminator}%</span>
            <span className={styles.zoneHabitability} style={{ color: '#00ff88' }}>Идеально</span>
          </div>
        </div>

        {/* Раскалённая дневная сторона */}
        <div className={styles.zoneRow}>
          <div className={styles.zoneInfo}>
            <span className={styles.zoneIcon}>☀️</span>
            <div className={styles.zoneTexts}>
              <span className={styles.zoneName}>Дневная сторона (Zenith)</span>
              <span className={styles.zoneDesc}>до +430°C • Солнечная радиация</span>
            </div>
          </div>
          <div className={styles.zoneStats}>
            <span className={styles.zonePercent} style={{ color: '#ff7700' }}>{hot}%</span>
            <span className={styles.zoneHabitability} style={{ color: '#ff3344' }}>Опасно</span>
          </div>
        </div>

        {/* Ледяная ночная сторона */}
        <div className={styles.zoneRow}>
          <div className={styles.zoneInfo}>
            <span className={styles.zoneIcon}>❄️</span>
            <div className={styles.zoneTexts}>
              <span className={styles.zoneName}>Ночная сторона (Nadir)</span>
              <span className={styles.zoneDesc}>до -180°C • Глубокая заморозка</span>
            </div>
          </div>
          <div className={styles.zoneStats}>
            <span className={styles.zonePercent} style={{ color: '#3b82f6' }}>{cold}%</span>
            <span className={styles.zoneHabitability} style={{ color: '#3b82f6' }}>Низкая t°</span>
          </div>
        </div>
      </div>
    </div>
  );
}
