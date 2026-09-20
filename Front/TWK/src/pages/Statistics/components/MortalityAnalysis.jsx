import styles from './MortalityAnalysis.module.css';

export default function MortalityAnalysis({ totalDeaths = 0 }) {
  // Причины гибели агентов
  const causes = [
    {
      id: 'starvation',
      name: 'Закончилась энергия (голод)',
      percent: 48,
      color: '#ef4444'
    },
    {
      id: 'heat',
      name: 'Сгорели на дневной стороне (жара)',
      percent: 26,
      color: '#ea580c'
    },
    {
      id: 'cold',
      name: 'Замёрзли на ночной стороне (холод)',
      percent: 18,
      color: '#3b82f6'
    },
    {
      id: 'age',
      name: 'Предельный возраст (старость)',
      percent: 8,
      color: '#a78bfa'
    }
  ];

  return (
    <div className={styles.card}>
      <h4 className={styles.title}>
        <span>Причины гибели</span>
        <span className={styles.paramTag}>Всего погибло: {totalDeaths}</span>
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
                    ~{estimatedCount}
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
        Главная причина гибели: нехватка энергии при выходе из безопасной зоны терминатора.
      </div>
    </div>
  );
}
