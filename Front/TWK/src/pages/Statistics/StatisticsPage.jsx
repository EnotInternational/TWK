import styles from './StatisticsPage.module.css';
import { useStatisticsData } from './hooks/useStatisticsData';
import StatsOverview from './components/StatsOverview';
import PopulationChart from './components/PopulationChart';
import EnergyDistributionChart from './components/EnergyDistributionChart';
import ZoneDistributionCard from './components/ZoneDistributionCard';
import MortalityAnalysis from './components/MortalityAnalysis';
import TopAgentsLeaderboard from './components/TopAgentsLeaderboard';
import EventsFeed from './components/EventsFeed';
import ReproducibilityCard from './components/ReproducibilityCard';

export default function StatisticsPage({ onBack }) {
  const {
    history,
    currentTick,
    status,
    isConnected,
    isLive,
    setIsLive,
    timeRange,
    setTimeRange,
    isInitialLoading,
    latestMetric,
    peakPopulation,
    minPopulation,
    totalBirths,
    totalDeaths,
    agents,
    zoneDistribution,
    topAgents,
    events,
    stateHash,
    exportJSON,
    exportCSV
  } = useStatisticsData();

  return (
    <div className={styles.pageContainer}>
      {/* Верхний командный HUD */}
      <header className={styles.topBar}>
        <div className={styles.brandArea}>
          {onBack && (
            <button className={styles.backBtn} onClick={onBack} title="Вернуться к визуализации симуляции">
              <span>←</span>
              <span>Симуляция</span>
            </button>
          )}

          <h1 className={styles.pageTitle}>
            Terra Nova // <span>Телеметрия & Статистика</span>
          </h1>

          <div className={styles.statusBadges}>
            <span className={`${styles.badge} ${isConnected ? styles.badgeOnline : styles.badgeOffline}`}>
              {isConnected ? <span className={styles.pulseDot} /> : null}
              {isConnected ? 'Socket Live' : isInitialLoading ? 'Синхронизация...' : 'Оффлайн'}
            </span>
            <span className={`${styles.badge} ${styles.badgeTick}`}>
              Тик: #{currentTick}
            </span>
            <span className={styles.badge} style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#a0aec0' }}>
              Статус: {status}
            </span>
          </div>
        </div>

        {/* Действия и фильтры телеметрии */}
        <div className={styles.topActions}>
          {/* Фильтр диапазона */}
          <div className={styles.filterGroup}>
            <button 
              className={`${styles.filterBtn} ${timeRange === '50' ? styles.active : ''}`}
              onClick={() => setTimeRange('50')}
            >
              50t
            </button>
            <button 
              className={`${styles.filterBtn} ${timeRange === '100' ? styles.active : ''}`}
              onClick={() => setTimeRange('100')}
            >
              100t
            </button>
            <button 
              className={`${styles.filterBtn} ${timeRange === '500' ? styles.active : ''}`}
              onClick={() => setTimeRange('500')}
            >
              500t
            </button>
            <button 
              className={`${styles.filterBtn} ${timeRange === 'all' ? styles.active : ''}`}
              onClick={() => setTimeRange('all')}
            >
              Все
            </button>
          </div>

          {/* Пауза стриминга */}
          <button 
            className={`${styles.liveBtn} ${!isLive ? styles.paused : ''}`}
            onClick={() => setIsLive(!isLive)}
            title="Приостановить поток обновлений"
          >
            {isLive ? '● Live поток' : '⏸ На паузе'}
          </button>

          {/* Экспорт */}
          <button className={styles.exportBtn} onClick={exportCSV} title="Экспортировать историю в CSV">
            📥 CSV
          </button>
          <button className={styles.exportBtn} onClick={exportJSON} title="Экспортировать снимок в JSON">
            📥 JSON
          </button>
        </div>
      </header>

      {/* Основная рабочая область телеметрии */}
      <main className={styles.mainContent}>
        {/* 1. Блок ключевых показателей (KPI Cards) */}
        <StatsOverview 
          latestMetric={latestMetric}
          peakPopulation={peakPopulation}
          minPopulation={minPopulation}
          totalBirths={totalBirths}
          totalDeaths={totalDeaths}
          currentTick={currentTick}
          status={status}
        />

        {/* 2. Главный интерактивный график численности во времени */}
        <PopulationChart history={history} />

        {/* 3. Трёхколоночный ряд: Энергия, Зонирование планеты, Анализ смертности */}
        <div className={styles.triGrid}>
          <EnergyDistributionChart 
            history={history} 
            latestMetric={latestMetric} 
            agents={agents}
          />
          <ZoneDistributionCard 
            zoneDistribution={zoneDistribution} 
          />
          <MortalityAnalysis 
            totalDeaths={totalDeaths} 
          />
        </div>

        {/* 4. Раздел лидеров популяции и ленты событий */}
        <div className={styles.splitGrid}>
          <TopAgentsLeaderboard agents={topAgents} />
          <EventsFeed events={events} />
        </div>

        {/* 5. Научная воспроизводимость (Seed & Hash Verification) */}
        <div style={{ marginBottom: '24px' }}>
          <ReproducibilityCard 
            currentHash={stateHash || latestMetric?.stateHash} 
            currentTick={currentTick} 
          />
        </div>
      </main>

      <footer className={styles.footerBar}>
        TERRA NOVA: MERCURY AGENT FIELD TELEMETRY SYSTEM • V0.2.0 • СИСТЕМА НАУЧНОГО МОНИТОРИНГА И АНАЛИТИКИ
      </footer>
    </div>
  );
}
