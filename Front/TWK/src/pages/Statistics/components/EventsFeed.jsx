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

  const getEventIcon = (type) => {
    switch (type) {
      case 'birth': return '🐣';
      case 'death': return '💀';
      case 'disaster': return '⚡';
      case 'evolution': return '🧬';
      default: return '📡';
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>📜 Хроника событий</h4>
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
            🐣 Рождения
          </button>
          <button 
            className={`${styles.chip} ${filter === 'death' ? styles.active : ''}`}
            onClick={() => setFilter('death')}
          >
            💀 Гибель
          </button>
          <button 
            className={`${styles.chip} ${filter === 'disaster' ? styles.active : ''}`}
            onClick={() => setFilter('disaster')}
          >
            ⚡ Аномалии
          </button>
        </div>
      </div>

      <div className={styles.eventsList}>
        {filteredEvents.length > 0 ? (
          filteredEvents.map((ev, idx) => (
            <div key={ev.id || idx} className={`${styles.eventItem} ${getEventClass(ev.type)}`}>
              <span className={styles.eventIcon}>{getEventIcon(ev.type)}</span>
              <div className={styles.eventContent}>
                <span className={styles.eventText}>{ev.text || ev.message || JSON.stringify(ev)}</span>
                <div className={styles.eventMeta}>
                  <span className={styles.tickBadge}>Тик #{ev.tick ?? '—'}</span>
                  <span>{ev.time || 'недавно'}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: '#718096', padding: '20px', fontSize: '0.8rem' }}>
            Нет событий по заданному фильтру
          </div>
        )}
      </div>
    </div>
  );
}
