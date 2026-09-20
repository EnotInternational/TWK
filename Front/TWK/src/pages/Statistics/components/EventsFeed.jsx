import { useState } from 'react';
import styles from './EventsFeed.module.css';

export default function EventsFeed({ events = [] }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'birth' | 'death' | 'disaster'

  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true;
    return e.type === filter;
  });

  const getEventClass = (type) => {
    switch (type) {
      case 'birth': return styles.eventBirth;
      case 'death': return styles.eventDeath;
      case 'disaster': return styles.eventDisaster;
      case 'evolution': return styles.eventEvolution;
      default: return '';
    }
  };

  const getTagLabel = (type) => {
    switch (type) {
      case 'birth': return '[РОЖДЕНИЕ]';
      case 'death': return '[ГИБЕЛЬ]';
      case 'disaster': return '[СРЕДА]';
      case 'evolution': return '[МУТАЦИЯ]';
      default: return '[СИСТЕМА]';
    }
  };

  const getTagColor = (type) => {
    switch (type) {
      case 'birth': return '#10b981';
      case 'death': return '#ef4444';
      case 'disaster': return '#f59e0b';
      case 'evolution': return '#a78bfa';
      default: return '#38bdf8';
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>Лента событий</h4>
        <div className={styles.filterChips}>
          <button 
            className={`${styles.chip} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            Все
          </button>
          <button 
            className={`${styles.chip} ${filter === 'birth' ? styles.active : ''}`}
            onClick={() => setFilter('birth')}
          >
            Рождения
          </button>
          <button 
            className={`${styles.chip} ${filter === 'death' ? styles.active : ''}`}
            onClick={() => setFilter('death')}
          >
            Гибель
          </button>
          <button 
            className={`${styles.chip} ${filter === 'disaster' ? styles.active : ''}`}
            onClick={() => setFilter('disaster')}
          >
            Среда
          </button>
        </div>
      </div>

      <div className={styles.eventsList}>
        {filteredEvents.length > 0 ? (
          filteredEvents.map((ev, idx) => (
            <div key={ev.id || idx} className={`${styles.eventItem} ${getEventClass(ev.type)}`}>
              <span className={styles.tagLabel} style={{ color: getTagColor(ev.type) }}>
                {getTagLabel(ev.type)}
              </span>
              <span className={styles.eventText}>
                {ev.text || ev.message || JSON.stringify(ev)}
              </span>
              <span className={styles.eventMeta}>
                Тик {ev.tick ?? '—'}
              </span>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '24px', fontSize: '0.72rem', fontFamily: 'Courier New, monospace' }}>
            [ Пока событий не произошло ]
          </div>
        )}
      </div>
    </div>
  );
}
