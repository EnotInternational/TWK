import { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './AgentDossierView.module.css';
import { simulationApi } from '../../../api';
import ValidatedInput from '../../../components/ValidatedInput/ValidatedInput';

const CHOICE_META = {
  friend: {
    label: 'Мир / Союз',
    icon: '',
    badgeClass: styles.choiceBadgeFriend,
    cardClass: styles.cardChoiceFriend,
    color: '#00d2d3',
  },
  bribe: {
    label: 'Откуп данью',
    icon: '',
    badgeClass: styles.choiceBadgeBribe,
    cardClass: styles.cardChoiceBribe,
    color: '#e056fd',
  },
  flee: {
    label: 'Побег / Уклонение',
    icon: '',
    badgeClass: styles.choiceBadgeFlee,
    cardClass: styles.cardChoiceFlee,
    color: '#2ed573',
  },
  retaliate: {
    label: 'Дать отпор',
    icon: '️',
    badgeClass: styles.choiceBadgeRetaliate,
    cardClass: styles.cardChoiceRetaliate,
    color: '#ffa502',
  },
  fight: {
    label: 'Схватка / Охота',
    icon: '️',
    badgeClass: styles.choiceBadgeFight,
    cardClass: styles.cardChoiceFight,
    color: '#ff4757',
  },
};

const OUTCOME_META = {
  pact: { title: ' Заключен союз и мирный пакт', type: 'success' },
  paid_bribe: { title: ' Откуп выплачен: хищник удовлетворен', type: 'warning' },
  received_bribe: { title: ' Откуп принят: получена дань от мирного', type: 'success' },
  escaped: { title: ' Успешный маневр: уклонение от атаки', type: 'success' },
  caught: { title: '️ Перехвачен хищником при попытке бегства', type: 'danger' },
  counter_win: { title: '️ Отпор успешен! Хищник обращен в бегство', type: 'success' },
  counter_loss: { title: '️ Отпор сломлен: хищник пробил защиту', type: 'danger' },
  killed_prey: { title: ' Добыча повержена: поглощена биомасса', type: 'success' },
  died_combat: { title: '️ Погиб в яростной схватке', type: 'danger' },
};

const TRAITS_CONFIG = [
  { key: 'ferocity', label: 'Свирепость', icon: '', color: '#ff4757' },
  { key: 'friendliness', label: 'Дружелюбие', icon: '', color: '#00d2d3' },
  { key: 'courage', label: 'Храбрость', icon: '️', color: '#ffa502' },
  { key: 'diplomacy', label: 'Дипломатия', icon: '', color: '#e056fd' },
  { key: 'caution', label: 'Осторожность', icon: '️', color: '#2ed573' },
];

export default function AgentDossierView({
  liveAgents = [],
  selectedAgentId: externalSelectedId = null,
  onSelectAgentId = null,
  currentTick = 0,
}) {
  const [allAgents, setAllAgents] = useState([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'alive' | 'dead'
  const [casteFilter, setCasteFilter] = useState('all'); // 'all' | 'predator' | 'peaceful'
  const [onlyWithChoices, setOnlyWithChoices] = useState(false);

  // Selected agent internal state
  const [selectedId, setSelectedId] = useState(externalSelectedId);
  const [choiceTypeFilter, setChoiceTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (newest first) | 'asc'

  // Update selectedId if external prop changes
  useEffect(() => {
    if (externalSelectedId) {
      setSelectedId(externalSelectedId);
    }
  }, [externalSelectedId]);

  // Fetch all agents (including dead ones) from backend
  const fetchAllAgents = useCallback(async () => {
    setIsLoadingAgents(true);
    try {
      const res = await simulationApi.getAgents(null, false);
      if (res && Array.isArray(res.agents)) {
        setAllAgents(res.agents);
      }
    } catch {
      // Ignore network errors
    } finally {
      setIsLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    fetchAllAgents();
  }, [fetchAllAgents]);

  // Merge liveAgents into allAgents so alive agents have realtime updates
  const mergedAgents = useMemo(() => {
    const map = new Map();
    // 1. Put all historical/dead agents
    for (const a of allAgents) {
      map.set(String(a.id), a);
    }
    // 2. Overlay live agents with latest state
    for (const a of liveAgents) {
      map.set(String(a.id), { ...map.get(String(a.id)), ...a });
    }
    return Array.from(map.values());
  }, [allAgents, liveAgents]);

  // If no agent is selected, pick the first one with choices or first available
  useEffect(() => {
    if (!selectedId && mergedAgents.length > 0) {
      const withChoices = mergedAgents.find(a => (a.choice_chronicle && a.choice_chronicle.length > 0));
      const target = withChoices || mergedAgents[0];
      setSelectedId(String(target.id));
      if (onSelectAgentId) onSelectAgentId(String(target.id));
    }
  }, [mergedAgents, selectedId, onSelectAgentId]);

  const handleSelectAgent = (id) => {
    setSelectedId(String(id));
    if (onSelectAgentId) onSelectAgentId(String(id));
  };

  // Filtered agent list for selector
  const filteredAgents = useMemo(() => {
    return mergedAgents.filter(a => {
      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesId = String(a.id).toLowerCase().includes(term);
        const matchesTitle = (a.character_title || '').toLowerCase().includes(term);
        const matchesCaste = (a.caste || '').toLowerCase().includes(term);
        if (!matchesId && !matchesTitle && !matchesCaste) return false;
      }

      // Status
      if (statusFilter === 'alive' && !a.is_alive) return false;
      if (statusFilter === 'dead' && a.is_alive) return false;

      // Caste
      if (casteFilter !== 'all' && a.caste !== casteFilter) return false;

      // Only with choices
      if (onlyWithChoices) {
        const count = (a.choice_chronicle && a.choice_chronicle.length) || 0;
        if (count === 0) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort agents with choices first, then by age
      const chA = (a.choice_chronicle?.length || 0);
      const chB = (b.choice_chronicle?.length || 0);
      if (chB !== chA) return chB - chA;
      return (b.age || 0) - (a.age || 0);
    });
  }, [mergedAgents, searchTerm, statusFilter, casteFilter, onlyWithChoices]);

  // Selected agent object
  const currentAgent = useMemo(() => {
    if (!selectedId) return null;
    return mergedAgents.find(a => String(a.id) === String(selectedId)) || null;
  }, [mergedAgents, selectedId]);

  // Selected agent's filtered choice chronicle
  const filteredChronicle = useMemo(() => {
    if (!currentAgent || !Array.isArray(currentAgent.choice_chronicle)) return [];
    let list = [...currentAgent.choice_chronicle];

    if (choiceTypeFilter !== 'all') {
      list = list.filter(item => item.choice === choiceTypeFilter);
    }

    if (sortOrder === 'desc') {
      list.sort((a, b) => (b.tick || 0) - (a.tick || 0));
    } else {
      list.sort((a, b) => (a.tick || 0) - (b.tick || 0));
    }

    return list;
  }, [currentAgent, choiceTypeFilter, sortOrder]);

  // Cumulative choices counts
  const choiceCounts = useMemo(() => {
    if (!currentAgent) return { friend: 0, bribe: 0, flee: 0, retaliate: 0, fight: 0, total: 0 };
    const hist = currentAgent.choices || {};
    const chron = currentAgent.choice_chronicle || [];
    
    // Fallback to chronicle count if hist is empty
    const counts = {
      friend: hist.friend ?? chron.filter(c => c.choice === 'friend').length,
      bribe: hist.bribe ?? chron.filter(c => c.choice === 'bribe').length,
      flee: hist.flee ?? chron.filter(c => c.choice === 'flee').length,
      retaliate: hist.retaliate ?? chron.filter(c => c.choice === 'retaliate').length,
      fight: hist.fight ?? chron.filter(c => c.choice === 'fight').length,
    };
    counts.total = counts.friend + counts.bribe + counts.flee + counts.retaliate + counts.fight;
    return counts;
  }, [currentAgent]);

  // Character traits values
  const character = currentAgent?.character || {
    ferocity: currentAgent?.aggression ?? 0.3,
    friendliness: currentAgent?.altruism ?? 0.2,
    courage: currentAgent?.fear !== undefined ? 1.0 - currentAgent.fear : 0.5,
    diplomacy: 0.3,
    caution: currentAgent?.fear ?? 0.5,
  };

  const isPredator = currentAgent?.caste === 'predator';
  const isAlive = currentAgent?.is_alive;

  return (
    <div className={styles.container}>
      {/* ================= LEFT: AGENT SELECTOR PANEL ================= */}
      <aside className={styles.selectorPanel}>
        <div className={styles.selectorHeader}>
          <h3 className={styles.selectorTitle}>
            <span> Реестр особей</span>
            <span className={styles.agentCountBadge}>{filteredAgents.length}</span>
          </h3>
          <button 
            className={styles.chip} 
            onClick={fetchAllAgents} 
            title="Обновить список агентов с сервера"
            style={{ padding: '3px 6px' }}
          >
            {isLoadingAgents ? '⏳' : ''}
          </button>
        </div>

        {/* Search Input */}
        <div className={styles.searchBox}>
          <ValidatedInput
            type="text"
            className={styles.searchInput}
            placeholder="Поиск по ID или титулу..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className={styles.filterChips}>
          {/* Status filters */}
          <button 
            className={`${styles.chip} ${statusFilter === 'all' ? styles.active : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Все
          </button>
          <button 
            className={`${styles.chip} ${statusFilter === 'alive' ? styles.active : ''}`}
            onClick={() => setStatusFilter('alive')}
          >
             Живые
          </button>
          <button 
            className={`${styles.chip} ${statusFilter === 'dead' ? styles.active : ''}`}
            onClick={() => setStatusFilter('dead')}
          >
             Погибшие
          </button>

          {/* Caste filters */}
          <button 
            className={`${styles.chip} ${casteFilter === 'predator' ? styles.active : ''}`}
            onClick={() => setCasteFilter(casteFilter === 'predator' ? 'all' : 'predator')}
          >
             Хищники
          </button>
          <button 
            className={`${styles.chip} ${casteFilter === 'peaceful' ? styles.active : ''}`}
            onClick={() => setCasteFilter(casteFilter === 'peaceful' ? 'all' : 'peaceful')}
          >
            ️ Мирные
          </button>

          {/* Having chronicle */}
          <button 
            className={`${styles.chip} ${onlyWithChoices ? styles.active : ''}`}
            onClick={() => setOnlyWithChoices(!onlyWithChoices)}
            title="Показывать только тех, кто делал выбор в столкновениях"
          >
             С выборами
          </button>
        </div>

        {/* Agents List */}
        <div className={styles.agentListScroll}>
          {filteredAgents.length > 0 ? (
            filteredAgents.map(a => {
              const isSelected = String(a.id) === String(selectedId);
              const chronicleCount = (a.choice_chronicle && a.choice_chronicle.length) || 0;
              const aCaste = a.caste || 'peaceful';
              return (
                <div
                  key={a.id}
                  className={`${styles.agentItem} ${isSelected ? styles.selected : ''}`}
                  onClick={() => handleSelectAgent(a.id)}
                >
                  <div className={styles.itemTopRow}>
                    <div className={styles.itemIdArea}>
                      <span className={styles.itemCasteIcon} title={`Каста: ${aCaste === 'predator' ? 'Хищник' : 'Мирный'}`}>
                        {aCaste === 'predator' ? '' : '️'}
                      </span>
                      <span className={styles.itemId}>#{a.id}</span>
                    </div>
                    <span className={`${styles.statusIndicator} ${a.is_alive ? styles.statusAlive : styles.statusDead}`}>
                      {a.is_alive ? 'В строю' : 'Погиб'}
                    </span>
                  </div>

                  <div className={styles.itemTitle}>
                    {a.character_title || (aCaste === 'predator' ? 'Охотник стаи' : 'Мирный житель')}
                  </div>

                  <div className={styles.itemMetaRow}>
                    <span>HP: {typeof a.energy === 'number' ? a.energy.toFixed(1) : a.energy || 0}</span>
                    <span>Возраст: {a.age || 0}т</span>
                    {chronicleCount > 0 ? (
                      <span className={styles.chronicleCountTag} title="Количество выборов в хронике">
                         {chronicleCount}
                      </span>
                    ) : (
                      <span style={{ color: '#475569' }}>0 событий</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.emptyState} style={{ padding: '24px 12px' }}>
              <p>Особей по заданным фильтрам не найдено</p>
            </div>
          )}
        </div>
      </aside>

      {/* ================= RIGHT: AGENT DOSSIER & CHRONICLE ================= */}
      <main className={styles.detailArea}>
        {!currentAgent ? (
          <div className={styles.dossierCard}>
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}></div>
              <h4>Агент не выбран</h4>
              <p>Выберите особь из левого списка для просмотра подробного досье и хронологии принятых решений.</p>
            </div>
          </div>
        ) : (
          <>
            {/* 1. AGENT SUMMARY DOSSIER CARD */}
            <div className={styles.dossierCard}>
              <div className={styles.dossierHeader}>
                <div className={styles.agentIdentity}>
                  <div className={`${styles.agentAvatar} ${isPredator ? styles.avatarPredator : styles.avatarPeaceful}`}>
                    {isPredator ? '' : '️'}
                  </div>
                  <div className={styles.identityText}>
                    <div className={styles.agentMainTitle}>
                      <span>Особь #{currentAgent.id}</span>
                      <span className={`${styles.castePill} ${isPredator ? styles.castePredator : styles.castePeaceful}`}>
                        {isPredator ? 'Хищник' : 'Мирный житель'}
                      </span>
                    </div>
                    <div className={styles.agentSubTitle}>
                      {currentAgent.character_title || 'Адаптивный организм'}
                    </div>
                  </div>
                </div>

                <div className={styles.headerBadges}>
                  <span className={`${styles.statusIndicator} ${isAlive ? styles.statusAlive : styles.statusDead}`} style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
                    {isAlive ? ' В строю' : `️ Погиб на тике ${currentAgent.death_tick ?? currentTick}`}
                  </span>
                  <div className={styles.metaBadge}>
                    Поколение: <strong>G{currentAgent.generation ?? 0}</strong>
                  </div>
                  <div className={styles.metaBadge}>
                    Предок: <strong>{currentAgent.parent_id || 'Первичное (Gen 0)'}</strong>
                  </div>
                </div>
              </div>

              {/* Vitality indicators */}
              <div className={styles.vitalityGrid}>
                <div className={styles.vitalityTile}>
                  <span className={styles.vitalityLabel}>Энергия (HP)</span>
                  <strong className={styles.vitalityValue} style={{ color: (currentAgent.energy || 0) > 120 ? '#10b981' : (currentAgent.energy || 0) < 60 ? '#ef4444' : '#f59e0b' }}>
                    {typeof currentAgent.energy === 'number' ? currentAgent.energy.toFixed(1) : currentAgent.energy || 0} HP
                  </strong>
                </div>

                <div className={styles.vitalityTile}>
                  <span className={styles.vitalityLabel}>Возраст</span>
                  <strong className={styles.vitalityValue} style={{ color: '#f1f5f9' }}>
                    {currentAgent.age || 0} тиков
                  </strong>
                </div>

                <div className={styles.vitalityTile}>
                  <span className={styles.vitalityLabel}>Координаты</span>
                  <strong className={styles.vitalityValue} style={{ color: '#38bdf8' }}>
                    X: {currentAgent.x ?? '—'}, Y: {currentAgent.y ?? '—'}
                  </strong>
                </div>

                <div className={styles.vitalityTile}>
                  <span className={styles.vitalityLabel}>Климатич. зона</span>
                  <strong className={styles.vitalityValue} style={{ textTransform: 'capitalize', color: '#cbd5e1' }}>
                    {currentAgent.zone || 'terminator'}
                  </strong>
                </div>

                <div className={styles.vitalityTile}>
                  <span className={styles.vitalityLabel}>Всего выборов</span>
                  <strong className={styles.vitalityValue} style={{ color: '#e056fd' }}>
                    {choiceCounts.total}
                  </strong>
                </div>
              </div>

              {/* Character Traits Breakdown */}
              <div className={styles.traitsSection}>
                <div className={styles.traitsTitle}>
                   Черты характера, сформированные жизненным опытом:
                </div>
                <div className={styles.traitsGrid}>
                  {TRAITS_CONFIG.map(t => {
                    const val = Number(character[t.key] ?? 0.3);
                    const pct = Math.min(100, Math.max(0, val * 100));
                    return (
                      <div key={t.key} className={styles.traitItem}>
                        <div className={styles.traitHeader}>
                          <span className={styles.traitName}>
                            <span>{t.icon}</span>
                            <span>{t.label}</span>
                          </span>
                          <span className={styles.traitVal} style={{ color: t.color }}>
                            {pct.toFixed(1)}% ({val.toFixed(3)})
                          </span>
                        </div>
                        <div className={styles.traitTrack}>
                          <div
                            className={styles.traitFill}
                            style={{
                              width: `${pct}%`,
                              backgroundColor: t.color,
                              boxShadow: `0 0 6px ${t.color}66`
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cumulative Choice Breakdown Pills */}
              <div className={styles.countersRow}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', alignSelf: 'center', fontWeight: 600 }}>
                  Статистика решений:
                </span>
                <div className={styles.counterPill} title="Сколько раз агент выбирал мирное сосуществование">
                  <span> Дружба:</span>
                  <strong>{choiceCounts.friend}</strong>
                </div>
                <div className={styles.counterPill} title="Сколько раз агент откупался данью или принимал дань">
                  <span> Откуп:</span>
                  <strong>{choiceCounts.bribe}</strong>
                </div>
                <div className={styles.counterPill} title="Сколько раз агент спасался бегством на соседнюю клетку">
                  <span> Побег:</span>
                  <strong>{choiceCounts.flee}</strong>
                </div>
                <div className={styles.counterPill} title="Сколько раз мирный давал смелый отпор хищнику">
                  <span>️ Отпор:</span>
                  <strong>{choiceCounts.retaliate}</strong>
                </div>
                <div className={styles.counterPill} title="Сколько раз хищник выбирал атаку в столкновении">
                  <span>️ Схватка:</span>
                  <strong>{choiceCounts.fight}</strong>
                </div>
              </div>
            </div>

            {/* 2. CHRONICLE TIMELINE FEED */}
            <div className={styles.chronicleSection}>
              <div className={styles.chronicleTopBar}>
                <h3 className={styles.chronicleTitle}>
                  <span> Хроника выборов и последствий</span>
                  <span className={styles.agentCountBadge}>
                    {filteredChronicle.length}
                  </span>
                </h3>

                <div className={styles.chronicleActions}>
                  {/* Filter by Choice Type */}
                  <div className={styles.choiceFilterGroup}>
                    <button
                      className={`${styles.choiceFilterBtn} ${choiceTypeFilter === 'all' ? styles.active : ''}`}
                      onClick={() => setChoiceTypeFilter('all')}
                    >
                      Все
                    </button>
                    <button
                      className={`${styles.choiceFilterBtn} ${choiceTypeFilter === 'friend' ? styles.active : ''}`}
                      onClick={() => setChoiceTypeFilter('friend')}
                      title="Только мирные союзы"
                    >
                       Мир
                    </button>
                    <button
                      className={`${styles.choiceFilterBtn} ${choiceTypeFilter === 'bribe' ? styles.active : ''}`}
                      onClick={() => setChoiceTypeFilter('bribe')}
                      title="Только откупы данью"
                    >
                       Откуп
                    </button>
                    <button
                      className={`${styles.choiceFilterBtn} ${choiceTypeFilter === 'flee' ? styles.active : ''}`}
                      onClick={() => setChoiceTypeFilter('flee')}
                      title="Только бегство"
                    >
                       Побег
                    </button>
                    <button
                      className={`${styles.choiceFilterBtn} ${choiceTypeFilter === 'retaliate' ? styles.active : ''}`}
                      onClick={() => setChoiceTypeFilter('retaliate')}
                      title="Только смелый отпор"
                    >
                      ️ Отпор
                    </button>
                    <button
                      className={`${styles.choiceFilterBtn} ${choiceTypeFilter === 'fight' ? styles.active : ''}`}
                      onClick={() => setChoiceTypeFilter('fight')}
                      title="Только схватки"
                    >
                      ️ Схватка
                    </button>
                  </div>

                  {/* Sort Order Toggle */}
                  <button
                    className={styles.sortOrderBtn}
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    title={sortOrder === 'desc' ? 'Сначала новые события' : 'Сначала старые события'}
                  >
                    {sortOrder === 'desc' ? 'Сначала новые ↓' : 'Сначала ранние ↑'}
                  </button>
                </div>
              </div>

              {/* Feed Items */}
              <div className={styles.timelineFeed}>
                {filteredChronicle.length > 0 ? (
                  filteredChronicle.map((item, idx) => {
                    const choiceInfo = CHOICE_META[item.choice] || {
                      label: item.choice,
                      icon: '',
                      badgeClass: '',
                      cardClass: '',
                      color: '#38bdf8'
                    };
                    const outcomeInfo = OUTCOME_META[item.outcome] || {
                      title: item.outcome,
                      type: 'neutral'
                    };

                    const outcomeClass = outcomeInfo.type === 'success'
                      ? styles.outcomeSuccess
                      : outcomeInfo.type === 'danger'
                      ? styles.outcomeDanger
                      : outcomeInfo.type === 'warning'
                      ? styles.outcomeWarning
                      : styles.outcomeNeutral;

                    const energyDelta = item.energy_delta ?? 0;
                    const energyClass = energyDelta > 0
                      ? styles.energyPositive
                      : energyDelta < 0
                      ? styles.energyNegative
                      : styles.energyNeutral;

                    const traitDeltas = item.trait_deltas || {};
                    const hasTraitDeltas = Object.keys(traitDeltas).length > 0;

                    return (
                      <div
                        key={`${item.tick}_${item.opponent_id}_${idx}`}
                        className={`${styles.timelineCard} ${choiceInfo.cardClass}`}
                      >
                        {/* Header: Tick, Choice, Opponent */}
                        <div className={styles.cardHeader}>
                          <div className={styles.cardHeaderLeft}>
                            <span className={styles.tickBadge}>Тик #{item.tick}</span>
                            <span className={`${styles.choiceBadge} ${choiceInfo.badgeClass}`}>
                              <span>{choiceInfo.icon}</span>
                              <span>ВЫБОР: {choiceInfo.label}</span>
                            </span>
                          </div>

                          <div className={styles.opponentBadge}>
                            <span>Оппонент:</span>
                            <strong style={{ color: '#f1f5f9' }}>
                              #{item.opponent_id}
                            </strong>
                            <span style={{ color: '#64748b' }}>
                              ({item.opponent_title || (item.opponent_caste === 'predator' ? 'Хищник' : 'Мирный')})
                            </span>
                            <button
                              className={styles.opponentLinkBtn}
                              onClick={() => handleSelectAgent(item.opponent_id)}
                              title={`Перейти к досье оппонента #${item.opponent_id}`}
                            >
                               Досье
                            </button>
                          </div>
                        </div>

                        {/* Outcome banner */}
                        <div className={`${styles.outcomeBanner} ${outcomeClass}`}>
                          <span>{outcomeInfo.title}</span>
                        </div>

                        {/* Details Narrative */}
                        {item.details && (
                          <div className={styles.cardDetails}>
                            {item.details}
                          </div>
                        )}

                        {/* Impact Grid: HP Delta, Trait Shifts, Resulting Title */}
                        <div className={styles.impactGrid}>
                          {/* Energy Delta */}
                          <div className={styles.energyDeltaArea}>
                            <span className={`${styles.energyDeltaTag} ${energyClass}`}>
                              {energyDelta > 0 ? `+${energyDelta.toFixed(1)} HP` : energyDelta < 0 ? `${energyDelta.toFixed(1)} HP` : '0 HP'}
                            </span>
                            <span className={styles.resultingHpText}>
                              Итого: {item.resulting_energy !== undefined ? `${item.resulting_energy.toFixed(1)} HP` : '—'}
                            </span>
                          </div>

                          {/* Trait Shifts */}
                          <div className={styles.traitDeltasArea}>
                            {hasTraitDeltas ? (
                              Object.entries(traitDeltas).map(([tName, deltaStr]) => {
                                const trConfig = TRAITS_CONFIG.find(c => c.key === tName);
                                return (
                                  <span key={tName} className={styles.traitDeltaPill} title={`Изменение черты ${trConfig?.label || tName}`}>
                                    {trConfig?.icon || '•'} {trConfig?.label || tName} {deltaStr}
                                  </span>
                                );
                              })
                            ) : (
                              <span style={{ fontSize: '0.68rem', color: '#475569' }}>
                                Черты не изменились
                              </span>
                            )}
                          </div>

                          {/* Resulting Title */}
                          {item.resulting_title && (
                            <div className={styles.resultingTitleArea}>
                              Итог характера: <strong>«{item.resulting_title}»</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>️</div>
                    <h4>История столкновений пуста</h4>
                    <p>
                      {choiceTypeFilter !== 'all'
                        ? `У данной особи нет выборов категории «${CHOICE_META[choiceTypeFilter]?.label || choiceTypeFilter}».`
                        : 'Эта особь еще не вступала в непосредственные столкновения с другими агентами на поле. При сближении с хищником или мирным сородичем здесь появится хроника ее решений и их последствий.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
