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
      {/* Верхняя панель научной телеметрии */}
      <header className={styles.topBar}>
        <div className={styles.brandArea}>
          {onBack && (
            <button className={styles.backBtn} onClick={onBack} title="Вернуться к интерактивному полю">
              ← Поле симуляции
            </button>
          )}

          <h1 className={styles.pageTitle}>
            TERRA NOVA // <span>Научная телеметрия популяции</span>
          </h1>

          <div className={styles.statusBadges}>
            <span className={`${styles.badge} ${isConnected ? styles.badgeOnline : styles.badgeOffline}`}>
              {isConnected ? 'STREAM: ACTIVE' : isInitialLoading ? 'SYNCING...' : 'OFFLINE'}
            </span>
            <span className={`${styles.badge} ${styles.badgeTick}`}>
              t = {currentTick}
            </span>
            <span className={styles.badge} style={{ background: '#1e293b', color: '#94a3b8' }}>
              STATUS: {status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Инструменты выборки и экспорта данных */}
        <div className={styles.topActions}>
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
              ALL
            </button>
          </div>

          <button 
            className={`${styles.liveBtn} ${!isLive ? styles.paused : ''}`}
            onClick={() => setIsLive(!isLive)}
            title="Приостановить поток сбора точек"
          >
            {isLive ? '[ ПОТОК: LIVE ]' : '[ ПАУЗА ]'}
          </button>

          <button className={styles.exportBtn} onClick={exportCSV} title="Выгрузить временной ряд в формате CSV">
            CSV Экспорт
          </button>
          <button className={styles.exportBtn} onClick={exportJSON} title="Выгрузить снимок состояния в формате JSON">
            JSON Срез
          </button>
        </div>
      </header>

      {/* Основная аналитическая зона */}
      <main className={styles.mainContent}>
        {/* 1. Блок базовых статистических агрегатов */}
        <StatsOverview 
          latestMetric={latestMetric}
          peakPopulation={peakPopulation}
          minPopulation={minPopulation}
          totalBirths={totalBirths}
          totalDeaths={totalDeaths}
          currentTick={currentTick}
          status={status}
        />

        {/* 2. Научный график временного ряда динамики популяции N(t) */}
        <PopulationChart history={history} />

        {/* 3. Трёхкомпонентный блок: Метаболический профиль, Термическая зональность, Факторы смертности */}
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

        {/* 4. Реестр фенотипов и журнал стохастических событий */}
        <div className={styles.splitGrid}>
          <TopAgentsLeaderboard agents={topAgents} />
          <EventsFeed events={events} />
        </div>

        {/* 5. Верификация детерминированности модели (PRNG) */}
        <div style={{ marginBottom: '16px' }}>
          <ReproducibilityCard 
            currentHash={stateHash || latestMetric?.stateHash} 
            currentTick={currentTick} 
          />
        </div>
      </main>

      <footer className={styles.footerBar}>
        MERCURY PLANETARY AGENT SIMULATION PLATFORM • RESEARCH TELEMETRY SPECIFICATION V0.3.0
      </footer>
    </div>
  );
}
