import styles from './BottomPanel.module.css';

export default function BottomPanel({ metrics }) {
  const m = metrics || {};
  
  return (
    <footer className={styles.bottomPanel}>
      <h3 className={styles.panelTitle}>
         Глобальная статистика популяции 
         {m.hash && <span className={styles.hashInfo}> State Hash: {m.hash}</span>}
      </h3>
      <div className={styles.chartsContainer}>
        <div className={styles.statBox}>
          <span className={styles.label}>Популяция (Живые)</span>
          <span className={styles.value}>{m.aliveCount !== undefined ? m.aliveCount : (m.total_agents || 0)}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.label}>Средняя энергия</span>
          <span className={styles.value}>{m.avg_energy ? m.avg_energy.toFixed(1) : '0.0'}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.label}>Доля в терминаторе</span>
          <span className={styles.value}>{m.terminator_ratio !== undefined ? (m.terminator_ratio * 100).toFixed(1) + '%' : '0%'}</span>
        </div>
        <div className={styles.statBox}>
           <span className={styles.label}>Смертей за шаг</span>
           <span className={styles.value}>{m.deaths_last_tick || 0}</span>
        </div>
      </div>
    </footer>
  );
}