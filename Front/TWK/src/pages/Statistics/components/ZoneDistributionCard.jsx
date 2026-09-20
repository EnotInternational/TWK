import styles from './ZoneDistributionCard.module.css';

export default function ZoneDistributionCard({ zoneDistribution }) {
  const hot = zoneDistribution?.hot ?? 0;
  const terminator = zoneDistribution?.terminator ?? 0;
  const cold = zoneDistribution?.cold ?? 0;
  const total = hot + terminator + cold;

  return (
    <div className={styles.card}>
      <h4 className={styles.title}>
        <span>Распределение по зонам</span>
        <span className={styles.paramTag}>Перепад темп.</span>
      </h4>

      {/* Спектральная полоса распределения */}
      <div className={styles.spectrumBar}>
        {total > 0 ? (
          <>
            <div 
              className={`${styles.segment} ${styles.segmentHot}`} 
              style={{ width: `${hot}%` }}
              title={`Дневная сторона (жара): ${hot}%`}
            >
              {hot > 8 ? `Жара ${hot}%` : ''}
            </div>
            <div 
              className={`${styles.segment} ${styles.segmentTerminator}`} 
              style={{ width: `${terminator}%` }}
              title={`Зона терминатора (комфорт): ${terminator}%`}
            >
              {terminator > 8 ? `Терминатор ${terminator}%` : ''}
            </div>
            <div 
              className={`${styles.segment} ${styles.segmentCold}`} 
              style={{ width: `${cold}%` }}
              title={`Ночная сторона (холод): ${cold}%`}
            >
              {cold > 8 ? `Холод ${cold}%` : ''}
            </div>
          </>
        ) : (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.7rem' }}>
            [ Нет данных о зонах ]
          </div>
        )}
      </div>

      <div className={styles.zonesList}>
        {/* Пояс Терминатора */}
        <div className={styles.zoneRow} style={{ borderColor: '#0284c7' }}>
          <div className={styles.zoneInfo}>
            <span className={styles.zoneName}>Зона терминатора (комфортная)</span>
            <span className={styles.zoneDesc}>Умеренная температура, идеальные условия для жизни</span>
          </div>
          <div className={styles.zoneStats}>
            <span className={styles.zonePercent} style={{ color: '#38bdf8' }}>{terminator}%</span>
            <span className={styles.zoneStatus} style={{ color: terminator > 0 ? '#10b981' : '#64748b' }}>
              {terminator > 0 ? 'Комфортно' : '0 агентов'}
            </span>
          </div>
        </div>

        {/* Подсолнечная зона (Zenith) */}
        <div className={styles.zoneRow}>
          <div className={styles.zoneInfo}>
            <span className={styles.zoneName}>Дневная сторона (жара)</span>
            <span className={styles.zoneDesc}>Очень высокая температура, быстрая потеря энергии</span>
          </div>
          <div className={styles.zoneStats}>
            <span className={styles.zonePercent} style={{ color: '#ea580c' }}>{hot}%</span>
            <span className={styles.zoneStatus} style={{ color: hot > 0 ? '#ef4444' : '#64748b' }}>
              {hot > 0 ? 'Опасно (жар)' : '0 агентов'}
            </span>
          </div>
        </div>

        {/* Ночная зона (Nadir) */}
        <div className={styles.zoneRow}>
          <div className={styles.zoneInfo}>
            <span className={styles.zoneName}>Ночная сторона (холод)</span>
            <span className={styles.zoneDesc}>Экстремальный холод, замерзание агентов</span>
          </div>
          <div className={styles.zoneStats}>
            <span className={styles.zonePercent} style={{ color: '#60a5fa' }}>{cold}%</span>
            <span className={styles.zoneStatus} style={{ color: cold > 0 ? '#60a5fa' : '#64748b' }}>
              {cold > 0 ? 'Опасно (холод)' : '0 агентов'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
