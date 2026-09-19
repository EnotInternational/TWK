import { useState, useEffect, useMemo } from 'react';
import styles from './RightSidebar.module.css';
import { socket } from '../../api';

export default function RightSidebar({ isOpen, agent, onToggle }) {
  const [agentsList, setAgentsList] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });

  useEffect(() => {
    if (!isOpen || agent) return; // Only fetch if we are showing the table
    
    let lastUpdate = 0;
    const handleTick = (data) => {
      const now = Date.now();
      if (now - lastUpdate > 1000) { // Throttle update to 1 per sec max
        setAgentsList(data.agents || []);
        lastUpdate = now;
      }
    };
    
    socket.on('simulation:tick', handleTick);
    socket.emit('request_field'); // Immediate fetch
    
    return () => socket.off('simulation:tick', handleTick);
  }, [isOpen, agent]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAgents = useMemo(() => {
    let sortableItems = [...agentsList];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [agentsList, sortConfig]);

  if (!agent && isOpen) {
    return (
      <>
        <aside 
        className={styles.rightSidebar}
        style={{ 
          marginRight: isOpen ? '0' : '-320px',
          opacity: isOpen ? 1 : 0
        }}
      >
          <div className={styles.tableContainer}>
             <h3>Все агенты ({agentsList.length})</h3>
             <div className={styles.tableScroll}>
               <table className={styles.agentsTable}>
                 <thead>
                   <tr>
                     <th onClick={() => requestSort('id')}>ID {sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                     <th onClick={() => requestSort('age')}>Возр. {sortConfig.key === 'age' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                     <th onClick={() => requestSort('energy')}>Энергия {sortConfig.key === 'energy' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                     <th onClick={() => requestSort('generation')}>Пок. {sortConfig.key === 'generation' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                   </tr>
                 </thead>
                 <tbody>
                   {sortedAgents.length > 0 ? sortedAgents.map(a => (
                     <tr key={a.id}>
                       <td>{a.id}</td>
                       <td>{a.age}</td>
                       <td style={{ color: a.energy > 120 ? '#00ff88' : a.energy < 60 ? '#ff3344' : '#ffd000' }}>
                         {a.energy ? a.energy.toFixed(1) : '0'}
                       </td>
                       <td>{a.generation}</td>
                     </tr>
                   )) : (
                     <tr>
                       <td colSpan="4" style={{textAlign: 'center', padding: '15px'}}>Нет данных</td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
          </div>
        </aside>
        <button 
          className={styles.rightToggleBtn} 
          style={{ right: isOpen ? '340px' : '20px' }}
          onClick={onToggle}
        >
          Закрыть
        </button>
      </>
    );
  }

  return (
    <>
      <aside 
        className={styles.rightSidebar}
        style={{ 
          marginRight: isOpen ? '0' : '-320px',
          opacity: isOpen ? 1 : 0
        }}
      >
        <h2>Данные агента</h2>
        <div className={styles.agentCard}>
          <div className={styles.dataRow}>
            <span>ID:</span>
            <strong>{agent?.id || '—'}</strong>
          </div>
          <div className={styles.dataRow}>
            <span>Координаты:</span>
            <strong>X: {agent?.x || 0}, Y: {agent?.y || 0}</strong>
          </div>
          <div className={styles.dataRow}>
            <span>Энергия:</span>
            <strong style={{ color: agent?.energy > 120 ? '#00ff88' : agent?.energy < 60 ? '#ff3344' : '#ffd000' }}>
              {agent?.energy ? agent.energy.toFixed(1) : '0.0'}
            </strong>
          </div>
          <div className={styles.dataRow}>
            <span>Возраст:</span>
            <strong>{agent?.age || 0} тиков</strong>
          </div>
          <div className={styles.dataRow}>
            <span>Поколение:</span>
            <strong>{agent?.generation || 0}</strong>
          </div>
          <div className={styles.dataRow}>
            <span>Предок:</span>
            <strong>{agent?.parent_id || 'Первичное'}</strong>
          </div>
          <div className={styles.dataRow}>
            <span>Темп. зона:</span>
            <strong style={{textTransform: 'capitalize'}}>{agent?.zone || 'unknown'}</strong>
          </div>
          
          {agent?.death_reason && (
            <div className={`${styles.dataRow} ${styles.deadRow}`}>
              <span>Причина смерти:</span>
              <strong>{agent.death_reason}</strong>
            </div>
          )}
        </div>
      </aside>
      
      <button 
        className={styles.rightToggleBtn} 
        style={{ right: isOpen ? '340px' : '20px' }}
        onClick={onToggle}
      >
        {isOpen ? 'Закрыть' : 'Агент'}
      </button>
    </>
  );
}