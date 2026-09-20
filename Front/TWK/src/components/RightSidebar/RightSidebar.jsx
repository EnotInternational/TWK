import { useState, useEffect, useMemo } from 'react';
import styles from './RightSidebar.module.css';
import { socket } from '../../api';

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

  // Bi-directional meter calculation (-3 to +3 range -> 0% to 100%)
  const clampRange = (val, min = -3, max = 3) => Math.min(max, Math.max(min, val));
  const tempMeterPercent = ((clampRange(wTemp) + 3) / 6) * 100;
  const swarmMeterPercent = ((clampRange(wSwarm) + 3) / 6) * 100;

  return (
    <>
      <aside
        className={styles.rightSidebar}
        style={{ 
          marginRight: isOpen ? '0' : '-360px',
          opacity: isOpen ? 1 : 0
        }}
      >
        {/* Top Header: Mode Switcher Tabs */}
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

                  {/* Mutation & Adaptation parameters */}
                  <div className={styles.metaRow}>
                    <span>Шаг мутации весов (Gaussian σ):</span>
                    <strong>±0.50</strong>
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
      </aside>

      {/* Floating Toggle Button on the side */}
      <button 
        className={styles.rightToggleBtn} 
        style={{ right: isOpen ? '380px' : '20px' }}
        onClick={onToggle}
        title={isOpen ? "Скрыть панель" : "Развернуть панель"}
      >
        {isOpen ? 'Скрыть' : (activeTab === 'agent' && agent ? `Агент #${agent.id} ◀` : `Агенты (${agentsList.length}) ◀`)}
      </button>
    </>
  );
}