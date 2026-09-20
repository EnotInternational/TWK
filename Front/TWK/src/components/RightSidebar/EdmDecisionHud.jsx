import { useState, useMemo } from 'react';
import styles from './EdmDecisionHud.module.css';

export const INTENT_CONFIG = {
  MOVE_TO_FOOD: {
    label: 'Движение к свету / пище',
    shortLabel: 'К свету',
    icon: '☀️',
    color: '#ffd000',
    bgColor: 'rgba(255, 208, 0, 0.12)',
    borderColor: 'rgba(255, 208, 0, 0.45)',
    description: 'Стремится в Терминатор к фотосинтезу или к богатым ресурсами оазисам',
  },
  ATTACK: {
    label: 'Охота / Нападение',
    shortLabel: 'Атака',
    icon: '🥩',
    color: '#ff4757',
    bgColor: 'rgba(255, 71, 87, 0.14)',
    borderColor: 'rgba(255, 71, 87, 0.45)',
    description: 'Атакует соседа для поглощения энергии и устранения конкурента',
  },
  FLEE: {
    label: 'Тактическое бегство',
    shortLabel: 'Бегство',
    icon: '🏃',
    color: '#2ed573',
    bgColor: 'rgba(46, 213, 115, 0.12)',
    borderColor: 'rgba(46, 213, 115, 0.4)',
    description: 'Спасается от сильных врагов и отступает на свободную соседнюю клетку',
  },
  EXPLORE: {
    label: 'Разведка территории',
    shortLabel: 'Разведка',
    icon: '🧭',
    color: '#70a1ff',
    bgColor: 'rgba(112, 161, 255, 0.12)',
    borderColor: 'rgba(112, 161, 255, 0.4)',
    description: 'Исследует неизвестные клетки планеты в поисках более выгодных условий',
  },
  REST: {
    label: 'Отдых / Удержание позиции',
    shortLabel: 'Отдых',
    icon: '💤',
    color: '#a4b0be',
    bgColor: 'rgba(164, 176, 190, 0.12)',
    borderColor: 'rgba(164, 176, 190, 0.35)',
    description: 'Экономит силы и удерживает комфортную клетку или кратер',
  },
  SHARE: {
    label: 'Альтруизм / Помощь',
    shortLabel: 'Помощь',
    icon: '🤝',
    color: '#00d2d3',
    bgColor: 'rgba(0, 210, 211, 0.14)',
    borderColor: 'rgba(0, 210, 211, 0.45)',
    description: 'Безвозмездно передает часть энергии истощенному сородичу рядом',
  },
};

const ALL_INTENT_KEYS = ['MOVE_TO_FOOD', 'ATTACK', 'FLEE', 'EXPLORE', 'REST', 'SHARE'];

export function computeFallbackDecision(agent) {
  if (!agent) return null;
  const energy = Number(agent.hp ?? agent.energy ?? 100);
  const caste = agent.caste || (agent.carnivore >= 0.4 ? 'predator' : 'peaceful');
  const carnivore = Number(agent.carnivore ?? agent.learning?.carnivore ?? (caste === 'predator' ? 0.75 : 0.05));
  const aggression = Number(agent.aggression ?? agent.learning?.aggression ?? (caste === 'predator' ? 0.6 : 0.2));
  const fear = Number(agent.fear ?? agent.learning?.fear ?? (caste === 'predator' ? 0.1 : 0.6));
  const social = Number(agent.w_social ?? agent.w_swarm ?? agent.learning?.w_swarm ?? (caste === 'predator' ? -0.2 : 0.4));
  const territorial = Number(agent.territorial ?? agent.learning?.territorial ?? 0.0);
  const wTemp = Number(agent.w_temp ?? agent.learning?.w_temp ?? 0.0);
  const wAggression = Number(agent.genome?.w_aggression ?? (aggression - fear));
  const temperature = Math.max(0.05, Number(agent.genome?.temperature ?? agent.temperature ?? 0.6));

  const isComfort = (agent.zone === 'terminator');
  const hunger = Math.max(0, (100 - energy) / 50.0);
  const photoAffinity = Math.max(0, 1.0 - carnivore);

  const scores = {
    MOVE_TO_FOOD: Number(((isComfort ? 1.5 : 3.2) * photoAffinity + hunger * photoAffinity * 2.5 + (wTemp < 0 ? 1.0 : 0.0)).toFixed(2)),
    ATTACK: Number((wAggression * 2.5 + carnivore * 3.0 + carnivore * hunger * 2.0).toFixed(2)),
    FLEE: Number((Math.max(0, -wAggression) * 2.5 + (energy < 45 ? 1.8 : 0.2) * fear * 2.0).toFixed(2)),
    EXPLORE: Number((0.35 * 2.2 + (!isComfort ? 1.2 : 0.2) - Math.max(0, territorial) * 1.5).toFixed(2)),
    REST: Number(((isComfort ? 2.0 : 0.2) + Math.max(0, territorial) * 1.8).toFixed(2)),
    SHARE: Number((Math.max(0, social) * 3.0 + (energy > 70 ? 1.5 : -2.5)).toFixed(2)),
  };

  const keys = Object.keys(scores);
  const maxS = Math.max(...keys.map(k => scores[k]));
  const exps = keys.map(k => Math.exp((scores[k] - maxS) / temperature));
  const total = exps.reduce((a, b) => a + b, 0) || 1;

  const probs = {};
  keys.forEach((k, idx) => {
    probs[k] = Number((exps[idx] / total).toFixed(4));
  });

  const intent = keys.reduce((best, k) => (probs[k] > (probs[best] ?? -1) ? k : best), keys[0]);

  return { intent, scores, probs, isFallback: true };
}

export default function EdmDecisionHud({ agent, currentTick = null }) {
  const [showGenomeDrivers, setShowGenomeDrivers] = useState(false);

  const decision = (agent?.last_decision && agent.last_decision.intent)
    ? agent.last_decision
    : computeFallbackDecision(agent);

  const genome = agent?.genome || {
    w_aggression: agent?.w_aggression ?? agent?.learning?.aggression ?? 0.0,
    w_carnivore: agent?.w_carnivore ?? agent?.learning?.carnivore ?? 0.0,
    w_social: agent?.w_social ?? agent?.learning?.w_swarm ?? 0.0,
    w_explore: agent?.w_explore ?? 0.35,
    w_territorial: agent?.w_territorial ?? agent?.learning?.territorial ?? 0.0,
    w_temp: agent?.w_temp ?? agent?.learning?.w_temp ?? 0.0,
    temperature: agent?.temperature ?? 0.6,
  };

  const temperature = Number(genome.temperature ?? agent?.temperature ?? 0.6);

  // Temperature interpretation
  const tempMeta = useMemo(() => {
    const t = temperature;
    if (t < 0.25) {
      return {
        label: 'Жадный выбор',
        icon: '🎯',
        color: '#00e5ff',
        desc: 'Строго выбирает действие с максимальным баллом utility (прагматичный детерминизм)',
      };
    } else if (t <= 0.75) {
      return {
        label: 'Адаптивный баланс',
        icon: '⚖️',
        color: '#00ff88',
        desc: 'Сбалансированный выбор: высокий приоритет оптимума с долей стохастического поиска',
      };
    } else {
      return {
        label: 'Поисковый шум',
        icon: '🎲',
        color: '#ffa502',
        desc: 'Высокая стохастичность: намерения выбираются с повышенной случайностью (exploration)',
      };
    }
  }, [temperature]);

  const tempMeterPercent = Math.min(100, Math.max(0, ((temperature - 0.05) / 1.45) * 100));

  // If even agent is missing
  if (!agent || !decision) {
    return null;
  }

  const activeIntentKey = decision.intent;
  const activeCfg = INTENT_CONFIG[activeIntentKey] || {
    label: activeIntentKey,
    shortLabel: activeIntentKey,
    icon: '⚡',
    color: '#00e5ff',
    bgColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.4)',
    description: 'Принято решение через softmax utility scoring',
  };

  const scores = decision.scores || {};
  const probs = decision.probs || {};
  const activeProb = probs[activeIntentKey] !== undefined ? (probs[activeIntentKey] * 100).toFixed(1) : '100.0';
  const activeScore = scores[activeIntentKey] !== undefined ? scores[activeIntentKey] : 0.0;

  return (
    <div className={styles.hudCard} style={{ borderColor: activeCfg.borderColor }}>
      {/* Header */}
      <div className={styles.hudHeader}>
        <div className={styles.hudTitleGroup}>
          <span className={styles.hudTitle}>
            <span>🧠 Мозг EDM: Выбор действия</span>
          </span>
        </div>
        <span className={styles.liveBadge}>
          <span className={styles.pulseDot} />
          <span>LIVE • ТИК #{currentTick ?? agent.age}</span>
        </span>
      </div>

      {/* Hero: Winning Intent */}
      <div
        className={styles.heroBanner}
        style={{
          background: activeCfg.bgColor,
          border: `1px solid ${activeCfg.borderColor}`,
        }}
      >
        <div className={styles.heroTopRow}>
          <span className={styles.heroIntentTag} style={{ color: activeCfg.color }}>
            <span>{activeCfg.icon}</span>
            <span>{activeCfg.label}</span>
          </span>
          <span className={styles.heroProbBadge} style={{ color: activeCfg.color }}>
            <span>{activeProb}%</span>
            <span className={styles.heroProbLabel}>шанс</span>
          </span>
        </div>

        <div className={styles.heroExplain}>
          {activeCfg.description}
        </div>

        <div className={styles.heroScoresRow}>
          <span>Балл полезности (Utility Score):</span>
          <span className={styles.heroScoreValue} style={{ color: activeCfg.color }}>
            {activeScore >= 0 ? `+${activeScore.toFixed(2)}` : activeScore.toFixed(2)} pts
          </span>
        </div>
      </div>

      {/* Softmax Temperature Gauge */}
      <div className={styles.tempBox}>
        <div className={styles.tempTop}>
          <span className={styles.tempLabel}>
            <span>🌡️ Температура Softmax (T):</span>
            <strong style={{ color: '#f1f5f9' }}>{temperature.toFixed(2)}</strong>
          </span>
          <span className={styles.tempBadge} style={{ color: tempMeta.color, borderColor: tempMeta.color }}>
            {tempMeta.icon} {tempMeta.label}
          </span>
        </div>
        <div className={styles.tempTrack}>
          <div className={styles.tempPointer} style={{ left: `${tempMeterPercent}%` }} />
        </div>
        <div className={styles.tempDesc}>
          {tempMeta.desc}
        </div>
      </div>

      {/* Probabilities Breakdown */}
      <div className={styles.distSection}>
        <div className={styles.distHeader}>
          <span>Спектр решений Softmax (P)</span>
          <span>Utility Score</span>
        </div>

        {ALL_INTENT_KEYS.map((key) => {
          const cfg = INTENT_CONFIG[key] || { icon: '•', shortLabel: key, color: '#94a3b8' };
          const p = probs[key] !== undefined ? probs[key] : 0.0;
          const pPercent = Math.min(100, Math.max(0, p * 100));
          const s = scores[key] !== undefined ? scores[key] : 0.0;
          const isActive = key === activeIntentKey;

          return (
            <div
              key={key}
              className={`${styles.intentRow} ${isActive ? styles.intentRowActive : ''}`}
              title={`${cfg.label} | Вероятность: ${(p * 100).toFixed(1)}% | Балл Utility: ${s.toFixed(2)}`}
            >
              <div className={styles.intentMeta}>
                <span className={styles.intentLabel}>
                  <span>{cfg.icon}</span>
                  <span style={{ color: isActive ? cfg.color : '#cbd5e1' }}>
                    {cfg.shortLabel}
                  </span>
                  {isActive && (
                    <span style={{
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: cfg.color,
                      color: '#000',
                      marginLeft: '4px'
                    }}>
                      ВЫБРАНО
                    </span>
                  )}
                </span>

                <div className={styles.intentNumbers}>
                  <span className={styles.intentScore}>
                    [{s >= 0 ? `+${s.toFixed(2)}` : s.toFixed(2)}]
                  </span>
                  <span className={styles.intentPercent} style={{ color: isActive ? cfg.color : '#94a3b8' }}>
                    {pPercent.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className={styles.track}>
                <div
                  className={styles.fill}
                  style={{
                    width: `${pPercent}%`,
                    backgroundColor: isActive ? cfg.color : `${cfg.color}55`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Accordion: 6 Core Decision-Making Genes */}
      <button
        className={styles.genomeToggleBtn}
        onClick={() => setShowGenomeDrivers(!showGenomeDrivers)}
        title="Показать гены, настраивающие веса формул полезности (utility) в EDM"
      >
        <span>🧬 Веса генома EDM ({showGenomeDrivers ? 'свернуть' : 'развернуть'})</span>
        <span>{showGenomeDrivers ? '▲' : '▼'}</span>
      </button>

      {showGenomeDrivers && (
        <div className={styles.genomeDriversGrid}>
          <div className={styles.geneMiniCard} title="w_aggression: −1 (пацифист/страх) ↔ +1 (агрессор)">
            <span className={styles.geneMiniLabel}>w_aggression</span>
            <span className={styles.geneMiniVal} style={{ color: genome.w_aggression >= 0 ? '#ff4757' : '#00d2d3' }}>
              {genome.w_aggression >= 0 ? `+${genome.w_aggression.toFixed(3)}` : genome.w_aggression.toFixed(3)}
            </span>
          </div>

          <div className={styles.geneMiniCard} title="w_carnivore: 0 (фотосинтез) ↔ 1 (хищник)">
            <span className={styles.geneMiniLabel}>w_carnivore</span>
            <span className={styles.geneMiniVal} style={{ color: genome.w_carnivore >= 0.4 ? '#ff4757' : '#2ed573' }}>
              {genome.w_carnivore.toFixed(3)}
            </span>
          </div>

          <div className={styles.geneMiniCard} title="w_social: −1 (одиночка) ↔ +1 (альтруист/стая)">
            <span className={styles.geneMiniLabel}>w_social</span>
            <span className={styles.geneMiniVal} style={{ color: genome.w_social >= 0 ? '#00d2d3' : '#a4b0be' }}>
              {genome.w_social >= 0 ? `+${genome.w_social.toFixed(3)}` : genome.w_social.toFixed(3)}
            </span>
          </div>

          <div className={styles.geneMiniCard} title="w_explore: 0 (домосед) ↔ 1 (исследователь)">
            <span className={styles.geneMiniLabel}>w_explore</span>
            <span className={styles.geneMiniVal} style={{ color: '#70a1ff' }}>
              {genome.w_explore.toFixed(3)}
            </span>
          </div>

          <div className={styles.geneMiniCard} title="w_territorial: −1 (кочевник) ↔ +1 (страж оазиса)">
            <span className={styles.geneMiniLabel}>w_territorial</span>
            <span className={styles.geneMiniVal} style={{ color: genome.w_territorial >= 0 ? '#e056fd' : '#ffa502' }}>
              {genome.w_territorial >= 0 ? `+${genome.w_territorial.toFixed(3)}` : genome.w_territorial.toFixed(3)}
            </span>
          </div>

          <div className={styles.geneMiniCard} title="w_temp: термоадаптация к зонам Меркурия">
            <span className={styles.geneMiniLabel}>w_temp</span>
            <span className={styles.geneMiniVal} style={{ color: genome.w_temp < 0 ? '#00e5ff' : '#ffa502' }}>
              {genome.w_temp >= 0 ? `+${genome.w_temp.toFixed(3)}` : genome.w_temp.toFixed(3)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
