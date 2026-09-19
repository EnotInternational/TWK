import styles from './ZoneDistributionCard.module.css';

export default function ZoneDistributionCard({ zoneDistribution }) {
  const hot = zoneDistribution?.hot ?? 0;
  const terminator = zoneDistribution?.terminator ?? 0;
  const cold = zoneDistribution?.cold ?? 0;
  const total = hot + terminator + cold;

  return (
    <div className={styles.card}>
      <h4 className={styles.title}>
        <span>Термическая зональность</span>
        <span className={styles.paramTag}>ΔT ≈ 550 K</span>
      </h4>

      {/* Спектральная полоса распределения */}
      <div className={styles.spectrumBar}>
        {total > 0 ? (
          <>
            <div 
              className={`${styles.segment} ${styles.segmentHot}`} 
              style={{ width: `${hot}%` }}
              title={`Инсоляционный сектор (Zenith): ${hot}%`}
            >
              {hot > 8 ? `${hot}%` : ''}
            </div>
            <div 
              className={`${styles.segment} ${styles.segmentTerminator}`} 
              style={{ width: `${terminator}%` }}
              title={`Пояс терминатора: ${terminator}%`}
            >
              {terminator > 8 ? `Терминатор ${terminator}%` : ''}
            </div>
            <div 
              className={`${styles.segment} ${styles.segmentCold}`} 
              style={{ width: `${cold}%` }}
              title={`Антиинсоляционный сектор (Nadir): ${cold}%`}
            >
              {cold > 8 ? `${cold}%` : ''}
            </div>
          </>
        ) : (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.7rem' }}>
            [ Калибровка координат термических поясов ]
          </div>
        )}
      </div>

      <div className={styles.zonesList}>
        {/* Пояс Терминатора */}
        <div className={styles.zoneRow} style={{ borderColor: '#0284c7' }}>
          <div className={styles.zoneInfo}>
            <span className={styles.zoneName}>Пояс Терминатора (Habitable Belt)</span>
            <span className={styles.zoneDesc}>290 K ≤ T ≤ 330 K • Умеренный градиент</span>
          </div>
          <div className={styles.zoneStats}>
            <span className={styles.zonePercent} style={{ color: '#38bdf8' }}>{terminator}%</span>
            <span className={styles.zoneStatus} style={{ color: terminator > 0 ? '#10b981' : '#64748b' }}>
              {terminator > 0 ? 'Оптимум' : 'N = 0'}
            </span>
          </div>
        </div>

        {/* Подсолнечная зона (Zenith) */}
        <div className={styles.zoneRow}>
          <div className={styles.zoneInfo}>
            <span className={styles.zoneName}>Подсолнечный сектор (Zenith)</span>
            <span className={styles.zoneDesc}>T &gt; 650 K • Радиационный поток</span>
          </div>
          <div className={styles.zoneStats}>
            <span className={styles.zonePercent} style={{ color: '#ea580c' }}>{hot}%</span>
            <span className={styles.zoneStatus} style={{ color: hot > 0 ? '#ef4444' : '#64748b' }}>
              {hot > 0 ? 'Стресс' : 'N = 0'}
            </span>
          </div>
        </div>

        {/* Ночная зона (Nadir) */}
        <div className={styles.zoneRow}>
          <div className={styles.zoneInfo}>
            <span className={styles.zoneName}>Антисолнечный сектор (Nadir)</span>
            <span className={styles.zoneDesc}>T &lt; 100 K • Криогенная среда</span>
          </div>
          <div className={styles.zoneStats}>
            <span className={styles.zonePercent} style={{ color: '#60a5fa' }}>{cold}%</span>
            <span className={styles.zoneStatus} style={{ color: cold > 0 ? '#60a5fa' : '#64748b' }}>
              {cold > 0 ? 'Гипотермия' : 'N = 0'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
