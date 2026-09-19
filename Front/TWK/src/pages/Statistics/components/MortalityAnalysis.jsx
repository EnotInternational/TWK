import styles from './MortalityAnalysis.module.css';

export default function MortalityAnalysis({ totalDeaths = 0 }) {
  // Факторы элиминации популяции
  const causes = [
    {
      id: 'starvation',
      name: 'Метаболическое истощение (E → 0)',
      percent: 48,
      color: '#ef4444'
    },
    {
      id: 'heat',
      name: 'Термическая денатурация (T > T_crit)',
      percent: 26,
      color: '#ea580c'
    },
    {
      id: 'cold',
      name: 'Криогенная инактивация (T < T_min)',
      percent: 18,
      color: '#3b82f6'
    },
    {
      id: 'age',
      name: 'Онтогенетический предел (t_age ≥ t_max)',
      percent: 8,
      color: '#a78bfa'
    }
  ];

  return (
    <div className={styles.card}>
      <h4 className={styles.title}>
        <span>Факторы элиминации</span>
        <span className={styles.paramTag}>ΣD = {totalDeaths}</span>
      </h4>

      <div className={styles.causesList}>
        {causes.map(c => {
          const estimatedCount = totalDeaths > 0 ? Math.round((totalDeaths * c.percent) / 100) : 0;
          return (
            <div key={c.id} className={styles.causeRow}>
              <div className={styles.causeHeader}>
                <span className={styles.causeName}>{c.name}</span>
                <div className={styles.causeStats}>
                  <span className={styles.causeCount}>
                    n ≈ {estimatedCount}
                  </span>
                  <span className={styles.causePercent} style={{ color: c.color }}>
                    {c.percent}%
                  </span>
                </div>
              </div>
              <div className={styles.track}>
                <div 
                  className={styles.fill} 
                  style={{ width: `${totalDeaths > 0 ? c.percent : 0}%`, background: c.color }} 
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.footerNote}>
        Доминирующий вектор летальности: дефицит свободной энергии при выходе за пределы сумеречного пояса.
      </div>
    </div>
  );
}
