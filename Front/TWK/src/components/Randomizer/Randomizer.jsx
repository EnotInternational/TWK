import { useState, useEffect, useRef } from 'react';
import styles from './Randomizer.module.css';

export default function Randomizer({ isOpen, onClose, metrics }) {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('disasterRandomizerConfigV2');
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
        meteorite: { enabled: true, intervalSec: 5 },
        wind: { enabled: true, intervalSec: 10 },
        rocks: { enabled: false, intervalSec: 15 },
      }
    };
  });

  const configRef = useRef(config);
  const timersRef = useRef([]);

  useEffect(() => {
    configRef.current = config;
    localStorage.setItem('disasterRandomizerConfigV2', JSON.stringify(config));
  }, [config]);

  // Stop if everyone dies
  useEffect(() => {
    if (config.enabled && metrics?.tick > 0 && metrics?.aliveCount === 0) {
      setConfig(prev => ({ ...prev, enabled: false }));
    }
  }, [metrics?.aliveCount, metrics?.tick, config.enabled]);

  // Disaster Dispatch Loop
  useEffect(() => {
    // Clear any existing timers
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];

    if (!config.enabled) return;

    const startLoop = (disasterType) => {
      const currentConfig = configRef.current.disasters[disasterType];
      
      // We only fire if the main toggle is still enabled and this specific disaster is enabled
      if (!configRef.current.enabled || !currentConfig.enabled) return;

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

      // Schedule next trigger for THIS disaster
      const newConfig = configRef.current.disasters[disasterType];
      if (configRef.current.enabled && newConfig.enabled) {
        const t = setTimeout(() => startLoop(disasterType), newConfig.intervalSec * 1000);
        timersRef.current.push(t);
      }
    };

    // Start initial timers for each enabled disaster (short initial delay for immediate feedback)
    Object.keys(config.disasters).forEach(key => {
      if (config.disasters[key].enabled) {
        const initialDelay = Math.min(1500, config.disasters[key].intervalSec * 1000);
        const t = setTimeout(() => startLoop(key), initialDelay);
        timersRef.current.push(t);
      }
    });

    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
    };
  }, [config.enabled, config.disasters]); // Restart timers when any interval or enable toggle changes

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
          intervalSec: parseInt(value) || 1
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
              <span>{config.disasters.meteorite.intervalSec} сек</span>
              <input 
                type="range" 
                min="1" 
                max="60" 
                value={config.disasters.meteorite.intervalSec}
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
              <span>{config.disasters.wind.intervalSec} сек</span>
              <input 
                type="range" 
                min="1" 
                max="60" 
                value={config.disasters.wind.intervalSec}
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
              <span>{config.disasters.rocks.intervalSec} сек</span>
              <input 
                type="range" 
                min="1" 
                max="60" 
                value={config.disasters.rocks.intervalSec}
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
