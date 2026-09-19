import styles from './MortalityAnalysis.module.css';

export default function MortalityAnalysis({ totalDeaths = 0 }) {
  // Процентное соотношение причин гибели
  const causes = [
    {
      id: 'starvation',
      name: 'Истощение энергии (голод)',
      icon: '⚡',
      percent: 48,
      color: '#ff3344',
      risk: 'Высокий'
    },
    {
      id: 'heat',
      name: 'Термоудар (радиация солнца)',
      icon: '🔥',
      percent: 26,
      color: '#ff7700',
      risk: 'Средний'
    },
    {
      id: 'cold',
      name: 'Глубокая заморозка',
      icon: '❄️',
      percent: 18,
      color: '#3b82f6',
      risk: 'Умеренный'
    },
    {
      id: 'age',
      name: 'Предельный возраст (старость)',
      icon: '⏳',
      percent: 8,
      color: '#a78bfa',
      risk: 'Естественный'
    }
  ];

  return (
    <div className={styles.card}>
      <h4 className={styles.title}>
        <span>💀 Причины смертности</span>
        <span style={{ fontSize: '0.8rem', color: '#ff3344' }}>Всего: {totalDeaths}</span>
      </h4>

      <div className={styles.causesList}>
        {causes.map(c => (
          <div key={c.id} className={styles.causeRow}>
            <div className={styles.causeHeader}>
              <span className={styles.causeName}>
                <span>{c.icon}</span> {c.name}
              </span>
              <div className={styles.causeStats}>
                <span className={styles.causeCount}>
                  ~{Math.round((totalDeaths * c.percent) / 100)} шт.
                </span>
                <span className={styles.causePercent} style={{ color: c.color }}>
                  {c.percent}%
                </span>
              </div>
            </div>
            <div className={styles.track}>
              <div 
                className={styles.fill} 
                style={{ width: `${c.percent}%`, background: c.color }} 
              />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.alertFooter}>
        <span>⚠️</span>
        <span>Основной фактор риска: дефицит энергии при выходе из зоны Терминатора</span>
      </div>
    </div>
  );
}
