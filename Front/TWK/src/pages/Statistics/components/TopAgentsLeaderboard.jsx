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
        <h4 className={styles.title}>🏆 Зал славы: Топ выживших агентов</h4>
        <div className={styles.sortTabs}>
          <button 
            className={`${styles.sortBtn} ${sortBy === 'age' ? styles.active : ''}`}
            onClick={() => setSortBy('age')}
          >
            По возрасту (тики)
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
            Поколение
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Agent ID</th>
              <th>Возраст</th>
              <th>Энергия</th>
              <th>Поколение</th>
              <th>Зона</th>
              <th>Предок</th>
            </tr>
          </thead>
          <tbody>
            {sortedList.length > 0 ? (
              sortedList.map((agent, index) => (
                <tr key={agent.id || index}>
                  <td style={{ color: index < 3 ? '#ffd000' : '#718096', fontWeight: 'bold' }}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#00e5ff', fontWeight: 600 }}>
                    {agent.id}
                  </td>
                  <td>
                    <strong style={{ color: '#fff' }}>{agent.age || 0}</strong>{' '}
                    <span style={{ color: '#718096', fontSize: '0.7rem' }}>тиков</span>
                  </td>
                  <td style={{ 
                    color: (agent.energy || 0) > 120 ? '#00ff88' : (agent.energy || 0) < 60 ? '#ff3344' : '#ffd000',
                    fontFamily: 'monospace',
                    fontWeight: 'bold'
                  }}>
                    {typeof agent.energy === 'number' ? agent.energy.toFixed(1) : agent.energy}
                  </td>
                  <td>
                    <span className={styles.badgeGen}>Gen {agent.generation || 0}</span>
                  </td>
                  <td>
                    <span className={`${styles.zoneTag} ${getZoneClass(agent.zone)}`}>
                      {agent.zone || 'terminator'}
                    </span>
                  </td>
                  <td style={{ color: '#a0aec0', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {agent.parent_id || 'Первичное'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#718096', padding: '20px' }}>
                  Нет данных об агентах
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
