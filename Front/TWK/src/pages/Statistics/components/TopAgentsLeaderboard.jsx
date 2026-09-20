import { useState, useMemo } from 'react';
import styles from './TopAgentsLeaderboard.module.css';

export default function TopAgentsLeaderboard({ agents = [] }) {
  const [sortBy, setSortBy] = useState('age'); // 'age' | 'energy' | 'generation'

  const sortedList = useMemo(() => {
    return [...agents].sort((a, b) => {
      const valA = a[sortBy] ?? 0;
      const valB = b[sortBy] ?? 0;
      return valB - valA;
    });
  }, [agents, sortBy]);

  const getZoneClass = (zone) => {
    const z = (zone || '').toLowerCase();
    if (z.includes('hot') || z.includes('sun')) return styles.zoneHot;
    if (z.includes('cold') || z.includes('night')) return styles.zoneCold;
    return styles.zoneTerm;
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>Топ-10 агентов-долгожителей</h4>
        <div className={styles.sortTabs}>
          <button 
            className={`${styles.sortBtn} ${sortBy === 'age' ? styles.active : ''}`}
            onClick={() => setSortBy('age')}
          >
            По возрасту
          </button>
          <button 
            className={`${styles.sortBtn} ${sortBy === 'energy' ? styles.active : ''}`}
            onClick={() => setSortBy('energy')}
          >
            По энергии
          </button>
          <button 
            className={`${styles.sortBtn} ${sortBy === 'generation' ? styles.active : ''}`}
            onClick={() => setSortBy('generation')}
          >
            По поколению
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>№</th>
              <th>ID агента</th>
              <th>Возраст (тики)</th>
              <th>Энергия</th>
              <th>Поколение</th>
              <th>Зона</th>
              <th>Предок (Parent ID)</th>
            </tr>
          </thead>
          <tbody>
            {sortedList.length > 0 ? (
              sortedList.map((agent, index) => (
                <tr key={agent.id || index}>
                  <td style={{ color: '#64748b' }}>
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td style={{ color: '#38bdf8', fontWeight: 600 }}>
                    {agent.id}
                  </td>
                  <td>
                    <strong style={{ color: '#f1f5f9' }}>{agent.age || 0}</strong>
                  </td>
                  <td style={{ 
                    color: (agent.energy || 0) >= 120 ? '#10b981' : (agent.energy || 0) < 60 ? '#ef4444' : '#f59e0b',
                    fontWeight: 'bold'
                  }}>
                    {typeof agent.energy === 'number' ? agent.energy.toFixed(1) : agent.energy}
                  </td>
                  <td>
                    <span className={styles.badgeGen}>G{agent.generation || 0}</span>
                  </td>
                  <td>
                    <span className={`${styles.zoneTag} ${getZoneClass(agent.zone)}`}>
                      {agent.zone || 'terminator'}
                    </span>
                  </td>
                  <td style={{ color: '#64748b' }}>
                    {agent.parent_id || 'Root_0'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '24px' }}>
                  [ Нет живых агентов ]
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
