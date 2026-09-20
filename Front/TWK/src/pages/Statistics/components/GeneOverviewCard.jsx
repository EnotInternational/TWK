import { useState, useMemo } from 'react';
import styles from './GeneOverviewCard.module.css';

export default function GeneOverviewCard({ 
  geneStats, 
  agents = [], 
  onExportCSV, 
  onExportJSON,
  currentTick = 0
}) {
  const [activeSort, setActiveSort] = useState('generation');
  const [sortOrder, setSortOrder] = useState('desc');

  const stats = geneStats || {
    count: agents.length,
    avgWTemp: 0,
    minWTemp: 0,
    maxWTemp: 0,
    thermophobePercent: 0,
    thermophobeCount: 0,
    avgWSwarm: 0,
    minWSwarm: 0,
    maxWSwarm: 0,
    swarmPercent: 0,
    swarmCount: 0,
    maxGeneration: 0,
    dominantGeneration: 0,
    generationDistribution: {},
    strategies: {},
    strategyPercents: {}
  };

  const handleSort = (field) => {
    if (activeSort === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setActiveSort(field);
      setSortOrder('desc');
    }
  };

  const sortedAgents = useMemo(() => {
    let list = [...agents];
    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (activeSort === 'generation') {
        valA = a.generation ?? 0;
        valB = b.generation ?? 0;
      } else if (activeSort === 'w_temp') {
        valA = a.w_temp ?? a.learning?.w_temp ?? 0;
        valB = b.w_temp ?? b.learning?.w_temp ?? 0;
      } else if (activeSort === 'w_swarm') {
        valA = a.w_swarm ?? a.learning?.w_swarm ?? 0;
        valB = b.w_swarm ?? b.learning?.w_swarm ?? 0;
      } else if (activeSort === 'hp') {
        valA = a.hp ?? a.energy ?? 0;
        valB = b.hp ?? b.energy ?? 0;
      } else if (activeSort === 'age') {
        valA = a.age ?? 0;
        valB = b.age ?? 0;
      } else {
        valA = a.id;
        valB = b.id;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list.slice(0, 15); // Show top 15 in card preview
  }, [agents, activeSort, sortOrder]);

  // Meter percentage calculations (-3.0 to +3.0 -> 0% to 100%)
  const clampRange = (val, min = -3, max = 3) => Math.min(max, Math.max(min, val));
  const tempMeterPercent = ((clampRange(stats.avgWTemp) + 3) / 6) * 100;
  const swarmMeterPercent = ((clampRange(stats.avgWSwarm) + 3) / 6) * 100;

  const stratPercents = stats.strategyPercents || {};
  const coopPercent = stratPercents.cooperation_thermophobe || 0;
  const loneThermPercent = stratPercents.lone_thermophobe || 0;
  const swarmExtremPercent = stratPercents.swarm_extremophile || 0;
  const loneExtremPercent = stratPercents.lone_extremophile || 0;

  return (
    <div className={styles.card}>
      {/* CARD HEADER */}
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>
            <span>🧬 Обзор генофонда и эволюционной адаптации</span>
          </h3>
          <div className={styles.tagGroup}>
            <span className={styles.tag}>Популяция: {stats.count}</span>
            <span className={styles.tagHighlight}>Доминирует: G{stats.dominantGeneration}</span>
            <span className={styles.tag}>Макс. поколение: G{stats.maxGeneration}</span>
            <span className={styles.tag}>Мутация σ: ±0.50</span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button 
            className={styles.geneExportBtn}
            onClick={onExportCSV}
            title="Выгрузить данные генофонда в CSV"
          >
            Экспорт генов CSV
          </button>
          <button 
            className={styles.geneExportBtn}
            onClick={onExportJSON}
            title="Выгрузить данные генофонда в JSON"
          >
            Экспорт генов JSON
          </button>
        </div>
      </div>

      {/* TWO PRIMARY GENE METRIC PANELS */}
      <div className={styles.genesGrid}>
        {/* Gene 1: w_temp */}
        <div className={styles.genePanel}>
          <div className={styles.geneHeader}>
            <div className={styles.geneTitleArea}>
              <span className={styles.geneName}>Ген термоадаптации (w_temp)</span>
              <span className={styles.geneDesc}>Отрицательный вес стимулирует избегать экстремальных температур</span>
            </div>
            <div className={styles.geneAvgBadge} style={{ color: stats.avgWTemp < 0 ? '#38bdf8' : '#f59e0b' }}>
              {stats.avgWTemp >= 0 ? `+${stats.avgWTemp.toFixed(4)}` : stats.avgWTemp.toFixed(4)}
            </div>
          </div>

          <div className={styles.meterContainer}>
            <div className={styles.bipolarTrack}>
              <div className={styles.bipolarCenterMark} />
              <div 
                className={styles.bipolarFill}
                style={{
                  left: stats.avgWTemp < 0 ? `${tempMeterPercent}%` : '50%',
                  width: `${Math.abs(tempMeterPercent - 50)}%`,
                  background: stats.avgWTemp < 0 ? '#38bdf8' : '#f59e0b'
                }}
              />
              <div 
                className={styles.bipolarPointer}
                style={{ left: `${tempMeterPercent}%` }}
                title={`Среднее w_temp: ${stats.avgWTemp}`}
              />
            </div>
            <div className={styles.meterLabels}>
              <span>-3.0 (Термофоб)</span>
              <span>0 (Нейтральный)</span>
              <span>+3.0 (Экстремал)</span>
            </div>
          </div>

          <div className={styles.geneStatsRow}>
            <div className={styles.microStat}>
              <span className={styles.microLabel}>Термофобы (&lt;0)</span>
              <strong className={styles.microValue} style={{ color: '#38bdf8' }}>
                {stats.thermophobePercent}% ({stats.thermophobeCount})
              </strong>
            </div>
            <div className={styles.microStat}>
              <span className={styles.microLabel}>Минимум / Максимум</span>
              <strong className={styles.microValue}>
                [{stats.minWTemp} ... {stats.maxWTemp}]
              </strong>
            </div>
            <div className={styles.microStat}>
              <span className={styles.microLabel}>Эволюционный тренд</span>
              <strong className={styles.microValue} style={{ color: stats.avgWTemp < 0 ? '#10b981' : '#f59e0b' }}>
                {stats.avgWTemp < 0 ? '✓ Селекция в Терминатор' : 'Размытый отбор'}
              </strong>
            </div>
          </div>
        </div>

        {/* Gene 2: w_swarm */}
        <div className={styles.genePanel}>
          <div className={styles.geneHeader}>
            <div className={styles.geneTitleArea}>
              <span className={styles.geneName}>Ген стайного инстинкта (w_swarm)</span>
              <span className={styles.geneDesc}>Положительный вес стимулирует поиск партнеров и группировку</span>
            </div>
            <div className={styles.geneAvgBadge} style={{ color: stats.avgWSwarm > 0 ? '#10b981' : '#94a3b8' }}>
              {stats.avgWSwarm >= 0 ? `+${stats.avgWSwarm.toFixed(4)}` : stats.avgWSwarm.toFixed(4)}
            </div>
          </div>

          <div className={styles.meterContainer}>
            <div className={styles.bipolarTrack}>
              <div className={styles.bipolarCenterMark} />
              <div 
                className={styles.bipolarFill}
                style={{
                  left: stats.avgWSwarm < 0 ? `${swarmMeterPercent}%` : '50%',
                  width: `${Math.abs(swarmMeterPercent - 50)}%`,
                  background: stats.avgWSwarm > 0 ? '#10b981' : '#64748b'
                }}
              />
              <div 
                className={styles.bipolarPointer}
                style={{ left: `${swarmMeterPercent}%` }}
                title={`Среднее w_swarm: ${stats.avgWSwarm}`}
              />
            </div>
            <div className={styles.meterLabels}>
              <span>-3.0 (Одиночка)</span>
              <span>0 (Нейтральный)</span>
              <span>+3.0 (Стайность)</span>
            </div>
          </div>

          <div className={styles.geneStatsRow}>
            <div className={styles.microStat}>
              <span className={styles.microLabel}>Стайные агенты (&gt;0)</span>
              <strong className={styles.microValue} style={{ color: '#10b981' }}>
                {stats.swarmPercent}% ({stats.swarmCount})
              </strong>
            </div>
            <div className={styles.microStat}>
              <span className={styles.microLabel}>Минимум / Максимум</span>
              <strong className={styles.microValue}>
                [{stats.minWSwarm} ... {stats.maxWSwarm}]
              </strong>
            </div>
            <div className={styles.microStat}>
              <span className={styles.microLabel}>Социальный фактор</span>
              <strong className={styles.microValue} style={{ color: stats.avgWSwarm > 0 ? '#10b981' : '#94a3b8' }}>
                {stats.avgWSwarm > 0 ? '✓ Кооперация популяции' : 'Обособленность'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* BEHAVIORAL STRATEGY SPECTRUM */}
      <div className={styles.strategySection}>
        <div className={styles.strategySectionHeader}>
          <span className={styles.subTitle}>Спектр выученных поведенческих стратегий (Генотипы)</span>
          <span className={styles.hint}>Классификация агентов по сочетанию весов w_temp и w_swarm</span>
        </div>

        {/* Multi-segment Spectrum Bar */}
        <div className={styles.spectrumBar}>
          {stats.count > 0 ? (
            <>
              {coopPercent > 0 && (
                <div 
                  className={`${styles.stratSegment} ${styles.segCoop}`} 
                  style={{ width: `${coopPercent}%` }}
                  title={`Термофоб-кооператор: ${coopPercent}%`}
                >
                  {coopPercent > 12 ? `Кооперация ${coopPercent}%` : ''}
                </div>
              )}
              {loneThermPercent > 0 && (
                <div 
                  className={`${styles.stratSegment} ${styles.segLoneTherm}`} 
                  style={{ width: `${loneThermPercent}%` }}
                  title={`Термофоб-одиночка: ${loneThermPercent}%`}
                >
                  {loneThermPercent > 12 ? `Одиночка ${loneThermPercent}%` : ''}
                </div>
              )}
              {swarmExtremPercent > 0 && (
                <div 
                  className={`${styles.stratSegment} ${styles.segSwarmExtrem}`} 
                  style={{ width: `${swarmExtremPercent}%` }}
                  title={`Экстремал-стайный: ${swarmExtremPercent}%`}
                >
                  {swarmExtremPercent > 12 ? `Экстремал ${swarmExtremPercent}%` : ''}
                </div>
              )}
              {loneExtremPercent > 0 && (
                <div 
                  className={`${styles.stratSegment} ${styles.segLoneExtrem}`} 
                  style={{ width: `${loneExtremPercent}%` }}
                  title={`Экстремал-одиночка: ${loneExtremPercent}%`}
                >
                  {loneExtremPercent > 12 ? `Одиноч.-экстр. ${loneExtremPercent}%` : ''}
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptySpectrum}>[ Нет активных данных о стратегиях ]</div>
          )}
        </div>

        {/* 4 Strategy Indicator Cards */}
        <div className={styles.stratGrid}>
          <div className={styles.stratCard}>
            <div className={styles.stratTop}>
              <span className={styles.stratDot} style={{ background: '#38bdf8' }} />
              <span className={styles.stratLabel}>🧬 Термофоб-кооператор</span>
              <strong className={styles.stratPercent} style={{ color: '#38bdf8' }}>{coopPercent}%</strong>
            </div>
            <span className={styles.stratSub}>w_temp &lt; 0, w_swarm &gt; 0 • Стремится в Терминатор, собирается в стаю</span>
          </div>

          <div className={styles.stratCard}>
            <div className={styles.stratTop}>
              <span className={styles.stratDot} style={{ background: '#3b82f6' }} />
              <span className={styles.stratLabel}>🎯 Термофоб-одиночка</span>
              <strong className={styles.stratPercent} style={{ color: '#3b82f6' }}>{loneThermPercent}%</strong>
            </div>
            <span className={styles.stratSub}>w_temp &lt; 0, w_swarm ≤ 0 • Избегает перепадов температур, держит дистанцию</span>
          </div>

          <div className={styles.stratCard}>
            <div className={styles.stratTop}>
              <span className={styles.stratDot} style={{ background: '#f59e0b' }} />
              <span className={styles.stratLabel}>🔥 Экстремал-стайный</span>
              <strong className={styles.stratPercent} style={{ color: '#f59e0b' }}>{swarmExtremPercent}%</strong>
            </div>
            <span className={styles.stratSub}>w_temp ≥ 0, w_swarm &gt; 0 • Толерантен к жаре/холоду, следует за сородичами</span>
          </div>

          <div className={styles.stratCard}>
            <div className={styles.stratTop}>
              <span className={styles.stratDot} style={{ background: '#ef4444' }} />
              <span className={styles.stratLabel}>⚡ Экстремал-одиночка</span>
              <strong className={styles.stratPercent} style={{ color: '#ef4444' }}>{loneExtremPercent}%</strong>
            </div>
            <span className={styles.stratSub}>w_temp ≥ 0, w_swarm ≤ 0 • Автономный исследователь экстремальных зон</span>
          </div>
        </div>
      </div>

      {/* GENERATION DISTRIBUTION CHIPS */}
      <div className={styles.genSection}>
        <div className={styles.genSectionHeader}>
          <span className={styles.subTitle}>Распределение поколений популяции</span>
          <span className={styles.hint}>Глубина эволюционных цепочек мутаций</span>
        </div>
        <div className={styles.genChipsList}>
          {Object.entries(stats.generationDistribution || {}).length > 0 ? (
            Object.entries(stats.generationDistribution)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([gen, count]) => {
                const isDom = Number(gen) === stats.dominantGeneration;
                const percent = stats.count ? Math.round((count / stats.count) * 100) : 0;
                return (
                  <div key={gen} className={`${styles.genChip} ${isDom ? styles.genChipDominant : ''}`}>
                    <span className={styles.genChipName}>G{gen}</span>
                    <span className={styles.genChipCount}>{count} экз. ({percent}%)</span>
                  </div>
                );
              })
          ) : (
            <span className={styles.emptyHint}>Нет данных о поколениях</span>
          )}
        </div>
      </div>

      {/* TOP AGENTS GENES TABLE PREVIEW */}
      <div className={styles.tableSection}>
        <div className={styles.tableSectionHeader}>
          <span className={styles.subTitle}>Срез генотипов активных агентов ({sortedAgents.length} из {agents.length})</span>
          <span className={styles.hint}>Сортировка по клику на заголовок колонки</span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.geneTable}>
            <thead>
              <tr>
                <th onClick={() => handleSort('id')}>ID {activeSort === 'id' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('generation')}>Пок. {activeSort === 'generation' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('w_temp')}>w_temp {activeSort === 'w_temp' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('w_swarm')}>w_swarm {activeSort === 'w_swarm' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
                <th>Стратегия</th>
                <th onClick={() => handleSort('hp')}>HP {activeSort === 'hp' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('age')}>Возраст {activeSort === 'age' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
                <th>Зона</th>
              </tr>
            </thead>
            <tbody>
              {sortedAgents.length > 0 ? (
                sortedAgents.map(a => {
                  const wt = a.w_temp ?? a.learning?.w_temp ?? 0;
                  const ws = a.w_swarm ?? a.learning?.w_swarm ?? 0;
                  const hp = a.hp ?? a.energy ?? 0;
                  let stratBadge = 'Термофоб-стайный';
                  let stratColor = '#38bdf8';
                  if (wt < 0 && ws > 0) {
                    stratBadge = 'Термофоб-стайный';
                    stratColor = '#38bdf8';
                  } else if (wt < 0 && ws <= 0) {
                    stratBadge = 'Термофоб-одиночка';
                    stratColor = '#3b82f6';
                  } else if (wt >= 0 && ws > 0) {
                    stratBadge = 'Экстремал-стайный';
                    stratColor = '#f59e0b';
                  } else {
                    stratBadge = 'Экстремал-одиночка';
                    stratColor = '#ef4444';
                  }

                  return (
                    <tr key={a.id}>
                      <td className={styles.monoCell}>{a.id}</td>
                      <td><span className={styles.genBadge}>G{a.generation ?? 0}</span></td>
                      <td className={styles.monoCell} style={{ color: wt < 0 ? '#38bdf8' : '#f59e0b' }}>
                        {wt >= 0 ? `+${wt.toFixed(4)}` : wt.toFixed(4)}
                      </td>
                      <td className={styles.monoCell} style={{ color: ws > 0 ? '#10b981' : '#94a3b8' }}>
                        {ws >= 0 ? `+${ws.toFixed(4)}` : ws.toFixed(4)}
                      </td>
                      <td>
                        <span className={styles.stratPill} style={{ borderColor: stratColor, color: stratColor }}>
                          {stratBadge}
                        </span>
                      </td>
                      <td className={styles.monoCell} style={{ color: hp > 120 ? '#10b981' : hp < 60 ? '#ef4444' : '#f59e0b' }}>
                        {hp.toFixed(1)}
                      </td>
                      <td>{a.age ?? 0} т.</td>
                      <td style={{ textTransform: 'capitalize' }}>{a.zone || '—'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                    Нет данных об агентах
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
