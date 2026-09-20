import { useState, useEffect } from 'react';
import styles from './StatisticsPage.module.css';
import { useStatisticsData } from './hooks/useStatisticsData';
import StatsOverview from './components/StatsOverview';
import PopulationChart from './components/PopulationChart';
import CharacterDynamicsChart from './components/CharacterDynamicsChart';
import ArchetypeDistributionChart from './components/ArchetypeDistributionChart';
import GeneEvolutionChart from './components/GeneEvolutionChart';
import EnergyDistributionChart from './components/EnergyDistributionChart';
import ZoneDistributionCard from './components/ZoneDistributionCard';
import MortalityAnalysis from './components/MortalityAnalysis';
import TopAgentsLeaderboard from './components/TopAgentsLeaderboard';
import EventsFeed from './components/EventsFeed';
import ReproducibilityCard from './components/ReproducibilityCard';
import AgentDossierView from './components/AgentDossierView';

export default function StatisticsPage({ onBack }) {
  const [activeSubTab, setActiveSubTab] = useState(() => {
    const hash = window.location.hash || '';
    if (hash.includes('tab=dossier') || hash.includes('agent=')) return 'dossier';
    return 'overview';
  });
  const [selectedAgentId, setSelectedAgentId] = useState(() => {
    const hash = window.location.hash || '';
    const match = hash.match(/agent=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  });

  useEffect(() => {
    const handleHashCheck = () => {
      const hash = window.location.hash || '';
      if (hash.includes('tab=dossier') || hash.includes('agent=')) {
        setActiveSubTab('dossier');
      } else if (hash.includes('tab=overview')) {
        setActiveSubTab('overview');
      }
      const match = hash.match(/agent=([^&]+)/);
      if (match) {
        setSelectedAgentId(decodeURIComponent(match[1]));
      }
    };
    window.addEventListener('hashchange', handleHashCheck);
    return () => window.removeEventListener('hashchange', handleHashCheck);
  }, []);

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
    geneStats,
    exportJSON,
    exportCSV,
    exportGenesCSV,
    exportGenesJSON
  } = useStatisticsData();

  return (
    <div className={styles.pageContainer}>
      {/* Верхняя панель статистики */}
      <header className={styles.topBar}>

        <div className={styles.brandArea}>
          <div>
            {onBack && (
              <button className={styles.backBtn} onClick={onBack} title="Вернуться к интерактивному полю симуляции">
                ← Поле симуляции
              </button>
            )}

            <h1 className={styles.pageTitle}>
              TERRA NOVA // <span>Статистика симуляции</span>
            </h1>
          </div>
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
          <button
            className={`${styles.exportBtn} ${styles.exportGeneBtn}`}
            onClick={exportGenesCSV}
            title="Скачать данные генофонда и адаптации всех агентов в формате CSV"
          >
            🧬 Гены (CSV)
          </button>
          <button
            className={`${styles.exportBtn} ${styles.exportGeneBtn}`}
            onClick={exportGenesJSON}
            title="Скачать полный датасет генома и мутаций в формате JSON"
          >
            🧬 Гены (JSON)
          </button>
        </div>
      </header>

      {/* Навигация по подразделам статистики */}
      <nav className={styles.tabNav}>
        <button
          className={`${styles.subTabBtn} ${activeSubTab === 'overview' ? styles.activeTab : ''}`}
          onClick={() => {
            setActiveSubTab('overview');
            window.location.hash = '#/stats?tab=overview';
          }}
        >
          <span>📊 Общий обзор симуляции</span>
        </button>

        <button
          className={`${styles.subTabBtn} ${activeSubTab === 'dossier' ? styles.activeTab : ''}`}
          onClick={() => {
            setActiveSubTab('dossier');
            window.location.hash = selectedAgentId
              ? `#/stats?tab=dossier&agent=${selectedAgentId}`
              : '#/stats?tab=dossier';
          }}
        >
          <span>🕵️ Досье агента и Хроника выборов</span>
          {agents.length > 0 && (
            <span className={styles.tabBadge}>{agents.length} в строю</span>
          )}
        </button>
      </nav>

      {/* Основная аналитическая зона */}
      <main className={styles.mainContent}>
        {activeSubTab === 'dossier' ? (
          <AgentDossierView
            liveAgents={agents}
            selectedAgentId={selectedAgentId}
            onSelectAgentId={(id) => {
              setSelectedAgentId(id);
              window.location.hash = `#/stats?tab=dossier&agent=${id}`;
            }}
            currentTick={currentTick}
          />
        ) : (
          <>
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

            {/* 3. График динамики формирования характера и выборов при столкновениях */}
            <CharacterDynamicsChart history={history} />

            {/* 4. График динамики 6 эволюционных архетипов (Трофика и Социальность) */}
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
              <TopAgentsLeaderboard
                agents={topAgents}
                onSelectAgent={(agentId) => {
                  setSelectedAgentId(agentId);
                  setActiveSubTab('dossier');
                  window.location.hash = `#/stats?tab=dossier&agent=${agentId}`;
                }}
              />
              <EventsFeed events={events} />
            </div>

            {/* 5. Проверка повторяемости (детерминизм) */}
            <div style={{ marginBottom: '16px' }}>
              <ReproducibilityCard
                currentHash={stateHash || latestMetric?.stateHash}
                currentTick={currentTick}
              />
            </div>
          </>
        )}
      </main>

      <footer className={styles.footerBar}>
        TERRA NOVA: MERCURY • МОНИТОРИНГ И СТАТИСТИКА СИМУЛЯЦИИ
      </footer>
    </div>
  );
}
