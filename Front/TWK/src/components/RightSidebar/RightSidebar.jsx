import { useState, useEffect, useMemo } from 'react';
import styles from './RightSidebar.module.css';
import { socket } from '../../api';
import BottomPanel from '../BottomPanel/BottomPanel';

export default function RightSidebar({ 
  isOpen, 
  agent, 
  onSelectAgent,
  onToggle, 
  onClose,
  activeTab: controlledTab, 
  setActiveTab: setControlledTab, 
  metrics 
}) {
  // Support controlled or internal tab state
  const [internalTab, setInternalTab] = useState('all');
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setActiveTab = setControlledTab || setInternalTab;

  const [agentsList, setAgentsList] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [searchQuery, setSearchQuery] = useState('');

  // Keep agent list updated when simulation ticks
  useEffect(() => {
    let lastUpdate = 0;
    const handleTick = (data) => {
      const now = Date.now();
      if (now - lastUpdate > 800) { // Throttle updates
        setAgentsList(data.agents || []);
        lastUpdate = now;
      }
    };
    
    socket.on('simulation:tick', handleTick);
    socket.emit('request_field'); // Initial fetch
    
    return () => socket.off('simulation:tick', handleTick);
  }, []);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedAgents = useMemo(() => {
    let items = [...agentsList];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(a => 
        (a.id && String(a.id).toLowerCase().includes(q)) || 
        (a.zone && String(a.zone).toLowerCase().includes(q))
      );
    }
    if (sortConfig !== null) {
      items.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (sortConfig.key === 'hp' || sortConfig.key === 'energy') {
          valA = a.hp ?? a.energy ?? 0;
          valB = b.hp ?? b.energy ?? 0;
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [agentsList, sortConfig, searchQuery]);

  const handleRowClick = (clickedAgent) => {
    if (onSelectAgent) {
      onSelectAgent(clickedAgent);
    }
    setActiveTab('agent');
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (onToggle) {
      onToggle();
    }
  };

  const handleDeselect = () => {
    if (onSelectAgent) {
      onSelectAgent(null);
    }
    setActiveTab('all');
  };

  // HP and vitality metrics
  const currentHp = agent ? (agent.hp ?? agent.energy ?? 0) : 0;
  const isAlive = agent ? (agent.is_alive !== false && currentHp > 0) : false;
  const maxHpRef = 140; // Reference maximum for health progress display
  const hpPercent = Math.min(100, Math.max(0, (currentHp / maxHpRef) * 100));

  let hpStatusText = 'Нормальное';
  let hpThemeColor = '#ffd000';
  if (!isAlive) {
    hpStatusText = 'Погиб';
    hpThemeColor = '#ff3344';
  } else if (currentHp > 120) {
    hpStatusText = 'Готов к размножению';
    hpThemeColor = '#00ff88';
  } else if (currentHp < 60) {
    hpStatusText = 'Истощение (Критич.)';
    hpThemeColor = '#ff3344';
  }

  // Training / behavioral weights
  const wTemp = agent?.w_temp ?? agent?.learning?.w_temp ?? 0;
  const wSwarm = agent?.w_swarm ?? agent?.learning?.w_swarm ?? 0;
  const generation = agent?.generation ?? 0;
  const parentId = agent?.parent_id;

  // New behavioral genes, Trophic niche, Sociality, Archetypes and Stats
  const aggression = agent?.aggression ?? agent?.learning?.aggression ?? 0.3;
  const fear = agent?.fear ?? agent?.learning?.fear ?? 0.5;
  const carnivore = agent?.carnivore ?? agent?.learning?.carnivore ?? 0.0;
  const altruism = agent?.altruism ?? agent?.learning?.altruism ?? 0.1;
  const territorial = agent?.territorial ?? agent?.learning?.territorial ?? 0.0;
  const archetype = agent?.archetype ?? agent?.learning?.archetype ?? 'opportunist';

  const fightsWon = agent?.fights_won ?? 0;
  const fightsLost = agent?.fights_lost ?? 0;
  const kills = agent?.kills ?? 0;
  const energyShared = agent?.energy_shared ?? 0.0;
  const energyReceived = agent?.energy_received ?? 0.0;
  const predationEnergy = agent?.predation_energy ?? 0.0;

  const totalFights = fightsWon + fightsLost;
  const winRate = totalFights > 0 ? `${((fightsWon / totalFights) * 100).toFixed(0)}%` : '0 боев';

  // Behavior Strategy
  let strategyTitle = 'Кооперация (термофоб)';
  let strategyDesc = 'Избегает опасных зон температуры (Hot/Cold) и стремится к стае сородичей';
  if (wTemp < 0 && wSwarm > 0) {
    strategyTitle = '🧬 Термофоб-кооператор';
    strategyDesc = 'Эффективно избегает экстремальных зон и активно ищет группу для размножения';
  } else if (wTemp < 0 && wSwarm <= 0) {
    strategyTitle = '🎯 Термофоб-одиночка';
    strategyDesc = 'Избегает температурных штрафов, но держится на безопасной дистанции от сородичей';
  } else if (wTemp >= 0 && wSwarm > 0) {
    strategyTitle = '🔥 Экстремал-стайный';
    strategyDesc = 'Толерантен к температурному стрессу, держится вместе со стаей';
  } else {
    strategyTitle = '⚡ Экстремал-одиночка';
    strategyDesc = 'Автономно исследует экстремальные температурные регионы';
  }

  // Archetype Data Banner (6 emerging evolutionary archetypes)
  let archetypeData = {
    key: 'opportunist',
    label: '⚖️ Оппортунист',
    tag: 'Сбалансированный',
    color: '#ffa502',
    bg: 'rgba(255, 165, 2, 0.12)',
    border: 'rgba(255, 165, 2, 0.35)',
    desc: 'Гибкая стратегия: балансирует между осторожностью, сбором солнечной энергии и умеренной защитой.',
  };

  if (archetype === 'oasis_guardian' || (territorial >= 0.35 && aggression >= 0.35 && carnivore < 0.6)) {
    archetypeData = {
      key: 'oasis_guardian',
      label: '🛡️ Страж оазиса',
      tag: 'Территориальный',
      color: '#e056fd',
      bg: 'rgba(224, 86, 253, 0.14)',
      border: 'rgba(224, 86, 253, 0.4)',
      desc: 'Оседает в метеоритных кратерах и оазисах. Получает до +60% к защите при обороне кратера.',
    };
  } else if (archetype === 'predator' || (carnivore >= 0.45 && aggression >= 0.4) || (aggression >= 0.75 && aggression > fear)) {
    archetypeData = {
      key: 'predator',
      label: '🥩 Хищник-мясоед',
      tag: 'Трофический хищник',
      color: '#ff4757',
      bg: 'rgba(255, 71, 87, 0.16)',
      border: 'rgba(255, 71, 87, 0.45)',
      desc: 'Почти не усваивает фотосинтез. Выживает охотой, поглощая до 90% биомассы атакованных жертв.',
    };
  } else if (archetype === 'altruist_swarm' || (altruism >= 0.45 && wSwarm > 0)) {
    archetypeData = {
      key: 'altruist_swarm',
      label: '🤝 Альтруист-роевик',
      tag: 'Социальная помощь',
      color: '#00d2d3',
      bg: 'rgba(0, 210, 211, 0.14)',
      border: 'rgba(0, 210, 211, 0.4)',
      desc: 'Держится в стае и спасает истощенных сородичей, безвозмездно передавая им избыток энергии.',
    };
  } else if (archetype === 'fleeing_prey' || archetype === 'passive' || (fear >= 0.55 && fear > aggression)) {
    archetypeData = {
      key: 'fleeing_prey',
      label: '🕊️ Беглец-пацифист',
      tag: 'Защитное бегство',
      color: '#2ed573',
      bg: 'rgba(46, 213, 115, 0.14)',
      border: 'rgba(46, 213, 115, 0.35)',
      desc: 'Чрезвычайно чуток к хищникам. При малейшей угрозе уступает ресурсы и спасается бегством.',
    };
  } else if (archetype === 'grazer' || (carnivore <= 0.2 && aggression <= 0.25 && territorial <= 0.2)) {
    archetypeData = {
      key: 'grazer',
      label: '🌱 Солнцеед-пастбищник',
      tag: 'Чистый фотосинтез',
      color: '#7bed9f',
      bg: 'rgba(123, 237, 159, 0.14)',
      border: 'rgba(123, 237, 159, 0.35)',
      desc: '100% эффективности усвоения солнечных лучей в Терминаторе. Не нападает и мирно мигрирует за светом.',
    };
  }

  // Icon helper for table and badges
  const getArchetypeIcon = (a) => {
    const arc = a?.archetype;
    const aggr = a?.aggression ?? 0.3;
    const f = a?.fear ?? 0.5;
    const carn = a?.carnivore ?? 0.0;
    const altr = a?.altruism ?? 0.1;
    const terr = a?.territorial ?? 0.0;
    if (arc === 'oasis_guardian' || (terr >= 0.35 && aggr >= 0.35 && carn < 0.6)) return '🛡️';
    if (arc === 'predator' || (carn >= 0.45 && aggr >= 0.4) || aggr >= 0.75) return '🥩';
    if (arc === 'altruist_swarm' || altr >= 0.45) return '🤝';
    if (arc === 'fleeing_prey' || arc === 'passive' || (f >= 0.55 && f > aggr)) return '🕊️';
    if (arc === 'grazer' || (carn <= 0.2 && aggr <= 0.25 && terr <= 0.2)) return '🌱';
    return '⚖️';
  };

  // Bi-directional and uni-directional meter calculations
  const clampRange = (val, min = -3, max = 3) => Math.min(max, Math.max(min, val));
  const tempMeterPercent = ((clampRange(wTemp) + 3) / 6) * 100;
  const swarmMeterPercent = ((clampRange(wSwarm) + 3) / 6) * 100;
  const aggressionPercent = Math.min(100, Math.max(0, aggression * 100));
  const fearPercent = Math.min(100, Math.max(0, fear * 100));
  const carnivorePercent = Math.min(100, Math.max(0, carnivore * 100));
  const altruismPercent = Math.min(100, Math.max(0, altruism * 100));
  const territorialMeterPercent = ((Math.min(1.0, Math.max(-1.0, territorial)) + 1.0) / 2.0) * 100;

  return (
    <>
      <aside 
        className={styles.rightSidebar}
        style={{ 
          marginRight: isOpen ? '0' : '-360px',
          opacity: isOpen ? 1 : 0
        }}
      >
        {/* Top Header: Mode Switcher Tabs + Close Button */}
        <div className={styles.sidebarHeader}>
          <div className={styles.tabsContainer}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('all')}
              title="Режим: список всех агентов"
            >
              👥 Все ({agentsList.length})
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'agent' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('agent')}
              title="Режим: данные выбранного агента"
            >
              🧬 {agent ? `Агент #${agent.id}` : 'Данные агента'}
            </button>
          </div>

          <button 
            className={styles.closeBtn} 
            onClick={handleClose} 
            title="Закрыть сайдбар"
          >
            ✕
          </button>
        </div>

        {/* MODE: ALL AGENTS */}
        {activeTab === 'all' && (
          <div className={styles.tabContent}>
            <div className={styles.tableContainer}>
              <div className={styles.tableTopRow}>
                <h3>Все агенты ({filteredAndSortedAgents.length})</h3>
                <span className={styles.hintText}>Кликните по строке для выбора</span>
              </div>

              <div className={styles.searchRow}>
                <input 
                  type="text" 
                  className={styles.searchInput}
                  placeholder="Поиск по ID или зоне..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className={styles.clearSearchBtn} onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>

              <div className={styles.tableScroll}>
                <table className={styles.agentsTable}>
                  <thead>
                    <tr>
                      <th onClick={() => requestSort('id')}>
                        ID {sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th onClick={() => requestSort('age')}>
                        Возр. {sortConfig.key === 'age' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th onClick={() => requestSort('energy')}>
                        HP {sortConfig.key === 'energy' || sortConfig.key === 'hp' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th onClick={() => requestSort('generation')}>
                        Пок. {sortConfig.key === 'generation' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedAgents.length > 0 ? filteredAndSortedAgents.map(a => {
                      const agentHp = a.hp ?? a.energy ?? 0;
                      const isSelected = agent && agent.id === a.id;
                      const hpCol = agentHp > 120 ? '#00ff88' : agentHp < 60 ? '#ff3344' : '#ffd000';
                      return (
                        <tr 
                          key={a.id} 
                          onClick={() => handleRowClick(a)}
                          className={`${styles.agentRow} ${isSelected ? styles.selectedRow : ''}`}
                          title={`Выбрать агента ${a.id}`}
                        >
                          <td className={styles.idCell}>
                            {isSelected && <span className={styles.selectedMarker}>▶ </span>}
                            <span 
                              className={styles.tableArchetypeIcon} 
                              title={`Архетип: ${a.archetype || 'opportunist'} (Агрессия: ${a.aggression ?? 0.3}, Страх: ${a.fear ?? 0.5}, Хищник: ${a.carnivore ?? 0.0}, Альтруизм: ${a.altruism ?? 0.1}, Кратер: ${a.territorial ?? 0.0})`}
                            >
                              {getArchetypeIcon(a)}
                            </span>
                            {a.id}
                          </td>
                          <td>{a.age}</td>
                          <td>
                            <div className={styles.tableHpCell}>
                              <span style={{ color: hpCol, fontWeight: 'bold' }}>
                                {agentHp ? agentHp.toFixed(1) : '0'}
                              </span>
                              <div className={styles.miniHpTrack}>
                                <div 
                                  className={styles.miniHpFill} 
                                  style={{ 
                                    width: `${Math.min(100, Math.max(5, (agentHp / 140) * 100))}%`,
                                    backgroundColor: hpCol
                                  }} 
                                />
                              </div>
                            </div>
                          </td>
                          <td><span className={styles.genBadge}>G{a.generation}</span></td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#718096' }}>
                          {searchQuery ? 'Агенты не найдены' : 'Нет активных агентов'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODE: AGENT DATA */}
        {activeTab === 'agent' && (
          <div className={styles.tabContent}>
            {agent && (
              <div className={styles.subHeader}>
                <span className={styles.hintText}>Инспекция агента #{agent.id}</span>
                <button 
                  className={styles.deselectBtn}
                  onClick={handleDeselect}
                  title="Снять выбор агента"
                >
                  ✕ Снять выбор
                </button>
              </div>
            )}

            {!agent ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🧬</div>
                <h4>Агент не выбран</h4>
                <p>Выберите нужного агента в списке «Все агенты» или кликните по объекту на карте планеты.</p>
                <button 
                  className={styles.actionBtn}
                  onClick={() => setActiveTab('all')}
                >
                  Открыть список агентов
                </button>
              </div>
            ) : (
              <div className={styles.agentCard}>
                {/* Agent Header Identity */}
                <div className={styles.agentCardHeader}>
                  <div className={styles.agentIdBadge}>
                    <span className={styles.idLabel}>ID</span>
                    <strong className={styles.idValue}>{agent.id}</strong>
                  </div>
                  <div className={`${styles.statusPill} ${isAlive ? styles.statusAlive : styles.statusDead}`}>
                    {isAlive ? '🟢 В строю' : '🔴 Погиб'}
                  </div>
                </div>

                {/* Archetype Banner */}
                <div 
                  className={styles.archetypeCard}
                  style={{
                    color: archetypeData.color,
                    background: archetypeData.bg,
                    borderColor: archetypeData.border,
                  }}
                  title={archetypeData.desc}
                >
                  <div className={styles.archetypeHeader}>
                    <span className={styles.archetypeTitle}>{archetypeData.label}</span>
                    <span className={styles.archetypeTag} style={{ borderColor: archetypeData.border }}>
                      {archetypeData.tag}
                    </span>
                  </div>
                  <div className={styles.archetypeDesc}>{archetypeData.desc}</div>
                </div>

                {/* HP & VITALITY SECTION */}
                <div className={styles.sectionBox}>
                  <div className={styles.sectionTitle}>
                    <span>❤️ Здоровье и Жизненные показатели (HP)</span>
                  </div>

                  <div className={styles.hpMainRow}>
                    <div className={styles.hpDisplay}>
                      <span className={styles.hpNumber} style={{ color: hpThemeColor }}>
                        {currentHp ? currentHp.toFixed(1) : '0.0'}
                      </span>
                      <span className={styles.hpUnit}>/ 140 HP</span>
                    </div>
                    <span className={styles.hpStatusBadge} style={{ borderColor: hpThemeColor, color: hpThemeColor }}>
                      {hpStatusText}
                    </span>
                  </div>

                  {/* HP Progress Bar */}
                  <div className={styles.hpProgressBarTrack}>
                    <div 
                      className={styles.hpProgressBarFill}
                      style={{ 
                        width: `${hpPercent}%`,
                        background: isAlive 
                          ? `linear-gradient(90deg, ${hpThemeColor}88, ${hpThemeColor})`
                          : '#4a5568'
                      }}
                    />
                  </div>

                  {/* Quick Vitality Stats */}
                  <div className={styles.statsGrid}>
                    <div className={styles.statTile}>
                      <span className={styles.statLabel}>Возраст</span>
                      <strong className={styles.statValue}>{agent.age || 0} тиков</strong>
                    </div>
                    <div className={styles.statTile}>
                      <span className={styles.statLabel}>Позиция</span>
                      <strong className={styles.statValue}>X: {agent.x}, Y: {agent.y}</strong>
                    </div>
                    <div className={styles.statTile}>
                      <span className={styles.statLabel}>Темп. зона</span>
                      <strong className={styles.statValue} style={{ textTransform: 'capitalize' }}>
                        {agent.zone || 'unknown'}
                      </strong>
                    </div>
                    <div className={styles.statTile}>
                      <span className={styles.statLabel}>Порог размнож.</span>
                      <strong className={styles.statValue}>140 HP</strong>
                    </div>
                  </div>
                </div>

                {/* TRAINING & EVOLUTIONARY DATA SECTION */}
                <div className={styles.sectionBox}>
                  <div className={styles.sectionTitle}>
                    <span>🧠 Данные обучения и Эволюции</span>
                  </div>

                  {/* Lineage */}
                  <div className={styles.lineageRow}>
                    <div className={styles.lineageItem}>
                      <span className={styles.statLabel}>Поколение:</span>
                      <span className={styles.genHighlight}>G{generation}</span>
                    </div>
                    <div className={styles.lineageItem}>
                      <span className={styles.statLabel}>Предок:</span>
                      <strong className={styles.parentHighlight}>{parentId || 'Первичное (Gen 0)'}</strong>
                    </div>
                  </div>

                  {/* Learned Strategy Card */}
                  <div className={styles.strategyCard}>
                    <div className={styles.strategyTitle}>{strategyTitle}</div>
                    <div className={styles.strategyDesc}>{strategyDesc}</div>
                  </div>

                  {/* Weight 1: Temperature Adaptation */}
                  <div className={styles.weightCard}>
                    <div className={styles.weightHeader}>
                      <span className={styles.weightLabel}>Термоадаптация (w_temp):</span>
                      <strong className={styles.weightValue} style={{ color: wTemp < 0 ? '#00e5ff' : '#ff9900' }}>
                        {wTemp >= 0 ? `+${wTemp.toFixed(4)}` : wTemp.toFixed(4)}
                      </strong>
                    </div>
                    <div className={styles.bipolarTrack}>
                      <div className={styles.bipolarCenterMark} />
                      <div 
                        className={styles.bipolarFill}
                        style={{
                          left: wTemp < 0 ? `${tempMeterPercent}%` : '50%',
                          width: `${Math.abs(tempMeterPercent - 50)}%`,
                          background: wTemp < 0 ? '#00e5ff' : '#ff9900'
                        }}
                      />
                      <div 
                        className={styles.bipolarPointer} 
                        style={{ left: `${tempMeterPercent}%` }}
                      />
                    </div>
                    <div className={styles.meterLabels}>
                      <span>-3.0 (Избегание штрафов)</span>
                      <span>0</span>
                      <span>+3.0 (Толерантность)</span>
                    </div>
                    <div className={styles.weightExplanation}>
                      {wTemp < 0 
                        ? '✓ Выучено поведение: избегать перегрева/холода и стремиться в Терминатор' 
                        : '⚠ Выучено поведение: безразличие к тепловым штрафам'}
                    </div>
                  </div>

                  {/* Weight 2: Swarm Behavior */}
                  <div className={styles.weightCard}>
                    <div className={styles.weightHeader}>
                      <span className={styles.weightLabel}>Стайный инстинкт (w_swarm):</span>
                      <strong className={styles.weightValue} style={{ color: wSwarm > 0 ? '#00ff88' : '#cbd5e0' }}>
                        {wSwarm >= 0 ? `+${wSwarm.toFixed(4)}` : wSwarm.toFixed(4)}
                      </strong>
                    </div>
                    <div className={styles.bipolarTrack}>
                      <div className={styles.bipolarCenterMark} />
                      <div 
                        className={styles.bipolarFill}
                        style={{
                          left: wSwarm < 0 ? `${swarmMeterPercent}%` : '50%',
                          width: `${Math.abs(swarmMeterPercent - 50)}%`,
                          background: wSwarm > 0 ? '#00ff88' : '#718096'
                        }}
                      />
                      <div 
                        className={styles.bipolarPointer} 
                        style={{ left: `${swarmMeterPercent}%` }}
                      />
                    </div>
                    <div className={styles.meterLabels}>
                      <span>-3.0 (Одиночка)</span>
                      <span>0</span>
                      <span>+3.0 (Стайность)</span>
                    </div>
                    <div className={styles.weightExplanation}>
                      {wSwarm > 0 
                        ? '✓ Выучено поведение: группировка и совместный поиск партнеров' 
                        : '• Выучено поведение: обособленное выживание без скоплений'}
                    </div>
                  </div>

                  {/* Weight 3: Aggression Gene */}
                  <div className={styles.weightCard}>
                    <div className={styles.weightHeader}>
                      <span className={styles.weightLabel}>⚔️ Агрессия (aggression):</span>
                      <strong className={styles.weightValue} style={{ color: aggression >= 0.55 ? '#ff4757' : '#ffa502' }}>
                        {(aggression * 100).toFixed(1)}% ({aggression.toFixed(3)})
                      </strong>
                    </div>
                    <div className={styles.geneTrack}>
                      <div 
                        className={styles.geneFill} 
                        style={{ 
                          width: `${aggressionPercent}%`,
                          background: 'linear-gradient(90deg, #ffa502, #ff4757)'
                        }} 
                      />
                    </div>
                    <div className={styles.meterLabels}>
                      <span>0.0 (Миролюбивый)</span>
                      <span>0.5</span>
                      <span>1.0 (Бескомпромиссный)</span>
                    </div>
                    <div className={styles.weightExplanation}>
                      {aggression >= 0.55 
                        ? '✓ Высокая боевитость: нападает на занятые клетки и отбирает энергию'
                        : aggression <= 0.3 
                        ? '• Миролюбивый: избегает стычек и уступает клетки'
                        : '• Умеренная: нападает только при значительном перевесе'}
                    </div>
                  </div>

                  {/* Weight 4: Fear Gene */}
                  <div className={styles.weightCard}>
                    <div className={styles.weightHeader}>
                      <span className={styles.weightLabel}>🏃 Чувствительность к угрозе (fear):</span>
                      <strong className={styles.weightValue} style={{ color: fear >= 0.55 ? '#2ed573' : '#70a1ff' }}>
                        {(fear * 100).toFixed(1)}% ({fear.toFixed(3)})
                      </strong>
                    </div>
                    <div className={styles.geneTrack}>
                      <div 
                        className={styles.geneFill} 
                        style={{ 
                          width: `${fearPercent}%`,
                          background: 'linear-gradient(90deg, #70a1ff, #2ed573)'
                        }} 
                      />
                    </div>
                    <div className={styles.meterLabels}>
                      <span>0.0 (Хладнокровный)</span>
                      <span>0.5</span>
                      <span>1.0 (Панический беглец)</span>
                    </div>
                    <div className={styles.weightExplanation}>
                      {fear >= 0.55 
                        ? '✓ Высокая тревожность: избегает агрессоров и спасается бегством'
                        : fear <= 0.3 
                        ? '• Хладнокровный: не боится скоплений опасных соседей'
                        : '• Осторожный: держится на безопасной дистанции'}
                    </div>
                  </div>

                  {/* Weight 5: Carnivore Gene (Trophic Niche) */}
                  <div className={styles.weightCard}>
                    <div className={styles.weightHeader}>
                      <span className={styles.weightLabel}>🥩 Плотоядность vs Фотосинтез (carnivore):</span>
                      <strong className={styles.weightValue} style={{ color: carnivore >= 0.45 ? '#ff4757' : '#7bed9f' }}>
                        {(carnivore * 100).toFixed(1)}% ({carnivore.toFixed(3)})
                      </strong>
                    </div>
                    <div className={styles.geneTrack}>
                      <div 
                        className={styles.geneFill} 
                        style={{ 
                          width: `${carnivorePercent}%`,
                          background: 'linear-gradient(90deg, #7bed9f, #ffa502, #ff4757)'
                        }} 
                      />
                    </div>
                    <div className={styles.meterLabels}>
                      <span>0.0 (🌱 Солнцеед)</span>
                      <span>0.5</span>
                      <span>1.0 (🥩 Хищник)</span>
                    </div>
                    <div className={styles.weightExplanation}>
                      {carnivore >= 0.5 
                        ? '✓ Облигатный хищник: не получает солнечную энергию, питается только охотой (усвоение до 90%)'
                        : carnivore <= 0.2 
                        ? '🌱 Солнцеед: 100% эффективность фотосинтеза в зоне Терминатора'
                        : '• Факультативный: совмещает фотосинтез и эпизодические атаки'}
                    </div>
                  </div>

                  {/* Weight 6: Altruism Gene (Sociality) */}
                  <div className={styles.weightCard}>
                    <div className={styles.weightHeader}>
                      <span className={styles.weightLabel}>🤝 Альтруизм и взаимопомощь (altruism):</span>
                      <strong className={styles.weightValue} style={{ color: altruism >= 0.4 ? '#00d2d3' : '#a0aec0' }}>
                        {(altruism * 100).toFixed(1)}% ({altruism.toFixed(3)})
                      </strong>
                    </div>
                    <div className={styles.geneTrack}>
                      <div 
                        className={styles.geneFill} 
                        style={{ 
                          width: `${altruismPercent}%`,
                          background: 'linear-gradient(90deg, #718096, #70a1ff, #00d2d3)'
                        }} 
                      />
                    </div>
                    <div className={styles.meterLabels}>
                      <span>0.0 (Эгоизм)</span>
                      <span>0.5</span>
                      <span>1.0 (Взаимопомощь)</span>
                    </div>
                    <div className={styles.weightExplanation}>
                      {altruism >= 0.35 
                        ? '✓ Социальный спасатель: делится избытком энергии с умирающими соседями (<25 HP)'
                        : '• Эгоцентричный: бережет накопленные запасы энергии исключительно для себя'}
                    </div>
                  </div>

                  {/* Weight 7: Territorial Gene (Crater / Oasis Defense) */}
                  <div className={styles.weightCard}>
                    <div className={styles.weightHeader}>
                      <span className={styles.weightLabel}>🛡️ Территориальность / Оазисы (territorial):</span>
                      <strong className={styles.weightValue} style={{ color: territorial >= 0.35 ? '#e056fd' : territorial <= -0.3 ? '#ffa502' : '#cbd5e0' }}>
                        {territorial >= 0 ? `+${territorial.toFixed(3)}` : territorial.toFixed(3)}
                      </strong>
                    </div>
                    <div className={styles.bipolarTrack}>
                      <div className={styles.bipolarCenterMark} />
                      <div 
                        className={styles.bipolarFill}
                        style={{
                          left: territorial < 0 ? `${territorialMeterPercent}%` : '50%',
                          width: `${Math.abs(territorialMeterPercent - 50)}%`,
                          background: territorial >= 0 ? '#e056fd' : '#ffa502'
                        }}
                      />
                      <div 
                        className={styles.bipolarPointer} 
                        style={{ left: `${territorialMeterPercent}%` }}
                      />
                    </div>
                    <div className={styles.meterLabels}>
                      <span>-1.0 (Кочевник)</span>
                      <span>0</span>
                      <span>+1.0 (Страж кратера)</span>
                    </div>
                    <div className={styles.weightExplanation}>
                      {territorial >= 0.35 
                        ? '✓ Страж оазиса: защищает кратер (+60% к защите в depression при обороне)'
                        : territorial <= -0.3 
                        ? '• Кочевник: постоянно мигрирует за Терминатором, не удерживая кратеры'
                        : '• Нейтральная привязка к местности'}
                    </div>
                  </div>

                  {/* Combat Track Record */}
                  <div className={styles.combatStatsCard}>
                    <div className={styles.combatTitle}>
                      <span>⚔️ Боевой послужной список</span>
                      <span className={styles.combatWinRate} style={{ color: fightsWon > fightsLost ? '#2ed573' : fightsLost > fightsWon ? '#ff4757' : '#ffa502' }}>
                        Винрейт: {winRate}
                      </span>
                    </div>
                    <div className={styles.combatGrid}>
                      <div className={styles.combatTile}>
                        <span className={styles.combatLabel}>Побед</span>
                        <strong className={styles.combatValue} style={{ color: '#2ed573' }}>{fightsWon}</strong>
                      </div>
                      <div className={styles.combatTile}>
                        <span className={styles.combatLabel}>Поражений</span>
                        <strong className={styles.combatValue} style={{ color: '#ff4757' }}>{fightsLost}</strong>
                      </div>
                      <div className={styles.combatTile}>
                        <span className={styles.combatLabel}>Убито</span>
                        <strong className={styles.combatValue} style={{ color: '#ff6b81' }}>{kills}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Social & Trophic Energy Balance */}
                  <div className={styles.socialStatsCard}>
                    <div className={styles.socialTitle}>
                      <span>🌱 Трофический и Социальный баланс</span>
                      <span style={{ fontSize: '0.72rem', color: '#00d2d3' }}>HP поток</span>
                    </div>
                    <div className={styles.socialGrid}>
                      <div className={styles.socialTile} title="Энергия, переданная умирающим сородичам">
                        <span className={styles.socialLabel}>🤝 Отдано</span>
                        <strong className={styles.socialValue} style={{ color: '#00d2d3' }}>
                          {energyShared ? energyShared.toFixed(1) : '0.0'}
                        </strong>
                      </div>
                      <div className={styles.socialTile} title="Энергия, полученная от альтруистов">
                        <span className={styles.socialLabel}>💚 Получено</span>
                        <strong className={styles.socialValue} style={{ color: '#2ed573' }}>
                          {energyReceived ? energyReceived.toFixed(1) : '0.0'}
                        </strong>
                      </div>
                      <div className={styles.socialTile} title="Энергия, усвоенная при хищничестве в боях">
                        <span className={styles.socialLabel}>🥩 Охота</span>
                        <strong className={styles.socialValue} style={{ color: '#ff4757' }}>
                          {predationEnergy ? predationEnergy.toFixed(1) : '0.0'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Mutation & Adaptation parameters */}
                  <div className={styles.metaRow}>
                    <span>Шаг мутации весов (w_temp, w_swarm):</span>
                    <strong>±0.50</strong>
                  </div>
                  <div className={styles.metaRow}>
                    <span>Шаг мутации генов (aggression, fear, carnivore, altruism, territorial):</span>
                    <strong>±0.10</strong>
                  </div>
                </div>

                {/* DEATH REPORT (IF AGENT DIED) */}
                {agent.death_reason && (
                  <div className={styles.deathReportBox}>
                    <div className={styles.deathHeader}>
                      <span>☠️ Отчет о гибели</span>
                    </div>
                    <div className={styles.dataRow}>
                      <span>Причина:</span>
                      <strong style={{ color: '#ff3344' }}>{agent.death_reason}</strong>
                    </div>
                    {agent.death_tick !== undefined && (
                      <div className={styles.dataRow}>
                        <span>Тик гибели:</span>
                        <strong>{agent.death_tick}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <BottomPanel metrics={metrics} />
      </aside>

      {/* Floating Toggle Button when sidebar is collapsed */}
      {!isOpen && (
        <button 
          className={styles.rightToggleBtn} 
          style={{ right: '20px' }}
          onClick={onToggle}
          title="Развернуть боковую панель"
        >
          {activeTab === 'agent' && agent ? `Агент #${agent.id} ◀` : `Агенты (${agentsList.length}) ◀`}
        </button>
      )}
    </>
  );
}