import { useState, useEffect, useRef } from 'react';
import styles from './Randomizer.module.css';

export default function Randomizer({ isOpen, onClose, metrics }) {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('disasterRandomizerConfigV3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Никогда не запускать автоматически при загрузке страницы
        return { ...parsed, enabled: false };
      } catch (e) {
        // default
      }
    }
    return {
      enabled: false,
      disasters: {
        meteorite: { enabled: true, intervalTicks: 50 },
        wind: { enabled: true, intervalTicks: 100 },
        rocks: { enabled: false, intervalTicks: 150 },
      }
    };
  });

  const nextTicksRef = useRef({
    meteorite: null,
    wind: null,
    rocks: null
  });

  useEffect(() => {
    localStorage.setItem('disasterRandomizerConfigV3', JSON.stringify(config));
  }, [config]);

  // Stop if everyone dies
  useEffect(() => {
    if (config.enabled && metrics?.tick > 0 && metrics?.aliveCount === 0) {
      setConfig(prev => ({ ...prev, enabled: false }));
    }
  }, [metrics?.aliveCount, metrics?.tick, config.enabled]);

  // Disaster Dispatch Loop based on Ticks
  useEffect(() => {
    if (!config.enabled || !metrics?.tick) return;

    const currentTick = metrics.tick;

    Object.keys(config.disasters).forEach(disasterType => {
      const currentConfig = config.disasters[disasterType];
      
      if (!currentConfig.enabled) {
        nextTicksRef.current[disasterType] = null;
        return;
      }

      if (nextTicksRef.current[disasterType] === null || nextTicksRef.current[disasterType] < currentTick) {
        nextTicksRef.current[disasterType] = currentTick + currentConfig.intervalTicks;
      } else if (currentTick >= nextTicksRef.current[disasterType]) {
        // Random coordinates (assuming 60x30 grid as default)
        const x = Math.floor(Math.random() * 60);
        const y = Math.floor(Math.random() * 30);
        
        // Randomize params based on disaster
        let params = {};
        if (disasterType === 'meteorite') {
          params = { radius: 2 + Math.random() * 4, damage: 100 + Math.random() * 400 };
        } else if (disasterType === 'wind') {
          params = { strength: 4 + Math.random() * 6 };
        } else if (disasterType === 'rocks') {
          params = { size: 1 + Math.floor(Math.random() * 4) };
        }

        const event = new CustomEvent('autoDisaster', {
          detail: { type: disasterType, x, y, params }
        });
        window.dispatchEvent(event);

        nextTicksRef.current[disasterType] = currentTick + currentConfig.intervalTicks;
      }
    });

  }, [metrics?.tick, config.enabled, config.disasters]);

  const handleToggleDisaster = (key) => {
    setConfig(prev => ({
      ...prev,
      disasters: {
        ...prev.disasters,
        [key]: {
          ...prev.disasters[key],
          enabled: !prev.disasters[key].enabled
        }
      }
    }));
  };

  const handleIntervalChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      disasters: {
        ...prev.disasters,
        [key]: {
          ...prev.disasters[key],
          intervalTicks: parseInt(value) || 1
        }
      }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className={styles.randomizerOverlay} onClick={onClose}>
      <div className={styles.randomizerModal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Авто-катастрофы</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.checkboxGroup}>
          
          <div className={styles.disasterRow}>
            <label className={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={config.disasters.meteorite.enabled} 
                onChange={() => handleToggleDisaster('meteorite')} 
              />
              Метеориты
            </label>
            <div className={styles.intervalControl}>
              <span>{config.disasters.meteorite.intervalTicks} тиков</span>
              <input 
                type="range" 
                min="10" 
                max="1000" 
                value={config.disasters.meteorite.intervalTicks}
                onChange={(e) => handleIntervalChange('meteorite', e.target.value)}
                className={styles.sliderSmall}
              />
            </div>
          </div>

          <div className={styles.disasterRow}>
            <label className={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={config.disasters.wind.enabled} 
                onChange={() => handleToggleDisaster('wind')} 
              />
              Ветер
            </label>
            <div className={styles.intervalControl}>
              <span>{config.disasters.wind.intervalTicks} тиков</span>
              <input 
                type="range" 
                min="10" 
                max="1000" 
                value={config.disasters.wind.intervalTicks}
                onChange={(e) => handleIntervalChange('wind', e.target.value)}
                className={styles.sliderSmall}
              />
            </div>
          </div>

          <div className={styles.disasterRow}>
            <label className={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={config.disasters.rocks.enabled} 
                onChange={() => handleToggleDisaster('rocks')} 
              />
              Скалы
            </label>
            <div className={styles.intervalControl}>
              <span>{config.disasters.rocks.intervalTicks} тиков</span>
              <input 
                type="range" 
                min="10" 
                max="1000" 
                value={config.disasters.rocks.intervalTicks}
                onChange={(e) => handleIntervalChange('rocks', e.target.value)}
                className={styles.sliderSmall}
              />
            </div>
          </div>

        </div>

        <button 
          className={`${styles.spinBtn} ${config.enabled ? styles.btnActive : ''}`} 
          onClick={() => setConfig({ ...config, enabled: !config.enabled })}
          style={{ background: config.enabled ? '#ff4a4a' : 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)' }}
        >
          {config.enabled ? 'Остановить все' : 'Запустить все'}
        </button>
      </div>
    </div>
  );
}
