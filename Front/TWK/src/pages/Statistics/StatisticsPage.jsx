import styles from './StatisticsPage.module.css';
import { useStatisticsData } from './hooks/useStatisticsData';
import StatsOverview from './components/StatsOverview';
import PopulationChart from './components/PopulationChart';
import ArchetypeDistributionChart from './components/ArchetypeDistributionChart';
import GeneEvolutionChart from './components/GeneEvolutionChart';
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
      {/* Верхняя панель статистики */}
      <header className={styles.topBar}>
        <div className={styles.brandArea}>
          {onBack && (
            <button className={styles.backBtn} onClick={onBack} title="Вернуться к интерактивному полю симуляции">
              ← Поле симуляции
            </button>
          )}

          <h1 className={styles.pageTitle}>
            TERRA NOVA // <span>Статистика симуляции</span>
          </h1>

          <div className={styles.statusBadges}>
            <span className={`${styles.badge} ${isConnected ? styles.badgeOnline : styles.badgeOffline}`}>
              {isConnected ? 'ОНЛАЙН' : isInitialLoading ? 'ПОДКЛЮЧЕНИЕ...' : 'ОФЛАЙН'}
            </span>
            <span className={`${styles.badge} ${styles.badgeTick}`}>
              Тик: {currentTick}
            </span>
            <span className={styles.badge} style={{ background: '#1e293b', color: '#94a3b8' }}>
              СТАТУС: {status.toUpperCase()}
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
              50 тиков
            </button>
            <button 
              className={`${styles.filterBtn} ${timeRange === '100' ? styles.active : ''}`}
              onClick={() => setTimeRange('100')}
            >
              100 тиков
            </button>
            <button 
              className={`${styles.filterBtn} ${timeRange === '500' ? styles.active : ''}`}
              onClick={() => setTimeRange('500')}
            >
              500 тиков
            </button>
            <button 
              className={`${styles.filterBtn} ${timeRange === 'all' ? styles.active : ''}`}
              onClick={() => setTimeRange('all')}
            >
              Все
            </button>
          </div>

          <button 
            className={`${styles.liveBtn} ${!isLive ? styles.paused : ''}`}
            onClick={() => setIsLive(!isLive)}
            title={isLive ? "Приостановить автообновление данных" : "Возобновить автообновление данных"}
          >
            {isLive ? '● LIVE' : '⏸ ПАУЗА'}
          </button>

          <button className={styles.exportBtn} onClick={exportCSV} title="Скачать историю показателей в формате CSV">
            Экспорт в CSV
          </button>
          <button className={styles.exportBtn} onClick={exportJSON} title="Скачать снимок состояния в формате JSON">
            Экспорт в JSON
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

        {/* 2. График общей динамики популяции */}
        <PopulationChart history={history} />

        {/* 3. График динамики 6 эволюционных архетипов (Трофика и Социальность) */}
        <ArchetypeDistributionChart history={history} />

        {/* 4. График генетического дрейфа и естественного отбора */}
        <GeneEvolutionChart history={history} />

        {/* 5. Блок: Уровень энергии, Распределение по зонам, Причины гибели */}
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

        {/* 4. Топ агентов и лента событий */}
        <div className={styles.splitGrid}>
          <TopAgentsLeaderboard agents={topAgents} />
          <EventsFeed events={events} />
        </div>

        {/* 5. Проверка повторяемости (детерминизм) */}
        <div style={{ marginBottom: '16px' }}>
          <ReproducibilityCard 
            currentHash={stateHash || latestMetric?.stateHash} 
            currentTick={currentTick} 
          />
        </div>
      </main>

      <footer className={styles.footerBar}>
        TERRA NOVA: MERCURY • МОНИТОРИНГ И СТАТИСТИКА СИМУЛЯЦИИ
      </footer>
    </div>
  );
}
