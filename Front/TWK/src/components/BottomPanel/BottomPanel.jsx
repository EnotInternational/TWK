import styles from './BottomPanel.module.css';

export default function BottomPanel({ metrics }) {
  return (
    <footer className={styles.bottomPanel}>
      <h3 className={styles.panelTitle}>Глобальная статистика популяции</h3>
      <div className={styles.chartsContainer}>
        {/* Здесь в будущем будут графики, пока выводим метрики в блоках */}
        <div className={styles.statBox}>
          <span className={styles.label}>Глобальная мощность</span>
          <span className={styles.value}>{metrics.power}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.label}>Задержка среды</span>
          <span className={styles.value}>{metrics.latency} мс</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.label}>Средняя эффективность</span>
          <span className={styles.value}>{metrics.efficiency}%</span>
        </div>
      </div>
    </footer>
  );
}