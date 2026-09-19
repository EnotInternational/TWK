import styles from './StatsOverview.module.css';

export default function StatsOverview({ 
  latestMetric, 
  peakPopulation = 0, 
  minPopulation = 0, 
  totalBirths = 0, 
  totalDeaths = 0, 
  currentTick = 0,
  status = 'stopped'
}) {
  const alive = latestMetric?.alive ?? 0;
  const avgEnergy = latestMetric?.avgEnergy ?? 0;
  const terminatorRatio = latestMetric?.terminatorRatio !== undefined 
    ? (latestMetric.terminatorRatio * 100).toFixed(1) 
    : '0.0';
  const dominantGen = latestMetric?.dominantGeneration ?? 0;

  // Определение режима гомеостаза по энергии
  let energyPill = { text: 'Гомеостаз', class: styles.statusNormal };
  if (avgEnergy >= 120) {
    energyPill = { text: 'Профицит', class: styles.statusNormal };
  } else if (avgEnergy < 60) {
    energyPill = { text: 'Дефицит', class: styles.statusCritical };
  } else {
    energyPill = { text: 'Норма', class: styles.statusWarning };
  }

  const deltaN = totalBirths - totalDeaths;
  const survivalRatio = totalDeaths > 0 
    ? (totalBirths / totalDeaths).toFixed(2) 
    : totalBirths > 0 ? '∞' : '1.00';

  return (
    <div className={styles.overviewGrid}>
      {/* 1. Численность популяции N(t) */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>Численность популяции</span>
          <span className={styles.paramSymbol}>N(t)</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue}>{alive}</span>
          <span className={styles.unitLabel}>особей</span>
        </div>
        <div className={styles.cardFooter}>
          <span>Состояние: {status}</span>
          <span className={`${styles.statusPill} ${alive > 0 ? styles.statusNormal : styles.statusCritical}`}>
            {alive > 0 ? 'Жизнеспособна' : 'Коллапс'}
          </span>
        </div>
      </div>

      {/* 2. Интервал флуктуации численности */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>Экстремумы ряда N</span>
          <span className={styles.paramSymbol}>[N_min, N_max]</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue}>[{minPopulation}, {peakPopulation}]</span>
          <span className={styles.unitLabel}>диапазон</span>
        </div>
        <div className={styles.cardFooter}>
          <span>Амплитуда: Δ = {peakPopulation - minPopulation}</span>
          <span className={`${styles.statusPill} ${styles.statusNeutral}`}>t = {currentTick}</span>
        </div>
      </div>

      {/* 3. Средняя метаболическая энергия */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>Метаболическая энергия</span>
          <span className={styles.paramSymbol}>⟨E⟩</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue}>{avgEnergy.toFixed(1)}</span>
          <span className={styles.unitLabel}>усл. ед.</span>
        </div>
        <div className={styles.cardFooter}>
          <span>Порог деления: E_rep = 140</span>
          <span className={`${styles.statusPill} ${energyPill.class}`}>
            {energyPill.text}
          </span>
        </div>
      </div>

      {/* 4. Коэффициент локализации в терминаторе */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>Доля в терминаторе</span>
          <span className={styles.paramSymbol}>Φ_term</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue}>{terminatorRatio}%</span>
          <span className={styles.unitLabel}>пояс обитания</span>
        </div>
        <div className={styles.cardFooter}>
          <span>Градиент температур: ΔT ≈ 400 K</span>
          <span className={`${styles.statusPill} ${styles.statusNeutral}`}>Климатич. зона</span>
        </div>
      </div>

      {/* 5. Максимальная филогенетическая глубина */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>Филогенетическая глубина</span>
          <span className={styles.paramSymbol}>G_max</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue}>{dominantGen}</span>
          <span className={styles.unitLabel}>поколение</span>
        </div>
        <div className={styles.cardFooter}>
          <span>Всего репликаций: {totalBirths}</span>
          <span className={`${styles.statusPill} ${styles.statusNeutral}`}>Эволюция</span>
        </div>
      </div>

      {/* 6. Демографическое сальдо */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>Демографический прирост</span>
          <span className={styles.paramSymbol}>ΔN = B - D</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue} style={{ color: deltaN >= 0 ? '#10b981' : '#ef4444' }}>
            {deltaN >= 0 ? `+${deltaN}` : deltaN}
          </span>
          <span className={styles.unitLabel}>сальдо</span>
        </div>
        <div className={styles.cardFooter}>
          <span>ΣB: {totalBirths} | ΣD: {totalDeaths}</span>
          <span className={`${styles.statusPill} ${deltaN >= 0 ? styles.statusNormal : styles.statusCritical}`}>
            Индекс B/D: {survivalRatio}
          </span>
        </div>
      </div>
    </div>
  );
}
