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

  // Оценка запаса энергии популяции
  let energyPill = { text: 'В норме', class: styles.statusNormal };
  if (avgEnergy >= 120) {
    energyPill = { text: 'С избытком', class: styles.statusNormal };
  } else if (avgEnergy < 60) {
    energyPill = { text: 'Истощение', class: styles.statusCritical };
  } else {
    energyPill = { text: 'В норме', class: styles.statusWarning };
  }

  const deltaN = totalBirths - totalDeaths;
  const survivalRatio = totalDeaths > 0 
    ? (totalBirths / totalDeaths).toFixed(2) 
    : totalBirths > 0 ? '∞' : '1.00';

  return (
    <div className={styles.overviewGrid}>
      {/* 1. Численность популяции */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>Популяция</span>
          <span className={styles.paramSymbol}>всего</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue}>{alive}</span>
          <span className={styles.unitLabel}>живых</span>
        </div>
        <div className={styles.cardFooter}>
          <span>Статус: {status}</span>
          <span className={`${styles.statusPill} ${alive > 0 ? styles.statusNormal : styles.statusCritical}`}>
            {alive > 0 ? 'Активна' : 'Вымерли'}
          </span>
        </div>
      </div>

      {/* 2. Мин и макс популяция */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>Мин / Макс</span>
          <span className={styles.paramSymbol}>диапазон</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue}>[{minPopulation}, {peakPopulation}]</span>
          <span className={styles.unitLabel}>агентов</span>
        </div>
        <div className={styles.cardFooter}>
          <span>Колебания: {peakPopulation - minPopulation}</span>
          <span className={`${styles.statusPill} ${styles.statusNeutral}`}>Тик {currentTick}</span>
        </div>
      </div>

      {/* 3. Средняя энергия */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>Средняя энергия</span>
          <span className={styles.paramSymbol}>avg</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue}>{avgEnergy.toFixed(1)}</span>
          <span className={styles.unitLabel}>ед. энергии</span>
        </div>
        <div className={styles.cardFooter}>
          <span>Размножение при: 140+</span>
          <span className={`${styles.statusPill} ${energyPill.class}`}>
            {energyPill.text}
          </span>
        </div>
      </div>

      {/* 4. Доля в терминаторе */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>В терминаторе</span>
          <span className={styles.paramSymbol}>%</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue}>{terminatorRatio}%</span>
          <span className={styles.unitLabel}>в зоне</span>
        </div>
        <div className={styles.cardFooter}>
          <span>Умеренная температура</span>
          <span className={`${styles.statusPill} ${styles.statusNeutral}`}>Комфорт</span>
        </div>
      </div>

      {/* 5. Максимальное поколение */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>Поколения</span>
          <span className={styles.paramSymbol}>max</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue}>{dominantGen}</span>
          <span className={styles.unitLabel}>поколение</span>
        </div>
        <div className={styles.cardFooter}>
          <span>Всего родилось: {totalBirths}</span>
          <span className={`${styles.statusPill} ${styles.statusNeutral}`}>Эволюция</span>
        </div>
      </div>

      {/* 6. Баланс рождений и смертей */}
      <div className={styles.metricCard}>
        <div className={styles.cardHeader}>
          <span className={styles.paramLabel}>Прирост популяции</span>
          <span className={styles.paramSymbol}>+/-</span>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.numericValue} style={{ color: deltaN >= 0 ? '#10b981' : '#ef4444' }}>
            {deltaN >= 0 ? `+${deltaN}` : deltaN}
          </span>
          <span className={styles.unitLabel}>разница</span>
        </div>
        <div className={styles.cardFooter}>
          <span>Родилось: {totalBirths} | Погибло: {totalDeaths}</span>
          <span className={`${styles.statusPill} ${deltaN >= 0 ? styles.statusNormal : styles.statusCritical}`}>
            Соотношение: {survivalRatio}
          </span>
        </div>
      </div>
    </div>
  );
}
